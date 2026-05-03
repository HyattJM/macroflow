import { Ionicons, FontAwesome } from '@expo/vector-icons';

// ─── Lazy-load Google Sign-In ─────────────────────────────────────────────────
// @react-native-google-signin calls TurboModuleRegistry.getEnforcing() at the
// TOP of its JS entrypoint — before any React component renders. If the native
// 'RNGoogleSignin' TurboModule is absent (Expo Go, wrong build variant), that
// throws an Invariant Violation that crashes the ENTIRE router, preventing even
// the login screen from mounting. A lazy require() inside try/catch contains
// the crash to inside handleGoogleSignIn() rather than at module-load time.
let _GoogleSignin: any = null;
let _statusCodes: any = {};
try {
  const gsModule = require('@react-native-google-signin/google-signin');
  _GoogleSignin = gsModule.GoogleSignin;
  _statusCodes = gsModule.statusCodes;
} catch (e) {
  console.warn('[GoogleSignIn] Native module not available in this build:', e);
}
import { initialize } from 'react-native-health-connect';
import apiClient from '../src/api/apiClient';
import { useAuth } from '../src/context/AuthContext';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { login } = useAuth();

  // ─── Problem 1: Health Connect Safe Initialization ───────────────────────────
  //
  // The native crash (lateinit property requestPermission has not been initialized)
  // occurs because the HealthConnectPermissionDelegate's ActivityResultLauncher is
  // registered in the Android Activity's onCreate lifecycle. Calling initialize()
  // before the Activity is fully attached — e.g. at module import time or in the
  // component body — causes the native delegate to fire before that launcher exists.
  //
  // Fix: defer initialize() to a useEffect callback. React guarantees this runs
  // only after the component has mounted and the host Activity is live and attached.
  // The try/catch prevents any Health Connect unavailability (e.g. API < 26,
  // Play Services missing) from crashing the login screen.
  useEffect(() => {
    const initHealthConnect = async () => {
      try {
        const isInitialized = await initialize();
        console.log('[HealthConnect] Initialized:', isInitialized);
      } catch (error) {
        // Health Connect is unavailable on this device or API level.
        // This is non-fatal — the app continues without it.
        console.warn('[HealthConnect] Could not initialize:', error);
      }
    };

    initHealthConnect();
  }, []); // Empty deps: runs once after first render, never blocks the UI.

  // ─── Google Sign-In Configuration ────────────────────────────────────────────
  // configure() must be called before any other GoogleSignin method.
  // Guard with _GoogleSignin check so this is a no-op when the native module
  // is absent (Expo Go / development without a full native build).
  useEffect(() => {
    if (!_GoogleSignin) return;
    _GoogleSignin.configure({
      webClientId: '186379443899-mkv7vv5aorscka0rhosfbhmhfl551ahl.apps.googleusercontent.com',
    });
  }, []);

  /**
   * Initiates the Google Sign-In flow and sends the resulting idToken to the
   * Django backend for server-side verification and token issuance.
   *
   * Guards against the native module being absent (e.g. running in Expo Go)
   * so a missing binary never surface as an unhandled crash to the user.
   */
  const handleGoogleSignIn = async () => {
    // Native module absent — inform the user gracefully instead of crashing.
    if (!_GoogleSignin) {
      Alert.alert(
        'Not Available',
        'Google Sign-In requires a custom development build. Run `npx expo run:android` to include the native module.',
      );
      return;
    }

    setIsGoogleLoading(true);
    try {
      await _GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const userInfo = await _GoogleSignin.signIn();

      // idToken may be nested under .data in v12+ of the library.
      const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;

      if (!idToken) {
        throw new Error('Google Sign-In succeeded but no idToken was returned.');
      }

      console.log('[GoogleSignIn] idToken obtained, contacting backend...');

      const response = await apiClient.post('/auth/google/', { id_token: idToken });

      if (response.data?.token) {
        await login(response.data.token);
      } else {
        Alert.alert('Sign-In Error', 'Backend did not return a valid session token.');
      }
    } catch (error: any) {
      if (error.code === _statusCodes.SIGN_IN_CANCELLED) {
        console.log('[GoogleSignIn] User cancelled the sign-in flow.');
      } else if (error.code === _statusCodes.IN_PROGRESS) {
        console.warn('[GoogleSignIn] Sign-in already in progress.');
      } else if (error.code === _statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(
          'Google Play Required',
          'Google Play Services are not available or need an update on this device.',
        );
      } else {
        console.error('[GoogleSignIn] Unexpected error:', error);
        Alert.alert(
          'Sign-In Failed',
          error.response?.data?.error ?? error.message ?? 'An unexpected error occurred.',
        );
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // ─── Email / Password Auth ────────────────────────────────────────────────────

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    try {
      const endpoint = isLogin ? '/login/' : '/register/';
      const payload = { username: email, password };

      const response = await apiClient.post(endpoint, payload);

      if (response.data.status === 'success') {
        await login(response.data.token);
      } else {
        Alert.alert('Authentication Failed', 'Please check your credentials and try again.');
      }
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.error ?? 'Authentication failed. Make sure your credentials are correct.',
      );
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* App title */}
        <Text style={styles.title}>Metrix</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Login to your account' : 'Create an account'}
        </Text>

        {/* Email / Username input */}
        <TextInput
          style={styles.input}
          placeholder="Email / Username"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        {/* Password input */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={isLogin ? 'password' : 'newPassword'}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleAuth}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLogin ? 'Login' : 'Sign Up'}
        >
          <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-In button */}
        <TouchableOpacity
          style={[styles.googleButton, isGoogleLoading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color="#555" style={styles.googleIcon} />
          ) : (
            <FontAwesome name="google" size={20} color="#DB4437" style={styles.googleIcon} />
          )}
          <Text style={styles.googleButtonText}>
            {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        {/* Toggle login / register */}
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsLogin(!isLogin)}
          accessibilityRole="button"
        >
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  content: {
    padding: 30,
  },
  title: {
    fontSize: 54,
    fontWeight: '900',
    color: '#0ea5e9',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1C1C1E',
    color: '#fff',
    padding: 18,
    borderRadius: 14,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    paddingRight: 15,
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    padding: 18,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0ea5e9',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#888',
    paddingHorizontal: 15,
    fontSize: 14,
    fontWeight: 'bold',
  },
  googleButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButton: {
    marginTop: 30,
    alignItems: 'center',
  },
  toggleText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
});
