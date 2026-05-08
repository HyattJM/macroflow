export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  card: string;
  isDark: boolean;
}

export const themes: Record<string, ThemeColors> = {
  defaultDark: {
    background: '#000000',
    surface: '#121212',
    card: '#1C1C1E',
    primary: '#BB9AF7', 
    accent: '#7AA2F7',  
    text: '#C0CAF5',    
    textSecondary: '#565F89', 
    success: '#9ECE6A', 
    warning: '#E0AF68', 
    error: '#F7768E',   
    info: '#7DCFFF',    
    border: '#1A1B26',
    isDark: true,
  },
  deepSeaDark: {
    background: '#010B13',
    surface: '#0A192F',    
    card: '#112240',      
    primary: '#64FFDA',   
    accent: '#00B8D9',    
    text: '#CCD6F6',      
    textSecondary: '#8892B0', 
    success: '#50FA7B',   
    warning: '#FFCB2B', 
    error: '#FF5555',   
    info: '#8BE9FD',
    border: '#233554',
    isDark: true,
  },
  synthWave: {
    background: '#010101',
    surface: '#120422',   
    card: '#1B0C32',
    primary: '#FF7EDB', 
    accent: '#36F9F6',  
    text: '#FFFFFF',
    textSecondary: '#B9A1E0', 
    success: '#34D399',
    warning: '#FBBF24',
    error: '#FF3B30',
    info: '#007AFF',
    border: '#331D52',
    isDark: true,
  },
  classicLight: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    primary: '#9D65FF',
    accent: '#5856D6',
    text: '#000000',
    textSecondary: '#8E8E93',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#007AFF',
    border: '#C6C6C8',
    isDark: false,
  },
  oceanicDark: {
    background: '#0F172A',
    surface: '#1E293B',
    card: '#1E293B',
    primary: '#0EA5E9',
    accent: '#0EA5E9',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    success: '#10B981',
    warning: '#FBBF24',
    error: '#EF4444',
    info: '#3ABFF8',
    border: '#334155',
    isDark: true,
  },
  highContrastLight: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    primary: '#0EA5E9',
    accent: '#0EA5E9',
    text: '#0F172A',
    textSecondary: '#64748B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#0EA5E9',
    border: '#E2E8F0',
    isDark: false,
  },
};
