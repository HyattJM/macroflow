import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';

/**
 * Interface for the AuthContext state and actions.
 */
interface AuthContextType {
  /** True if an auth_token exists in storage. */
  isAuthenticated: boolean | null;
  /** True if the user has finished the onboarding physiological data entry. */
  isOnboardingComplete: boolean | null;
  /** True while the provider is reading from AsyncStorage. */
  isLoading: boolean;
  /** User's preferred color scheme. */
  themePreference: 'light' | 'dark' | 'system';
  /** Sets the auth token and triggers a re-initialization. */
  login: (token: string) => Promise<void>;
  /** Clears all storage and resets auth state. */
  logout: () => Promise<void>;
  /** Manually flags onboarding as complete in storage and state. */
  completeOnboarding: () => Promise<void>;
  /** Persists theme selection to storage. */
  updateThemePreference: (theme: 'light' | 'dark' | 'system') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * AuthProvider manages the global authentication state and onboarding status.
 * 
 * Logic Rationale:
 * - Boot Sequence: Reads `auth_token` and `has_onboarded` from AsyncStorage on mount.
 * - API Synchronization: If `auth_token` exists but `has_onboarded` is missing from local storage, 
 *   it attempts to verify onboarding status via the `/daily-summary/` endpoint (checking if `age > 0`).
 * - Persistence: All state changes are mirrored to AsyncStorage to survive app restarts.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    initializeAuth();
  }, []);

  /**
   * Initializes the auth state by reading from local storage and verifying with the backend.
   * @param isNewLogin - If true, treats the initialization as a fresh login event.
   */
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
          // Fallback to API check: Verify if the profile has real data (age > 0)
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

/**
 * Custom hook to access the AuthContext.
 * @throws Error if used outside of an AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
