import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Profile', headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#F8FAFC' }} />
      <View style={styles.content}>
        <Ionicons name="person-circle" size={100} color="#0EA5E9" />
        <Text style={styles.title}>Your Profile</Text>
        <Text style={styles.subtitle}>Settings and preferences coming soon.</Text>
        
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 10,
    textAlign: 'center',
  },
  button: {
    marginTop: 40,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: {
    color: '#0EA5E9',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
