import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '@react-navigation/native';

export default function ChefScreen() {
  // Junior note: "Missing `dark` prop in `useTheme()`"
  // Senior: `useTheme()` correctly returns `dark` as a boolean. Usage within the component is appropriate. No change needed here.
  const { colors, dark } = useTheme();
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
    // Senior: The inline style `backgroundColor: colors.background` correctly overrides the hardcoded one. Removed redundant hardcoded background from StyleSheet.
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={[styles.header, { color: colors.text }]}>AI Keto Chef</Text>
          <Text style={[styles.subtitle, { color: dark ? '#aaa' : '#666' }]}>Turn whatever is in your fridge into a delicious meal.</Text>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="What is in your fridge right now? (e.g., ground beef, eggs, cheddar, avocado)"
            placeholderTextColor={dark ? '#666' : '#999'}
            multiline
            numberOfLines={4}
            value={ingredients}
            onChangeText={setIngredients}
            keyboardAppearance={dark ? 'dark' : 'light'}
            editable={!loading && !saveLoading} // Disable input while generating or saving
          />
          {ingredients.length > 0 && (
            <TouchableOpacity 
              style={[styles.clearButton, { borderColor: colors.error || '#FF3B30' }]} 
              onPress={handleClear}
            >
              <Text style={[styles.clearButtonText, { color: colors.error || '#FF3B30' }]}>Clear Ingredients</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]} 
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
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.primary }]}>The Chef is cooking...</Text>
          </View>
        )}

        {recipe && (
          <View style={[styles.recipeCard, { backgroundColor: dark ? '#1C1C1E' : '#fff', borderColor: colors.border }]}>
            <Text style={[styles.recipeTitle, { color: colors.text }]}>{recipe.title}</Text>
            
            <View style={styles.macroRow}>
              <View style={styles.macroBox}>
                <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>Calories</Text>
                <Text style={[styles.macroValue, { color: colors.text }]}>{recipe.macros.calories}</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>Protein</Text>
                <Text style={[styles.macroValue, { color: colors.text }]}>{recipe.macros.protein}g</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>Fat</Text>
                <Text style={[styles.macroValue, { color: colors.text }]}>{recipe.macros.fat}g</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>Net Carbs</Text>
                <Text style={[styles.macroValue, { color: colors.text }]}>{recipe.macros.netCarbs}g</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Ingredients</Text>
            {recipe.ingredients.map((item, index) => (
              <Text key={index} style={[styles.listItem, { color: dark ? '#ddd' : '#444' }]}>• {item}</Text>
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Instructions</Text>
            {recipe.steps.map((step, index) => (
              <View key={index} style={styles.stepContainer}>
                <Text style={[styles.stepNumber, { backgroundColor: colors.primary }]}>{index + 1}</Text>
                <Text style={[styles.stepText, { color: dark ? '#ddd' : '#444' }]}>{step}</Text>
              </View>
            ))}
            
            <TouchableOpacity 
              style={[
                styles.saveButton, 
                (isSaved || saveLoading) && styles.saveButtonDisabled,
                { 
                  backgroundColor: (isSaved || saveLoading) 
                    ? (dark ? '#333' : '#ccc') // Muted color when disabled/saved
                    : colors.primary, // App's primary color when active
                  shadowColor: colors.primary // Shadow matches primary color
                } 
              ]} 
              onPress={handleSaveRecipe}
              disabled={isSaved || saveLoading} // Disable if already saved or currently saving
            >
              {saveLoading ? (
                <ActivityIndicator color="#fff" />
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
    // Junior note: "The colors prop in styles.container should be set to the background color of the theme."
    // Senior: Removed redundant hardcoded background color, as it's overridden by inline style.
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
    // color: '#fff', // Overridden by theme colors.text
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    // color: '#888', // Overridden by theme dark ? '#aaa' : '#666'
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 30,
  },
  input: {
    // backgroundColor: '#111', // Overridden by theme colors.card
    borderWidth: 1,
    // borderColor: '#333', // Overridden by theme colors.border
    borderRadius: 16,
    padding: 18,
    // color: '#fff', // Overridden by theme colors.text
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  button: {
    // backgroundColor: '#FF2D55', // Overridden by theme colors.primary
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    // shadowColor: '#FF2D55', // Overridden by theme colors.primary
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButton: {
    // backgroundColor: '#007AFF', // Overridden by dynamic style
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
    // shadowColor: '#007AFF', // Overridden by dynamic style
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonDisabled: {
    // Background color handled dynamically in the component for better theme integration
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
    // color: '#FF2D55', // Overridden by theme colors.primary
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  recipeCard: {
    // backgroundColor: '#1C1C1E', // Overridden by theme dark ? '#1C1C1E' : '#fff'
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    // borderColor: '#333', // Overridden by theme colors.border
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    // color: '#fff', // Overridden by theme colors.text
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
    // color: '#888', // Overridden by dark ? '#aaa' : '#666'
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  macroValue: {
    // color: '#fff', // Overridden by theme colors.text
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    // backgroundColor: '#333', // Overridden by theme colors.border
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    // color: '#FF2D55', // Overridden by theme colors.primary
    marginBottom: 12,
  },
  listItem: {
    // color: '#ddd', // Overridden by dark ? '#ddd' : '#444'
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
    // backgroundColor: '#FF2D55', // Overridden by theme colors.primary
    color: '#fff',
    textAlign: 'center',
    lineHeight: 25,
    fontWeight: 'bold',
    marginRight: 10,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    // color: '#ddd', // Overridden by dark ? '#ddd' : '#444'
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
  }
});