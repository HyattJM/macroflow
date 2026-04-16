import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useTheme } from '@react-navigation/native';

export default function ChefScreen() {
  const { colors, dark } = useTheme();
  const [ingredients, setIngredients] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  const handleGenerate = async () => {
    if (!ingredients.trim()) return;
    setLoading(true);
    setRecipe(null);
    setIsSaved(false);
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
        Alert.alert('Error', 'Failed to generate recipe.');
      }
    } catch (error) {
      if (error?.response?.status === 429) {
        Alert.alert('Capacity Reached', error.response.data.error || 'AI servers are currently at capacity. Please try again later.');
      } else {
        console.error(error);
        Alert.alert('Error', 'Failed to connect to AI Chef.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!recipe) return;
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
        
        // Clear screen after a short delay
        setTimeout(() => {
          setRecipe(null);
          setIngredients('');
          setIsSaved(false);
        }, 1500);
      } else {
        Alert.alert('Error', 'Failed to save recipe.');
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      Alert.alert('Error', 'Failed to communicate with backend.');
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          />
          <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Thinking...' : 'Generate Recipe'}</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF2D55" />
            <Text style={styles.loadingText}>The Chef is cooking...</Text>
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

            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((item, index) => (
              <Text key={index} style={[styles.listItem, { color: dark ? '#ddd' : '#444' }]}>• {item}</Text>
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.steps.map((step, index) => (
              <View key={index} style={styles.stepContainer}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={[styles.stepText, { color: dark ? '#ddd' : '#444' }]}>{step}</Text>
              </View>
            ))}
            
            <TouchableOpacity 
              style={[styles.saveButton, isSaved && styles.saveButtonDisabled]} 
              onPress={handleSaveRecipe}
              disabled={isSaved}
            >
              <Text style={styles.buttonText}>{isSaved ? 'Saved!' : 'Save to Cookbook'}</Text>
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
    backgroundColor: '#000', // Dark premium mode
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
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 16,
    padding: 18,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#FF2D55',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#007AFF', // Clean blue for generic saving action
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: '#333',
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
    color: '#FF2D55',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  recipeCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  macroValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF2D55',
    marginBottom: 12,
  },
  listItem: {
    color: '#ddd',
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
    backgroundColor: '#FF2D55',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 25,
    fontWeight: 'bold',
    marginRight: 10,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    color: '#ddd',
    fontSize: 16,
    lineHeight: 24,
  }
});
