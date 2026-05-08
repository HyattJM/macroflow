import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LineChart } from "react-native-chart-kit";
import { HeartRateGraph } from '../../src/components/HeartRateGraph';
import { useWorkoutSession } from '../../src/context/WorkoutSessionContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { readRecords, initialize } from 'react-native-health-connect';
import apiClient from '../../src/api/apiClient';

const { width } = Dimensions.get('window');
const cardHalfWidth = (width - 48) / 2;

const ProgressRing = ({ size, strokeWidth, progress, color, borderColor, children }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size/2} cy={size/2} r={radius} stroke={borderColor} strokeWidth={strokeWidth} fill="none" />
        <Circle 
          cx={size/2} 
          cy={size/2} 
          r={radius} 
          stroke={color} 
          strokeWidth={strokeWidth} 
          fill="none" 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          strokeLinecap="round" 
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      {children}
    </View>
  );
};

const ProgressBar = ({ label, valueText, progress, color, trackColor, textColor, subTextColor }: any) => (
  <View style={styles.progressBarContainer}>
    <View style={styles.progressTextRow}>
      <Text style={[styles.progressLabel, { color: textColor }]}>{label}</Text>
      <Text style={[styles.progressValueText, { color: subTextColor }]}>{valueText}</Text>
    </View>
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
    </View>
  </View>
);

