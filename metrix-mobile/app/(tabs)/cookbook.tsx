import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/apiClient';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function CookbookScreen() {
  const { currentThemeColors, typography, layout } = useAppTheme();
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
    <View style={[styles.container, { backgroundColor: currentThemeColors.background }]}>
      <View style={[styles.headerContainer, { backgroundColor: currentThemeColors.surface, borderBottomColor: currentThemeColors.border || currentThemeColors.surface }]}>
        <Text style={[styles.header, { color: currentThemeColors.text }]}>Cookbook</Text>
        <Text style={[styles.subtitle, { color: currentThemeColors.textSecondary }]}>Your saved repertoire of Keto recipes.</Text>
      </View>

      {loading && savedRecipes.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={currentThemeColors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {savedRecipes.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="book-outline" size={60} color={currentThemeColors.textSecondary} style={{marginBottom: 20}} />
              <Text style={[styles.emptyText, { color: currentThemeColors.text }]}>No recipes saved yet.</Text>
              <Text style={[styles.emptySubText, { color: currentThemeColors.textSecondary }]}>Visit the AI Chef to stock your cookbook!</Text>
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
                      { 
                        backgroundColor: currentThemeColors.card, 
                        borderColor: isSelected ? currentThemeColors.primary : currentThemeColors.border,
                        ...layout.shadows.md 
                      }
                    ]}
                    onPress={() => {
                      setSelectedRecipe(recipe);
                      setModalVisible(true);
                    }}
                    onLongPress={() => toggleRecipeSelection(recipe.id)}
                    activeOpacity={0.9}
                  >
                    <TouchableOpacity 
                      style={[
                        styles.checkBadgeToggle, 
                        { 
                          backgroundColor: isSelected ? currentThemeColors.primary : currentThemeColors.surface,
                          borderColor: isSelected ? currentThemeColors.primary : currentThemeColors.border
                        }
                      ]}
                      onPress={() => toggleRecipeSelection(recipe.id)}
                    >
                      <Ionicons 
                         name={isSelected ? "checkmark" : "add"} 
                         size={20} 
                         color={isSelected ? '#fff' : currentThemeColors.primary} 
                       />
                    </TouchableOpacity>

                    <Text style={[styles.recipeTitle, { color: currentThemeColors.text }]}>{recipe.title}</Text>
                    <View style={styles.macroRow}>
                      <View style={[styles.macroPill, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]}>
                        <Text style={[styles.macroText, { color: currentThemeColors.textSecondary }]}>🔥 {recipe.calories} kcal</Text>
                      </View>
                      <View style={[styles.macroPill, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]}>
                        <Text style={[styles.macroText, { color: currentThemeColors.textSecondary }]}>🥑 {recipe.net_carbs}g Net Carbs</Text>
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
          <TouchableOpacity style={[styles.fab, { backgroundColor: currentThemeColors.primary, shadowColor: currentThemeColors.primary, ...layout.shadows.lg }]} onPress={handleGenerateList} disabled={isGenerating}>
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

      <Modal 
        visible={showGroceryModal} 
        animationType="slide" 
        presentationStyle="pageSheet" 
        onRequestClose={() => setShowGroceryModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: currentThemeColors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: currentThemeColors.surface, borderBottomColor: currentThemeColors.border || currentThemeColors.surface }]}>
            <Text style={[styles.modalTitle, { color: currentThemeColors.text }]}>Grocery List</Text>
            <TouchableOpacity onPress={() => setShowGroceryModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={currentThemeColors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {groceryData?.map((category, index) => (
              <View key={index} style={[styles.categoryContainer, { backgroundColor: currentThemeColors.surface }]}>
                <Text style={[styles.categoryTitle, { color: currentThemeColors.primary }]}>{category.name}</Text>
                {category.items.map((item, iIndex) => (
                  <View key={iIndex} style={styles.itemRow}>
                    <Ionicons name="ellipse" size={8} color={currentThemeColors.primary} style={{marginTop: 6}} />
                    <Text style={[styles.itemText, { color: currentThemeColors.textSecondary }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalContent, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, borderWidth: 1 }]}>
            <View style={[styles.modalIndicator, { backgroundColor: currentThemeColors.border }]} />
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
              <Text style={[styles.detailTitle, { color: currentThemeColors.text }]}>{selectedRecipe?.title}</Text>
              
              <View style={styles.detailMacroRow}>
                <View style={styles.detailMacroBox}>
                  <Text style={[styles.detailMacroLabel, { color: currentThemeColors.textSecondary }]}>Calories</Text>
                  <Text style={[styles.detailMacroValue, { color: currentThemeColors.text }]}>{selectedRecipe?.calories}</Text>
                </View>
                <View style={styles.detailMacroBox}>
                  <Text style={[styles.detailMacroLabel, { color: currentThemeColors.textSecondary }]}>Protein</Text>
                  <Text style={[styles.detailMacroValue, { color: currentThemeColors.warning }]}>{selectedRecipe?.protein}g</Text>
                </View>
                <View style={styles.detailMacroBox}>
                  <Text style={[styles.detailMacroLabel, { color: currentThemeColors.textSecondary }]}>Fat</Text>
                  <Text style={[styles.detailMacroValue, { color: currentThemeColors.primary }]}>{selectedRecipe?.fat}g</Text>
                </View>
                <View style={styles.detailMacroBox}>
                  <Text style={[styles.detailMacroLabel, { color: currentThemeColors.textSecondary }]}>Net Carbs</Text>
                  <Text style={[styles.detailMacroValue, { color: currentThemeColors.info }]}>{selectedRecipe?.net_carbs}g</Text>
                </View>
              </View>

              <View style={[styles.detailDivider, { backgroundColor: currentThemeColors.border }]} />

              <Text style={[styles.detailSectionTitle, { color: currentThemeColors.primary }]}>Ingredients</Text>
              {selectedRecipe?.ingredients?.map((item, index) => (
                <Text key={index} style={[styles.detailListItem, { color: currentThemeColors.textSecondary }]}>• {item}</Text>
              ))}

              <View style={[styles.detailDivider, { backgroundColor: currentThemeColors.border }]} />

              <Text style={[styles.detailSectionTitle, { color: currentThemeColors.primary }]}>Instructions</Text>
              {selectedRecipe?.instructions?.map((step, index) => (
                <View key={index} style={styles.detailStepContainer}>
                  <View style={[styles.detailStepNumberContainer, { backgroundColor: currentThemeColors.surface }]}>
                    <Text style={[styles.detailStepNumber, { color: currentThemeColors.primary }]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.detailStepText, { color: currentThemeColors.text }]}>{step}</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.detailCloseButton, { backgroundColor: currentThemeColors.primary }]} 
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
  },
  headerContainer: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  header: {
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 16,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 15,
    paddingBottom: 120,
  },
  grid: {
    gap: 15,
  },
  recipeCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    paddingRight: 35,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  macroText: {
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
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  fab: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    gap: 10,
  },
  fabText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
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
    padding: 15,
    borderRadius: 16,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingTop: 12,
    height: '92%',
  },
  modalIndicator: {
    width: 40,
    height: 5,
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
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailStepNumber: {
    fontWeight: '900',
    fontSize: 14,
  },
  detailStepText: {
    fontSize: 16,
    flex: 1,
    lineHeight: 24,
  },
  detailCloseButton: {
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
