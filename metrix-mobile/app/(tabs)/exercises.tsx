import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView
} from 'react-native';
import apiClient from '../../src/api/apiClient';
import { ExerciseCard, Exercise } from '../../src/components/workout/ExerciseCard';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

/**
 * ExercisesScreen serves as a visual dictionary of all available exercises.
 * 
 * Logic Rationale:
 * - Real-time Filtering: Uses `useMemo` to filter the `exercises` array based on `searchQuery` 
 *   and `selectedMuscle` without re-rendering the entire list unless the data or criteria change.
 * - Performance Tuning: The `FlatList` is optimized with `initialNumToRender` and `windowSize` 
 *   to handle the 140+ GIFs without crashing the main thread.
 * - Data Shape: Expects an array of objects: { id: number, name: string, gif_url: string, muscle_group: { name: string } }.
 */
export const ExercisesScreen = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentThemeColors } = useAppTheme();

  /**
   * Dynamically extracts unique muscle groups from the fetched exercise list.
   * Prepends 'All' to allow resetting filters.
   */
  const categories = useMemo(() => {
    const muscles = exercises
      .map(ex => ex.muscle_group?.name)
      .filter((name): name is string => !!name);
    const uniqueMuscles = Array.from(new Set(muscles)).sort();
    return ['All', ...uniqueMuscles];
  }, [exercises]);

  /**
   * Filters exercises based on search query and selected muscle group.
   * Case-insensitive matching is applied to both exercise names and muscle group names.
   */
  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      // 1. Filter by Muscle Group
      const matchesMuscle = selectedMuscle === 'All' || ex.muscle_group?.name === selectedMuscle;
      
      // 2. Filter by Search Query
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        ex.name.toLowerCase().includes(query) || 
        ex.muscle_group?.name.toLowerCase().includes(query);

      return matchesMuscle && matchesSearch;
    });
  }, [exercises, searchQuery, selectedMuscle]);

  /**
   * Fetches the master exercise list from the Django backend.
   */
  const fetchExercises = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/exercises/');
      setExercises(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch exercises:', err);
      setError('Failed to load exercises. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: '#121212' }]}>
        <ActivityIndicator size="large" color={currentThemeColors.primary} />
        <Text style={[styles.loadingText, { color: '#FFFFFF', marginTop: 10 }]}>Loading exercises...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: '#121212' }]}>
        <Ionicons name="alert-circle-outline" size={48} color={currentThemeColors.error} />
        <Text style={[styles.errorText, { color: '#FFFFFF' }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryBtn, { backgroundColor: currentThemeColors.primary }]} 
          onPress={fetchExercises}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#121212' }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>Exercise Database</Text>
        <Text style={[styles.subtitle, { color: '#8e8e93' }]}>{exercises.length} Exercises Available</Text>
        
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: '#2A2A2A' }]}>
          <Ionicons name="search" size={20} color="#8e8e93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises or muscles..."
            placeholderTextColor="#8e8e93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#8e8e93" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => {
            const isActive = category === selectedMuscle;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedMuscle(category)}
                style={[
                  styles.categoryPill,
                  { backgroundColor: isActive ? '#3b82f6' : '#2A2A2A' }
                ]}
              >
                <Text 
                  style={[
                    styles.categoryPillText,
                    { color: isActive ? '#FFFFFF' : '#888888' }
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      
      {/* Exercise List */}
      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id?.toString() || item.name}
        renderItem={({ item }) => <ExerciseCard exercise={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
    marginTop: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    height: '100%',
  },
  categoriesScroll: {
    marginTop: 15,
  },
  categoriesContent: {
    paddingRight: 20, // ensure last item has space
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 40,
  },
});

export default ExercisesScreen;
