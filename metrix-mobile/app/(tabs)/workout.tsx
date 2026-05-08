import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, DeviceEventEmitter, Dimensions, SectionList } from 'react-native';
import { LineChart } from "react-native-chart-kit";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import apiClient from '../../src/api/apiClient';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DailyCanvas } from '../../src/components/workout/DailyCanvas';
import type { ActiveExerciseEntry } from '../../src/components/workout/DailyCanvas';
import { WorkoutCalendarHistory } from '../../src/components/workout/WorkoutCalendarHistory';
import { useWorkoutSession } from '../../src/context/WorkoutSessionContext';

export const EXERCISE_DATABASE = [
  { category: 'Abs', color: '#5C6BC0', exercises: ['Ab-Wheel Rollout', 'Cable Crunch', 'Crunch', 'Crunch Machine', 'Decline Crunch', 'Dragon Flag', 'Hanging Knee Raise', 'Hanging Leg Raise', 'Plank', 'Side Plank'] },
  { category: 'Back', color: '#03A9F4', exercises: ['Barbell Row', 'Barbell Shrug', 'Chin Up', 'Deadlift', 'Dumbbell Row', 'Good Morning', 'Hammer Strength Row', 'Lat Pulldown', 'Lat Pullover', 'Machine Shrug', 'Neutral Chin Up', 'Pendlay Row', 'Pull Up', 'Rack Pull', 'Seated Cable Row', 'Straight-Arm Cable Pushdown', 'T-Bar Row', 'Upright Row'] },
  { category: 'Biceps', color: '#FF9800', exercises: ['Barbell Curl', 'Cable Curl', 'Dumbbell Concentration Curl', 'Dumbbell Curl', 'Dumbbell Hammer Curl', 'Dumbbell Preacher Curl', 'EZ-Bar Curl', 'EZ-Bar Preacher Curl', 'Seated Incline Dumbbell Curl', 'Seated Machine Curl'] },
  { category: 'Cardio', color: '#9E9E9E', exercises: ['Cycling', 'Elliptical Trainer', 'Rowing Machine', 'Running (Outdoor)', 'Running (Treadmill)', 'Stationary Bike', 'Swimming', 'Walking'] },
  { category: 'Chest', color: '#F44336', exercises: ['Cable Crossover', 'Decline Barbell Bench Press', 'Decline Hammer Strength Chest Press', 'Flat Barbell Bench Press', 'Flat Dumbbell Bench Press', 'Flat Dumbbell Fly', 'Incline Barbell Bench Press', 'Incline Dumbbell Bench Press', 'Incline Dumbbell Fly', 'Incline Hammer Strength Chest Press', 'Seated Machine Fly'] },
  { category: 'Legs', color: '#00BCD4', exercises: ['Barbell Calf Raise', 'Barbell Front Squat', 'Barbell Glute Bridge', 'Barbell Squat', 'Donkey Calf Raise', 'Glute-Ham Raise', 'Hack Squat Machine', 'Leg Extension Machine', 'Leg Press', 'Lying Leg Curl Machine', 'Romanian Deadlift', 'Seated Calf Raise Machine', 'Seated Leg Curl Machine', 'Standing Calf Raise Machine', 'Stiff-Legged Deadlift', 'Sumo Deadlift'] },
  { category: 'Shoulders', color: '#AB47BC', exercises: ['Arnold Dumbbell Press', 'Behind The Neck Barbell Press', 'Cable Face Pull', 'Front Dumbbell Raise', 'Hammer Strength Shoulder Press', 'Lateral Dumbbell Raise', 'Lateral Machine Raise', 'Log Press', 'One-Arm Standing Dumbbell Press', 'Overhead Press', 'Push Press', 'Rear Delt Dumbbell Raise', 'Rear Delt Machine Fly', 'Seated Dumbbell Lateral Raise', 'Seated Dumbbell Press', 'Smith Machine Overhead Press'] },
  { category: 'Triceps', color: '#4CAF50', exercises: ['Cable Overhead Triceps Extension', 'Close Grip Barbell Bench Press', 'Dumbbell Overhead Triceps Extension', 'EZ-Bar Skullcrusher', 'Lying Triceps Extension', 'Parallel Bar Triceps Dip', 'Ring Dip', 'Rope Push Down', 'Smith Machine Close Grip Bench Press', 'Triceps Press Nautilus'] }
];

