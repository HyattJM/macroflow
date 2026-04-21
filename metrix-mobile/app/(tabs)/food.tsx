import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, DeviceEventEmitter } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function FoodLogScreen() {
  const { currentThemeColors, layout, typography } = useAppTheme();
  const isDark = currentThemeColors.isDark;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  
  // Temporary Form State
  const [editFoodName, setEditFoodName] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchLogs();
    }, [])
  );

  const fetchLogs = async () => {
    try {
      const response = await apiClient.get('/nutrition-logs/');
      if (response.data.status === 'success') {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching nutrition logs:', error);
    } finally {
      setLoading(false);
    }
  };

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
        setLogs(prev => prev.map(log => log.id === editingLog.id ? res.data.data : log));
        setEditModalVisible(false);
        setEditingLog(null);
        DeviceEventEmitter.emit('refreshDashboard');
      }
    } catch (err) {
      console.error('Failed to update', err);
      Alert.alert('Error', 'Failed to update log');
    }
  };

  const renderItem = ({ item }) => {
    const date = new Date(item.created_at);
    const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
      <Text style={[styles.title, { color: currentThemeColors.text }]}>Food Log</Text>
      {loading ? (
        <ActivityIndicator size="large" color={currentThemeColors.primary} />
      ) : logs.length === 0 ? (
        <Text style={[styles.emptyText, { color: currentThemeColors.textSecondary }]}>Your meals and scanned foods will appear here.</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'black',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
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
