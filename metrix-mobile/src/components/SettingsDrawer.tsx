import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import apiClient from '../api/apiClient';

let _GoogleSignin: any = null;
try {
  const gsModule = require('@react-native-google-signin/google-signin');
  _GoogleSignin = gsModule.GoogleSignin;
} catch (e) {
  console.log('[SettingsDrawer] Google module not available');
}

const { height } = Dimensions.get('window');

interface SettingsDrawerProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ isVisible, onClose }: SettingsDrawerProps) {
  const { logout } = useAuth();
  const { toggleTheme, themeName, currentThemeColors } = useAppTheme();
  const slideAnim = React.useRef(new Animated.Value(-height)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => {
          try {
            if (_GoogleSignin) {
              await _GoogleSignin.signOut();
              await _GoogleSignin.revokeAccess();
            }
          } catch (e) {
            console.warn('[Logout] Google Sign-Out error:', e);
          }
          logout();
          onClose();
        } 
      }
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.prompt(
      "Delete Account",
      "This action is permanent. Please enter your password to confirm deletion:",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async (password) => {
            if (!password) return;
            try {
              const res = await apiClient.post('user/delete-account/', { password });
              if (res.status === 200) {
                Alert.alert("Account Deleted", "Your account has been successfully removed.");
                logout();
              }
            } catch (err: any) {
              const msg = err.response?.data?.error || "Failed to delete account.";
              Alert.alert("Error", msg);
            }
          } 
        }
      ],
      "secure-text"
    );
  };

  const themeLabel = themeName === 'oceanicDark' ? 'Oceanic Dark' : 'High-Contrast Light';

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View 
          style={[
            styles.drawerContainer, 
            { 
              transform: [{ translateY: slideAnim }],
              backgroundColor: currentThemeColors.surface 
            }
          ]}
        >
          <Pressable style={styles.drawerContent}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: currentThemeColors.text }]}>Settings</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color={currentThemeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Theme Toggle */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentThemeColors.textSecondary }]}>Appearance</Text>
              <View style={[styles.row, { backgroundColor: currentThemeColors.background }]}>
                <Text style={[styles.label, { color: currentThemeColors.text }]}>Current: {themeLabel}</Text>
                <TouchableOpacity 
                  style={[styles.toggleBtn, { backgroundColor: currentThemeColors.surface }]} 
                  onPress={toggleTheme}
                >
                  <Ionicons 
                    name={currentThemeColors.isDark ? "moon" : "sunny"} 
                    size={24} 
                    color={currentThemeColors.primary} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Account Actions */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: currentThemeColors.textSecondary }]}>Account Management</Text>
              <TouchableOpacity style={[styles.menuItem, { backgroundColor: currentThemeColors.background }]} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color={currentThemeColors.textSecondary} />
                <Text style={[styles.menuText, { color: currentThemeColors.text }]}>Logout</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuItem, styles.deleteItem, { backgroundColor: currentThemeColors.background, borderColor: currentThemeColors.error }]} 
                onPress={handleDeleteAccount}
              >
                <Ionicons name="trash-outline" size={24} color={currentThemeColors.error} />
                <Text style={[styles.menuText, styles.deleteText, { color: currentThemeColors.error }]}>Delete Account</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={[styles.versionText, { color: currentThemeColors.textSecondary }]}>Metrix v2.0.1</Text>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawerContainer: {
    width: '100%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 60,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  drawerContent: {
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  label: {
    fontSize: 16,
  },
  toggleBtn: {
    padding: 10,
    borderRadius: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '600',
  },
  deleteItem: {
    borderWidth: 1,
    marginTop: 8,
  },
  deleteText: {
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  versionText: {
    fontSize: 12,
    opacity: 0.6,
  }
});