export default function WorkoutScreen() {
  const { currentThemeColors } = useAppTheme();
  const { isActive, startWorkout, finishWorkout } = useWorkoutSession();
  
  const [activeExercise, setActiveExercise] = useState('');
  const [sessionExercises, setSessionExercises] = useState<ActiveExerciseEntry[]>([]);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('track');
  const [graphData, setGraphData] = useState([]);
  const [graphLoading, setGraphLoading] = useState(false);

  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [isSelectorVisible, setSelectorVisible] = useState(false);
  const [expandedCats, setExpandedCats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const indicatorPosition = useSharedValue(0);

  useEffect(() => {
    if (activeTab === 'track') indicatorPosition.value = withSpring(0);
    else if (activeTab === 'history') indicatorPosition.value = withSpring(1);
    else if (activeTab === 'graph') indicatorPosition.value = withSpring(2);
  }, [activeTab]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({ left: `${indicatorPosition.value * 33.33}%` }));

  const filteredExerciseDatabase = useMemo(() => {
    if (!searchQuery.trim()) return EXERCISE_DATABASE.map(cat => ({ title: cat.category, color: cat.color, data: cat.exercises }));
    const lowerQuery = searchQuery.toLowerCase();
    return EXERCISE_DATABASE.map(cat => ({
      title: cat.category, color: cat.color, data: cat.exercises.filter(ex => ex.toLowerCase().includes(lowerQuery))
    })).filter(cat => cat.data.length > 0);
  }, [searchQuery]);

  useEffect(() => {
    fetchWorkouts();
    const sub = DeviceEventEmitter.addListener('refreshWorkouts', fetchWorkouts);
    return () => sub.remove();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await apiClient.get('workouts/');
      if (response.data.status === 'success') setWorkouts(response.data.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchGraphData = async (name) => {
    if (!name) return;
    setGraphLoading(true);
    try {
      const res = await apiClient.get(`workout-history/?exercise=${encodeURIComponent(name)}&mode=graph`);
      setGraphData(res.data);
    } catch (e) { setGraphData([]); } finally { setGraphLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'graph' && activeExercise) fetchGraphData(activeExercise);
  }, [activeTab, activeExercise]);

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: currentThemeColors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.segmentedWrapper, { backgroundColor: currentThemeColors.background }]}>
        <View style={[styles.segmentedControl, { backgroundColor: currentThemeColors.surface }]}>
          <Animated.View style={[{ position: 'absolute', top: 4, bottom: 4, width: '33.33%', backgroundColor: currentThemeColors.primary, borderRadius: 20 }, animatedIndicatorStyle]} />
          {['track', 'history', 'graph'].map((tab) => (
            <TouchableOpacity key={tab} onPress={() => { setActiveTab(tab); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={styles.segmentBtn}>
              <Text style={[styles.segmentText, { color: activeTab === tab ? '#fff' : currentThemeColors.textSecondary }]}>{tab.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'track' && (
        <View style={{ paddingHorizontal: 15, paddingBottom: 10 }}>
          <TouchableOpacity onPress={isActive ? finishWorkout : startWorkout} style={{ backgroundColor: isActive ? '#F44336' : '#4CAF50', paddingVertical: 15, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
            <Ionicons name={isActive ? "stop-circle" : "play-circle"} size={24} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{isActive ? "Finish Workout" : "Start Workout"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'track' && (
        <DailyCanvas
          activeExercises={sessionExercises}
          onOpenExerciseSelector={() => setSelectorVisible(true)}
          onSaveExercise={async (id, sets) => {
            const entry = sessionExercises.find(e => e.id === id);
            if (!entry || sets.length === 0) return;
            try {
              const res = await apiClient.post('log-workout/', { exercise_name: entry.exercise.name, duration: 30, sets_list: sets });
              if (res.data.status === 'success') {
                fetchWorkouts();
                Toast.show({ type: 'success', text1: 'Logged!' });
                setSessionExercises(prev => prev.filter(e => e.id !== id));
              }
            } catch (e) { Toast.show({ type: 'error', text1: 'Error' }); }
          }}
        />
      )}

      {activeTab === 'history' && <WorkoutCalendarHistory workouts={workouts} />}

      {activeTab === 'graph' && (
        <ScrollView contentContainerStyle={{ padding: 15 }}>
          {!activeExercise ? <Text style={{ color: currentThemeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>Select an exercise to see progress.</Text> : (
            <>
              <Text style={[styles.title, { color: currentThemeColors.text }]}>Progress</Text>
              <View style={[styles.graphHeader, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>
                <Text style={{ color: currentThemeColors.primary, fontWeight: 'bold', fontSize: 18 }}>{activeExercise}</Text>
                {graphLoading && <ActivityIndicator size="small" color={currentThemeColors.primary} />}
              </View>
              {graphData.length > 1 ? (
                <LineChart
                  data={{ labels: graphData.map(d => d.date), datasets: [{ data: graphData.map(d => d.weight) }] }}
                  width={Dimensions.get('window').width - 30}
                  height={220}
                  chartConfig={{ backgroundColor: currentThemeColors.card, backgroundGradientFrom: currentThemeColors.card, backgroundGradientTo: currentThemeColors.card, decimalPlaces: 0, color: (o) => currentThemeColors.primary, labelColor: (o) => currentThemeColors.textSecondary, propsForDots: { r: '6', stroke: currentThemeColors.primary } }}
                  bezier style={{ marginVertical: 8, borderRadius: 16 }}
                />
              ) : <Text style={{ color: currentThemeColors.textSecondary, textAlign: 'center', marginTop: 20 }}>Not enough data to graph.</Text>}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={isSelectorVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: currentThemeColors.background }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: currentThemeColors.text }]}>Choose Exercise</Text>
              <TouchableOpacity onPress={() => setSelectorVisible(false)}><Ionicons name="close-circle" size={28} color={currentThemeColors.textSecondary} /></TouchableOpacity>
            </View>
            <TextInput 
              style={[styles.searchInput, { backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
              placeholder="Search..." placeholderTextColor={currentThemeColors.textSecondary} onChangeText={setSearchQuery} 
            />
            <SectionList
              sections={filteredExerciseDatabase}
              keyExtractor={i => i}
              renderSectionHeader={({ section }) => (
                <TouchableOpacity onPress={() => setExpandedCats(p => p.includes(section.title) ? p.filter(c => c !== section.title) : [...p, section.title])} style={[styles.catHeader, { borderBottomColor: currentThemeColors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={[styles.catDot, { backgroundColor: section.color }]} /><Text style={[styles.catTitle, { color: currentThemeColors.text }]}>{section.title}</Text></View>
                  <Ionicons name={expandedCats.includes(section.title) ? "chevron-up" : "chevron-down"} size={20} color={currentThemeColors.primary} />
                </TouchableOpacity>
              )}
              renderItem={({ item, section }) => (expandedCats.includes(section.title) || searchQuery.length > 0) ? (
                <TouchableOpacity onPress={() => { setActiveExercise(item); setSessionExercises(p => [...p, { id: `${item}-${Date.now()}`, exercise: { name: item, category: section.title } }]); setSelectorVisible(false); }} style={[styles.exItem, { borderBottomColor: currentThemeColors.border }]}>
                  <Text style={[styles.exText, { color: currentThemeColors.text }]}>{item}</Text>
                  <Ionicons name="add-circle" size={20} color={currentThemeColors.primary} />
                </TouchableOpacity>
              ) : null}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentedWrapper: { padding: 15 },
  segmentedControl: { flexDirection: 'row', borderRadius: 25, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  bottomSheet: { height: '80%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  sheetHandle: { width: 40, height: 5, backgroundColor: '#ccc', alignSelf: 'center', borderRadius: 5, marginBottom: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  searchInput: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 15 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1 },
  catDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  catTitle: { fontSize: 18, fontWeight: 'bold' },
  exItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, paddingLeft: 20, borderBottomWidth: 0.5 },
  exText: { fontSize: 16 },
  graphHeader: { padding: 15, borderRadius: 15, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 }
});
