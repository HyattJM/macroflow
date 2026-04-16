import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import FoodLogScreen from './src/screens/FoodLogScreen';
import KetoScanner from './src/screens/KetoScanner';
import WorkoutScreen from './src/screens/WorkoutScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#007AFF', // standard iOS blue
          tabBarInactiveTintColor: 'gray',
        }}
        initialRouteName="Dashboard"
      >
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{
            title: 'Daily Totals',
            tabBarIcon: () => null // We could add Ionicons here later
          }}
        />
        <Tab.Screen 
          name="Log" 
          component={FoodLogScreen} 
          options={{
            title: 'Food Log'
          }}
        />
        <Tab.Screen 
          name="Scan" 
          initialParams={{ user }}
          options={{
            title: 'Camera',
          }}
        >
          {props => <KetoScanner {...props} user={user} />}
        </Tab.Screen>
        <Tab.Screen 
          name="Workout" 
          component={WorkoutScreen} 
          options={{
            title: 'Workouts'
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
