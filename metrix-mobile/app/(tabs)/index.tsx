import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, DeviceEventEmitter, TouchableOpacity, Alert, Modal } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import Animated, { FadeInUp } from 'react-native-reanimated';
import apiClient from '../../src/api/apiClient';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/context/ThemeContext';
import { EXERCISE_DATABASE } from './workout';
import { setupHealthConnect } from '../../src/utils/biometrics';
import Constants from 'expo-constants';

const screenWidth = Dimensions.get('window').width;

const CalendarHeatMap = ({ history, isDark, onSelectDay }) => {
  const getCategoryColor = (exerciseName) => {
    for (const group of EXERCISE_DATABASE) {
      if (group.exercises.includes(exerciseName)) {
        return group.color;
      }
    }
    return '#8E8E93'; // Fallback gray
  };

  const getDaysInMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for start of month
    for (let i = 0; i < firstDay; i++) {
      days.push({ type: 'empty' });
    }
    // Month days
    for (let i = 1; i <= daysCount; i++) {
        const fullDate = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        days.push({ type: 'day', day: i, fullDate });
    }
    return days;
  };

  const days = getDaysInMonth();
  const todayStr = new Date().toISOString().split('T')[0];

  const renderDay = (item, index) => {
    if (item.type === 'empty') {
      return <View key={`empty-${index}`} style={styles.calendarDayCell} />;
    }

    const isToday = item.fullDate === todayStr;
    const dayLogs = history.find(section => section.title === item.fullDate)?.data || [];

    return (
      <TouchableOpacity 
        key={item.fullDate} 
        onPress={() => {
          if (dayLogs.length > 0) {
            onSelectDay({ date: item.fullDate, workouts: dayLogs });
          }
        }}
        activeOpacity={dayLogs.length > 0 ? 0.6 : 1}
        style={[styles.calendarDayCell, isToday && styles.todayCell]}
      >
        <Text style={[styles.dayNumber, { color: isDark ? '#fff' : '#000' }, isToday && styles.todayNumber]}>
          {item.day}
        </Text>
        <View style={styles.dotContainer}>
          {dayLogs.map((log, index) => (
            <View 
              key={`dot-${item.fullDate}-${index}`} 
              style={[styles.workoutDot, { backgroundColor: getCategoryColor(log.exercise_name) }]} 
            />
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.calendarCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
      <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>Workout Consistency</Text>
      <View style={styles.calendarHeaderRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
          <Text key={`day-header-${index}`} style={styles.calendarHeaderDay}>{d}</Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {days.map((day, idx) => renderDay(day, idx))}
      </View>
    </View>
  );
};

export default function DashboardScreen() {
  const [macros, setMacros] = useState(null);
  const [waterOz, setWaterOz] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [tokens, setTokens] = useState(0);
  const [timeLeft, setTimeLeft] = useState('');
  const [isFeedingWindow, setIsFeedingWindow] = useState(false);
  const [isIfEnabled, setIsIfEnabled] = useState(true);
  const [ifStart, setIfStart] = useState('21:00');
  const [ifEnd, setIfEnd] = useState('09:00');
  const [heartRate, setHeartRate] = useState('--');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayContent, setSelectedDayContent] = useState(null);

  const totalVolume = useMemo(() => {
    return workoutHistory.reduce((acc, section) => {
      const sectionVol = section.data.reduce((sAcc, item) => {
        return sAcc + (item.weight || 0) * (item.reps || 0); 
      }, 0);
      return acc + sectionVol;
    }, 0);
  }, [workoutHistory]);
  
  const { currentThemeColors, typography, layout } = useAppTheme();
  const isDark = currentThemeColors.isDark;

  const router = useRouter();
  const { logout } = useAuth();

  // Goals will be fetched from backend

  useFocusEffect(
    useCallback(() => {
      fetchDailyMacros();
      fetchTokens();
      loadIfSettings();
      fetchWorkoutHistory();
    }, [ifStart, ifEnd, isIfEnabled])
  );

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
      const start = await AsyncStorage.getItem('if_start_time');
      const end = await AsyncStorage.getItem('if_end_time');
      if (enabled !== null) setIsIfEnabled(enabled === 'true');
      if (start !== null) setIfStart(start);
      if (end !== null) setIfEnd(end);
    } catch (e) {
      console.error("Failed to load IF settings on dashboard", e);
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

  const fetchWorkoutHistory = async () => {
    try {
      const res = await apiClient.get('/workout-history/');
      // Backend returns sections: [{title: 'YYYY-MM-DD', data: [...]}, ...]
      setWorkoutHistory(res.data);
    } catch (e) {
      if (e.response?.status === 401) {
        return; // Silent return for unauthorized
      }
      Alert.alert("Error", "Failed to fetch workout history");
      console.error("Failed to fetch workout history", e);
    }
  };

  const handleLogWater = async (amount) => {
    try {
      const res = await apiClient.post('/log-water/', { amount_oz: amount });
      if (res.data.status === 'success') {
        fetchDailyMacros();
      }
    } catch (err) {
      console.error('Failed to log water', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const goals = macros?.goals || {
    calories: 2000,
    protein: 150,
    fat: 140,
    net_carbs: 30
  };
  const WATER_GOAL = 128; // Default if not in profile yet

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
          onPress={() => router.push('/settings')} 
          style={[styles.iconHeaderBtn, { backgroundColor: currentThemeColors.card, ...layout.shadows.sm }]}
        >
          <Ionicons name="settings-outline" size={24} color={currentThemeColors.primary} />
        </TouchableOpacity>
      </View>

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
          onPress={() => router.push('/settings')}
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
          <TouchableOpacity onPress={() => router.push('/settings')}>
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

      <Animated.View entering={FadeInUp.delay(400)}>
        <CalendarHeatMap 
          history={workoutHistory} 
          isDark={isDark} 
          onSelectDay={(day) => {
            setSelectedDayContent(day);
            setModalVisible(true);
          }}
        />
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
        <View style={{ alignItems: 'center' }}>
          <PieChart
            data={chartData}
            width={screenWidth - 80}
            height={200}
            chartConfig={{
              color: (opacity = 1) => currentThemeColors.text,
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
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
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  fastingStatus: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fastingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  heartRateCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heartRateLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heartRateValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  premiumCard: {
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
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
    fontWeight: '800',
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  carbValue: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
  },
  carbLimit: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    fontWeight: '800',
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
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
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
    padding: 24,
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: '800',
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalScroll: {
    marginBottom: 20,
  },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  workoutStats: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalCloseBtn: {
    backgroundColor: '#FF2D55',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
