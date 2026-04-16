import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../src/api/apiClient';

import { useColorScheme } from '@/hooks/use-color-scheme';

import { AuthProvider, useAuth } from '../src/context/AuthContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const systemColorScheme = useColorScheme();
  const { isAuthenticated, isOnboardingComplete, isLoading, themePreference } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const activeColorScheme = themePreference === 'system' ? systemColorScheme : themePreference;

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

  return (
    <ThemeProvider value={activeColorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={activeColorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
