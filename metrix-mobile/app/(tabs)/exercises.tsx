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

export const ExercisesScreen = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentThemeColors } = useAppTheme();

  const categories = useMemo(() => {
    const muscles = exercises
      .map(ex => ex.muscle_group?.name)
      .filter((name): name is string => !!name);
    const uniqueMuscles = Array.from(new Set(muscles)).sort();
    return ['All', ...uniqueMuscles];
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      const matchesMuscle = selectedMuscle === 'All' || ex.muscle_group?.name === selectedMuscle;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        ex.name.toLowerCase().includes(query) || 
        ex.muscle_group?.name.toLowerCase().includes(query);
      return matchesMuscle && matchesSearch;
    });
  }, [exercises, searchQuery, selectedMuscle]);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('exercises/');
      setExercises(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch exercises:', err);
      setError('Failed to load exercises.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: currentThemeColors.background }]}>
        <ActivityIndicator size="large" color={currentThemeColors.primary} />
        <Text style={[styles.loadingText, { color: currentThemeColors.text, marginTop: 10 }]}>Loading exercises...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: currentThemeColors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={currentThemeColors.error} />
        <Text style={[styles.errorText, { color: currentThemeColors.text }]}>{error}</Text>
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
    <SafeAreaView style={[styles.container, { backgroundColor: currentThemeColors.background }]}>
      <StatusBar barStyle={currentThemeColors.isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: currentThemeColors.text }]}>Exercise Database</Text>
        <Text style={[styles.subtitle, { color: currentThemeColors.textSecondary }]}>{exercises.length} Exercises Available</Text>
        
        <View style={[styles.searchContainer, { backgroundColor: currentThemeColors.card }]}>
          <Ionicons name="search" size={20} color={currentThemeColors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: currentThemeColors.text }]}
            placeholder="Search exercises or muscles..."
            placeholderTextColor={currentThemeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={currentThemeColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {categories.map((category) => {
            const isActive = category === selectedMuscle;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedMuscle(category)}
                style={[
                  styles.categoryPill,
                  { backgroundColor: isActive ? currentThemeColors.primary : currentThemeColors.card }
                ]}
              >
                <Text style={[styles.categoryPillText, { color: isActive ? '#FFFFFF' : currentThemeColors.textSecondary }]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      
      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id?.toString() || item.name}
        renderItem={({ item }) => <ExerciseCard exercise={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, fontWeight: '500', marginTop: 4, marginBottom: 15 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 45, marginTop: 5 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, height: '100%' },
  categoriesScroll: { marginTop: 15 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  categoryPillText: { fontSize: 13, fontWeight: '700' },
  loadingText: { fontSize: 16, fontWeight: '500' },
  errorText: { fontSize: 16, textAlign: 'center', marginTop: 10, marginBottom: 20 },
  retryBtn: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  listContent: { paddingTop: 10, paddingBottom: 40 },
});

export default ExercisesScreen;
