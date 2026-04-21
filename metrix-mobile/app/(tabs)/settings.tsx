import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/ThemeContext';

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
  const { themeName, currentThemeColors, setThemeName, layout, typography } = useAppTheme();
  const { updateThemePreference, logout } = useAuth(); 
  const isDark = currentThemeColors.isDark;

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
    <ScrollView 
      style={[styles.container, { backgroundColor: currentThemeColors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: currentThemeColors.text, marginTop: layout.spacing.xl }]}>Settings</Text>

      <View style={[styles.section, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Intermittent Fasting</Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: currentThemeColors.text }]}>Enable Timer</Text>
          <Switch value={isEnabled} onValueChange={handleToggle} trackColor={{ false: '#333', true: currentThemeColors.accent }} />
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
                     { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border },
                     protocol === p && { backgroundColor: currentThemeColors.primary, borderColor: currentThemeColors.primary }
                   ]}
                   onPress={() => {
                     handleProtocolChange(p);
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                   }}
                 >
                   <Text style={[styles.protocolText, { color: currentThemeColors.textSecondary }, protocol === p && { color: '#fff' }]}>{p}</Text>
                 </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timeSection}>
              <TouchableOpacity style={[styles.timeBox, { backgroundColor: currentThemeColors.surface }]} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.timeLabel}>Feeding Starts</Text>
                <Text style={[styles.timeValue, { color: currentThemeColors.text }]}>{formatTime(startTime)}</Text>
              </TouchableOpacity>

              <Ionicons name="arrow-forward" size={20} color={currentThemeColors.textSecondary} style={{ marginHorizontal: 10 }} />

              <TouchableOpacity style={[styles.timeBox, { backgroundColor: currentThemeColors.surface }]} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.timeLabel}>Feeding Ends</Text>
                <Text style={[styles.timeValue, { color: currentThemeColors.text }]}>{formatTime(endTime)}</Text>
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

      <View style={[styles.section, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>Appearance</Text>
        <View style={styles.protocolRow}>
          {[
            { id: 'defaultDark', label: 'Classic' },
            { id: 'deepSeaDark', label: 'Ocean' },
            { id: 'synthWave', label: 'Synth' },
            { id: 'classicLight', label: 'Light' }
          ].map((theme) => (
            <TouchableOpacity 
              key={theme.id} 
              style={[
                styles.protocolBtn, 
                { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border },
                themeName === theme.id && { backgroundColor: currentThemeColors.primary, borderColor: currentThemeColors.primary }
              ]}
              onPress={() => {
                setThemeName(theme.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[
                styles.protocolText, 
                { color: currentThemeColors.textSecondary },
                themeName === theme.id && { color: '#fff' }
              ]}>{theme.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <Text style={[styles.sectionTitle, { color: currentThemeColors.error }]}>Account</Text>
        <TouchableOpacity 
          style={[styles.dangerButton, { backgroundColor: currentThemeColors.error + '10', borderColor: currentThemeColors.error }]} 
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Logout", "Are you sure you want to log out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: logout }
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={currentThemeColors.error} />
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
          <Ionicons name="refresh-outline" size={20} color={currentThemeColors.error} />
          <Text style={[styles.dangerButtonText, { color: currentThemeColors.error }]}>Reset All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },
  title: { 
    fontSize: 34, 
    fontWeight: '900', 
    paddingHorizontal: 20, 
    marginBottom: 24 
  },
  section: { 
    marginHorizontal: 16, 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: '900', 
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  settingRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  settingLabel: { 
    fontSize: 16, 
    fontWeight: '600'
  },
  subLabel: { 
    fontSize: 12, 
    fontWeight: '700',
    marginBottom: 12, 
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  protocolRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12,
    gap: 8,
  },
  protocolBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center', 
    borderRadius: 12, 
    borderWidth: 1,
  },
  protocolText: { 
    fontSize: 14,
    fontWeight: '800' 
  },
  timeSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeBox: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 14, 
    alignItems: 'center' 
  },
  timeLabel: { 
    fontSize: 11, 
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  timeValue: { 
    fontSize: 18, 
    fontWeight: '900' 
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  dangerButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '900',
  }
});
