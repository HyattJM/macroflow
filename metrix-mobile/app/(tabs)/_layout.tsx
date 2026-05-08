import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext, useRouter } from 'expo-router';
// Navigation Version 2.0 - Settings Tab Removed
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import SettingsDrawer from '../../src/components/SettingsDrawer';

// Create a custom Expo Router layout wrapper for Material Top Tabs
const { Navigator } = createMaterialTopTabNavigator();
export const SwipeableTabs = withLayoutContext(Navigator);

function CustomTabBar({ state, descriptors, navigation }) {
  const { currentThemeColors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.tabBar, 
      { 
        backgroundColor: currentThemeColors.card,
        borderTopColor: currentThemeColors.border,
        borderTopWidth: 1,
        position: 'relative',
        paddingBottom: Math.max(insets.bottom, 12)
      }
    ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        // Skip hidden routes (like settings)
        if (options.href === null) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const activeColor = currentThemeColors.primary;
        const inactiveColor = currentThemeColors.textSecondary;
        const color = isFocused ? activeColor : inactiveColor;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            {options.tabBarIcon ? options.tabBarIcon({ color, size: 24, focused: isFocused }) : null}
            <Text style={[styles.tabLabel, { color }]}>
              {options.title || route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { currentThemeColors } = useAppTheme();
  const router = useRouter();
  const [settingsVisible, setSettingsVisible] = React.useState(false);
  
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: currentThemeColors.background }} edges={['top']}>
      {/* Global Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: currentThemeColors.background,
        borderBottomWidth: 1,
        borderBottomColor: currentThemeColors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Favicon/Logo Placeholder */}
          <View style={{
            width: 36, height: 36, borderRadius: 8, backgroundColor: currentThemeColors.primary,
            alignItems: 'center', justifyContent: 'center', marginRight: 12
          }}>
            <Ionicons name="fitness" size={20} color="#FFF" />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: currentThemeColors.text }}>Metrix</Text>
            <Text style={{ fontSize: 13, color: currentThemeColors.textSecondary, fontWeight: '500' }}>{today}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={{ padding: 8, backgroundColor: currentThemeColors.card, borderRadius: 12 }}
          onPress={() => setSettingsVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={24} color={currentThemeColors.primary} />
        </TouchableOpacity>
      </View>

      <SettingsDrawer 
        isVisible={settingsVisible} 
        onClose={() => setSettingsVisible(false)} 
      />

    <SwipeableTabs
      tabBar={props => <CustomTabBar {...props} />}
      tabBarPosition="bottom"
      keyboardDismissMode="on-drag"
      sceneContainerStyle={{ backgroundColor: currentThemeColors.background }}
      screenOptions={{
        swipeEnabled: true,
        tabBarStyle: {
          backgroundColor: currentThemeColors.card,
          borderTopWidth: 1,
          borderTopColor: currentThemeColors.border,
        }
      }}>
      <SwipeableTabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="stats-chart" color={color} />,
        }}
      />
      <SwipeableTabs.Screen
        name="food"
        options={{
          title: 'Food Log',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="restaurant" color={color} />,
        }}
      />
      <SwipeableTabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="camera" color={color} />,
        }}
      />
      <SwipeableTabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="barbell" color={color} />,
        }}
      />
      <SwipeableTabs.Screen
        name="exercises"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="library" color={color} />,
        }}
      />
      <SwipeableTabs.Screen
        name="chef"
        options={{
          title: 'AI Chef',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="restaurant-outline" color={color} />,
        }}
      />
      <SwipeableTabs.Screen
        name="cookbook"
        options={{
          title: 'Cookbook',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="book-outline" color={color} />,
        }}
      />
    </SwipeableTabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 12, // Safe area handling
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  }
});
