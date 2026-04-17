import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, DeviceEventEmitter, TouchableOpacity, Alert, Modal } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import apiClient from '../../src/api/apiClient';

import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '../../hooks/use-color-scheme';
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
  
  const [selectedDayContent, setSelectedDayContent] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [heartRate, setHeartRate] = useState('--');

  const { themePreference } = useAuth();
  const systemColorScheme = useColorScheme();
  const activeTheme = themePreference === 'system' ? systemColorScheme : themePreference;
  const isDark = activeTheme === 'dark';

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

  const handleLogout = async () => {
    console.log("Starting logout process...");
    try {
      await logout();
    } catch (e) {
      console.error("LOGOUT_ERROR:", e);
    }
  };

  const handleResetData = () => {
    Alert.alert(
      "Reset Account?",
      "This will wipe your profile and onboarding data. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reset", 
          style: "destructive", 
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
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
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#000' : '#f5f5f5' }]}>
      {/* Session Navigation Header */}
      <View style={styles.sessionHeader}>
        <TouchableOpacity onPress={() => router.push('/settings')} style={[styles.iconHeaderBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
          <Ionicons name="settings-outline" size={20} color={isDark ? "#8E8E93" : "#555"} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleLogout} style={[styles.headerBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
          <Text style={styles.logoutHeaderText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleResetData} style={[styles.headerBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
          <Text style={styles.resetHeaderText}>Reset Data</Text>
        </TouchableOpacity>
      </View>

      {/* AI Token Display */}
      <View style={[styles.tokenCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <Text style={[styles.tokenHeader, { color: isDark ? '#FF2D55' : '#007AFF' }]}>FREE AI SCANS</Text>
        <View style={styles.progressHeader}>
          <Text style={[styles.tokenCount, { color: isDark ? '#fff' : '#000' }]}>{tokens}</Text>
          <Text style={styles.tokenLabel}>API calls left</Text>
        </View>
      </View>

      {/* Intermittent Fasting Card */}
      {isIfEnabled ? (
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => router.push('/settings')}
          style={[styles.fastingCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }, isFeedingWindow ? styles.feedingBorder : styles.fastingBorder]}
        >
          <View style={styles.fastingHeader}>
            <View style={[styles.statusDot, { backgroundColor: isFeedingWindow ? '#34C759' : '#FF9500' }]} />
            <Text style={[styles.fastingStatus, { color: isFeedingWindow ? '#34C759' : '#FF9500' }]}>
              {isFeedingWindow ? 'Feeding Phase Open' : 'Fasting Phase'}
            </Text>
          </View>
          <View style={styles.fastingContent}>
            <Text style={styles.timeLabel}>Ends in</Text>
            <Text style={[styles.timeValue, { color: isDark ? '#fff' : '#000' }]}>{timeLeft}</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[styles.fastingDisabledCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
          <Text style={styles.fastingDisabledText}>Intermittent Fasting is disabled.</Text>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Text style={styles.enableLink}>Enable in Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Heart Rate Metric Card */}
      <View style={[styles.heartRateCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <Text style={styles.heartRateLabel}>HEART RATE</Text>
        <Text style={styles.heartRateValue}>{heartRate} BPM</Text>
      </View>

      <CalendarHeatMap 
        history={workoutHistory} 
        isDark={isDark} 
        onSelectDay={(day) => {
          setSelectedDayContent(day);
          setModalVisible(true);
        }}
      />

      <Text style={[styles.title, { color: isDark ? '#fff' : '#333' }]}>Daily Breakdown</Text>
      
      {/* Carb Tracker Card */}
      <View style={[styles.carbCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <Text style={[styles.cardTitle, { color: '#007AFF' }]}>Net Carbs</Text>
        <View style={styles.progressHeader}>
          <Text style={[styles.carbValue, { color: isDark ? '#fff' : '#000' }]}>{currentCarbs.toFixed(1)}g</Text>
          <Text style={styles.carbLimit}>/ {goals.net_carbs}g limit</Text>
        </View>
        <View style={[styles.progressBarBackground, { backgroundColor: isDark ? '#333' : '#eee' }]}>
          <View style={[styles.progressBarFill, { width: `${carbProgress}%` }, currentCarbs > goals.net_carbs && { backgroundColor: '#FF3B30' }]} />
        </View>
      </View>

      {/* Pie Chart Card */}
      <View style={[styles.carbCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>Macro Split</Text>
        <PieChart
          data={chartData}
          width={screenWidth - 88} // card margins
          height={180}
          chartConfig={{
            color: (opacity = 1) => `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
          }}
          accessor={"population"}
          backgroundColor={"transparent"}
          paddingLeft={"0"}
          center={[10, 0]}
          absolute
        />
      </View>

      {/* Water Tracker Card */}
      <View style={[styles.carbCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <Text style={[styles.cardTitle, { color: '#34C759' }]}>Water Intake</Text>
        <View style={styles.progressHeader}>
          <Text style={[styles.carbValue, { color: isDark ? '#fff' : '#000' }]}>{waterOz} oz</Text>
          <Text style={styles.carbLimit}>/ {WATER_GOAL} oz goal</Text>
        </View>
        <View style={[styles.progressBarBackground, { backgroundColor: isDark ? '#333' : '#eee' }]}>
          <View style={[styles.progressBarFill, { width: `${Math.min((waterOz / WATER_GOAL) * 100, 100)}%` }, { backgroundColor: '#34C759' }]} />
        </View>
        <View style={styles.waterButtons}>
          <TouchableOpacity style={[styles.waterBtn, { backgroundColor: isDark ? '#2C2C2E' : '#f0f0f0' }]} onPress={() => handleLogWater(8)}>
            <Text style={[styles.waterBtnText, { color: isDark ? '#fff' : '#555' }]}>+ 8 oz</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.waterBtn, { backgroundColor: isDark ? '#2C2C2E' : '#f0f0f0' }]} onPress={() => handleLogWater(16)}>
            <Text style={[styles.waterBtnText, { color: isDark ? '#fff' : '#555' }]}>+ 16.9 oz</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Other Metrics Grid */}
      <View style={styles.grid}>
        <View style={[styles.metricCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
          <Text style={styles.metricLabel}>Net Calories</Text>
          <Text style={[styles.metricValue, { color: isDark ? '#fff' : '#000' }]}>{Math.round(netCalories)}</Text>
          <Text style={styles.metricGoal}>/ {goals.calories}</Text>
          <View style={[styles.miniProgress, { backgroundColor: isDark ? '#333' : '#eee' }]}>
            <View style={[styles.miniFill, { width: `${calProgress}%` }]} />
          </View>
        </View>
        
        <View style={[styles.metricCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
          <Text style={styles.metricLabel}>Protein</Text>
          <Text style={[styles.metricValue, { color: isDark ? '#fff' : '#000' }]}>{macros ? macros.protein.toFixed(1) : 0}</Text>
          <Text style={styles.metricGoal}>/ {goals.protein}g</Text>
          <View style={[styles.miniProgress, { backgroundColor: isDark ? '#333' : '#eee' }]}>
            <View style={[styles.miniFill, { width: `${Math.min((macros?.protein / goals.protein) * 100, 100)}%`, backgroundColor: '#FF9500' }]} />
          </View>
        </View>
        
        <View style={[styles.metricCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
          <Text style={styles.metricLabel}>Fat</Text>
          <Text style={[styles.metricValue, { color: isDark ? '#fff' : '#000' }]}>{macros ? macros.fat.toFixed(1) : 0}</Text>
          <Text style={styles.metricGoal}>/ {goals.fat}g</Text>
          <View style={[styles.miniProgress, { backgroundColor: isDark ? '#333' : '#eee' }]}>
            <View style={[styles.miniFill, { width: `${Math.min((macros?.fat / goals.fat) * 100, 100)}%`, backgroundColor: '#FF3B30' }]} />
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />

      {/* Workout Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <Text style={[styles.modalHeader, { color: isDark ? '#fff' : '#000' }]}>
              {selectedDayContent?.date}
            </Text>
            
            <ScrollView style={styles.modalScroll}>
              {selectedDayContent?.workouts.map((workout, idx) => (
                <View key={idx} style={styles.workoutRow}>
                  <Text style={[styles.workoutName, { color: isDark ? '#fff' : '#000' }]}>
                    {workout.exercise_name}
                  </Text>
                  <Text style={styles.workoutStats}>
                    {workout.sets} Sets / {workout.reps} Reps / {workout.weight} lbs
                  </Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginBottom: 20,
    color: '#333'
  },
  tokenCard: {
    backgroundColor: '#111', // Dark premium mode
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tokenHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF2D55',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  tokenCount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
  },
  tokenLabel: {
    fontSize: 16,
    color: '#888',
    marginLeft: 10,
    fontWeight: '600'
  },
  carbCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  carbValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  carbLimit: {
    fontSize: 16,
    color: '#888',
    marginLeft: 8,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  waterButtons: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-between',
  },
  waterBtn: {
    flex: 1,
    backgroundColor: '#E5F1FF',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  waterBtnText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  metricGoal: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  miniProgress: {
    height: 4,
    width: '100%',
    backgroundColor: '#eee',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden'
  },
  miniFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  burnedText: {
    fontSize: 10,
    color: '#FF2D55',
    fontWeight: 'bold',
    marginTop: 4,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 10,
  },
  iconHeaderBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerBtn: {
    marginLeft: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  logoutHeaderText: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resetHeaderText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fastingCard: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  feedingBorder: {
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  fastingBorder: {
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  fastingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  fastingStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fastingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  timeLabel: {
    color: '#8E8E93',
    fontSize: 14,
  },
  timeValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  fastingDisabledCard: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  fastingDisabledText: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 8,
  },
  enableLink: {
    color: '#FF2D55',
    fontSize: 14,
  },
  heartRateCard: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  heartRateLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heartRateValue: {
    color: '#FF2D55',
    fontSize: 36,
    fontWeight: '900',
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
