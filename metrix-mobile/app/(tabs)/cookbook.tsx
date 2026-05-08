import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform, Modal, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../src/api/apiClient';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function CookbookScreen() {
  const { currentThemeColors, layout } = useAppTheme();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [groceryData, setGroceryData] = useState(null);
  const [showGroceryModal, setShowGroceryModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(useCallback(() => { fetchRecipes(); }, []));

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('saved-recipes/');
      if (res.data.status === 'success') setSavedRecipes(res.data.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleGenerateList = async () => {
    setIsGenerating(true);
    try {
      const res = await apiClient.post('generate-grocery-list/', { recipe_ids: selectedRecipeIds });
      if (res.data.status === 'success') { setGroceryData(res.data.data.categories); setShowGroceryModal(true); }
    } catch (e) { Alert.alert('Error'); } finally { setIsGenerating(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentThemeColors.background }]}>
      <View style={[styles.headerContainer, { borderBottomColor: currentThemeColors.border }]}>
        <Text style={[styles.header, { color: currentThemeColors.text }]}>Cookbook</Text>
        <Text style={[styles.subtitle, { color: currentThemeColors.textSecondary }]}>Your saved repertoire of Keto recipes.</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={currentThemeColors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {savedRecipes.length === 0 ? (
            <View style={styles.centered}><Ionicons name="book-outline" size={60} color={currentThemeColors.textSecondary} /><Text style={[styles.emptyText, { color: currentThemeColors.text }]}>Empty</Text></View>
          ) : (
            <View style={styles.grid}>
              {savedRecipes.map(r => (
                <TouchableOpacity key={r.id} style={[styles.recipeCard, { backgroundColor: currentThemeColors.card, borderColor: selectedRecipeIds.includes(r.id) ? currentThemeColors.primary : currentThemeColors.border }]} onPress={() => { setSelectedRecipe(r); setModalVisible(true); }} onLongPress={() => setSelectedRecipeIds(p => p.includes(r.id) ? p.filter(id => id !== r.id) : [...p, r.id])}>
                  <Text style={[styles.recipeTitle, { color: currentThemeColors.text }]}>{r.title}</Text>
                  <View style={styles.macroRow}>
                    <View style={[styles.macroPill, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]}><Text style={{ color: currentThemeColors.textSecondary }}>🔥 {r.calories} kcal</Text></View>
                    <View style={[styles.macroPill, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]}><Text style={{ color: currentThemeColors.textSecondary }}>🥑 {r.net_carbs}g C</Text></View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {selectedRecipeIds.length > 0 && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: currentThemeColors.primary }]} onPress={handleGenerateList}>
          <Text style={styles.fabText}>Generate List ({selectedRecipeIds.length})</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentThemeColors.card }]}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={[styles.detailTitle, { color: currentThemeColors.text }]}>{selectedRecipe?.title}</Text>
              <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Ingredients</Text>
              {selectedRecipe?.ingredients?.map((it, i) => <Text key={i} style={{ color: currentThemeColors.textSecondary, marginBottom: 5 }}>• {it}</Text>)}
              <View style={{ height: 20 }} />
              <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Instructions</Text>
              {selectedRecipe?.instructions?.map((st, i) => <Text key={i} style={{ color: currentThemeColors.text, marginBottom: 10 }}>{i + 1}. {st}</Text>)}
            </ScrollView>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: currentThemeColors.primary }]} onPress={() => setModalVisible(false)}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { padding: 20, paddingTop: 60, borderBottomWidth: 1 },
  header: { fontSize: 34, fontWeight: '900' },
  subtitle: { fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 15, paddingBottom: 100 },
  grid: { gap: 15 },
  recipeCard: { borderRadius: 20, padding: 20, borderWidth: 1 },
  recipeTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  fab: { position: 'absolute', bottom: 30, left: 20, right: 20, padding: 18, borderRadius: 20, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { height: '90%', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  detailTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  closeBtn: { padding: 18, borderRadius: 16, margin: 20, alignItems: 'center' }
});
