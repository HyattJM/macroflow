import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '@react-navigation/native';

export default function CookbookScreen() {
  const { colors, dark } = useTheme();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [groceryData, setGroceryData] = useState(null);
  const [showGroceryModal, setShowGroceryModal] = useState(false);
  
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchRecipes();
      // Optionally reset selections when revisiting the tab
      // setSelectedRecipeIds([]); 
    }, [])
  );

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/saved-recipes/');
      if (response.data.status === 'success') {
        setSavedRecipes(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipeSelection = (id) => {
    setSelectedRecipeIds(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const handleGenerateList = async () => {
    setIsGenerating(true);
    try {
      const response = await apiClient.post('/generate-grocery-list/', { recipe_ids: selectedRecipeIds });
      if (response.data.status === 'success') {
        setGroceryData(response.data.data.categories);
        setShowGroceryModal(true);
      } else {
        Alert.alert('Error', 'Failed to generate grocery list.');
      }
    } catch (error) {
      console.error("Grocery Generation Error:", error);
      if (error?.response?.status === 429) {
        Alert.alert('Capacity Reached', error.response.data.error || 'AI servers are currently at capacity. Please try again later.');
      } else if (error?.response?.data?.error) {
        Alert.alert('AI Chef Error', error.response.data.error);
      } else {
        Alert.alert('Connection Error', 'Could not reach the AI Chef. Please check your internet connection.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerContainer, { backgroundColor: dark ? '#000' : colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.header, { color: colors.text }]}>Cookbook</Text>
        <Text style={[styles.subtitle, { color: dark ? '#aaa' : '#666' }]}>Your saved repertoire of Keto recipes.</Text>
      </View>

      {loading && savedRecipes.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF2D55" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {savedRecipes.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="book-outline" size={60} color={dark ? '#333' : '#ccc'} style={{marginBottom: 20}} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No recipes saved yet.</Text>
              <Text style={[styles.emptySubText, { color: dark ? '#aaa' : '#666' }]}>Visit the AI Chef to stock your cookbook!</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {savedRecipes.map((recipe) => {
                const isSelected = selectedRecipeIds.includes(recipe.id);
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[
                      styles.recipeCard, 
                      { backgroundColor: colors.card, borderColor: isSelected ? '#FF2D55' : 'transparent' },
                      isSelected && styles.recipeCardSelected
                    ]}
                    onPress={() => {
                      setSelectedRecipe(recipe);
                      setModalVisible(true);
                    }}
                    onLongPress={() => toggleRecipeSelection(recipe.id)}
                    activeOpacity={0.9}
                  >
                    <TouchableOpacity 
                      style={[styles.checkBadgeToggle, { backgroundColor: isSelected ? '#FF2D55' : 'rgba(255,255,255,0.1)' }]}
                      onPress={() => toggleRecipeSelection(recipe.id)}
                    >
                      <Ionicons 
                        name={isSelected ? "checkmark" : "add"} 
                        size={20} 
                        color="#fff" 
                      />
                    </TouchableOpacity>

                    <Text style={[styles.recipeTitle, { color: colors.text }]}>{recipe.title}</Text>
                    <View style={styles.macroRow}>
                      <View style={[styles.macroPill, { backgroundColor: dark ? '#000' : '#f0f0f0', borderColor: colors.border }]}>
                        <Text style={[styles.macroText, { color: dark ? '#ddd' : '#444' }]}>🔥 {recipe.calories} kcal</Text>
                      </View>
                      <View style={[styles.macroPill, { backgroundColor: dark ? '#000' : '#f0f0f0', borderColor: colors.border }]}>
                        <Text style={[styles.macroText, { color: dark ? '#ddd' : '#444' }]}>🥑 {recipe.net_carbs}g Net Carbs</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {selectedRecipeIds.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.fab} onPress={handleGenerateList} disabled={isGenerating}>
            {isGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.fabText}>Generate Grocery List ({selectedRecipeIds.length})</Text>
                <Ionicons name="cart-outline" size={24} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Grocery List Modal */}
      <Modal 
        visible={showGroceryModal} 
        animationType="slide" 
        presentationStyle="pageSheet" 
        onRequestClose={() => setShowGroceryModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Grocery List</Text>
            <TouchableOpacity onPress={() => setShowGroceryModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {groceryData?.map((category, index) => (
              <View key={index} style={[styles.categoryContainer, { backgroundColor: colors.card }]}>
                <Text style={styles.categoryTitle}>{category.name}</Text>
                {category.items.map((item, iIndex) => (
                  <View key={iIndex} style={styles.itemRow}>
                    <Ionicons name="ellipse" size={8} color="#FF2D55" style={{marginTop: 6}} />
                    <Text style={[styles.itemText, { color: dark ? '#ddd' : '#444' }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: dark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.modalIndicator} />
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
              <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedRecipe?.title}</Text>
              
              <View style={styles.detailMacroRow}>
                <View style={styles.detailMacroBox}>
                  <Text style={styles.detailMacroLabel}>Calories</Text>
                  <Text style={[styles.detailMacroValue, { color: colors.text }]}>{selectedRecipe?.calories}</Text>
                </View>
                <View style={styles.detailMacroBox}>
                  <Text style={styles.detailMacroLabel}>Protein</Text>
                  <Text style={[styles.detailMacroValue, { color: colors.text }]}>{selectedRecipe?.protein}g</Text>
                </View>
                <View style={styles.detailMacroBox}>
                  <Text style={styles.detailMacroLabel}>Fat</Text>
                  <Text style={[styles.detailMacroValue, { color: colors.text }]}>{selectedRecipe?.fat}g</Text>
                </View>
                <View style={styles.detailMacroBox}>
                  <Text style={styles.detailMacroLabel}>Net Carbs</Text>
                  <Text style={[styles.detailMacroValue, { color: colors.text }]}>{selectedRecipe?.net_carbs}g</Text>
                </View>
              </View>

              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

              <Text style={styles.detailSectionTitle}>Ingredients</Text>
              {selectedRecipe?.ingredients?.map((item, index) => (
                <Text key={index} style={[styles.detailListItem, { color: dark ? '#ddd' : '#444' }]}>• {item}</Text>
              ))}

              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

              <Text style={styles.detailSectionTitle}>Instructions</Text>
              {selectedRecipe?.instructions?.map((step, index) => (
                <View key={index} style={styles.detailStepContainer}>
                  <View style={styles.detailStepNumberContainer}>
                    <Text style={styles.detailStepNumber}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.detailStepText, { color: dark ? '#ddd' : '#444' }]}>{step}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.detailCloseButton} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.detailCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  header: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 15,
    paddingBottom: 120, // Space for FAB
  },
  grid: {
    gap: 15,
  },
  recipeCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  recipeCardSelected: {
    borderColor: '#FF2D55',
    backgroundColor: '#2A181D',
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    paddingRight: 30, // Make room for checkmark if selected
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroPill: {
    backgroundColor: '#000',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  macroText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  checkBadgeToggle: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 32,
    height: 32,
    borderRadius: 16,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  fab: {
    backgroundColor: '#FF2D55',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  fabText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#111',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  categoryContainer: {
    marginBottom: 25,
    backgroundColor: '#1C1C1E',
    padding: 15,
    borderRadius: 16,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF2D55',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  itemText: {
    color: '#ddd',
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingTop: 12,
    height: '90%',
  },
  modalIndicator: {
    width: 40,
    height: 5,
    backgroundColor: '#333',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  detailScrollContent: {
    paddingBottom: 40,
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  detailMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailMacroBox: {
    alignItems: 'center',
  },
  detailMacroLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailMacroValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailDivider: {
    height: 1,
    marginVertical: 25,
  },
  detailSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF2D55',
    marginBottom: 15,
  },
  detailListItem: {
    fontSize: 16,
    marginBottom: 10,
    lineHeight: 24,
  },
  detailStepContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  detailStepNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailStepNumber: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailStepText: {
    fontSize: 16,
    flex: 1,
    lineHeight: 24,
  },
  detailCloseButton: {
    backgroundColor: '#FF2D55',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  detailCloseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
