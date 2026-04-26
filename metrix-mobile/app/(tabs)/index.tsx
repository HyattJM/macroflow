import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, DeviceEventEmitter, TouchableOpacity, Alert, Modal, TextInput, FlatList, Switch, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { PieChart, LineChart } from 'react-native-chart-kit';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import apiClient from '../../src/api/apiClient';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../src/context/ThemeContext';
import { EXERCISE_DATABASE } from './workout';
import { setupHealthConnect } from '../../src/utils/biometrics';
import Constants from 'expo-constants';
import { WorkoutCalendarHistory } from '../../src/components/workout/WorkoutCalendarHistory';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// Helper to format time for display
const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

// Helper to parse HH:mm into a Date object
const parseTime = (timeStr: string) => {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  } catch (e) {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  }
};

const calculateDynamicGoals = (currentWeightLbs: number, age: number, heightCm: number) => {
  const weightKg = currentWeightLbs / 2.20462;
  
  // Mifflin-St Jeor Equation for Men
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  const tdee = bmr * 1.55; // Moderate activity factor
  
  const targetNetCarbs = 50;
  const targetProtein = currentWeightLbs * 1; // 1g per lb
  const targetFat = (tdee - (targetProtein * 4) - (targetNetCarbs * 4)) / 9;
  
  return {
    calories: Math.round(tdee),
    protein: Math.round(targetProtein),
    fat: Math.round(targetFat),
    net_carbs: targetNetCarbs
  };
};

