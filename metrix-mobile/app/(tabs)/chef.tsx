import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useAppTheme } from '../../src/context/ThemeContext';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function ChefScreen() {
  const { currentThemeColors, layout } = useAppTheme();
  const isDark = currentThemeColors.isDark; 
  const [ingredients, setIngredients] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  const handleGenerate = async () => {
    if (!ingredients.trim()) { Toast.show({ type: 'error', text1: 'Input Required' }); return; }
    setLoading(true);
    setRecipe(null);
    setIsSaved(false);
    try {
      const response = await apiClient.post('generate-recipe/', { ingredients });
      if (response.data.status === 'success') {
        const aiRecipe = response.data.data;
        setRecipe({
          title: aiRecipe.title,
          macros: { calories: aiRecipe.calories, protein: aiRecipe.protein, fat: aiRecipe.fat, netCarbs: aiRecipe.net_carbs },
          ingredients: aiRecipe.ingredients,
          steps: aiRecipe.instructions
        });
      }
    } catch (error) { Toast.show({ type: 'error', text1: 'Error' }); } finally { setLoading(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
  };

  const handleSaveRecipe = async () => {
    if (!recipe) return;
    setSaveLoading(true);
    try {
      const payload = { title: recipe.title, calories: recipe.macros.calories, protein: recipe.macros.protein, fat: recipe.macros.fat, net_carbs: recipe.macros.netCarbs, ingredients: recipe.ingredients, instructions: recipe.steps };
      const response = await apiClient.post('save-recipe/', payload);
      if (response.data.status === 'success') {
        setIsSaved(true);
        Toast.show({ type: 'success', text1: 'Saved!' });
        setTimeout(() => { setRecipe(null); setIngredients(''); setIsSaved(false); }, 1500);
      }
    } catch (e) { Toast.show({ type: 'error', text1: 'Error' }); } finally { setSaveLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: currentThemeColors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <Text style={[styles.header, { color: currentThemeColors.text }]}>AI Keto Chef</Text>
          <Text style={[styles.subtitle, { color: currentThemeColors.textSecondary }]}>Turn whatever is in your fridge into a delicious personal recipe.</Text>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            style={[styles.input, { backgroundColor: currentThemeColors.card, color: currentThemeColors.text, borderColor: currentThemeColors.border }]}
            placeholder="Ingredients..." placeholderTextColor={currentThemeColors.textSecondary} multiline value={ingredients} onChangeText={setIngredients}
          />
          <TouchableOpacity style={[styles.button, { backgroundColor: currentThemeColors.primary }]} onPress={handleGenerate} disabled={loading || saveLoading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate Recipe</Text>}
          </TouchableOpacity>
        </View>

        {recipe && (
          <View style={[styles.recipeCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>
            <View style={[styles.aiBadge, { backgroundColor: currentThemeColors.primary + '15' }]}><Ionicons name="sparkles" size={16} color={currentThemeColors.primary} /><Text style={{ color: currentThemeColors.primary, fontWeight: 'bold' }}>AI CRAFTED</Text></View>
            <Text style={[styles.recipeTitle, { color: currentThemeColors.text }]}>{recipe.title}</Text>
            <View style={styles.macroRow}>
              {[{ l: 'KCAL', v: recipe.macros.calories, c: currentThemeColors.text }, { l: 'PRO', v: recipe.macros.protein, c: currentThemeColors.warning }, { l: 'FAT', v: recipe.macros.fat, c: currentThemeColors.error }, { l: 'CARB', v: recipe.macros.netCarbs, c: currentThemeColors.info }].map((m, i) => (
                <View key={i} style={styles.macroBox}><Text style={[styles.macroLabel, { color: currentThemeColors.textSecondary }]}>{m.l}</Text><Text style={[styles.macroValue, { color: m.c }]}>{m.v}</Text></View>
              ))}
            </View>
            <View style={[styles.divider, { backgroundColor: currentThemeColors.border }]} />
            <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Ingredients</Text>
            {recipe.ingredients.map((it, idx) => <Text key={idx} style={[styles.listItem, { color: currentThemeColors.textSecondary }]}>• {it}</Text>)}
            <View style={[styles.divider, { backgroundColor: currentThemeColors.border }]} />
            <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Instructions</Text>
            {recipe.steps.map((st, idx) => (
              <View key={idx} style={styles.stepContainer}>
                <View style={[styles.stepNumberBadge, { backgroundColor: currentThemeColors.surface }]}><Text style={{ color: currentThemeColors.primary, fontWeight: 'bold' }}>{idx + 1}</Text></View>
                <Text style={[styles.stepText, { color: currentThemeColors.text }]}>{st}</Text>
              </View>
            ))}
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: isSaved ? currentThemeColors.surface : currentThemeColors.primary }]} onPress={handleSaveRecipe} disabled={isSaved || saveLoading}>
              <Text style={styles.buttonText}>{isSaved ? 'Saved!' : 'Save to Cookbook'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 60 },
  headerContainer: { marginBottom: 25 },
  header: { fontSize: 32, fontWeight: '900' },
  subtitle: { fontSize: 16 },
  inputSection: { marginBottom: 30 },
  input: { borderWidth: 1, borderRadius: 16, padding: 18, fontSize: 16, minHeight: 120, textAlignVertical: 'top', marginBottom: 15 },
  button: { paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  recipeCard: { borderRadius: 24, padding: 24, borderWidth: 1 },
  recipeTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  macroBox: { alignItems: 'center' },
  macroLabel: { fontSize: 10, fontWeight: 'bold' },
  macroValue: { fontSize: 18, fontWeight: 'bold' },
  divider: { height: 1, marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  listItem: { fontSize: 16, marginBottom: 8 },
  stepContainer: { flexDirection: 'row', marginBottom: 15 },
  stepNumberBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  stepText: { flex: 1, fontSize: 16 },
  saveButton: { paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', padding: 8, borderRadius: 20, marginBottom: 16, gap: 6 }
});
