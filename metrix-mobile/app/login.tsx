import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { initialize } from 'react-native-health-connect';
import apiClient from '../src/api/apiClient';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';

export default function LoginScreen() {
  const { currentThemeColors } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    const initHealthConnect = async () => {
      try {
        const isInitialized = await initialize();
        console.log('[HealthConnect] Initialized:', isInitialized);
      } catch (error) {
        console.warn('[HealthConnect] Could not initialize:', error);
      }
    };
    initHealthConnect();
  }, []);

  useEffect(() => {
    const setupGoogle = async () => {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        if (GoogleSignin) {
          await GoogleSignin.configure({
            webClientId: '186379443899-mkv7vv5aorscka0rhosfbhmhfl551ahl.apps.googleusercontent.com',
            offlineAccess: true,
          });
          const userInfo = await GoogleSignin.signInSilently();
          if (userInfo) {
            const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;
            if (idToken) {
              const response = await apiClient.post('auth/google/', { id_token: idToken });
              if (response.data?.token) {
                await login(response.data.token);
              }
            }
          }
        }
      } catch (e) {
        console.log('[GoogleSignIn] Module unavailable or session not found:', e.message);
      }
    };
    setupGoogle();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      if (!GoogleSignin) throw new Error('MODULE_NOT_FOUND');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;
      if (!idToken) throw new Error('Google Sign-In succeeded but no idToken was returned.');
      const response = await apiClient.post('auth/google/', { id_token: idToken });
      if (response.data?.token) {
        await login(response.data.token);
      } else {
        Alert.alert('Sign-In Error', 'Backend did not return a valid session token.');
      }
    } catch (error: any) {
      if (error.message === 'MODULE_NOT_FOUND' || error.message?.includes('RNGoogleSignin')) {
        Alert.alert('Not Available', 'Google Sign-In requires a custom development build.');
      } else {
        Alert.alert('Sign-In Failed', error.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    try {
      const endpoint = isLogin ? 'login/' : 'register/';
      const payload = { username: email, password };
      const response = await apiClient.post(endpoint, payload);
      if (response.data.status === 'success') {
        await login(response.data.token);
      } else {
        Alert.alert('Authentication Failed', 'Check your credentials.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error ?? 'Authentication failed.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: currentThemeColors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: currentThemeColors.primary }]}>Metrix</Text>
        <Text style={[styles.subtitle, { color: currentThemeColors.textSecondary }]}>
          {isLogin ? 'Login to your account' : 'Create an account'}
        </Text>

        <TextInput
          style={[styles.input, { backgroundColor: currentThemeColors.card, color: currentThemeColors.text, borderColor: currentThemeColors.border }]}
          placeholder="Email / Username"
          placeholderTextColor={currentThemeColors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <View style={[styles.passwordContainer, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>
          <TextInput
            style={[styles.passwordInput, { color: currentThemeColors.text }]}
            placeholder="Password"
            placeholderTextColor={currentThemeColors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={currentThemeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: currentThemeColors.primary }]} onPress={handleAuth}>
          <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: currentThemeColors.border }]} />
          <Text style={[styles.dividerText, { color: currentThemeColors.textSecondary }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: currentThemeColors.border }]} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, isGoogleLoading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color="#1E293B" style={styles.googleIcon} />
          ) : (
            <FontAwesome name="google" size={20} color="#DB4437" style={styles.googleIcon} />
          )}
          <Text style={styles.googleButtonText}>
            {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toggleButton} onPress={() => setIsLogin(!isLogin)}>
          <Text style={[styles.toggleText, { color: currentThemeColors.textSecondary }]}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  content: { padding: 30 },
  title: { fontSize: 54, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 18, textAlign: 'center', marginBottom: 40, fontWeight: '500' },
  input: { padding: 18, borderRadius: 14, marginBottom: 20, fontSize: 16, borderWidth: 1 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, marginBottom: 20, borderWidth: 1, paddingRight: 15 },
  passwordInput: { flex: 1, padding: 18, fontSize: 16 },
  button: { padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { paddingHorizontal: 15, fontSize: 14, fontWeight: 'bold' },
  googleButton: { backgroundColor: '#fff', flexDirection: 'row', padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  googleButtonDisabled: { opacity: 0.7 },
  googleIcon: { marginRight: 12 },
  googleButtonText: { color: '#1E293B', fontSize: 16, fontWeight: 'bold' },
  toggleButton: { marginTop: 30, alignItems: 'center' },
  toggleText: { fontSize: 16, fontWeight: '600' },
});
