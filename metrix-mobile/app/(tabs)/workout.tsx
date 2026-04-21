import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, DeviceEventEmitter, Dimensions, SectionList, Switch } from 'react-native';
import { LineChart } from "react-native-chart-kit";
import { Swipeable } from 'react-native-gesture-handler';
import apiClient from '../../src/api/apiClient';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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
  const { currentThemeColors, typography, layout } = useAppTheme();
  const dark = true; 
  
  // Active Exercise State
  const [activeExercise, setActiveExercise] = useState('');
  const [currentSets, setCurrentSets] = useState([]); 
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('30');
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [historicalMax, setHistoricalMax] = useState({ weight: 0, reps: 0 });
  
  // History State
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('track');
  const [historyData, setHistoryData] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [graphLoading, setGraphLoading] = useState(false);

  // Edit Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editExerciseName, setEditExerciseName] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editSets, setEditSets] = useState('');
  const [editReps, setEditReps] = useState('');

  // Refinement States
  const [isSelectorVisible, setSelectorVisible] = useState(false);
  const [expandedCats, setExpandedCats] = useState([]);
  const [isTimerEnabled, setIsTimerEnabled] = useState(true);

  useEffect(() => {
    fetchWorkouts();
    
    const sub = DeviceEventEmitter.addListener('refreshWorkouts', fetchWorkouts);
    return () => sub.remove();
  }, []);

  const toggleCat = (cat) => {
    setExpandedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  useEffect(() => {
    let interval = null;
    if (restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft(prev => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [restTimeLeft]);

  const fetchHistoricalMax = async (name) => {
    if (!name.trim()) return;
    try {
      const res = await apiClient.get(`/exercise-max/?name=${encodeURIComponent(name)}`);
      setHistoricalMax({
        weight: res.data.max_weight || 0,
        reps: res.data.max_reps || 0
      });
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    try {
      const url = activeExercise 
        ? `/workout-history/?exercise=${encodeURIComponent(activeExercise)}`
        : '/workout-history/';
      const res = await apiClient.get(url);
      setHistoryData(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchGraphData = async (name) => {
    if (!name || name.trim().length === 0) return;
    setGraphLoading(true);
    try {
      const res = await apiClient.get(`/workout-history/?exercise=${encodeURIComponent(name)}&mode=graph`);
      setGraphData(res.data);
    } catch (e) {
      console.error(e);
      setGraphData([]);
    } finally {
      setGraphLoading(false);
    }
  };

  // Crash Guards & Auto-fetching for tabs
  useEffect(() => {
    if (activeTab === 'history' && activeExercise && activeExercise.length > 0) {
      fetchHistory();
    }
  }, [activeTab, activeExercise]);

  useEffect(() => {
    if (activeTab === 'graph' && activeExercise && activeExercise.length > 0) {
      fetchGraphData(activeExercise);
    }
  }, [activeTab, activeExercise]);

  const fetchWorkouts = async () => {
    try {
      const response = await apiClient.get('/workouts/');
      if (response.data.status === 'success') {
        setWorkouts(response.data.data);
      }
    } catch (error) {
      console.error("Fetch Workouts Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogSet = () => {
    if (!weight || !reps) {
       Alert.alert("Missing Info", "Please enter both weight and reps.");
       return;
    }
    
    const weightVal = parseFloat(weight);
    const repsVal = parseInt(reps, 10);
    const isPR = weightVal > historicalMax.weight || (weightVal === historicalMax.weight && repsVal > historicalMax.reps);
    
    const newSet = {
      weight: weightVal,
      reps: repsVal,
      is_pr: isPR
    };
    
    setCurrentSets([...currentSets, newSet]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Instant update of historicalMax for subsequent sets in this session
    if (isPR) {
      setHistoricalMax({ weight: weightVal, reps: repsVal });
    }
    setReps(''); // Clear reps, usually weight stays
    if (isTimerEnabled) {
      setRestTimeLeft(90); // Start 90s rest timer
    }
  };

  const removeSet = (index) => {
    setCurrentSets(currentSets.filter((_, i) => i !== index));
  };

  const handleFinishExercise = async () => {
    if (!activeExercise || !activeExercise.trim()) {
      Alert.alert("Exercise Name", "Please select an exercise.");
      return;
    }
    if (currentSets.length === 0) {
      Alert.alert("No Sets", "Add at least one set before finishing.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        exercise_name: activeExercise,
        duration: parseInt(duration, 10),
        sets_list: currentSets
      };
      
      const response = await apiClient.post('/log-workout/', payload);
      if (response.data.status === 'success') {
        setActiveExercise('');
        setCurrentSets([]);
        setWeight('');
        setReps('');
        fetchWorkouts();
        Alert.alert("Success", "Exercise session logged!");
      }
    } catch (error) {
      console.error("Logging Error:", error);
      Alert.alert("Error", "Failed to log workout.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Workout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await apiClient.delete(`/workouts/${id}/delete/`);
            fetchWorkouts();
          } catch (e) { console.error(e); }
        }
      }
    ]);
  };

  const openEditModal = (item) => {
    setEditingLog(item);
    setEditExerciseName(item.exercise_name);
    setEditWeight(item.weight.toString());
    setEditSets(item.sets.toString());
    setEditReps(item.reps.toString());
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editingLog) return;
    try {
      const payload = {
        exercise_name: editExerciseName,
        weight: parseFloat(editWeight) || 0,
        sets: parseInt(editSets, 10) || 0,
        reps: parseInt(editReps, 10) || 0
      };
      const res = await apiClient.put(`/workouts/${editingLog.id}/update/`, payload);
      if (res.data.status === 'success') {
        setWorkouts(prev => prev.map(w => w.id === editingLog.id ? res.data.data : w));
        setEditModalVisible(false);
        setEditingLog(null);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to update lift");
    }
  };

  const totalVolume = currentSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderHistoryItem = (item) => {
    const date = new Date(item.created_at);
    const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View key={item.id} style={[styles.card, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
             <Text style={[styles.exerciseNameText, { color: currentThemeColors.text }]}>{item.exercise_name}</Text>
             <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <Ionicons name="fitness-outline" size={24} color={currentThemeColors.primary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.macroStat}>
            <Text style={styles.macroLabel}>MAX WEIGHT</Text>
            <Text style={[styles.macroValue, { color: currentThemeColors.text }]}>{item.weight}</Text>
          </View>
          <View style={styles.macroStat}>
            <Text style={styles.macroLabel}>SETS</Text>
            <Text style={[styles.macroValue, { color: currentThemeColors.text }]}>{item.sets}</Text>
          </View>
          <View style={styles.macroStat}>
            <Text style={styles.macroLabel}>REPS</Text>
            <Text style={[styles.macroValue, { color: currentThemeColors.text }]}>{item.reps}</Text>
          </View>
        </View>
        <View style={styles.actionContainer}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconButton}>
              <Text>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconButton}>
              <Text>🗑️</Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  const allTimePR = useMemo(() => {
    let maxItem = null;
    historyData.forEach(section => {
      section.data.forEach(item => {
        if (!maxItem || 
            item.weight > maxItem.weight || 
            (item.weight === maxItem.weight && item.reps > maxItem.reps)) {
          maxItem = item;
        }
      });
    });
    return maxItem;
  }, [historyData]);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: currentThemeColors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Sticky Segmented Control */}
      <View style={[styles.segmentedWrapper, { backgroundColor: currentThemeColors.background }]}>
        <View style={[styles.segmentedControl, { backgroundColor: currentThemeColors.surface }]}>
          {['track', 'history', 'graph'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                setActiveTab(tab);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.segmentBtn,
                activeTab === tab && { backgroundColor: currentThemeColors.primary }
              ]}
            >
              <Text style={[
                styles.segmentText,
                { color: activeTab === tab ? '#fff' : currentThemeColors.textSecondary }
              ]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'track' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { color: currentThemeColors.text, paddingHorizontal: 20, marginTop: 20 }]}>Active Exercise</Text>
          
          <View style={[styles.activeSection, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
            <View style={styles.headerRow}>
              <TouchableOpacity 
                style={[styles.exerciseSelectorTrigger, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]} 
                onPress={() => setSelectorVisible(true)}
              >
                <Text style={[styles.exerciseSelectorText, { color: activeExercise ? currentThemeColors.text : currentThemeColors.textSecondary }]}>
                  {activeExercise || 'Select Exercise'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={currentThemeColors.primary} />
              </TouchableOpacity>
              <View style={[styles.volumeBadge, { backgroundColor: currentThemeColors.primary + '15' }]}>
                <Text style={[styles.volumeLabel, { color: currentThemeColors.primary }]}>VOLUME</Text>
                <Text style={[styles.volumeValue, { color: currentThemeColors.text }]}>{totalVolume.toLocaleString()} <Text style={{ fontSize: 10 }}>LBS</Text></Text>
              </View>
            </View>

            <View style={styles.gridHeader}>
              <Text style={[styles.gridHeaderText, { flex: 0.5, textAlign: 'center' }]}>SET</Text>
              <Text style={[styles.gridHeaderText, { flex: 1 }]}>WEIGHT (LBS)</Text>
              <Text style={[styles.gridHeaderText, { flex: 1 }]}>REPS</Text>
              <View style={{ width: 40 }} />
            </View>

            {currentSets.map((s, index) => (
              <Swipeable key={index} renderRightActions={() => (
                <TouchableOpacity onPress={() => removeSet(index)} style={styles.deleteSwipeBtn}>
                  <Ionicons name="trash" size={24} color="#fff" />
                </TouchableOpacity>
              )}>
                <View style={styles.setRow}>
                  <Text style={[styles.setText, { flex: 0.5, textAlign: 'center', color: dark ? '#aaa' : '#666' }]}>{index + 1}</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.setText, { color: currentThemeColors.text, fontWeight: 'bold' }]}>{s.weight}</Text>
                    <Text style={styles.setSubText}>lbs</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.setText, { flex: 1, color: currentThemeColors.text, fontWeight: 'bold' }]}>{s.reps}</Text>
                  <View style={{ width: 40 }} />
                </View>
              </View>
            </Swipeable>
            ))}

            <View style={[styles.inputRow, { borderTopWidth: 1, borderTopColor: currentThemeColors.border, paddingTop: 15 }]}>
               <View style={{ flex: 0.5, alignItems: 'center' }}>
                  <Text style={{ color: currentThemeColors.primary, fontWeight: '900', fontSize: 18 }}>{currentSets.length + 1}</Text>
               </View>
               <TextInput
                 style={[styles.gridInput, { flex: 1, color: currentThemeColors.text, backgroundColor: currentThemeColors.surface }]}
                 placeholder="LBS"
                 placeholderTextColor={currentThemeColors.textSecondary}
                 keyboardType="numeric"
                 value={weight}
                 onChangeText={setWeight}
                 keyboardAppearance='dark'
               />
               <TextInput
                 style={[styles.gridInput, { flex: 1, color: currentThemeColors.text, backgroundColor: currentThemeColors.surface }]}
                 placeholder="REPS"
                 placeholderTextColor={currentThemeColors.textSecondary}
                 keyboardType="numeric"
                 value={reps}
                 onChangeText={setReps}
                 keyboardAppearance='dark'
               />
               <TouchableOpacity style={[styles.addSetBtn, { backgroundColor: currentThemeColors.primary }]} onPress={handleLogSet}>
                 <Text style={styles.addSetBtnText}>LOG</Text>
               </TouchableOpacity>
            </View>
          </View>
                    {/* Auto-Rest Timer */}
          {restTimeLeft > 0 && (
            <View style={[styles.timerCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.primary, ...layout.shadows.md }]}>
              <View style={styles.timerHeader}>
                <Ionicons name="hourglass-outline" size={20} color={currentThemeColors.primary} />
                <Text style={[styles.timerLabel, { color: currentThemeColors.primary }]}>RESTING</Text>
              </View>
              <Text style={[styles.timerValue, { color: currentThemeColors.text }]}>{formatTime(restTimeLeft)}</Text>
              <View style={styles.timerActions}>
                <TouchableOpacity onPress={() => setRestTimeLeft(prev => prev + 30)} style={[styles.timerBtn, { backgroundColor: currentThemeColors.surface }]}>
                  <Text style={[styles.timerBtnText, { color: currentThemeColors.text }]}>+30s</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRestTimeLeft(prev => Math.max(0, prev - 30))} style={[styles.timerBtn, { backgroundColor: currentThemeColors.surface }]}>
                  <Text style={[styles.timerBtnText, { color: currentThemeColors.text }]}>-30s</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRestTimeLeft(0)} style={[styles.timerBtn, { backgroundColor: currentThemeColors.error }]}>
                  <Text style={[styles.timerBtnText, { color: '#fff' }]}>Skip</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timerToggleRow}>
                <Text style={{ color: currentThemeColors.textSecondary, fontSize: 12, fontWeight: '600' }}>Auto-Rest Timer</Text>
                <Switch 
                  value={isTimerEnabled} 
                  onValueChange={setIsTimerEnabled}
                  trackColor={{ false: currentThemeColors.surface, true: currentThemeColors.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </View>
          )}

          {currentSets.length > 0 && (
            <View style={[styles.finishSection, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
              <View style={styles.durationRow}>
                <Text style={{ color: currentThemeColors.textSecondary, fontSize: 14, fontWeight: '600' }}>Session Duration (min)</Text>
                <TextInput
                  style={[styles.durationInput, { color: currentThemeColors.text, backgroundColor: currentThemeColors.surface }]}
                  keyboardType="numeric"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardAppearance='dark'
                />
              </View>
              <TouchableOpacity style={[styles.finishBtn, { backgroundColor: currentThemeColors.success }]} onPress={handleFinishExercise} disabled={submitting}>
                <Text style={styles.finishBtnText}>{submitting ? 'LOGGING...' : 'FINISH EXERCISE'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      )}

      {activeTab === 'history' && (() => {
        if (!activeExercise) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}><Text style={{ color: currentThemeColors.text, fontSize: 16 }}>So much empty... Select an exercise above!</Text></View>;
        return (
          <SectionList
            sections={historyData}
            keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
            stickySectionHeadersEnabled={true}
            onRefresh={fetchHistory}
            refreshing={loading}
            renderSectionHeader={({ section: { title } }) => (
              <View style={[styles.historyHeader, { backgroundColor: currentThemeColors.background, borderBottomColor: currentThemeColors.border }]}>
                <Text style={[styles.historyHeaderText, { color: currentThemeColors.primary }]}>{title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={[styles.historyItem, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.sm }]}>
                <View style={styles.historyTopRow}>
                  <Text style={[styles.historyName, { color: currentThemeColors.text }]}>{item.exercise_name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.historyStats, { color: currentThemeColors.primary }]}>{item.sets} Sets / {item.reps} Reps / {item.weight} lbs</Text>
                    {allTimePR?.id === item.id && <Ionicons name="trophy" size={16} color="#FFD700" style={{ marginLeft: 6 }} />}
                  </View>
                </View>
              </View>
            )}
            contentContainerStyle={{ padding: 15 }}
          />
        );
      })()}

      {activeTab === 'graph' && (() => {
        if (!activeExercise) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}><Text style={{ color: currentThemeColors.text, fontSize: 16 }}>So much empty... Select an exercise above!</Text></View>;
        return (
          <ScrollView contentContainerStyle={{ padding: 15 }}>
            <Text style={[styles.title, { color: currentThemeColors.text }]}>Progress Analysis</Text>
            <View style={[styles.activeGraphHeader, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.sm }]}>
               <Text style={[styles.activeGraphExName, { color: currentThemeColors.primary }]}>{activeExercise}</Text>
               <Text style={{ color: currentThemeColors.textSecondary, fontSize: 12 }}>All-Time PR: {historicalMax.weight} lbs x {historicalMax.reps}</Text>
               {graphLoading && <ActivityIndicator size="small" color={currentThemeColors.primary} style={{ marginTop: 10 }} />}
            </View>

            {graphData.length > 1 ? (
               <View style={styles.chartWrapper}>
                 <LineChart
                   data={{
                     labels: graphData.map(d => d.date),
                     datasets: [{ data: graphData.map(d => d.weight) }]
                   }}
                   width={Dimensions.get("window").width - 30}
                   height={220}
                   chartConfig={{
                     backgroundColor: currentThemeColors.card,
                     backgroundGradientFrom: currentThemeColors.card,
                     backgroundGradientTo: currentThemeColors.card,
                     decimalPlaces: 0,
                     color: (opacity = 1) => currentThemeColors.primary,
                     labelColor: (opacity = 1) => currentThemeColors.textSecondary,
                     propsForDots: {
                       r: "6",
                       strokeWidth: "2",
                       stroke: currentThemeColors.primary
                     }
                   }}
                   bezier
                   style={{
                     marginVertical: 8,
                     borderRadius: 16
                   }}
                 />
                 <Text style={[styles.chartStatus, { color: currentThemeColors.textSecondary }]}>Progression of Max Weight (lbs)</Text>
               </View>
            ) : (
              <View style={[styles.emptyChart, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.sm }]}>
                <Ionicons name="analytics-outline" size={48} color={currentThemeColors.surface} />
                <Text style={{ color: currentThemeColors.textSecondary, marginTop: 10, textAlign: 'center' }}>
                  {graphData.length === 1 
                    ? 'Need at least 2 sessions to graph progress' 
                    : (activeExercise ? `No history for ${activeExercise} yet. Log more sessions!` : 'Select an exercise to see your progress')}
                </Text>
              </View>
            )}
          </ScrollView>
        );
      })()}

      <Modal visible={isEditModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: dark ? '#1C1C1E' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: currentThemeColors.text }]}>Edit Lift</Text>
            <View style={styles.modalInputSection}>
              <Text style={{ color: currentThemeColors.textSecondary, marginBottom: 5 }}>Exercise Name</Text>
              <TextInput 
              style={[styles.inputFullModal, { backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
              value={editExerciseName} 
              onChangeText={setEditExerciseName} 
              />

              <View style={{flexDirection: 'row', marginTop: 15}}>
                 <View style={{flex: 1, marginRight: 5}}>
                 <Text style={{ color: currentThemeColors.textSecondary, marginBottom: 5 }}>Weight</Text>
                 <TextInput 
                 style={[styles.inputModal, {flex: 1, marginRight: 5, backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
                 value={editWeight} 
                 onChangeText={setEditWeight} 
                 keyboardType="numeric"
                 />
                 </View>
                 <View style={{flex: 1, marginHorizontal: 5}}>
                 <Text style={{ color: currentThemeColors.textSecondary, marginBottom: 5 }}>Sets</Text>
                 <TextInput 
                 style={[styles.inputModal, {flex: 1, marginHorizontal: 5, backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
                 value={editSets} 
                 onChangeText={setEditSets} 
                 keyboardType="numeric"
                 />
                 </View>
                 <View style={{flex: 1, marginLeft: 5}}>
                 <Text style={{ color: currentThemeColors.textSecondary, marginBottom: 5 }}>Reps</Text>
                 <TextInput 
                 style={[styles.inputModal, {flex: 1, marginLeft: 5, backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
                 value={editReps} 
                 onChangeText={setEditReps} 
                 keyboardType="numeric"
                 />
                 </View>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: dark ? '#2C2C2E' : '#eee' }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.cancelTxt, { color: dark ? '#aaa' : '#555' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                <Text style={styles.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Exercise Selector Modal */}
      <Modal visible={isSelectorVisible} animationType="slide" transparent={true} onRequestClose={() => setSelectorVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: dark ? '#1C1C1E' : '#fff', height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: currentThemeColors.text }]}>Choose Exercise</Text>
              <TouchableOpacity onPress={() => setSelectorVisible(false)}>
                <Ionicons name="close" size={24} color={currentThemeColors.text} />
              </TouchableOpacity>
            </View>
            <SectionList
              sections={EXERCISE_DATABASE.map(cat => ({ title: cat.category, color: cat.color, data: cat.exercises }))}
              keyExtractor={(item) => item}
              renderSectionHeader={({ section }) => {
                const isExpanded = expandedCats.includes(section.title);
                return (
                  <TouchableOpacity 
                      onPress={() => toggleCat(section.title)}
                      style={[styles.catHeader, { borderBottomColor: currentThemeColors.border }]} 
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.catIndicator, { backgroundColor: section.color }]} />
                        <Text style={[styles.catHeaderText, { color: currentThemeColors.text }]}>{section.title}</Text>
                    </View>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={currentThemeColors.primary} />
                  </TouchableOpacity>
                );
              }}
              renderItem={({ item, section }) => {
                if (!expandedCats.includes(section.title)) return null;
                return (
                  <TouchableOpacity 
                        onPress={() => { setActiveExercise(item); setSelectorVisible(false); }}
                        style={[styles.exItem, { borderBottomColor: currentThemeColors.border }]} 
                  >
                    <View style={styles.exItemInner}>
                        <View style={[styles.catDot, { backgroundColor: section.color }]} />
                        <Text style={[styles.exItemText, { color: currentThemeColors.text }]}>{item}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={currentThemeColors.primary} />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedWrapper: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 5,
    zIndex: 10,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 25,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyHeader: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
    marginTop: 10,
  },
  historyHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyItem: {
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 10,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyName: {
    fontSize: 15,
    fontWeight: '600',
  },
  historyStats: {
    fontSize: 13,
    fontWeight: '500',
  },
  searchBox: {
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  chartStatus: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyChart: {
    height: 250,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 20,
  },
  activeSection: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  exerciseSelectorTrigger: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginRight: 10,
  },
  exerciseSelectorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  timerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  catWrapper: {
    marginBottom: 10,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  catHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  exItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 20,
    borderBottomWidth: 0.5,
  },
  exItemText: {
    fontSize: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  exerciseInput: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
    paddingVertical: 5,
  },
  volumeBadge: {
    alignItems: 'flex-end',
  },
  volumeLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  volumeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#007AFF',
  },
  gridHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 10,
  },
  gridHeaderText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  setText: {
    fontSize: 16,
  },
  removeSetBtn: {
    width: 40,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 15,
    marginTop: 5,
  },
  gridInput: {
    height: 40,
    borderRadius: 10,
    marginHorizontal: 5,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  addSetBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 5,
  },
  addSetBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  deleteSwipeBtn: {
    backgroundColor: '#FF3B30',
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginVertical: 4,
  },
  timerCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
    letterSpacing: 2,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginBottom: 15,
  },
  timerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  timerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  timerBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  finishSection: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 30,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  durationInput: {
    width: 60,
    height: 35,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  finishBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  finishBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 15,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseNameText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 12,
  },
  macroBox: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  macroLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputFullModal: {
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 15,
  },
  inputModal: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelTxt: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeGraphHeader: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  activeGraphExName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
});
