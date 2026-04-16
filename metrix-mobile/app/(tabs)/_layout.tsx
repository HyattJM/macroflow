import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

// Create a custom Expo Router layout wrapper for Material Top Tabs
const { Navigator } = createMaterialTopTabNavigator();
export const SwipeableTabs = withLayoutContext(Navigator);

function CustomTabBar({ state, descriptors, navigation }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  return (
    <View style={[
      styles.tabBar, 
      { 
        backgroundColor: isDark ? '#1C1C1E' : '#fff',
        borderTopColor: isDark ? '#333' : '#eee'
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

        const activeColor = theme.tint;
        const inactiveColor = '#8e8e93';
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
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <SwipeableTabs
      tabBar={props => <CustomTabBar {...props} />}
      tabBarPosition="bottom"
      keyboardDismissMode="on-drag"
      screenOptions={{
        swipeEnabled: true,
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
      <SwipeableTabs.Screen
        name="settings"
        options={{
          href: null,
        } as any}
      />
    </SwipeableTabs>
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
