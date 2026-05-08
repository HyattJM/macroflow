import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { themes, ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { layout } from '../theme/layout';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  themeName: string;
  currentThemeColors: ThemeColors;
  typography: typeof typography;
  layout: typeof layout;
  setThemeName: (name: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeName, setThemeName] = useState<string>('oceanicDark'); 

  useEffect(() => {
    // Load theme from storage on mount
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('user-theme');
      if (savedTheme && themes[savedTheme]) {
        setThemeName(savedTheme);
      }
    };
    loadTheme();
  }, []);

  const currentThemeColors = themes[themeName] || themes.oceanicDark;

  const toggleTheme = async () => {
    const newTheme = themeName === 'oceanicDark' ? 'highContrastLight' : 'oceanicDark';
    setThemeName(newTheme);
    await AsyncStorage.setItem('user-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ 
      themeName, 
      currentThemeColors, 
      typography, 
      layout, 
      setThemeName,
      toggleTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
