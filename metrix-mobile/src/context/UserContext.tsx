import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import { calculateMacros, UserStats } from '../utils/macroEngine';

interface UserContextType {
  profile: UserStats | null;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  loading: boolean;
  updateProfile: (updates: Partial<UserStats>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState({ calories: 2000, protein: 150, carbs: 200, fat: 70 });

  const refreshProfile = async () => {
    try {
      const res = await apiClient.get('user/profile/');
      if (res.data) {
        setProfile(res.data);
        const results = calculateMacros(res.data);
        setTargets(results);
      }
    } catch (e) {
      console.error("Failed to fetch profile", e);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserStats>) => {
    try {
      const res = await apiClient.patch('user/profile/', updates);
      if (res.data) {
        setProfile(res.data);
        const results = calculateMacros(res.data);
        setTargets(results);
      }
    } catch (e) {
      console.error("Failed to update profile", e);
      throw e;
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  return (
    <UserContext.Provider value={{ profile, targets, loading, updateProfile, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
