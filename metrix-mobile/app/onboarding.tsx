import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import apiClient from '../src/api/apiClient';
import { useAuth } from '../src/context/AuthContext';

const { width } = Dimensions.get('window');

/**
 * Metadata for activity level selection.
 * Used to calculate the TDEE multiplier on the backend.
 */
const ACTIVITY_LEVELS = [
  { label: 'Sedentary', value: 'sedentary', desc: 'Little to no exercise' },
  { label: 'Lightly Active', value: 'lightly active', desc: '1-3 days/week exercise' },
  { label: 'Moderately Active', value: 'moderately active', desc: '3-5 days/week exercise' },
  { label: 'Very Active', value: 'very active', desc: '6-7 days/week hard exercise' },
  { label: 'Extra Active', value: 'extra active', desc: 'Hard daily exercise & physical job' },
];

/**
 * Metadata for user goal selection.
 * Used to adjust the final calorie budget (surplus or deficit).
 */
const GOALS = [
  { label: 'Lose Weight', value: 'lose weight', desc: 'Focus on fat loss' },
  { label: 'Maintain', value: 'maintain', desc: 'Keep current weight' },
  { label: 'Gain Muscle', value: 'gain muscle', desc: 'Focus on lean mass' },
];

/**
 * OnboardingScreen handles the initial data collection for new users.
 * 
 * Logic Rationale:
 * - Multi-Step Flow: Breaks down complex physiological data entry into 5 digestible steps.
 * - Field Mapping: Frontend values are mapped to strict snake_case keys (e.g. 'lightly_active') 
 *   required by the Django REST API.
 * - State Management: Tracks all user inputs in a single `form` object for easy payload construction.
 */
