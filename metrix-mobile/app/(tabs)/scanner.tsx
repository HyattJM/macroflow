import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { CameraView, useCameraPermissions } from 'expo-camera';
import apiClient from '../../src/api/apiClient';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, withRepeat, withTiming, useAnimatedStyle, withSequence } from 'react-native-reanimated';

export default function KetoScanner() {
  const { currentThemeColors } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [modifier, setModifier] = useState('');
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [mode, setMode] = useState('vision');
  const [scanned, setScanned] = useState(false);
  const [aiTokens, setAiTokens] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (mode === 'barcode' && !scanned) {
      pulseScale.value = withRepeat(withSequence(withTiming(1.05, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, true);
    } else { pulseScale.value = 1; }
  }, [mode, scanned]);

  const animatedReticleStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  useFocusEffect(useCallback(() => { fetchWallet(); }, []));

  const fetchWallet = async () => {
    try {
      const response = await apiClient.get('tokens/');
      if (response.data && response.data.tokens !== undefined) setAiTokens(response.data.tokens);
    } catch (e) { console.error(e); }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: currentThemeColors.background }]}>
        <Text style={{ textAlign: 'center', color: currentThemeColors.text }}>Camera permission required.</Text>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: currentThemeColors.primary }]} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleScan = async () => {
    if (!photo || aiTokens <= 0) { if (aiTokens <= 0) setShowUpgradeModal(true); return; }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await apiClient.post('scan-keto/', { image: photo.base64, modifier }, { headers: { 'Authorization': `Token ${token}` } });
      if (response.data.status === 'success') {
        setAiTokens(prev => Math.max(0, prev - 1));
        Toast.show({ type: 'success', text1: 'Added!', text2: response.data.data.food_name });
        setPhoto(null);
      }
    } catch (error) { if (error?.response?.status === 402) setShowUpgradeModal(true); } finally { setLoading(false); }
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await res.json();
      if (json.status === 1) {
        const p = json.product;
        const n = p.nutriments || {};
        const payload = { food_name: p.product_name || 'Barcode Item', calories: Math.round(n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0), protein: n.proteins_serving || 0, carbs: n.carbohydrates_serving || 0, fat: n.fat_serving || 0 };
        const post = await apiClient.post('log-nutrition/', payload);
        if (post.data.status === 'success') Toast.show({ type: 'success', text1: 'Barcode Scanned!', text2: payload.food_name });
      }
    } catch (e) { console.error(e); } finally { setScanned(false); }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: currentThemeColors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.toggleContainer, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, borderWidth: 1 }]}>
        <TouchableOpacity style={[styles.toggleButton, mode === 'vision' && { backgroundColor: currentThemeColors.primary }]} onPress={() => { setMode('vision'); setPhoto(null); }}>
          <Text style={[styles.toggleText, { color: mode === 'vision' ? '#fff' : currentThemeColors.textSecondary }]}>AI Vision</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleButton, mode === 'barcode' && { backgroundColor: currentThemeColors.primary }]} onPress={() => { setMode('barcode'); setPhoto(null); }}>
          <Text style={[styles.toggleText, { color: mode === 'barcode' ? '#fff' : currentThemeColors.textSecondary }]}>Barcode</Text>
        </TouchableOpacity>
      </View>

      {!photo && mode === 'barcode' && (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
          {!scanned && (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Animated.View style={[styles.reticleWrapper, animatedReticleStyle]}>
                <View style={styles.reticleBox}>
                  <View style={[styles.corner, styles.cornerTL, { borderColor: currentThemeColors.primary }]} />
                  <View style={[styles.corner, styles.cornerTR, { borderColor: currentThemeColors.primary }]} />
                  <View style={[styles.corner, styles.cornerBL, { borderColor: currentThemeColors.primary }]} />
                  <View style={[styles.corner, styles.cornerBR, { borderColor: currentThemeColors.primary }]} />
                </View>
                <Text style={[styles.reticleHint, { color: '#FFF' }]}>Align barcode within frame</Text>
              </Animated.View>
            </View>
          )}
          {scanned && <View style={styles.lookingUpOverlay}><ActivityIndicator size="large" color={currentThemeColors.primary} /><Text style={{ color: '#fff' }}>Looking up product…</Text></View>}
        </View>
      )}

      {(mode === 'vision' || photo) && (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {photo ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photo.uri }} style={styles.preview} />
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: currentThemeColors.text }]}>Modifiers:</Text>
                <TextInput style={[styles.input, { backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} placeholder="What did you change?" placeholderTextColor={currentThemeColors.textSecondary} value={modifier} onChangeText={setModifier} />
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: currentThemeColors.surface }]} onPress={() => setPhoto(null)}><Text style={{ color: currentThemeColors.text }}>Retake</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: currentThemeColors.primary }]} onPress={handleScan}><Text style={{ color: '#fff' }}>{loading ? 'Analyzing...' : 'Analyze Meal'}</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              <CameraView style={styles.camera} ref={cameraRef} />
              <View style={styles.cameraOverlay}>
                <TouchableOpacity style={styles.captureButton} onPress={async () => { const data = await cameraRef.current?.takePictureAsync({ quality: 0.5, base64: true }); setPhoto(data); }}>
                  <View style={styles.captureInner} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
      <Modal visible={showUpgradeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentThemeColors.card }]}>
            <Text style={[styles.modalTitle, { color: currentThemeColors.text }]}>Upgrade to Metrix Pro</Text>
            <TouchableOpacity style={[styles.upgradeButton, { backgroundColor: currentThemeColors.primary }]} onPress={() => setShowUpgradeModal(false)}><Text style={{ color: '#fff' }}>Subscribe for $9.99/mo</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowUpgradeModal(false)}><Text style={{ color: currentThemeColors.textSecondary }}>Maybe Later</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 45 },
  toggleContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, borderRadius: 12, overflow: 'hidden' },
  toggleButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  toggleText: { fontWeight: 'bold', textTransform: 'uppercase', fontSize: 12 },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  previewContainer: { flex: 1 },
  preview: { width: '100%', aspectRatio: 3/4 },
  inputContainer: { padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, padding: 18, borderRadius: 16 },
  actionButtons: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, paddingBottom: 30 },
  primaryButton: { flex: 2, padding: 18, borderRadius: 16, alignItems: 'center' },
  secondaryButton: { flex: 1, padding: 18, borderRadius: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  reticleWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  reticleBox: { width: 260, height: 160 },
  reticleHint: { fontSize: 13, fontWeight: '600' },
  corner: { position: 'absolute', width: 28, height: 28, borderWidth: 4, borderRadius: 4 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  lookingUpOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', gap: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 30, padding: 30, alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  upgradeButton: { width: '100%', paddingVertical: 20, borderRadius: 18, alignItems: 'center', marginBottom: 15 }
});
