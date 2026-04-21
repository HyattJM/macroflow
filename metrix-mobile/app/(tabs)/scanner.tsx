import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import apiClient from '../../src/api/apiClient';
import axios from 'axios';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface KetoScannerProps {
  user?: {
    id?: string | number;
  };
}

export default function KetoScanner({ user }: KetoScannerProps) {
  const { currentThemeColors, layout, typography } = useAppTheme();
  const isDark = currentThemeColors.isDark;
  
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [modifier, setModifier] = useState('');
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // New State
  const [mode, setMode] = useState('vision'); // 'vision' | 'barcode'
  const [scanned, setScanned] = useState(false); // To disable multi-scans
  const [aiTokens, setAiTokens] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchWallet();
    }, [])
  );

  const fetchWallet = async () => {
    try {
      const response = await apiClient.get('/tokens/');
      if (response.data && response.data.tokens !== undefined) {
        setAiTokens(response.data.tokens);
      }
    } catch (e) {
      console.error("Failed to fetch wallet", e);
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color: '#fff' }}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Vision Mode Methods
  const takePicture = async () => {
    if (cameraRef.current) {
      const options = { quality: 0.5, base64: true };
      const data = await cameraRef.current.takePictureAsync(options);
      setPhoto(data);
    }
  };

  const handleScan = async () => {
    if (!photo) return;
    
    // Check local tokens first
    if (aiTokens <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    setLoading(true);
    try {
      // 1. Physically pull the token out of the vault
      const token = await AsyncStorage.getItem('auth_token');
      
      const payload = {
        image: photo.base64,
        modifier: modifier,
        userId: user?.id
      };
      
      // 2. Staple the token directly to the headers of this specific request
      const response = await apiClient.post('/scan-keto/', payload, {
        headers: {
          'Authorization': `Token ${token}`
        }
      });
      
      if (response.data.status === 'success') {
        setAiTokens(prev => Math.max(0, prev - 1)); // instantly decrement visually
        const foodName = response.data.data.food_name || response.data.data.name || 'Unknown Food';
        Alert.alert(
          'Keto Vision Result',
          `Added: ${foodName}\nCalories: ${response.data.data.calories}\nProtein: ${response.data.data.protein}g\nCarbs: ${response.data.data.carbs}g\nFat: ${response.data.data.fat}g`
        );
        setPhoto(null);
        setModifier('');
      } else {
        Alert.alert('Error', 'Failed to parse image from Keto Vision.');
      }
    } catch (error) {
      const status = error?.response?.status;
      console.log("SCAN ERROR STATUS:", status);
      
      // 3. Strict error routing
      if (status === 402) {
        setShowUpgradeModal(true); // ONLY show paywall on true 402 "Out of Tokens"
      } else if (status === 403) {
        Alert.alert('Auth Error', 'The server rejected the token (403 Forbidden).');
      } else if (status === 429) {
        Alert.alert('Capacity Reached', 'AI servers are temporarily busy, try again in a moment.');
      } else {
        Alert.alert('Server Error', `Failed to communicate with backend. Status: ${status || 'Unknown'}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Barcode Mode Methods
  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const responseData = await response.json();

      if (responseData.status === 1) {
        const product = responseData.product;
        const nutriments = product.nutriments || {};

        const productName = product.product_name || 'Barcode Item';
        
        const getValue = (keyServing, key100g) => {
          if (nutriments[keyServing] !== undefined && nutriments[keyServing] !== null) return nutriments[keyServing];
          if (nutriments[key100g] !== undefined && nutriments[key100g] !== null) return nutriments[key100g];
          return 0;
        };

        const calories = getValue('energy-kcal_serving', 'energy-kcal_100g');
        const protein = getValue('proteins_serving', 'proteins_100g');
        const carbs = getValue('carbohydrates_serving', 'carbohydrates_100g');
        const fat = getValue('fat_serving', 'fat_100g');
        const fiber = getValue('fiber_serving', 'fiber_100g');
        
        const polyols = getValue('polyols_serving', 'polyols_100g');
        const erythritol = getValue('erythritol_serving', 'erythritol_100g');
        const sugarAlcohols = Math.max(polyols, erythritol);

        const netCarbs = Math.max(0, carbs - fiber - sugarAlcohols);

        // POST to log_nutrition
        const payload = {
          food_name: productName,
          calories: Math.round(calories),
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(netCarbs * 10) / 10,
          fat: Math.round(fat * 10) / 10
        };

        const postResponse = await apiClient.post('/log-nutrition/', payload);

        if (postResponse.data.status === 'success') {
          Alert.alert(
             'Barcode Scanned!',
             `Added: ${productName}\nCalories: ${payload.calories}\nProtein: ${payload.protein}g\nNet Carbs: ${payload.carbs}g\nFat: ${payload.fat}g`,
             [{ text: 'OK', onPress: () => setScanned(false) }]
          );
        } else {
          Alert.alert('Error', 'Failed to log nutrition', [{ text: 'OK', onPress: () => setScanned(false) }]);
        }
      } else {
        Alert.alert('Not Found', 'Product not found in OpenFoodFacts.', [{ text: 'OK', onPress: () => setScanned(false) }]);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch barcode info.', [{ text: 'OK', onPress: () => setScanned(false) }]);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: currentThemeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.toggleContainer, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, borderWidth: 1 }]}>
        <TouchableOpacity 
          style={[styles.toggleButton, mode === 'vision' && { backgroundColor: currentThemeColors.primary }]} 
          onPress={() => { setMode('vision'); setPhoto(null); setScanned(false); }}
        >
          <Text style={[styles.toggleText, { color: mode === 'vision' ? '#fff' : currentThemeColors.textSecondary }]}>AI Vision</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, mode === 'barcode' && { backgroundColor: currentThemeColors.primary }]} 
          onPress={() => { setMode('barcode'); setPhoto(null); setScanned(false); }}
        >
          <Text style={[styles.toggleText, { color: mode === 'barcode' ? '#fff' : currentThemeColors.textSecondary }]}>Barcode</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{flexGrow: 1}}>
        {photo && mode === 'vision' ? (
          <View style={[styles.previewContainer, { backgroundColor: currentThemeColors.background }]}>
            {mode === 'vision' && (
              <View style={[styles.tokenBadge, { backgroundColor: currentThemeColors.card + 'CC' }]}>
                <Text style={[styles.tokenText, { color: currentThemeColors.text }]}>Free AI Scans: {aiTokens}</Text>
              </View>
            )}
            <Image source={{ uri: photo.uri }} style={styles.preview} />
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: currentThemeColors.text }]}>Modifiers (e.g. 'McDonalds, no bun'):</Text>
              <TextInput
                style={[styles.input, { backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]}
                placeholder="What did you change?"
                placeholderTextColor={currentThemeColors.textSecondary}
                value={modifier}
                onChangeText={setModifier}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: currentThemeColors.surface }]} onPress={() => setPhoto(null)}>
                <Text style={[styles.buttonTextBlack, { color: currentThemeColors.text }]}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: currentThemeColors.primary }]} onPress={handleScan} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Analyzing...' : 'Analyze Meal'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView 
              style={styles.camera} 
              ref={cameraRef}
              barcodeScannerSettings={mode === 'barcode' ? { barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e'] } : undefined}
              onBarcodeScanned={scanned || mode !== 'barcode' ? undefined : handleBarCodeScanned}
            />
            {mode === 'vision' && (
              <View style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 10 }}>
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenText}>Free AI Scans: {aiTokens}</Text>
                </View>
                <View style={styles.cameraOverlay}>
                  <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                    <View style={styles.captureInner} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {mode === 'barcode' && scanned && (
              <View style={styles.loadingOverlay}>
                <Text style={styles.loadingText}>Looking up product...</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Premium Upgrade Modal */}
      <Modal visible={showUpgradeModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentThemeColors.card }]}>
            <View style={[styles.aiBadge, { backgroundColor: currentThemeColors.primary + '15' }]}>
              <Ionicons name="sparkles" size={20} color={currentThemeColors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: currentThemeColors.text }]}>Upgrade to Metrix Pro</Text>
            
            <View style={styles.featuresList}>
              <Text style={[styles.featureItem, { color: currentThemeColors.textSecondary }]}>✨ Unlimited AI Food Scanning</Text>
              <Text style={[styles.featureItem, { color: currentThemeColors.textSecondary }]}>👨‍🍳 Unlock the AI Personal Chef</Text>
              <Text style={[styles.featureItem, { color: currentThemeColors.textSecondary }]}>📊 Advanced Macro Analytics</Text>
            </View>

            <TouchableOpacity style={[styles.upgradeButton, { backgroundColor: currentThemeColors.primary }]} onPress={() => {
              Alert.alert("Connecting to App Store...");
              setShowUpgradeModal(false);
            }}>
              <Text style={styles.upgradeButtonText}>Subscribe for $9.99/mo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeModalButton} onPress={() => setShowUpgradeModal(false)}>
              <Text style={[styles.closeModalText, { color: currentThemeColors.textSecondary }]}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 45,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleText: {
    fontWeight: 'black',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    aspectRatio: 3/4,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  preview: {
    width: '100%',
    aspectRatio: 3/4,
  },
  inputContainer: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'black',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    padding: 18,
    borderRadius: 16,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 12,
  },
  primaryButton: {
    flex: 2,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextBlack: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokenBadge: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 20,
  },
  tokenText: {
    fontWeight: 'black',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'black',
    marginBottom: 20,
    textAlign: 'center',
  },
  featuresList: {
    width: '100%',
    marginBottom: 30,
  },
  featureItem: {
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '600',
  },
  upgradeButton: {
    width: '100%',
    paddingVertical: 20,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 15,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeModalButton: {
    padding: 10,
  },
  closeModalText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aiBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  }
});
