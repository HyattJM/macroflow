import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../src/api/apiClient';
import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password.');
      return;
    }

    try {
      const endpoint = isLogin ? '/login/' : '/register/';
      const payload = { username: email, password: password };
      
      const response = await apiClient.post(endpoint, payload);
      
      if (response.data.status === 'success') {
        await login(response.data.token);
      } else {
        Alert.alert('Error', 'Authentication failed.');
      }
    } catch (error: any) {
       Alert.alert('Error', error.response?.data?.error || 'Authentication failed. Make sure your credentials are correct.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Metrix</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Login to your account' : 'Create an account'}</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email / Username"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="gray" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.button} onPress={handleAuth}>
          <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toggleButton} onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000', 
    justifyContent: 'center' 
  },
  content: { 
    padding: 30 
  },
  title: { 
    fontSize: 54, 
    fontWeight: '900', 
    color: '#FF2D55', 
    textAlign: 'center', 
    marginBottom: 10 
  },
  subtitle: { 
    fontSize: 18, 
    color: '#aaa', 
    textAlign: 'center', 
    marginBottom: 40,
    fontWeight: '500'
  },
  input: { 
    backgroundColor: '#1C1C1E', 
    color: '#fff', 
    padding: 18, 
    borderRadius: 14, 
    marginBottom: 20, 
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333'
  },
  button: { 
    backgroundColor: '#FF2D55', 
    padding: 18, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  toggleButton: { 
    marginTop: 30, 
    alignItems: 'center' 
  },
  toggleText: { 
    color: '#888', 
    fontSize: 16,
    fontWeight: '600'
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    paddingRight: 15,
  },
  passwordInput: {
    flex: 1,
    color: '#fff',
    padding: 18,
    fontSize: 16,
  },
});
