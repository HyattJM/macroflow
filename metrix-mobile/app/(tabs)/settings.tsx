import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../src/context/AuthContext';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Colors } from '../../constants/theme';

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

export default function SettingsScreen() {
  const { themePreference, updateThemePreference } = useAuth();
  const systemColorScheme = useColorScheme();
  const activeTheme = themePreference === 'system' ? systemColorScheme : themePreference;
  const isDark = activeTheme === 'dark';

  const [isEnabled, setIsEnabled] = useState(true);
  const [protocol, setProtocol] = useState('16/8'); // '12/12', '16/8', 'Custom'
  const [startTime, setStartTime] = useState(parseTime('21:00'));
  const [endTime, setEndTime] = useState(parseTime('09:00'));

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('if_enabled');
      const prot = await AsyncStorage.getItem('if_protocol');
      const start = await AsyncStorage.getItem('if_start_time');
      const end = await AsyncStorage.getItem('if_end_time');

      if (enabled !== null) setIsEnabled(enabled === 'true');
      if (prot !== null) setProtocol(prot);
      if (start !== null) setStartTime(parseTime(start));
      if (end !== null) setEndTime(parseTime(end));
    } catch (e) {
      console.error("Failed to load IF settings", e);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error(`Failed to save ${key}`, e);
    }
  };

  const handleToggle = (val: boolean) => {
    setIsEnabled(val);
    saveSetting('if_enabled', val.toString());
  };

  const handleProtocolChange = (p: string) => {
    setProtocol(p);
    saveSetting('if_protocol', p);
    
    if (p === '16/8') {
      const start = parseTime('21:00');
      const end = parseTime('13:00'); 
      setStartTime(start);
      setEndTime(end);
      saveSetting('if_start_time', '21:00');
      saveSetting('if_end_time', '13:00');
    } else if (p === '12/12') {
      const start = parseTime('21:00');
      const end = parseTime('09:00');
      setStartTime(start);
      setEndTime(end);
      saveSetting('if_start_time', '21:00');
      saveSetting('if_end_time', '09:00');
    }
  };

  const onStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartTime(selectedDate);
      saveSetting('if_start_time', formatTime(selectedDate));
      if (protocol !== 'Custom') setProtocol('Custom');
    }
  };

  const onEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndTime(selectedDate);
      saveSetting('if_end_time', formatTime(selectedDate));
      if (protocol !== 'Custom') setProtocol('Custom');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#000' : '#f5f5f5' }]}>
      <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Settings</Text>

      <View style={[styles.section, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#FF2D55' : '#007AFF' }]}>Intermittent Fasting</Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: isDark ? '#fff' : '#333' }]}>Enable Timer</Text>
          <Switch value={isEnabled} onValueChange={handleToggle} trackColor={{ false: '#333', true: '#34C759' }} />
        </View>

        {isEnabled && (
          <>
            <Text style={styles.subLabel}>Protocol</Text>
            <View style={styles.protocolRow}>
              {['12/12', '16/8', 'Custom'].map((p) => (
                <TouchableOpacity 
                  key={p} 
                  style={[
                    styles.protocolBtn, 
                    { backgroundColor: isDark ? '#2C2C2E' : '#f0f0f0' },
                    protocol === p && { backgroundColor: isDark ? '#FF2D55' : '#007AFF' }
                  ]}
                  onPress={() => handleProtocolChange(p)}
                >
                  <Text style={[styles.protocolText, protocol === p && { color: '#fff' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timeSection}>
              <TouchableOpacity style={[styles.timeBox, { backgroundColor: isDark ? '#2C2C2E' : '#f9f9f9' }]} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.timeLabel}>Feeding Starts</Text>
                <Text style={[styles.timeValue, { color: isDark ? '#fff' : '#000' }]}>{formatTime(startTime)}</Text>
              </TouchableOpacity>

              <Ionicons name="arrow-forward" size={20} color={isDark ? "#444" : "#ccc"} style={{ marginHorizontal: 10 }} />

              <TouchableOpacity style={[styles.timeBox, { backgroundColor: isDark ? '#2C2C2E' : '#f9f9f9' }]} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.timeLabel}>Feeding Ends</Text>
                <Text style={[styles.timeValue, { color: isDark ? '#fff' : '#000' }]}>{formatTime(endTime)}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onStartTimeChange}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onEndTimeChange}
              />
            )}
          </>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#FF2D55' : '#007AFF' }]}>Appearance</Text>
        <View style={styles.protocolRow}>
          {['Light', 'Dark', 'System'].map((mode) => (
            <TouchableOpacity 
              key={mode} 
              style={[
                styles.protocolBtn, 
                { backgroundColor: isDark ? '#2C2C2E' : '#f0f0f0' },
                themePreference === mode.toLowerCase() && { backgroundColor: isDark ? '#FF2D55' : '#007AFF' }
              ]}
              onPress={() => updateThemePreference(mode.toLowerCase() as any)}
            >
              <Text style={[
                styles.protocolText, 
                themePreference === mode.toLowerCase() && { color: '#fff' }
              ]}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  title: { fontSize: 34, fontWeight: 'bold', color: '#fff', paddingHorizontal: 20, marginBottom: 20 },
  section: { backgroundColor: '#1C1C1E', marginHorizontal: 20, borderRadius: 14, padding: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FF2D55', marginBottom: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingLabel: { fontSize: 16, color: '#fff' },
  subLabel: { fontSize: 14, color: '#8E8E93', marginBottom: 12, textTransform: 'uppercase' },
  protocolRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  protocolBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#2C2C2E', marginHorizontal: 4 },
  protocolBtnActive: { backgroundColor: '#FF2D55' },
  protocolText: { color: '#8E8E93', fontWeight: 'bold' },
  protocolTextActive: { color: '#fff' },
  timeSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeBox: { flex: 1, backgroundColor: '#2C2C2E', padding: 12, borderRadius: 10, alignItems: 'center' },
  timeLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  timeValue: { fontSize: 18, color: '#fff', fontWeight: 'bold' }
});
