import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, DeviceEventEmitter } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@react-navigation/native';

export default function FoodLogScreen() {
  const { colors, dark } = useTheme();
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
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{flex: 1}}>
             <Text style={[styles.foodName, { color: colors.text }]}>{item.food_name}</Text>
             <Text style={[styles.dateText, { color: dark ? '#aaa' : '#888' }]}>{dateString}</Text>
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
        <View style={[styles.macrosContainer, { backgroundColor: dark ? '#2C2C2E' : '#f9f9f9' }]}>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: colors.text }]}>{item.calories}</Text>
            <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>kcal</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: colors.text }]}>{item.protein}g</Text>
            <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>Protein</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: colors.text }]}>{item.carbs}g</Text>
            <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>Net Carbs</Text>
          </View>
          <View style={styles.macroBox}>
            <Text style={[styles.macroValue, { color: colors.text }]}>{item.fat}g</Text>
            <Text style={[styles.macroLabel, { color: dark ? '#aaa' : '#666' }]}>Fat</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Food Log</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : logs.length === 0 ? (
        <Text style={[styles.emptyText, { color: dark ? '#aaa' : '#666' }]}>Your meals and scanned foods will appear here.</Text>
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
          <View style={[styles.modalContent, { backgroundColor: dark ? '#1C1C1E' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Macros</Text>
            
            <TextInput 
              style={[styles.input, { backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: colors.text, borderColor: colors.border }]} 
              value={editFoodName} 
              onChangeText={setEditFoodName} 
              placeholder="Food Name" 
              placeholderTextColor={dark ? '#666' : '#999'}
              keyboardAppearance={dark ? 'dark' : 'light'}
            />
            <View style={styles.row}>
               <TextInput 
                 style={[styles.input, {flex: 1, marginRight: 5, backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: colors.text, borderColor: colors.border }]} 
                 value={editCalories} 
                 onChangeText={setEditCalories} 
                 placeholder="Calories" 
                 keyboardType="numeric" 
                 placeholderTextColor={dark ? '#666' : '#999'}
                 keyboardAppearance={dark ? 'dark' : 'light'}
               />
               <TextInput 
                 style={[styles.input, {flex: 1, marginLeft: 5, backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: colors.text, borderColor: colors.border }]} 
                 value={editProtein} 
                 onChangeText={setEditProtein} 
                 placeholder="Protein (g)" 
                 keyboardType="numeric" 
                 placeholderTextColor={dark ? '#666' : '#999'}
                 keyboardAppearance={dark ? 'dark' : 'light'}
               />
            </View>
            <View style={styles.row}>
               <TextInput 
                 style={[styles.input, {flex: 1, marginRight: 5, backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: colors.text, borderColor: colors.border }]} 
                 value={editCarbs} 
                 onChangeText={setEditCarbs} 
                 placeholder="Carbs (g)" 
                 keyboardType="numeric" 
                 placeholderTextColor={dark ? '#666' : '#999'}
                 keyboardAppearance={dark ? 'dark' : 'light'}
               />
               <TextInput 
                 style={[styles.input, {flex: 1, marginLeft: 5, backgroundColor: dark ? '#2C2C2E' : '#f9f9f9', color: colors.text, borderColor: colors.border }]} 
                 value={editFat} 
                 onChangeText={setEditFat} 
                 placeholder="Fat (g)" 
                 keyboardType="numeric" 
                 placeholderTextColor={dark ? '#666' : '#999'}
                 keyboardAppearance={dark ? 'dark' : 'light'}
               />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: dark ? '#2C2C2E' : '#eee' }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.cancelTxt, { color: dark ? '#aaa' : '#555' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
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
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginBottom: 20,
    color: '#333'
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 50,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  foodName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
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
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
  macroBox: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  macroLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
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
    backgroundColor: '#eee',
    marginRight: 10,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  cancelTxt: {
    fontWeight: 'bold',
    color: '#555',
  },
  saveTxt: {
    fontWeight: 'bold',
    color: '#fff',
  }
});
