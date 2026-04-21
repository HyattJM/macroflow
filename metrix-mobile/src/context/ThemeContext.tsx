import React, { createContext, useState, useContext, ReactNode } from 'react';
import { themes, ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { layout } from '../theme/layout';

interface ThemeContextType {
  themeName: string;
  currentThemeColors: ThemeColors;
  typography: typeof typography;
  layout: typeof layout;
  setThemeName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeName, setThemeName] = useState<string>('defaultDark'); 
  const currentThemeColors = themes[themeName] || themes.defaultDark;

  return (
    <ThemeContext.Provider value={{ 
      themeName, 
      currentThemeColors, 
      typography, 
      layout, 
      setThemeName 
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
