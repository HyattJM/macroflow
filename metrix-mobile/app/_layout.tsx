import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../src/api/apiClient';
import Toast from 'react-native-toast-message';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider, useAppTheme } from '../src/context/ThemeContext';
import { WorkoutSessionProvider } from '../src/context/WorkoutSessionContext';

/**
 * Expo Router configuration settings.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * RootLayoutNav handles the core navigation logic, including authentication 
 * and onboarding redirects.
 * 
 * Logic Rationale:
 * - Redirection: Uses a multi-state check (isAuthenticated, isOnboardingComplete) 
 *   to ensure users are always in the correct app section.
 * - Non-Authenticated Users: Forced to /login if they attempt to access restricted segments.
 * - Authenticated Users: Redirected to /onboarding if their profile is incomplete, 
 *   otherwise sent to the main (tabs) dashboard.
 */
function RootLayoutNav() {
  const { isAuthenticated, isOnboardingComplete, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { currentThemeColors } = useAppTheme();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('transparent');
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  useEffect(() => {
    if (isLoading || isAuthenticated === null || (isAuthenticated && isOnboardingComplete === null)) return;
    
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!isAuthenticated && (inTabsGroup || inOnboarding)) {
      router.replace('/login');
    } else if (isAuthenticated) {
      if (!isOnboardingComplete && !inOnboarding) {
        router.replace('/onboarding');
      } else if (isOnboardingComplete && (segments[0] === 'login' || inOnboarding)) {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isOnboardingComplete, isLoading, segments]);

  if (isLoading || isAuthenticated === null || (isAuthenticated && isOnboardingComplete === null)) return null;

  const isDarkBackground = currentThemeColors.background === '#1A1B26' || currentThemeColors.background === '#121212' || currentThemeColors.background === '#262335'; // Check if background is dark for status bar

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="profile" options={{ presentation: 'card', title: 'Profile' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDarkBackground ? 'light' : 'dark'} />
    </>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * ToastWrapper provides custom-styled dynamic notifications.
 * It is theme-aware and responds to changes in the global ThemeContext.
 */
const ToastWrapper = () => {
  const { currentThemeColors } = useAppTheme();
  
  const toastConfig = {
    success: (props: any) => (
      <View style={{ minHeight: 60, paddingVertical: 10, width: '90%', backgroundColor: currentThemeColors.surface, borderRadius: 8, borderLeftWidth: 5, borderLeftColor: currentThemeColors.primary, justifyContent: 'center', paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}>
        <Text style={{ color: currentThemeColors.text, fontSize: 16, fontWeight: 'bold' }}>{props.text1}</Text>
        {props.text2 ? <Text style={{ color: '#aaa', fontSize: 14 }}>{props.text2}</Text> : null}
      </View>
    ),
    error: (props: any) => (
      <View style={{ minHeight: 60, paddingVertical: 10, width: '90%', backgroundColor: currentThemeColors.surface, borderRadius: 8, borderLeftWidth: 5, borderLeftColor: currentThemeColors.error, justifyContent: 'center', paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}>
        <Text style={{ color: currentThemeColors.text, fontSize: 16, fontWeight: 'bold' }}>{props.text1}</Text>
        {props.text2 ? <Text style={{ color: '#aaa', fontSize: 14 }}>{props.text2}</Text> : null}
      </View>
    )
  };

  return <Toast config={toastConfig} />;
};

/**
 * RootLayout is the entry point for the application.
 * It wraps the app in the necessary providers for authentication, 
 * theming, and gesture handling.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <WorkoutSessionProvider>
            <RootLayoutNav />
            <ToastWrapper />
          </WorkoutSessionProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