export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    age: '',
    gender: '',
    weight_lbs: '',
    height_inches: '',
    activity_level: '',
    goal: '',
  });
  const [loading, setLoading] = useState(false);
  const { completeOnboarding } = useAuth();

  /**
   * Validates current step inputs before advancing.
   */
  const handleNext = () => {
    if (step === 1 && (!form.age || !form.gender)) return Alert.alert('Missing Info', 'Please provide age and gender.');
    if (step === 2 && (!form.weight_lbs || !form.height_inches)) return Alert.alert('Missing Info', 'Please provide weight and height.');
    if (step === 3 && !form.activity_level) return Alert.alert('Missing Info', 'Please select an activity level.');
    if (step === 4 && !form.goal) return Alert.alert('Missing Info', 'Please select a goal.');
    
    if (step < 5) setStep(step + 1);
  };

  /**
   * Navigates to the previous step.
   */
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  /**
   * Submits the gathered data to the /submit-onboarding/ endpoint.
   * On success, updates the global AuthContext to finalize the user's registration state.
   */
  const handleSubmit = async () => {
    setLoading(true);
    
    // Mapping frontend labels to strict backend keys
    const activityMap: Record<string, string> = {
      'sedentary': 'sedentary',
      'lightly active': 'lightly_active',
      'moderately active': 'moderately_active',
      'very active': 'very_active',
      'extra active': 'extra_active',
    };

    const goalMap: Record<string, string> = {
      'lose weight': 'weight_loss',
      'maintain': 'maintain',
      'gain muscle': 'gain_muscle',
    };

    const payload = {
      age: Number(form.age),
      gender: form.gender,
      weight_lbs: Number(form.weight_lbs),
      height_inches: Number(form.height_inches),
      activity_level: activityMap[form.activity_level] || form.activity_level,
      goal: goalMap[form.goal] || form.goal,
    };

    try {
      const response = await apiClient.post('/submit-onboarding/', payload);

      if (response.data.status === 'success') {
        await completeOnboarding();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to connect to server.';
      Alert.alert('Submission Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Renders the progress bar dots.
   */
  const renderProgress = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4, 5].map((s) => (
        <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.brandTitle}>Metrix Onboarding</Text>
        {renderProgress()}

        <View style={styles.glassCard}>
          {step === 1 && (
            <View>
              <Text style={styles.title}>Tell us about yourself</Text>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter age"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={form.age}
                onChangeText={(v) => setForm({ ...form, age: v })}
              />
              <Text style={styles.inputLabel}>Gender</Text>
              <View style={styles.row}>
                {['Male', 'Female'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.choiceButton, form.gender === g.toLowerCase() && styles.choiceButtonActive]}
                    onPress={() => setForm({ ...form, gender: g.toLowerCase() })}
                  >
                    <Text style={[styles.choiceText, form.gender === g.toLowerCase() && styles.choiceTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>Your Biometrics</Text>
              <Text style={styles.inputLabel}>Weight (lbs)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 180"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={form.weight_lbs}
                onChangeText={(v) => setForm({ ...form, weight_lbs: v })}
              />
              <Text style={styles.inputLabel}>Height (inches)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 70"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={form.height_inches}
                onChangeText={(v) => setForm({ ...form, height_inches: v })}
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Activity Level</Text>
              {ACTIVITY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[styles.bigChoice, form.activity_level === level.value && styles.bigChoiceActive]}
                  onPress={() => setForm({ ...form, activity_level: level.value })}
                >
                  <Text style={styles.bigChoiceLabel}>{level.label}</Text>
                  <Text style={styles.bigChoiceDesc}>{level.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.title}>What is your goal?</Text>
              {GOALS.map((goal) => (
                <TouchableOpacity
                  key={goal.value}
                  style={[styles.bigChoice, form.goal === goal.value && styles.bigChoiceActive]}
                  onPress={() => setForm({ ...form, goal: goal.value })}
                >
                  <Text style={styles.bigChoiceLabel}>{goal.label}</Text>
                  <Text style={styles.bigChoiceDesc}>{goal.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 5 && (
            <View>
              <Text style={styles.title}>Ready to transform?</Text>
              <Text style={styles.summaryText}>We've calculated the perfect Keto Waterfall plan for your biometrics. Once submitted, your macro goals will be updated automatically.</Text>
              <View style={styles.reviewContainer}>
                <Text style={styles.reviewItem}>• {form.age} years old</Text>
                <Text style={styles.reviewItem}>• {form.weight_lbs} lbs</Text>
                <Text style={styles.reviewItem}>• {form.activity_level}</Text>
                <Text style={styles.reviewItem}>• Goal: {form.goal}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.nextButton, step === 1 && { width: '100%' }]} 
            onPress={step === 5 ? handleSubmit : handleNext}
            disabled={loading}
          >
            <Text style={styles.nextButtonText}>{loading ? 'Calculating...' : step === 5 ? 'Get Started' : 'Next Step'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { padding: 24, paddingTop: 60 },
  brandTitle: { fontSize: 16, fontWeight: '800', color: '#FF2D55', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  progressDot: { width: 40, height: 4, backgroundColor: '#333', marginHorizontal: 4, borderRadius: 2 },
  progressDotActive: { backgroundColor: '#FF2D55' },
  glassCard: { 
    backgroundColor: 'rgba(28, 28, 30, 0.8)', 
    borderRadius: 24, 
    padding: 24, 
    minHeight: 350,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  inputLabel: { fontSize: 14, color: '#aaa', marginBottom: 8, fontWeight: '600' },
  input: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    color: '#fff', 
    padding: 18, 
    borderRadius: 14, 
    marginBottom: 20, 
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#333'
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  choiceButton: { 
    flex: 1, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 16, 
    borderRadius: 14, 
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#333'
  },
  choiceButtonActive: { backgroundColor: '#FF2D55', borderColor: '#FF2D55' },
  choiceText: { color: '#888', fontSize: 16, fontWeight: '600' },
  choiceTextActive: { color: '#fff' },
  bigChoice: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333'
  },
  bigChoiceActive: { borderColor: '#FF2D55', backgroundColor: 'rgba(255, 45, 85, 0.1)' },
  bigChoiceLabel: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  bigChoiceDesc: { color: '#888', fontSize: 14 },
  summaryText: { color: '#aaa', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  reviewContainer: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 14 },
  reviewItem: { color: '#fff', fontSize: 16, marginBottom: 8, fontWeight: '500' },
  footer: { flexDirection: 'row', marginTop: 30, justifyContent: 'space-between' },
  backButton: { padding: 18, justifyContent: 'center' },
  backButtonText: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  nextButton: { 
    backgroundColor: '#FF2D55', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    flex: 1,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
