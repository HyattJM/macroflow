import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';

interface AuthContextType {
  isAuthenticated: boolean | null;
  isOnboardingComplete: boolean | null;
  isLoading: boolean;
  themePreference: 'light' | 'dark' | 'system';
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateThemePreference: (theme: 'light' | 'dark' | 'system') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async (isNewLogin = false) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const onboarded = await AsyncStorage.getItem('has_onboarded');
      const savedTheme = await AsyncStorage.getItem('theme_preference');
      
      if (savedTheme) setThemePreference(savedTheme as any);
      setIsAuthenticated(!!token);
      
      if (token) {
        if (onboarded === 'true') {
          setIsOnboardingComplete(true);
        } else {
          // Fallback to API check
          try {
            const res = await apiClient.get('/daily-summary/');
            const complete = res.data.age > 0;
            setIsOnboardingComplete(complete);
            if (complete) await AsyncStorage.setItem('has_onboarded', 'true');
          } catch (apiError) {
             console.error("Onboarding API check failed", apiError);
             // If API fails, assume complete if we just logged in, to avoid blocking
             if (isNewLogin) setIsOnboardingComplete(true);
             else setIsOnboardingComplete(null);
          }
        }
      } else {
        setIsOnboardingComplete(null);
      }
    } catch (e) {
      console.error("Auth init failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string) => {
    setIsLoading(true);
    await AsyncStorage.setItem('auth_token', token);
    await initializeAuth(true);
  };

  const logout = async () => {
    await AsyncStorage.clear();
    setIsAuthenticated(false);
    setIsOnboardingComplete(null);
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('has_onboarded', 'true');
    setIsOnboardingComplete(true);
  };

  const updateThemePreference = async (theme: 'light' | 'dark' | 'system') => {
    setThemePreference(theme);
    await AsyncStorage.setItem('theme_preference', theme);
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isOnboardingComplete, 
      isLoading, 
      themePreference,
      login, 
      logout, 
      completeOnboarding,
      updateThemePreference
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