export default function DashboardScreen() {
  const { currentThemeColors } = useAppTheme();
  const [weightInput, setWeightInput] = useState('');
  const [displayWeight, setDisplayWeight] = useState<number | string>('--');
  const [weightHistory, setWeightHistory] = useState<any>(null);
  const [waterTotal, setWaterTotal] = useState(0);
  const [dailySteps, setDailySteps] = useState(0);
  const [lastSynced, setLastSynced] = useState('Never');
  const { currentBpm, heartRateHistory } = useWorkoutSession();

  useEffect(() => {
    const initApp = async () => {
      try {
        await initialize();
      } catch (e) {
        console.error('HC Init Fail', e);
      }
      syncWeightData();
      fetchTodayWater();
    };
    initApp();
  }, []);

  const syncWeightData = async () => {
    try {
      const response = await apiClient.get('bodyweights/');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const sortedData = response.data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const last7 = sortedData.slice(-7);
        setWeightHistory({
          labels: last7.map((item: any, i: number) => i === 0 || i === last7.length - 1 ? `${new Date(item.date).getMonth() + 1}/${new Date(item.date).getDate()}` : ''),
          datasets: [{ data: last7.map((item: any) => parseFloat(item.weight)) }]
        });
        const latestEntry = last7[last7.length - 1];
        setDisplayWeight(String(latestEntry.weight));
      } else {
        setWeightHistory(null);
        setDisplayWeight('--');
      }
    } catch (error) {
      console.error('Failed to sync weight data:', error);
    }
  };

  const fetchTodayWater = async () => {
    try {
      const response = await apiClient.get('water-today/');
      if (response.data && response.data.total !== undefined) {
        setWaterTotal(response.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch today water:', error);
    }
  };

  const handleManualSync = async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const timeRangeFilter = {
        operator: 'between' as const,
        startTime: startOfDay.toISOString(),
        endTime: now.toISOString(),
      };
      const result = await readRecords('Steps', { timeRangeFilter });
      const totalSteps = result.records.reduce((sum, record) => sum + record.count, 0);
      setDailySteps(totalSteps);
      setLastSynced(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error('HC Sync Fail', error);
    }
  };

  const handleLogWeight = async () => {
    if (!weightInput || String(weightInput).trim() === '') {
      Alert.alert('Error', 'Please enter a weight value.');
      return;
    }
    const weight = Number(weightInput);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Error', 'Please enter a valid weight number.');
      return;
    }
    try {
      const response = await apiClient.post('log-daily-weight/', { weight });
      if (response.data) {
        Alert.alert('Success', `${weight} lbs recorded.`);
        setWeightInput('');
        await syncWeightData();
      }
    } catch (error) {
      console.error('Log Weight Fail', error);
      Alert.alert('Error', 'Could not save weight.');
    }
  };

  const handleAddWater = async (amount: number) => {
    const prev = waterTotal;
    setWaterTotal(p => p + amount);
    try {
      const res = await apiClient.post('water-add/', { amount });
      if (res.data.status !== 'success') throw new Error();
    } catch (e) {
      setWaterTotal(prev);
      Alert.alert('Error', 'Water log failed');
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: currentThemeColors.background },
    card: { backgroundColor: currentThemeColors.card },
    text: { color: currentThemeColors.text },
    subText: { color: currentThemeColors.textSecondary },
    input: { backgroundColor: currentThemeColors.isDark ? '#111827' : '#F1F5F9', color: currentThemeColors.text },
    border: { borderColor: currentThemeColors.border }
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.row}>
        <View style={[styles.card, dynamicStyles.card, styles.cardHalf]}>
          <Text style={[styles.cardTitle, dynamicStyles.text]}>Live Heart Rate</Text>
          <View style={styles.hrValueRow}>
            <Text style={[styles.giantText, dynamicStyles.text]}>{currentBpm || '--'}</Text>
            <Text style={[styles.unitText, dynamicStyles.subText]}> BPM</Text>
          </View>
          <Text style={[styles.cardSubtitle, dynamicStyles.subText]}>Zone 2 - Fat Burn</Text>
          <View style={styles.chartContainer}>
            <HeartRateGraph bpm={currentBpm} history={heartRateHistory} />
          </View>
        </View>

        <View style={[styles.card, dynamicStyles.card, styles.cardHalf, { alignItems: 'center' }]}>
          <Text style={[styles.cardTitle, dynamicStyles.text, { alignSelf: 'flex-start' }]}>Steps Today</Text>
          <View style={styles.stepsRingContainer}>
            <ProgressRing size={110} strokeWidth={10} progress={Math.min(dailySteps / 10000, 1)} color={currentThemeColors.primary} borderColor={currentThemeColors.border}>
              <View style={styles.ringInnerContent}>
                <Text style={[styles.ringMainText, dynamicStyles.text]}>{dailySteps}</Text>
                <Text style={[styles.ringSubText, dynamicStyles.subText]}>Steps</Text>
              </View>
            </ProgressRing>
          </View>
          <Text style={[styles.cardSubtitle, dynamicStyles.subText]}>Goal: 10,000</Text>
        </View>
      </View>

      <View style={[styles.card, dynamicStyles.card, styles.fullCard, styles.syncBar, { borderLeftColor: currentThemeColors.primary }]}>
        <View style={styles.syncBarLeft}>
          <Ionicons name="pulse" size={24} color={currentThemeColors.primary} />
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.syncTitle, dynamicStyles.text]}>Health Connect</Text>
            <Text style={[styles.syncSubtitle, dynamicStyles.subText]}>Last synced: {lastSynced}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.syncBtn, { backgroundColor: currentThemeColors.primary }]} onPress={handleManualSync}>
          <Text style={styles.syncBtnText}>SYNC NOW</Text>
          <Ionicons name="sync" size={16} color="#FFF" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      <View style={[styles.card, dynamicStyles.card, styles.fullCard]}>
        <Text style={[styles.cardTitle, dynamicStyles.text]}>Macro Analysis</Text>
        <View style={styles.macroTopRow}>
          <Text style={[styles.macroLabelLarge, dynamicStyles.text]}>Calorie</Text>
          <ProgressRing size={130} strokeWidth={12} progress={0.7} color={currentThemeColors.primary} borderColor={currentThemeColors.border}>
            <View style={styles.ringInnerContent}>
              <Text style={[styles.ringMainText, dynamicStyles.text]}>1,842</Text>
              <Text style={[styles.ringSubText, dynamicStyles.subText]}>Remaining</Text>
            </View>
          </ProgressRing>
          <View style={styles.macroRightBox}>
            <Text style={[styles.macroTotalValue, dynamicStyles.text]}>2,600</Text>
            <Text style={[styles.macroTotalLabel, dynamicStyles.subText]}>Total</Text>
          </View>
        </View>
        <View style={styles.macroBarsContainer}>
          <View style={styles.macroBarColumn}>
            <ProgressBar 
              label="Carbs" valueText="85g/325g" progress={0.26} color={currentThemeColors.primary} 
              trackColor={currentThemeColors.border} textColor={currentThemeColors.text} subTextColor={currentThemeColors.textSecondary}
            />
          </View>
          <View style={styles.macroBarColumn}>
            <ProgressBar 
              label="Protein" valueText="42g/175g" progress={0.24} color={currentThemeColors.primary} 
              trackColor={currentThemeColors.border} textColor={currentThemeColors.text} subTextColor={currentThemeColors.textSecondary}
            />
          </View>
          <View style={styles.macroBarColumn}>
            <ProgressBar 
              label="Fat" valueText="20g/87g" progress={0.22} color={currentThemeColors.primary} 
              trackColor={currentThemeColors.border} textColor={currentThemeColors.text} subTextColor={currentThemeColors.textSecondary}
            />
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.card, dynamicStyles.card, styles.cardHalf, { justifyContent: 'space-between' }]}>
          <View>
            <Text style={[styles.cardTitle, dynamicStyles.text]}>Weight</Text>
            <View style={styles.valueRowBasic}>
              <Text style={[styles.giantText, dynamicStyles.text]}>{displayWeight}</Text>
              <Text style={[styles.unitTextBasic, dynamicStyles.subText]}> lbs</Text>
            </View>
            <TextInput 
              style={[styles.weightInput, dynamicStyles.input]} placeholder="Enter weight" placeholderTextColor={currentThemeColors.textSecondary}
              value={weightInput} onChangeText={(text) => setWeightInput(text)} keyboardType="numeric"
              returnKeyType="done" onSubmitEditing={handleLogWeight}
            />
            {weightHistory && (
              <View style={{ marginTop: 4, marginLeft: -16 }}>
                <LineChart
                  data={weightHistory} width={cardHalfWidth} height={60}
                  chartConfig={{
                    backgroundColor: currentThemeColors.card, backgroundGradientFrom: currentThemeColors.card, backgroundGradientTo: currentThemeColors.card,
                    decimalPlaces: 1, color: (opacity = 1) => currentThemeColors.primary,
                    labelColor: (opacity = 1) => currentThemeColors.textSecondary,
                    propsForDots: { r: "2", strokeWidth: "1", stroke: currentThemeColors.primary },
                    hidePointsAtIndices: weightHistory.datasets[0].data.length > 2 ? Array.from({length: weightHistory.datasets[0].data.length - 2}, (_, i) => i + 1) : []
                  }}
                  bezier withVerticalLines={false} withHorizontalLines={false} withVerticalLabels={true} withHorizontalLabels={false}
                />
              </View>
            )}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: currentThemeColors.primary }]} onPress={handleLogWeight}>
            <Text style={styles.primaryBtnText}>ADD DAILY WEIGHT</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, dynamicStyles.card, styles.cardHalf, { justifyContent: 'space-between' }]}>
          <View>
            <View style={styles.waterTitleRow}>
              <Text style={[styles.cardTitle, dynamicStyles.text]}>Water Intake</Text>
              <Ionicons name="water" size={24} color={currentThemeColors.primary} />
            </View>
            <View style={styles.valueRowBasic}>
              <Text style={[styles.giantText, dynamicStyles.text]}>{waterTotal}</Text>
              <Text style={[styles.unitTextBasic, dynamicStyles.subText]}> oz</Text>
            </View>
            <ProgressBar 
              label="Intake" valueText={`${waterTotal}/100 oz`} progress={Math.min(waterTotal/100, 1)} color={currentThemeColors.primary} 
              trackColor={currentThemeColors.border} textColor={currentThemeColors.text} subTextColor={currentThemeColors.textSecondary}
            />
            <Text style={[styles.cardSubtitle, dynamicStyles.subText]}>Remaining: {Math.max(0, 100 - waterTotal)} oz</Text>
          </View>
          <View style={styles.waterBtnRow}>
            <TouchableOpacity style={[styles.waterBtn, { backgroundColor: currentThemeColors.primary }]} onPress={() => handleAddWater(8)}><Text style={styles.primaryBtnText}>+ 8 oz</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.waterBtn, { backgroundColor: currentThemeColors.primary }]} onPress={() => handleAddWater(16)}><Text style={styles.primaryBtnText}>+ 16 oz</Text></TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.card, dynamicStyles.card, styles.fullCard, styles.recentWorkoutCard]}>
        <View style={styles.workoutContent}>
          <Text style={[styles.cardTitle, dynamicStyles.text]}>Recent Workout</Text>
          <Text style={[styles.workoutTitle, dynamicStyles.text]}>Strength Training</Text>
          <Text style={[styles.workoutStat, dynamicStyles.subText]}>45 min | 320 kcal</Text>
          <Text style={[styles.workoutStat, dynamicStyles.subText]}>10:30 AM Today</Text>
        </View>
        <View style={styles.workoutGradientMock}>
          <Svg height="100%" width="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={currentThemeColors.primary} stopOpacity="0.3" />
                <Stop offset="1" stopColor={currentThemeColors.background} stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            <Path d="M0,100 L100,100 L100,50 Q75,20 50,60 T0,40 Z" fill="url(#grad)" />
          </Svg>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  card: { borderRadius: 20, padding: 16, elevation: 4 },
  cardHalf: { width: cardHalfWidth, minHeight: 180 },
  fullCard: { width: '100%', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardSubtitle: { fontSize: 12, marginTop: 4 },
  giantText: { fontSize: 36, fontWeight: '700' },
  unitText: { fontSize: 16, fontWeight: '600' },
  unitTextBasic: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  valueRowBasic: { flexDirection: 'row', alignItems: 'baseline' },
  hrValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  chartContainer: { marginTop: 10, flex: 1, justifyContent: 'flex-end', marginHorizontal: -8 },
  stepsRingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 10 },
  ringInnerContent: { alignItems: 'center', justifyContent: 'center' },
  ringMainText: { fontSize: 28, fontWeight: 'bold' },
  ringSubText: { fontSize: 12 },
  macroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 16, paddingHorizontal: 10 },
  macroLabelLarge: { fontSize: 18, fontWeight: '600' },
  macroRightBox: { alignItems: 'center' },
  macroTotalValue: { fontSize: 24, fontWeight: 'bold' },
  macroTotalLabel: { fontSize: 14 },
  macroBarsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  macroBarColumn: { flex: 1, marginHorizontal: 4 },
  progressBarContainer: { width: '100%' },
  progressTextRow: { flexDirection: 'column', marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: '600' },
  progressValueText: { fontSize: 10 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  weightInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12, marginBottom: 16, fontSize: 14 },
  primaryBtn: { borderRadius: 20, paddingVertical: 12, alignItems: 'center', width: '100%' },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  waterTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  waterBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  waterBtn: { borderRadius: 15, paddingVertical: 10, alignItems: 'center', flex: 0.48 },
  recentWorkoutCard: { flexDirection: 'row', position: 'relative', overflow: 'hidden', minHeight: 120, marginTop: 8 },
  workoutContent: { zIndex: 2, flex: 1 },
  workoutTitle: { fontSize: 22, fontWeight: 'bold', marginVertical: 4 },
  workoutStat: { fontSize: 14, marginTop: 2 },
  workoutGradientMock: { position: 'absolute', right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 1 },
  syncBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderLeftWidth: 4, paddingHorizontal: 16 },
  syncBarLeft: { flexDirection: 'row', alignItems: 'center' },
  syncTitle: { fontSize: 16, fontWeight: '700' },
  syncSubtitle: { fontSize: 12, marginTop: 2 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  syncBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }
});