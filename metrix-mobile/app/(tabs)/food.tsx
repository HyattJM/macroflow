import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, DeviceEventEmitter, Platform } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../src/context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

export default function FoodLogScreen() {
  const { currentThemeColors, layout, typography } = useAppTheme();
  const isDark = currentThemeColors.isDark;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [dailyTotals, setDailyTotals] = useState({ calories: 0, protein: 0, fat: 0, net_carbs: 0 });
  const [weeklyTotals, setWeeklyTotals] = useState({ calories: 0, protein: 0, fat: 0, net_carbs: 0 });

  // Edit Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  
  // Temporary Form State
  const [editFoodName, setEditFoodName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');

  const formatDate = (d: Date) => {
    // Return YYYY-MM-DD
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  };

  const getWeekRange = (d: Date) => {
    const start = new Date(d);
    start.setDate(start.getDate() - start.getDay()); // Sunday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Saturday
    return { start: formatDate(start), end: formatDate(end) };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const formattedDate = formatDate(selectedDate);
      const weekRange = getWeekRange(selectedDate);

      const [dailyRes, weeklyRes] = await Promise.all([
        apiClient.get(`/nutrition-logs/?date=${formattedDate}`),
        apiClient.get(`/nutrition-logs/?start_date=${weekRange.start}&end_date=${weekRange.end}`)
      ]);

      if (dailyRes.data.status === 'success') {
        setLogs(dailyRes.data.data);
        setDailyTotals(dailyRes.data.totals || { calories: 0, protein: 0, fat: 0, net_carbs: 0 });
      }
      if (weeklyRes.data.status === 'success') {
        setWeeklyTotals(weeklyRes.data.totals || { calories: 0, protein: 0, fat: 0, net_carbs: 0 });
      }
    } catch (error) {
      console.error('Error fetching nutrition logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [selectedDate])
  );

  const handleDelete = async (id) => {
    Alert.alert(
      "Delete Log",
      "Are you sure you want to delete this food log?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await apiClient.delete(`/nutrition-logs/${id}/delete/`);
              if (res.data.status === 'success') {
                setLogs(prev => prev.filter(log => log.id !== id));
                DeviceEventEmitter.emit('refreshDashboard');
                fetchData(); // Refresh totals
              }
            } catch (error) {
              console.error('Failed to delete', error);
            }
          }
        }
      ]
    );
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
      const res = await apiClient.put(`/nutrition-logs/${editingLog.id}/update/`, payload);
      if (res.data.status === 'success') {
        setEditModalVisible(false);
        setEditingLog(null);
        DeviceEventEmitter.emit('refreshDashboard');
        fetchData(); // Refresh totals instead of just replacing the row
      }
    } catch (err) {
      console.error('Failed to update', err);
      Alert.alert('Error', 'Failed to update log');
    }
  };

  const onDateChange = (event, selected) => {
    setShowPicker(Platform.OS === 'ios');
    if (selected) {
      setSelectedDate(selected);
      if (Platform.OS === 'android') setShowPicker(false);
    } else {
        setShowPicker(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: currentThemeColors.text }]}>Food Log</Text>
        <TouchableOpacity 
          style={[styles.dateButton, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]} 
          onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={20} color={currentThemeColors.text} />
          <Text style={[styles.dateButtonText, { color: currentThemeColors.text }]}>
            {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <Text style={[styles.summaryTitle, { color: currentThemeColors.text }]}>Daily Totals</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.text }]}>{dailyTotals.calories}</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>kcal</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.warning }]}>{dailyTotals.protein}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Protein</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.info }]}>{dailyTotals.net_carbs}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Net Carbs</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.error }]}>{dailyTotals.fat}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Fat</Text></View>
        </View>

        <View style={[styles.divider, { backgroundColor: currentThemeColors.border }]} />

        <Text style={[styles.summaryTitle, { color: currentThemeColors.text }]}>Weekly Totals</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.text }]}>{weeklyTotals.calories}</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>kcal</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.warning }]}>{weeklyTotals.protein}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Protein</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.info }]}>{weeklyTotals.net_carbs}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Net Carbs</Text></View>
          <View style={styles.summaryBox}><Text style={[styles.summaryValue, { color: currentThemeColors.error }]}>{weeklyTotals.fat}g</Text><Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>Fat</Text></View>
        </View>
      </View>
      
      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
    </View>
  );

  const renderItem = ({ item }) => {
    const date = new Date(item.created_at);
    // Adjust time formatting since React Native Hermes can sometimes struggle with default locales
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const dateString = `${date.toLocaleDateString()} ${hours}:${minutes}`;

    return (
      <View style={[styles.card, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, ...layout.shadows.md }]}>
        <View style={styles.cardHeader}>
          <View style={{flex: 1}}>
             <Text style={[styles.foodName, { color: currentThemeColors.text }]}>{item.food_name}</Text>
             <Text style={[styles.dateText, { color: currentThemeColors.textSecondary }]}>{dateString}</Text>
          </View>
          <View style={styles.actionContainer}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconButton}>
              <Text>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconButton}>
              <Text>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.macrosContainer, { backgroundColor: currentThemeColors.surface }]}>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: currentThemeColors.text }]}>{item.calories}</Text>
            <Text style={[styles.macroLabel, { color: currentThemeColors.textSecondary }]}>kcal</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: currentThemeColors.warning }]}>{item.protein}g</Text>
             <Text style={[styles.macroLabel, { color: currentThemeColors.textSecondary }]}>Protein</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: currentThemeColors.info }]}>{item.carbs}g</Text>
            <Text style={[styles.macroLabel, { color: currentThemeColors.textSecondary }]}>Net Carbs</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: currentThemeColors.error }]}>{item.fat}g</Text>
            <Text style={[styles.macroLabel, { color: currentThemeColors.textSecondary }]}>Fat</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentThemeColors.background }]}>
      {loading && logs.length === 0 ? (
        <View style={{flex: 1, justifyContent: 'center'}}>
            <ActivityIndicator size="large" color={currentThemeColors.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: currentThemeColors.textSecondary }]}>No meals tracked for this date.</Text>}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border, borderWidth: 1 }]}>
            <Text style={[styles.modalTitle, { color: currentThemeColors.text }]}>Edit Macros</Text>
            
            <TextInput 
              style={[styles.input, { backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
              value={editFoodName} 
              onChangeText={setEditFoodName} 
              placeholder="Food Name" 
              placeholderTextColor={currentThemeColors.textSecondary}
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
            <View style={styles.row}>
               <TextInput 
                 style={[styles.input, {flex: 1, marginRight: 5, backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
                 value={editCalories} 
                 onChangeText={setEditCalories} 
                 placeholder="Calories" 
                 keyboardType="numeric" 
                 placeholderTextColor={currentThemeColors.textSecondary}
                 keyboardAppearance={isDark ? 'dark' : 'light'}
               />
               <TextInput 
                 style={[styles.input, {flex: 1, marginLeft: 5, backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
                 value={editProtein} 
                 onChangeText={setEditProtein} 
                 placeholder="Protein (g)" 
                 keyboardType="numeric" 
                 placeholderTextColor={currentThemeColors.textSecondary}
                 keyboardAppearance={isDark ? 'dark' : 'light'}
               />
            </View>
            <View style={styles.row}>
               <TextInput 
                 style={[styles.input, {flex: 1, marginRight: 5, backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
                 value={editCarbs} 
                 onChangeText={setEditCarbs} 
                 placeholder="Carbs (g)" 
                 keyboardType="numeric" 
                 placeholderTextColor={currentThemeColors.textSecondary}
                 keyboardAppearance={isDark ? 'dark' : 'light'}
               />
               <TextInput 
                 style={[styles.input, {flex: 1, marginLeft: 5, backgroundColor: currentThemeColors.surface, color: currentThemeColors.text, borderColor: currentThemeColors.border }]} 
                 value={editFat} 
                 onChangeText={setEditFat} 
                 placeholder="Fat (g)" 
                 keyboardType="numeric" 
                 placeholderTextColor={currentThemeColors.textSecondary}
                 keyboardAppearance={isDark ? 'dark' : 'light'}
               />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: currentThemeColors.surface }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.cancelTxt, { color: currentThemeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: currentThemeColors.primary }]} onPress={saveEdit}>
                <Text style={styles.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 50,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'black',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  dateButtonText: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'black',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryBox: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'black',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  listContainer: {
    paddingBottom: 40,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
  },
  card: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    marginHorizontal: 20,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  foodName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 10,
  },
  macroBox: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  macroLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelTxt: {
    fontWeight: 'bold',
  },
  saveTxt: {
    fontWeight: 'bold',
    color: '#fff',
  }
});
