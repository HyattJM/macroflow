import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useAppTheme } from '../../src/context/ThemeContext';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

export default function ChefScreen() {
  const { currentThemeColors, typography, layout, themeName } = useAppTheme();
  const isDark = currentThemeColors.isDark; 
  const [ingredients, setIngredients] = useState('');
  const [loading, setLoading] = useState(false); // For generating recipe
  const [saveLoading, setSaveLoading] = useState(false); // New state for saving recipe
  const [recipe, setRecipe] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  const handleClear = () => {
    setIngredients('');
  };

  const handleGenerate = async () => {
    // Junior note: "Missing validation: The code doesn't validate the `ingredients` input before sending it to the API."
    // Senior: The original code already included `if (!ingredients.trim()) return;`. Enhanced with an Alert for better UX.
    if (!ingredients.trim()) {
      Alert.alert('Input Required', 'Please enter some ingredients to generate a recipe.');
      return;
    }

    setLoading(true);
    setRecipe(null);
    setIsSaved(false); // Reset saved status for new recipe generation
    try {
      const response = await apiClient.post('/generate-recipe/', { ingredients });
      if (response.data.status === 'success') {
        const aiRecipe = response.data.data;
        setRecipe({
          title: aiRecipe.title,
          macros: {
            calories: aiRecipe.calories,
            protein: aiRecipe.protein,
            fat: aiRecipe.fat,
            netCarbs: aiRecipe.net_carbs
          },
          ingredients: aiRecipe.ingredients,
          steps: aiRecipe.instructions
        });
      } else {
        // Fallback for API success but data status not 'success'
        Alert.alert('Error', response.data.error || 'Failed to generate recipe. Please try again.');
      }
    } catch (error) {
      // Junior note: "Incorrect Alert message: In `handleSaveRecipe()`, the error message for `capacity reached` is incorrect."
      // Senior: Junior misidentified the function. The `429` error handler is in `handleGenerate()` and is already correct.
      if (error?.response?.status === 429) {
        Alert.alert('Capacity Reached', error.response.data.error || 'AI servers are currently at capacity. Please try again later.');
      } else {
        console.error("Error generating recipe:", error); // More specific logging
        Alert.alert('Error', 'Failed to connect to AI Chef. Please check your network or try again later.');
      }
      } finally {
        setLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
  };

  const handleSaveRecipe = async () => {
    if (!recipe) return; // Should not happen if button is only visible when recipe exists

    // Junior note: "Missing loading state for saving: The code doesn't show a loading state when saving the recipe."
    // Senior: Implemented `saveLoading` state and integrated it into the UI.
    setSaveLoading(true);
    try {
      const payload = {
        title: recipe.title,
        calories: recipe.macros.calories,
        protein: recipe.macros.protein,
        fat: recipe.macros.fat,
        net_carbs: recipe.macros.netCarbs,
        ingredients: recipe.ingredients,
        instructions: recipe.steps
      };
      
      const response = await apiClient.post('/save-recipe/', payload);
      if (response.data.status === 'success') {
        setIsSaved(true);
        Alert.alert('Success', 'Recipe saved to Cookbook!');
        
        // Clear screen after a short delay for better UX
        setTimeout(() => {
          setRecipe(null);
          setIngredients('');
          setIsSaved(false);
        }, 1500);
      } else {
        Alert.alert('Error', response.data.error || 'Failed to save recipe. Please try again.');
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      // More descriptive error for the user
      Alert.alert('Error', 'Failed to save recipe. Please check your network or try again later.');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    // Junior note: "The `keyboardAvoidingView` behavior should be set based on the platform (iOS or Android)."
    // Senior: This was already correctly implemented. Added `keyboardVerticalOffset` for potential better Android UX.
    // Junior note: "The `colors` prop in `styles.container` should be set to the background color of the theme."
    // Senior: The inline style `backgroundColor: currentThemeColors.background` correctly overrides the hardcoded one. Removed redundant hardcoded background from StyleSheet.
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: currentThemeColors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={[styles.header, { color: currentThemeColors.text }]}>AI Keto Chef</Text>
          <Text style={[styles.subtitle, { color: currentThemeColors.textSecondary }]}>Turn whatever is in your fridge into a delicious personal recipe.</Text>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            style={[styles.input, { backgroundColor: currentThemeColors.card, color: currentThemeColors.text, borderColor: currentThemeColors.border }]}
            placeholder="What is in your fridge right now? (e.g., ground beef, eggs, cheddar, avocado)"
            placeholderTextColor={currentThemeColors.textSecondary}
            multiline
            numberOfLines={4}
            value={ingredients}
            onChangeText={setIngredients}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            editable={!loading && !saveLoading}
          />
          {ingredients.length > 0 && (
            <TouchableOpacity 
              style={[styles.clearButton, { borderColor: currentThemeColors.error }]} 
              onPress={handleClear}
            >
              <Text style={[styles.clearButtonText, { color: currentThemeColors.error }]}>Clear Ingredients</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: currentThemeColors.primary, shadowColor: currentThemeColors.primary }]} 
            onPress={handleGenerate} 
            disabled={loading || saveLoading} // Disable if generating or saving
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Generate Recipe</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={currentThemeColors.primary} />
            <Text style={[styles.loadingText, { color: currentThemeColors.primary }]}>The Chef is cooking...</Text>
          </View>
        )}

        {recipe && (
          <View style={[styles.recipeCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.lg }]}>
            <View style={[styles.aiBadge, { backgroundColor: currentThemeColors.primary + '15' }]}>
              <Ionicons name="sparkles" size={16} color={currentThemeColors.primary} />
              <Text style={[styles.aiBadgeText, { color: currentThemeColors.primary }]}>AI CRAFTED</Text>
            </View>
            <Text style={[styles.recipeTitle, { color: currentThemeColors.text }]}>{recipe.title}</Text>
            
            <View style={styles.macroRow}>
              {[
                { label: 'CALORIES', value: recipe.macros.calories, color: currentThemeColors.text },
                { label: 'PROTEIN', value: `${recipe.macros.protein}g`, color: currentThemeColors.warning },
                { label: 'FAT', value: `${recipe.macros.fat}g`, color: currentThemeColors.error },
                { label: 'NET CARBS', value: `${recipe.macros.netCarbs}g`, color: currentThemeColors.info },
              ].map((macro, idx) => (
                <View key={idx} style={styles.macroBox}>
                  <Text style={[styles.macroLabel, { color: currentThemeColors.textSecondary }]}>{macro.label}</Text>
                  <Text style={[styles.macroValue, { color: macro.color }]}>{macro.value}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: currentThemeColors.border }]} />

            <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Ingredients</Text>
            {recipe.ingredients.map((item, index) => (
              <Text key={index} style={[styles.listItem, { color: currentThemeColors.textSecondary }]}>• {item}</Text>
            ))}

            <View style={[styles.divider, { backgroundColor: currentThemeColors.border }]} />

            <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Instructions</Text>
            {recipe.steps.map((step, index) => (
              <View key={index} style={styles.stepContainer}>
                <View style={[styles.stepNumberBadge, { backgroundColor: currentThemeColors.surface }]}>
                  <Text style={[styles.stepNumber, { color: currentThemeColors.primary }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.stepText, { color: currentThemeColors.text }]}>{step}</Text>
              </View>
            ))}
            
            <TouchableOpacity 
              style={[
                styles.saveButton, 
                (isSaved || saveLoading) && styles.saveButtonDisabled,
                { 
                  backgroundColor: (isSaved || saveLoading) 
                    ? currentThemeColors.surface
                    : currentThemeColors.primary,
                  shadowColor: currentThemeColors.primary
                } 
              ]} 
              onPress={handleSaveRecipe}
              disabled={isSaved || saveLoading}
            >
              {saveLoading ? (
                <ActivityIndicator color={currentThemeColors.text} />
              ) : (
                <Text style={styles.buttonText}>{isSaved ? 'Saved!' : 'Save to Cookbook'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
  },
  headerContainer: {
    marginBottom: 25,
  },
  header: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  recipeCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  macroBox: {
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listItem: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 24,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  stepNumber: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 25,
    fontWeight: 'bold',
    marginRight: 10,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  clearButton: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
});
