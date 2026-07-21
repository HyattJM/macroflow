import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useUser } from '../../src/context/UserContext';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const OptionCard = ({ label, value, selected, onSelect, currentThemeColors }: any) => (
  <TouchableOpacity 
    style={[
      styles.optionCard, 
      { 
        backgroundColor: selected ? currentThemeColors.primary + '20' : currentThemeColors.card,
        borderColor: selected ? currentThemeColors.primary : currentThemeColors.border
      }
    ]}
    onPress={() => onSelect(value)}
  >
    <Text style={[styles.optionLabel, { color: selected ? currentThemeColors.primary : currentThemeColors.text }]}>{label}</Text>
    {selected && <Ionicons name="checkmark-circle" size={20} color={currentThemeColors.primary} />}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { profile, loading, updateProfile } = useUser();
  const { currentThemeColors } = useAppTheme();
  const [saving, setSaving] = useState(false);

  // Local state for form
  const [dietType, setDietType] = useState('Balanced');
  const [activityLevel, setActivityLevel] = useState('Sedentary');
  const [goal, setGoal] = useState('Maintain');
  const [units, setUnits] = useState('Imperial');

  useEffect(() => {
    if (profile) {
      setDietType(profile.diet_type || 'Balanced');
      setActivityLevel(profile.activity_level || 'Sedentary');
      setGoal(profile.goal || 'Maintain');
      setUnits(profile.units || 'Imperial');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        diet_type: dietType,
        activity_level: activityLevel,
        goal,
        units
      } as any);
      Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Nutritional targets recalculated.' });
    } catch (e) {
      Alert.alert("Error", "Failed to save profile preferences.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={[styles.centered, { backgroundColor: currentThemeColors.background }]}><ActivityIndicator size="large" color={currentThemeColors.primary} /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentThemeColors.background }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: currentThemeColors.text }]}>User Preferences</Text>
        <Text style={[styles.subtitle, { color: currentThemeColors.textSecondary }]}>Customize your diet protocol and activity metrics.</Text>
      </View>

      {/* Diet Type */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>DIET TYPE</Text>
        <View style={styles.grid}>
          {['Keto', 'Paleo', 'Balanced', 'High Protein'].map(type => (
            <OptionCard 
              key={type} label={type} value={type} 
              selected={dietType === type} onSelect={setDietType} 
              currentThemeColors={currentThemeColors} 
            />
          ))}
        </View>
      </View>

      {/* Activity Level */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>ACTIVITY LEVEL</Text>
        <View style={styles.grid}>
          {['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'].map(level => (
            <OptionCard 
              key={level} label={level} value={level} 
              selected={activityLevel === level} onSelect={setActivityLevel} 
              currentThemeColors={currentThemeColors} 
            />
          ))}
        </View>
      </View>

      {/* Goal */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>GOAL</Text>
        <View style={styles.grid}>
          {['Lose Weight', 'Maintain', 'Gain Muscle'].map(g => (
            <OptionCard 
              key={g} label={g} value={g} 
              selected={goal === g} onSelect={setGoal} 
              currentThemeColors={currentThemeColors} 
            />
          ))}
        </View>
      </View>

      {/* Units */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: currentThemeColors.primary }]}>UNITS</Text>
        <View style={styles.grid}>
          {['Imperial', 'Metric'].map(u => (
            <OptionCard 
              key={u} label={u} value={u} 
              selected={units === u} onSelect={setUnits} 
              currentThemeColors={currentThemeColors} 
            />
          ))}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.saveBtn, { backgroundColor: currentThemeColors.primary }]} 
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Preferences</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 30 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16 },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 12, 
    borderWidth: 1,
    minWidth: '45%' 
  },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  saveBtn: { 
    marginTop: 20, 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
