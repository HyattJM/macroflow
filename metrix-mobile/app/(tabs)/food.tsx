import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, DeviceEventEmitter, Platform } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function FoodLogScreen() {
  const { currentThemeColors, layout } = useAppTheme();
  const isDark = currentThemeColors.isDark;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein: 0, fat: 0, net_carbs: 0 });
  const [weeklyTotals, setWeeklyTotals] = useState({ calories: 0, protein: 0, fat: 0, net_carbs: 0 });
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loggingId, setLoggingId] = useState<number | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');

  const formatDate = (d: Date) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 10);
  };

  const getWeekRange = (d: Date) => {
    const start = new Date(d);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatDate(start), end: formatDate(end) };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const formattedDate = formatDate(selectedDate);
      const weekRange = getWeekRange(selectedDate);
      const [dailyRes, weeklyRes] = await Promise.all([
        apiClient.get(`nutrition-logs/?date=${formattedDate}`),
        apiClient.get(`nutrition-logs/?start_date=${weekRange.start}&end_date=${weekRange.end}`)
      ]);
      if (dailyRes.data.status === 'success') {
        setLogs(dailyRes.data.data);
        setDailyTotals(dailyRes.data.totals || { calories: 0, protein: 0, fat: 0, net_carbs: 0 });
      }
      if (weeklyRes.data.status === 'success') {
        setWeeklyTotals(weeklyRes.data.totals || { calories: 0, protein: 0, fat: 0, net_carbs: 0 });
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [selectedDate]));

  const handleDelete = async (id) => {
    Alert.alert("Delete Log", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            const res = await apiClient.delete(`nutrition-logs/${id}/delete/`);
            if (res.data.status === 'success') {
              setLogs(prev => prev.filter(log => log.id !== id));
              DeviceEventEmitter.emit('refreshDashboard');
              fetchData();
            }
          } catch (e) { console.error(e); }
        }
      }
    ]);
  };

  const openEditModal = (item) => {
    setEditingLog(item);
    setEditFoodName(item.food_name);
    setEditCalories(item.calories.toString());
    setEditProtein(item.protein.toString());
    setEditCarbs(item.carbs.toString());
    setEditFat(item.fat.toString());
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editingLog) return;
    try {
      const payload = {
        food_name: editFoodName,
        calories: parseInt(editCalories) || 0,
        protein: parseFloat(editProtein) || 0,
        carbs: parseFloat(editCarbs) || 0,
        fat: parseFloat(editFat) || 0
      };
      const res = await apiClient.put(`nutrition-logs/${editingLog.id}/update/`, payload);
      if (res.data.status === 'success') {
        setEditModalVisible(false);
        DeviceEventEmitter.emit('refreshDashboard');
        fetchData();
        Toast.show({ type: 'success', text1: 'Updated' });
      }
    } catch (err) { console.error(err); }
  };

  const searchUSDA = async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${process.env.EXPO_PUBLIC_USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=20`;
      const res = await fetch(url);
      const json = await res.json();
      const items = (json.foods || []).map((food: any) => ({
        fdcId: food.fdcId,
        description: food.description,
        brandOwner: food.brandOwner || '',
        calories: (food.foodNutrients || []).find(n => n.nutrientName?.toLowerCase().includes('energy'))?.value || 0,
        protein: (food.foodNutrients || []).find(n => n.nutrientName?.toLowerCase().includes('protein'))?.value || 0,
        fat: (food.foodNutrients || []).find(n => n.nutrientName?.toLowerCase().includes('lipid'))?.value || 0,
        netCarbs: (food.foodNutrients || []).find(n => n.nutrientName?.toLowerCase().includes('carbohydrate'))?.value || 0,
      }));
      setSearchResults(items);
    } catch (e) { console.error(e); } finally { setSearchLoading(false); }
  };

  const logFoodItem = async (item: any) => {
    setLoggingId(item.fdcId);
    try {
      const payload = { food_name: item.description, calories: Math.round(item.calories), protein: item.protein, carbs: item.netCarbs, fat: item.fat };
      const res = await apiClient.post('log-nutrition/', payload);
      if (res.data.status === 'success') {
        Toast.show({ type: 'success', text1: 'Added!' });
        setSearchModalVisible(false);
        DeviceEventEmitter.emit('refreshDashboard');
        fetchData();
      }
    } catch (e) { console.error(e); } finally { setLoggingId(null); }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: currentThemeColors.text }]}>Food Log</Text>
        <TouchableOpacity 
          style={[styles.dateButton, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]} 
          onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={20} color={currentThemeColors.primary} />
          <Text style={[styles.dateButtonText, { color: currentThemeColors.text }]}>{selectedDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>
        <Text style={[styles.summaryTitle, { color: currentThemeColors.textSecondary }]}>DAILY TOTALS</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.text }]}>{dailyTotals.calories}</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>kcal</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.warning }]}>{dailyTotals.protein}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Pro</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.info }]}>{dailyTotals.net_carbs}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Net C</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.error }]}>{dailyTotals.fat}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Fat</Text></View>
        </View>
      </View>
      <TouchableOpacity style={[styles.addBtnFull, { backgroundColor: currentThemeColors.primary }]} onPress={() => setSearchModalVisible(true)}>
        <Ionicons name="add" size={24} color="#FFF" />
        <Text style={styles.addBtnText}>ADD FOOD</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: currentThemeColors.background }]}>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.logCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>
            <View style={styles.logHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logName, { color: currentThemeColors.text }]}>{item.food_name}</Text>
                <Text style={[styles.logTime, { color: currentThemeColors.textSecondary }]}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconBtn}><Ionicons name="pencil" size={18} color={currentThemeColors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}><Ionicons name="trash" size={18} color={currentThemeColors.error} /></TouchableOpacity>
            </View>
            <View style={[styles.macroRow, { backgroundColor: currentThemeColors.background }]}>
              <Text style={[styles.macroItem, { color: currentThemeColors.text }]}>{item.calories} kcal</Text>
              <Text style={[styles.macroItem, { color: currentThemeColors.warning }]}>{item.protein}g P</Text>
              <Text style={[styles.macroItem, { color: currentThemeColors.info }]}>{item.carbs}g C</Text>
              <Text style={[styles.macroItem, { color: currentThemeColors.error }]}>{item.fat}g F</Text>
            </View>
          </View>
        )}
      />
      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowPicker(false)}>
          <View style={[styles.pickerContainer, { backgroundColor: currentThemeColors.card }]}>
            <Calendar
              onDayPress={(d) => { setSelectedDate(new Date(d.year, d.month - 1, d.day)); setShowPicker(false); }}
              theme={{ calendarBackground: currentThemeColors.card, textDayColor: currentThemeColors.text, monthTextColor: currentThemeColors.text, todayTextColor: currentThemeColors.primary, dayTextColor: currentThemeColors.text, arrowColor: currentThemeColors.primary }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isSearchModalVisible} animationType="slide" transparent>
        <View style={[styles.searchModal, { backgroundColor: currentThemeColors.background }]}>
          <View style={styles.searchHeader}>
            <TextInput 
              autoFocus style={[styles.searchInput, { backgroundColor: currentThemeColors.card, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
              placeholder="Search USDA..." placeholderTextColor={currentThemeColors.textSecondary} 
              onChangeText={searchUSDA}
            />
            <TouchableOpacity onPress={() => setSearchModalVisible(false)}><Text style={{ color: currentThemeColors.primary, fontWeight: 'bold' }}>Close</Text></TouchableOpacity>
          </View>
          {searchLoading ? <ActivityIndicator size="large" color={currentThemeColors.primary} style={{ marginTop: 20 }} /> : (
            <FlatList
              data={searchResults}
              keyExtractor={i => i.fdcId.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.resCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]} onPress={() => logFoodItem(item)}>
                  <Text style={[styles.resName, { color: currentThemeColors.text }]}>{item.description}</Text>
                  <Text style={[styles.resMacros, { color: currentThemeColors.textSecondary }]}>{Math.round(item.calories)} kcal | {item.protein}g P | {item.netCarbs}g C</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { paddingTop: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  dateButton: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1 },
  dateButtonText: { marginLeft: 8, fontWeight: '600' },
  summaryCard: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  summaryTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryBox: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { fontSize: 12, marginTop: 4 },
  addBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginBottom: 20 },
  addBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
  logCard: { marginHorizontal: 20, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  logHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logName: { fontSize: 18, fontWeight: 'bold' },
  logTime: { fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 8, marginLeft: 8 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 12 },
  macroItem: { fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  pickerContainer: { padding: 20, borderRadius: 20, width: '90%' },
  searchModal: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  searchInput: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, marginRight: 15 },
  resCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  resName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  resMacros: { fontSize: 12 }
});