export default function DashboardScreen() {
  const [macros, setMacros] = useState(null);
  const [waterOz, setWaterOz] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [tokens, setTokens] = useState(0);
  const [timeLeft, setTimeLeft] = useState('');
  const [isFeedingWindow, setIsFeedingWindow] = useState(false);
  const [isIfEnabled, setIsIfEnabled] = useState(true);
  const [ifStart, setIfStart] = useState('21:00');
  const [ifEnd, setIfEnd] = useState('09:00');
  const [heartRate, setHeartRate] = useState('--');
  
  // Biometrics
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [currentBmi, setCurrentBmi] = useState<number | null>(null);
  const [biometricsLoading, setBiometricsLoading] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeightInput, setNewWeightInput] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [biometricHistory, setBiometricHistory] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'list' | 'graph'>('list');
  
  // Profile Stats
  const [userProfile, setUserProfile] = useState({
    age: 26,
    height_inches: 72,
    weight_lbs: 180,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Consolidated Settings State
  const [ifProtocol, setIfProtocol] = useState('16/8');
  const [ifStartTime, setIfStartTime] = useState(parseTime('21:00'));
  const [ifEndTime, setIfEndTime] = useState(parseTime('09:00'));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const { themeName, currentThemeColors, setThemeName, layout, typography } = useAppTheme();
  const isDark = currentThemeColors.isDark;

  const router = useRouter();
  const { logout } = useAuth();

  useFocusEffect(
    useCallback(() => {
      fetchDailyMacros();
      fetchTokens();
      loadIfSettings();
      fetchWorkouts();
      fetchBiometrics();
      fetchProfile();
    }, []) // ✅ EMPTY ARRAY
  );

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/profile/');
      if (res.data.status === 'success') {
        setUserProfile(res.data.data);
      }
    } catch (e) {
      console.error("Failed to fetch profile:", e);
    }
  };

  const saveProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await apiClient.post('/profile/', userProfile);
      if (res.data.status === 'success') {
        Toast.show({
          type: 'success',
          text1: 'Profile Saved',
          text2: 'Your dynamic goals have been updated.',
        });
        setShowSettings(false);
        fetchBiometrics(); // Refresh to ensure everything is in sync
      }
    } catch (e) {
      console.error("Failed to save profile:", e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update profile stats.',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    setupHealthConnect();
  }, []);

  useEffect(() => {
    if (Constants.appOwnership !== 'expo') return;

    const interval = setInterval(() => {
      const mockRate = Math.floor(Math.random() * (70 - 60 + 1)) + 60;
      setHeartRate(mockRate.toString());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const loadIfSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('if_enabled');
      const prot = await AsyncStorage.getItem('if_protocol');
      const start = await AsyncStorage.getItem('if_start_time');
      const end = await AsyncStorage.getItem('if_end_time');

      if (enabled !== null) setIsIfEnabled(enabled === 'true');
      if (prot !== null) setIfProtocol(prot);
      if (start !== null) {
        setIfStart(start);
        setIfStartTime(parseTime(start));
      }
      if (end !== null) {
        setIfEnd(end);
        setIfEndTime(parseTime(end));
      }
    } catch (e) {
      console.error("Failed to load IF settings on dashboard", e);
    }
  };

  const saveIfSetting = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error(`Failed to save ${key}`, e);
    }
  };

  const handleIfToggle = (val: boolean) => {
    setIsIfEnabled(val);
    saveIfSetting('if_enabled', val.toString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleProtocolChange = (p: string) => {
    setIfProtocol(p);
    saveIfSetting('if_protocol', p);
    
    let startStr = '21:00';
    let endStr = '13:00';

    if (p === '16/8') {
      startStr = '21:00';
      endStr = '13:00';
    } else if (p === '12/12') {
      startStr = '21:00';
      endStr = '09:00';
    }

    if (p !== 'Custom') {
      const start = parseTime(startStr);
      const end = parseTime(endStr); 
      setIfStartTime(start);
      setIfEndTime(end);
      setIfStart(startStr);
      setIfEnd(endStr);
      saveIfSetting('if_start_time', startStr);
      saveIfSetting('if_end_time', endStr);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setIfStartTime(selectedDate);
      const timeStr = formatTime(selectedDate);
      setIfStart(timeStr);
      saveIfSetting('if_start_time', timeStr);
      if (ifProtocol !== 'Custom') setIfProtocol('Custom');
    }
  };

  const onEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setIfEndTime(selectedDate);
      const timeStr = formatTime(selectedDate);
      setIfEnd(timeStr);
      saveIfSetting('if_end_time', timeStr);
      if (ifProtocol !== 'Custom') setIfProtocol('Custom');
    }
  };

  useEffect(() => {
    if (!isIfEnabled) return;

    const updateTimer = () => {
      const now = new Date();
      const [sh, sm] = ifStart.split(':').map(Number);
      const [eh, em] = ifEnd.split(':').map(Number);

      const nowTime = now.getHours() * 60 + now.getMinutes();
      const startTime = sh * 60 + sm;
      const endTime = eh * 60 + em;

      let isFeeding = false;
      let target = new Date(now);
      target.setSeconds(0, 0);

      if (startTime < endTime) {
        // Simple case: start=9AM, end=9PM
        isFeeding = (nowTime >= startTime && nowTime < endTime);
        if (isFeeding) {
          target.setHours(eh, em);
        } else {
          target.setHours(sh, sm);
          if (nowTime >= endTime) target.setDate(now.getDate() + 1);
        }
      } else {
        // Midnight case: start=9PM, end=9AM
        isFeeding = (nowTime >= startTime || nowTime < endTime);
        if (isFeeding) {
          target.setHours(eh, em);
          if (nowTime >= startTime) target.setDate(now.getDate() + 1);
        } else {
          target.setHours(sh, sm);
        }
      }

      const diff = target.getTime() - now.getTime();
      const diffH = Math.floor(diff / 3600000);
      const diffM = Math.floor((diff % 3600000) / 60000);
      
      setIsFeedingWindow(isFeeding);
      setTimeLeft(`${diffH}h ${diffM}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [isIfEnabled, ifStart, ifEnd]);

  const fetchTokens = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await apiClient.get('/tokens/');
      if (response.data && response.data.tokens !== undefined) {
        setTokens(response.data.tokens);
      }
    } catch (e) {
      console.error("Failed to fetch tokens:", e);
    }
  };

  const fetchBiometrics = async () => {
    try {
      const res = await apiClient.get('/biometrics/');
      if (res.data.status === 'success' && res.data.data.length > 0) {
        const sortedData = [...res.data.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setBiometricHistory(res.data.data); 
        
        const latest = res.data.data[res.data.data.length - 1];
        setCurrentWeight(latest.weight_lbs);
        setCurrentBmi(latest.bmi);
      }
    } catch (e) {
      console.error("Failed to fetch biometrics:", e);
    }
  };

  const handleUpdateWeight = async () => {
    const weightVal = parseFloat(newWeightInput);
    if (!weightVal || weightVal <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }
    
    setBiometricsLoading(true);
    try {
      const heightInches = userProfile.height_inches || 72;
      const bmi = (weightVal / (heightInches * heightInches)) * 703;
      
      const res = await apiClient.post('/biometrics/', {
        weight_lbs: weightVal,
        bmi: Math.round(bmi * 10) / 10
      });
      
      if (res.data.status === 'success') {
        setCurrentWeight(weightVal);
        setCurrentBmi(Math.round(bmi * 10) / 10);
        setShowWeightModal(false);
        setNewWeightInput('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: 'Metrics Updated!',
          text2: `Weight logged as ${weightVal} lbs`,
          position: 'top',
          visibilityTime: 2500,
        });
      }
    } catch (e) {
      console.error('Failed to update weight', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update weight.',
        position: 'top',
      });
    } finally {
      setBiometricsLoading(false);
    }
  };

  const fetchDailyMacros = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const [macroRes, waterRes] = await Promise.all([
        apiClient.get('/daily-summary/'),
        apiClient.get('/today-water/')
      ]);
      if (macroRes.status === 200) {
        setMacros(macroRes.data);
      }
      if (waterRes.data.status === 'success') {
        setWaterOz(waterRes.data.data.total_oz);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkouts = async () => {
    try {
      const response = await apiClient.get('/workouts/');
      if (response.data.status === 'success') {
        setWorkouts(response.data.data);
      }
    } catch (e: any) {
      if (e.response?.status === 401) return;
      console.error('Failed to fetch workouts for dashboard', e);
    }
  };

  const handleLogWater = async (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post('/log-water/', { amount_oz: amount });
      if (res.data.status === 'success') {
        fetchDailyMacros();
      }
    } catch (err) {
      console.error('Failed to log water', err);
    }
  };

  const dynamicGoals = useMemo(() => {
    const weight = currentWeight || userProfile.weight_lbs;
    const heightCm = userProfile.height_inches * 2.54;
    return calculateDynamicGoals(weight, userProfile.age, heightCm);
  }, [currentWeight, userProfile, macros]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const goals = dynamicGoals;
  const WATER_GOAL = 128; 

  const currentCarbs = macros ? macros.net_carbs : 0;
  const carbProgress = Math.min((currentCarbs / goals.net_carbs) * 100, 100);

  const burned = macros ? macros.burned : 0;
  const netCalories = macros ? macros.calories : 0;
  const calProgress = Math.min((netCalories / goals.calories) * 100, 100);

  const chartData = [
    {
      name: 'Protein',
      population: macros ? macros.protein : 0,
      color: '#FF9500',
      legendFontColor: '#7F7F7F',
      legendFontSize: 14,
    },
    {
      name: 'Fat',
      population: macros ? macros.fat : 0,
      color: '#FF3B30',
      legendFontColor: '#7F7F7F',
      legendFontSize: 14,
    },
    {
      name: 'Net Carbs',
      population: macros ? macros.net_carbs : 0,
      color: '#007AFF',
      legendFontColor: '#7F7F7F',
      legendFontSize: 14,
    },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: currentThemeColors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Session Navigation Header */}
      <View style={[styles.sessionHeader, { marginTop: layout.spacing.xl }]}>
        <View>
          <Text style={[styles.greetingText, { color: currentThemeColors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.nameText, { color: currentThemeColors.text }]}>Champion</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity 
          onPress={() => setShowSettings(!showSettings)} 
          style={[styles.iconHeaderBtn, { backgroundColor: currentThemeColors.card, ...layout.shadows.sm }]}
        >
          <Ionicons name={showSettings ? "close" : "settings-outline"} size={24} color={currentThemeColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Consolidated Settings Overlay as a true Modal */}
      <Modal visible={showSettings} transparent={true} animationType="none">
        <Animated.View 
          entering={FadeInUp.duration(400)}
          style={[styles.settingsOverlay, { backgroundColor: currentThemeColors.card, borderBottomColor: currentThemeColors.border, height: '100%', maxHeight: '100%' }]}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.overlayTitle, { color: currentThemeColors.text, marginBottom: 0 }]}>Settings & Profile</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={32} color={currentThemeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Profile & Stats Section */}
            <View style={[styles.settingsSection, { backgroundColor: currentThemeColors.surface + '50', borderColor: currentThemeColors.border }]}>
              <Text style={[styles.sectionHeader, { color: currentThemeColors.primary }]}>Profile & Stats</Text>
              <View style={styles.profileGrid}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: currentThemeColors.textSecondary }]}>AGE</Text>
                  <TextInput 
                    style={[styles.overlayInput, { backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]}
                    value={userProfile.age.toString()}
                    keyboardType="numeric"
                    onChangeText={(text) => setUserProfile({...userProfile, age: parseInt(text) || 0})}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: currentThemeColors.textSecondary }]}>HEIGHT (IN)</Text>
                  <TextInput 
                    style={[styles.overlayInput, { backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]}
                    value={userProfile.height_inches.toString()}
                    keyboardType="numeric"
                    onChangeText={(text) => setUserProfile({...userProfile, height_inches: parseFloat(text) || 0})}
                  />
                </View>
              </View>
              
              <TouchableOpacity 
                style={[styles.saveProfileBtn, { backgroundColor: currentThemeColors.primary }]}
                onPress={saveProfile}
                disabled={profileLoading}
              >
                {profileLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveProfileText}>Sync Biometrics</Text>}
              </TouchableOpacity>
            </View>

            {/* Intermittent Fasting Section */}
            <View style={[styles.settingsSection, { backgroundColor: currentThemeColors.surface + '50', borderColor: currentThemeColors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.sectionHeader, { color: currentThemeColors.primary, marginBottom: 0 }]}>Fasting Timer</Text>
                <Switch value={isIfEnabled} onValueChange={handleIfToggle} trackColor={{ false: '#333', true: currentThemeColors.primary }} />
              </View>

              {isIfEnabled && (
                <>
                  <View style={styles.protocolRow}>
                    {['12/12', '16/8', 'Custom'].map((p) => (
                      <TouchableOpacity 
                         key={p} 
                         style={[
                           styles.protocolBtn, 
                           { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border },
                           ifProtocol === p && { backgroundColor: currentThemeColors.primary, borderColor: currentThemeColors.primary }
                         ]}
                         onPress={() => handleProtocolChange(p)}
                       >
                         <Text style={[styles.protocolText, { color: currentThemeColors.textSecondary }, ifProtocol === p && { color: '#fff' }]}>{p}</Text>
                       </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.timeSection}>
                    <TouchableOpacity style={[styles.timeBox, { backgroundColor: currentThemeColors.surface }]} onPress={() => setShowStartPicker(true)}>
                      <Text style={styles.timeLabel}>Starts</Text>
                      <Text style={[styles.timeValue, { color: currentThemeColors.text, fontSize: 16 }]}>{formatTime(ifStartTime)}</Text>
                    </TouchableOpacity>
                    <Ionicons name="arrow-forward" size={16} color={currentThemeColors.textSecondary} style={{ marginHorizontal: 8 }} />
                    <TouchableOpacity style={[styles.timeBox, { backgroundColor: currentThemeColors.surface }]} onPress={() => setShowEndPicker(true)}>
                      <Text style={styles.timeLabel}>Ends</Text>
                      <Text style={[styles.timeValue, { color: currentThemeColors.text, fontSize: 16 }]}>{formatTime(ifEndTime)}</Text>
                    </TouchableOpacity>
                  </View>

                  {showStartPicker && (
                    <DateTimePicker value={ifStartTime} mode="time" is24Hour={true} onChange={onStartTimeChange} />
                  )}
                  {showEndPicker && (
                    <DateTimePicker value={ifEndTime} mode="time" is24Hour={true} onChange={onEndTimeChange} />
                  )}
                </>
              )}
            </View>

            {/* Appearance Section */}
            <View style={[styles.settingsSection, { backgroundColor: currentThemeColors.surface + '50', borderColor: currentThemeColors.border }]}>
              <Text style={[styles.sectionHeader, { color: currentThemeColors.primary }]}>Appearance</Text>
              <View style={[styles.protocolRow, { flexWrap: 'wrap' }]}>
                {[
                  { id: 'defaultDark', label: 'Tokyo' },
                  { id: 'deepSeaDark', label: 'Ocean' },
                  { id: 'synthWave', label: 'Synth' },
                  { id: 'classicLight', label: 'Light' }
                ].map((t) => (
                  <TouchableOpacity 
                    key={t.id} 
                    style={[
                      styles.protocolBtn, 
                      { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border, minWidth: '45%' },
                      themeName === t.id && { backgroundColor: currentThemeColors.primary, borderColor: currentThemeColors.primary }
                    ]}
                    onPress={() => {
                      setThemeName(t.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[styles.protocolText, { color: currentThemeColors.textSecondary }, themeName === t.id && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ACCOUNT SECTION (Now clearly visible) */}
            <View style={[styles.settingsSection, { backgroundColor: currentThemeColors.surface + '50', borderColor: currentThemeColors.border }]}>
              <Text style={[styles.sectionHeader, { color: currentThemeColors.error }]}>Account</Text>
              <TouchableOpacity 
                style={[styles.dangerButton, { backgroundColor: currentThemeColors.error + '10', borderColor: currentThemeColors.error }]} 
                onPress={() => {
                  Alert.alert("Logout", "Are you sure you want to log out?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Logout", style: "destructive", onPress: logout }
                  ]);
                }}
              >
                <Ionicons name="log-out-outline" size={18} color={currentThemeColors.error} />
                <Text style={[styles.dangerButtonText, { color: currentThemeColors.error }]}>Log Out</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.dangerButton, { backgroundColor: currentThemeColors.error + '10', borderColor: currentThemeColors.error, marginTop: 12 }]} 
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Alert.alert(
                    "Reset Account",
                    "This will wipe your profile and onboarding data. This action cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Reset", style: "destructive", onPress: logout }
                    ]
                  );
                }}
              >
                <Ionicons name="refresh-outline" size={18} color={currentThemeColors.error} />
                <Text style={[styles.dangerButtonText, { color: currentThemeColors.error }]}>Reset All Data</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Body Metrics Card */}
      <Animated.View entering={FadeInUp.delay(50)} style={[styles.premiumCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.sm, marginBottom: 20 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.cardTitle, { color: currentThemeColors.text, marginBottom: 0, flex: 1 }]}>Body Metrics</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={{ 
                backgroundColor: 'transparent', 
                borderColor: currentThemeColors.border, 
                borderWidth: 1,
                paddingHorizontal: 12, 
                paddingVertical: 4, 
                borderRadius: 8,
              }} 
              onPress={() => setShowHistoryModal(true)}
            >
              <Text style={{ color: currentThemeColors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ 
                backgroundColor: currentThemeColors.surface, 
                borderColor: currentThemeColors.primary, 
                borderWidth: 1,
                paddingHorizontal: 12, 
                paddingVertical: 4, 
                borderRadius: 8,
              }} 
              onPress={() => setShowWeightModal(true)}
            >
              <Text style={{ color: currentThemeColors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 15, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.metricLabel, { color: currentThemeColors.textSecondary }]}>CURRENT WEIGHT</Text>
            <Text style={[styles.metricValue, { color: currentThemeColors.primary, fontSize: 24 }]}>{currentWeight ? currentWeight.toFixed(1) : '--'} <Text style={{ fontSize: 14 }}>lbs</Text></Text>
          </View>
          <View style={{ width: 1, backgroundColor: currentThemeColors.border, height: '80%', alignSelf: 'center' }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.metricLabel, { color: currentThemeColors.textSecondary }]}>CURRENT BMI</Text>
            <Text style={[styles.metricValue, { color: currentThemeColors.text, fontSize: 24 }]}>{currentBmi ? currentBmi.toFixed(1) : '--'}</Text>
          </View>
        </View>
      </Animated.View>

      {/* AI Token Display */}
      <Animated.View entering={FadeInUp.delay(100)} style={[styles.tokenCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <View style={styles.tokenInfo}>
          <View style={[styles.tokenIconBadge, { backgroundColor: currentThemeColors.primary + '15' }]}>
            <Ionicons name="sparkles" size={24} color={currentThemeColors.primary} />
          </View>
          <View style={{ marginLeft: layout.spacing.md }}>
            <Text style={[styles.tokenHeader, { color: currentThemeColors.primary }]}>AI POWER-UP</Text>
            <Text style={[styles.tokenSubText, { color: currentThemeColors.textSecondary }]}>{tokens} scans remaining</Text>
          </View>
        </View>
        <View style={[styles.tokenProgressBar, { backgroundColor: currentThemeColors.surface }]}>
          <View style={[styles.tokenProgressFill, { width: `${(tokens / 50) * 100}%`, backgroundColor: currentThemeColors.primary }]} />
        </View>
      </Animated.View>

      {/* Intermittent Fasting Card */}
      {isIfEnabled ? (
        <AnimatedTouchableOpacity 
          entering={FadeInUp.delay(200)}
          activeOpacity={0.8}
          onPress={() => setShowSettings(true)} // FIXED THE ROUTE CRASH HERE
          style={[
            styles.fastingCard, 
            { backgroundColor: currentThemeColors.card, borderColor: isFeedingWindow ? currentThemeColors.success + '40' : currentThemeColors.warning + '40' },
            layout.shadows.md
          ]}
        >
          <View style={styles.fastingHeader}>
            <View style={[styles.statusDot, { backgroundColor: isFeedingWindow ? currentThemeColors.success : currentThemeColors.warning }]} />
            <Text style={[styles.fastingStatus, { color: isFeedingWindow ? currentThemeColors.success : currentThemeColors.warning }]}>
              {isFeedingWindow ? 'Feeding Phase Open' : 'Fasting Phase'}
            </Text>
          </View>
          <View style={styles.fastingContent}>
            <View>
              <Text style={[styles.timeLabel, { color: currentThemeColors.textSecondary }]}>Ends in</Text>
              <Text style={[styles.timeValue, { color: currentThemeColors.text }]}>{timeLeft}</Text>
            </View>
            <Ionicons name={isFeedingWindow ? "restaurant-outline" : "moon-outline"} size={40} color={isFeedingWindow ? currentThemeColors.success : currentThemeColors.warning} opacity={0.6} />
          </View>
        </AnimatedTouchableOpacity>
      ) : (
        <Animated.View entering={FadeInUp.delay(200)} style={[styles.fastingDisabledCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>
          <Text style={[styles.fastingDisabledText, { color: currentThemeColors.textSecondary }]}>Intermittent Fasting is disabled.</Text>
          <TouchableOpacity onPress={() => setShowSettings(true)}> {/* FIXED THE ROUTE CRASH HERE */}
            <Text style={[styles.enableLink, { color: currentThemeColors.primary }]}>Enable in Settings</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Heart Rate Metric Card */}
      <Animated.View entering={FadeInUp.delay(300)} style={[styles.heartRateCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.sm }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="heart" size={20} color={currentThemeColors.error} />
          <Text style={[styles.heartRateLabel, { color: currentThemeColors.textSecondary, marginLeft: 8 }]}>HEART RATE</Text>
        </View>
        <Text style={[styles.heartRateValue, { color: currentThemeColors.text }]}>{heartRate} <Text style={{ fontSize: 16, fontWeight: 'normal' }}>BPM</Text></Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400)} style={{ marginHorizontal: 0, marginBottom: 8 }}>
        <WorkoutCalendarHistory workouts={workouts} />
      </Animated.View>

      <Animated.Text entering={FadeInUp.delay(500)} style={[styles.title, { color: currentThemeColors.text, marginTop: layout.spacing.lg }]}>Daily Breakdown</Animated.Text>
      
      {/* Carb Tracker Card */}
      <Animated.View entering={FadeInUp.delay(600)} style={[styles.premiumCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <Text style={[styles.cardTitle, { color: currentThemeColors.info }]}>Net Carbs</Text>
        <View style={styles.progressHeader}>
          <Text style={[styles.carbValue, { color: currentThemeColors.text }]}>{currentCarbs.toFixed(1)}<Text style={{ fontSize: 18 }}>g</Text></Text>
          <Text style={[styles.carbLimit, { color: currentThemeColors.textSecondary }]}>/ {goals.net_carbs}g limit</Text>
        </View>
        <View style={[styles.progressBarBackground, { backgroundColor: currentThemeColors.surface }]}>
          <View style={[styles.progressBarFill, { width: `${carbProgress}%`, backgroundColor: currentCarbs > goals.net_carbs ? currentThemeColors.error : currentThemeColors.info }]} />
        </View>
      </Animated.View>

      {/* Pie Chart Card - Visual Polish */}
      <Animated.View entering={FadeInUp.delay(700)} style={[styles.premiumCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <Text style={[styles.cardTitle, { color: currentThemeColors.text }]}>Macro Split</Text>
        <View style={{ alignItems: 'center', paddingRight: 10 }}>
          <PieChart
            data={chartData}
            width={screenWidth - 70}
            height={200}
            chartConfig={{
              color: (opacity = 1) => currentThemeColors.text,
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"0"}
            center={[10, 0]}
            absolute
          />
        </View>
      </Animated.View>

      {/* Water Tracker Card */}
      <Animated.View entering={FadeInUp.delay(800)} style={[styles.premiumCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.cardTitle, { color: currentThemeColors.success, marginBottom: 0 }]}>Water Intake</Text>
          <Ionicons name="water" size={24} color={currentThemeColors.success} />
        </View>
        <View style={styles.progressHeader}>
          <Text style={[styles.carbValue, { color: currentThemeColors.text }]}>{waterOz}<Text style={{ fontSize: 18 }}>oz</Text></Text>
          <Text style={[styles.carbLimit, { color: currentThemeColors.textSecondary }]}>/ {WATER_GOAL} oz goal</Text>
        </View>
        <View style={[styles.progressBarBackground, { backgroundColor: currentThemeColors.surface }]}>
          <View style={[styles.progressBarFill, { width: `${Math.min((waterOz / WATER_GOAL) * 100, 100)}%`, backgroundColor: currentThemeColors.success }]} />
        </View>
        <View style={styles.waterButtons}>
          <TouchableOpacity style={[styles.waterBtn, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.success }]} onPress={() => handleLogWater(8)}>
            <Text style={[styles.waterBtnText, { color: currentThemeColors.success }]}>+ 8 oz</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.waterBtn, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.success }]} onPress={() => handleLogWater(16)}>
            <Text style={[styles.waterBtnText, { color: currentThemeColors.success }]}>+ 16 oz</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Other Metrics Grid */}
      <View style={styles.grid}>
        {[
          { label: 'Calories', value: Math.round(netCalories), goal: goals.calories, color: currentThemeColors.primary, progress: calProgress },
          { label: 'Protein', value: macros ? macros.protein.toFixed(0) : 0, goal: goals.protein, color: currentThemeColors.warning, progress: (macros?.protein / goals.protein) * 100 },
          { label: 'Fat', value: macros ? macros.fat.toFixed(0) : 0, goal: goals.fat, color: currentThemeColors.error, progress: (macros?.fat / goals.fat) * 100 },
        ].map((item, idx) => (
          <Animated.View entering={FadeInUp.delay(900 + (idx * 100))} key={idx} style={[styles.metricCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.sm }]}>
            <Text style={[styles.metricLabel, { color: currentThemeColors.textSecondary }]}>{item.label.toUpperCase()}</Text>
            <Text style={[styles.metricValue, { color: currentThemeColors.text }]}>{item.value}</Text>
            <Text style={[styles.metricGoal, { color: currentThemeColors.textSecondary }]}>/ {item.goal}{item.label !== 'Calories' ? 'g' : ''}</Text>
            <View style={[styles.miniProgress, { backgroundColor: currentThemeColors.surface }]}>
              <View style={[styles.miniFill, { width: `${Math.min(item.progress, 100)}%`, backgroundColor: item.color }]} />
            </View>
          </Animated.View>
        ))}
      </View>
      
      <Modal visible={showWeightModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentThemeColors.card, width: '80%' }]}>
            <Text style={[styles.modalHeader, { color: currentThemeColors.text }]}>Log Weight</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: currentThemeColors.border,
                backgroundColor: currentThemeColors.surface,
                color: currentThemeColors.text,
                padding: 15,
                borderRadius: 12,
                fontSize: 18,
                textAlign: 'center',
                marginBottom: 20
              }}
              placeholder="Weight (lbs)"
              placeholderTextColor={currentThemeColors.textSecondary}
              keyboardType="numeric"
              value={newWeightInput}
              onChangeText={setNewWeightInput}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 15, backgroundColor: currentThemeColors.surface, borderRadius: 12, alignItems: 'center' }} onPress={() => setShowWeightModal(false)}>
                <Text style={{ color: currentThemeColors.text, fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, padding: 15, backgroundColor: currentThemeColors.primary, borderRadius: 12, alignItems: 'center' }} 
                onPress={handleUpdateWeight}
                disabled={biometricsLoading}
              >
                {biometricsLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHistoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentThemeColors.card, height: '80%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalHeader, { color: currentThemeColors.text, flex: 1, textAlign: 'left' }]}>Weight History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color={currentThemeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.tabContainer, { backgroundColor: currentThemeColors.surface, marginBottom: 20 }]}>
              <TouchableOpacity 
                style={[styles.tabButton, historyTab === 'list' && { backgroundColor: currentThemeColors.card }]} 
                onPress={() => setHistoryTab('list')}
              >
                <Text style={[styles.tabText, { color: historyTab === 'list' ? currentThemeColors.primary : currentThemeColors.textSecondary }]}>List View</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, historyTab === 'graph' && { backgroundColor: currentThemeColors.card }]} 
                onPress={() => setHistoryTab('graph')}
              >
                <Text style={[styles.tabText, { color: historyTab === 'graph' ? currentThemeColors.primary : currentThemeColors.textSecondary }]}>Graph View</Text>
              </TouchableOpacity>
            </View>

            {historyTab === 'list' ? (
              <FlatList
                data={[...biometricHistory].reverse()}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={[styles.historyRow, { borderBottomColor: currentThemeColors.border }]}>
                    <View>
                      <Text style={[styles.historyDate, { color: currentThemeColors.text }]}>{item.date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.historyWeight, { color: currentThemeColors.primary }]}>{item.weight_lbs} lbs</Text>
                      <Text style={[styles.historyBmi, { color: currentThemeColors.textSecondary }]}>BMI: {item.bmi}</Text>
                    </View>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                {biometricHistory.length > 1 ? (
                  <LineChart
                    data={{
                      labels: biometricHistory.slice(-7).map(d => d.date),
                      datasets: [{ data: biometricHistory.slice(-7).map(d => d.weight_lbs) }]
                    }}
                    width={screenWidth - 48}
                    height={220}
                    chartConfig={{
                      backgroundColor: currentThemeColors.card,
                      backgroundGradientFrom: currentThemeColors.card,
                      backgroundGradientTo: currentThemeColors.card,
                      decimalPlaces: 1,
                      color: (opacity = 1) => currentThemeColors.primary,
                      labelColor: (opacity = 1) => currentThemeColors.textSecondary,
                      style: { borderRadius: 16 },
                      propsForDots: { r: "6", strokeWidth: "2", stroke: currentThemeColors.primary }
                    }}
                    bezier
                    style={{ marginVertical: 8, borderRadius: 16 }}
                  />
                ) : (
                  <Text style={{ color: currentThemeColors.textSecondary, marginTop: 40 }}>Not enough data for chart</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nameText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  iconHeaderBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenCard: {
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tokenIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenHeader: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  tokenSubText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tokenProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tokenProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  fastingCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  fastingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  fastingStatus: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  fastingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heartRateCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heartRateLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heartRateValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  premiumCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  carbValue: {
    fontSize: 32,
    fontWeight: '900',
    marginRight: 8,
  },
  carbLimit: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  waterButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  waterBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  waterBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  metricGoal: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  miniProgress: {
    height: 6,
    width: '100%',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
  },
  fastingDisabledCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  fastingDisabledText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  enableLink: {
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  calendarCard: {
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  calendarHeaderDay: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: 'bold',
    width: (screenWidth - 80) / 7,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: (screenWidth - 80) / 7,
    height: 45,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  todayCell: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  todayNumber: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  dotContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
  },
  workoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyWeight: {
    fontSize: 18,
    fontWeight: '900',
  },
  historyBmi: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 60,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    maxHeight: screenHeight * 0.85,
  },
  settingsSection: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  profileGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: 1,
  },
  overlayInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  saveProfileBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveProfileText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  protocolRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  protocolBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  protocolText: {
    fontSize: 12,
    fontWeight: '800',
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeBox: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 2,
    textTransform: 'uppercase',
    color: '#8E8E93',
  },
  timeValue: {
    fontWeight: '900',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dangerButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '900',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  }
});