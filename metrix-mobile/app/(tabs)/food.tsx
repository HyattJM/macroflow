import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, DeviceEventEmitter, Platform } from 'react-native';
import apiClient from '../../src/api/apiClient';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../src/context/ThemeContext';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

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

  // USDA Food Search State
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loggingId, setLoggingId] = useState<number | null>(null); // tracks which item is being logged
  
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
        Toast.show({ type: 'success', text1: 'Success', text2: 'Food log updated successfully!' });
      }
    } catch (err) {
      console.error('Failed to update', err);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update log' });
    }
  };

  const onDayPress = (day) => {
    const [year, month, date] = day.dateString.split('-');
    const newDate = new Date(year, month - 1, date);
    setSelectedDate(newDate);
    setShowPicker(false);
  };

  // ── USDA FoodData Central search ────────────────────────────────────────────
  const USDA_API_KEY = 'DEMO_KEY'; // swap for a real key if rate-limited

  const getNutrient = (nutrients: any[], name: string): number => {
    const hit = nutrients.find(n =>
      typeof n.nutrientName === 'string' &&
      n.nutrientName.toLowerCase().includes(name.toLowerCase())
    );
    return hit ? Math.round((hit.value || 0) * 10) / 10 : 0;
  };

  const searchUSDA = async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${process.env.EXPO_PUBLIC_USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=20`;
      const res = await fetch(url);
      const json = await res.json();
      console.log("USDA Data:", json);
      const items = (json.foods || []).map((food: any) => {
        const nutrients = food.foodNutrients || [];
        const calories  = getNutrient(nutrients, 'energy');
        const protein   = getNutrient(nutrients, 'protein');
        const fat       = getNutrient(nutrients, 'total lipid');
        const carbs     = getNutrient(nutrients, 'carbohydrate');
        const fiber     = getNutrient(nutrients, 'fiber');
        const netCarbs  = Math.max(0, Math.round((carbs - fiber) * 10) / 10);
        return {
          fdcId: food.fdcId,
          description: food.description,
          brandOwner: food.brandOwner || '',
          calories,
          protein,
          fat,
          netCarbs,
        };
      });
      setSearchResults(items);
    } catch (e) {
      console.error('USDA Search Error:', e);
      Toast.show({ type: 'error', text1: 'Search Error', text2: 'Could not reach USDA database.' });
    } finally {
      setSearchLoading(false);
    }
  };

  const logFoodItem = async (item: any) => {
    setLoggingId(item.fdcId);
    try {
      const payload = {
        food_name: item.description,
        calories: Math.round(item.calories),
        protein: item.protein,
        carbs: item.netCarbs,
        fat: item.fat,
      };
      const res = await apiClient.post('/log-nutrition/', payload);
      if (res.data.status === 'success') {
        Toast.show({ type: 'success', text1: '✅ Added!', text2: item.description });
        setSearchModalVisible(false);
        setSearchQuery('');
        setSearchResults([]);
        DeviceEventEmitter.emit('refreshDashboard');
        fetchData();
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to log item.' });
      }
    } catch (e) {
      console.error('logFoodItem failed', e);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to log item.' });
    } finally {
      setLoggingId(null);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: currentThemeColors.text }]}>Food Log</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.dateButton, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]} 
            onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar-outline" size={20} color={currentThemeColors.text} />
            <Text style={[styles.dateButtonText, { color: currentThemeColors.text }]}>
              {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
        </View>
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
      
      {/* Add Food Full-Width Button */}
      <TouchableOpacity
        style={[styles.addFoodFullBtn, { backgroundColor: currentThemeColors.primary }]}
        onPress={() => {
          setSearchQuery('');
          setSearchResults([]);
          setSearchModalVisible(true);
        }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addFoodFullBtnText}>Add Food</Text>
      </TouchableOpacity>
      
      {/* Custom Themeable Calendar Modal */}
      <Modal visible={showPicker} animationType="fade" transparent={true} onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={() => setShowPicker(false)}>
          <View style={[styles.modalContent, { backgroundColor: currentThemeColors.surface, padding: 0, overflow: 'hidden' }]}>
            <Calendar
              current={formatDate(selectedDate)}
              onDayPress={onDayPress}
              theme={{
                backgroundColor: currentThemeColors.surface,
                calendarBackground: currentThemeColors.surface,
                textSectionTitleColor: currentThemeColors.textSecondary,
                selectedDayBackgroundColor: currentThemeColors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: currentThemeColors.warning || '#FF9800',
                dayTextColor: currentThemeColors.text,
                textDisabledColor: currentThemeColors.border || '#333333',
                dotColor: currentThemeColors.primary,
                selectedDotColor: '#ffffff',
                arrowColor: currentThemeColors.primary,
                monthTextColor: currentThemeColors.text,
                indicatorColor: currentThemeColors.primary,
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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

      {/* ── USDA Food Search Modal ── */}
      <Modal
        visible={isSearchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.searchModalOverlay}>
          <View style={[styles.searchModalSheet, { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border }]}>

            {/* Header row */}
            <View style={styles.searchModalHeader}>
              <Text style={[styles.searchModalTitle, { color: currentThemeColors.text }]}>Add Food</Text>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={currentThemeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={[styles.searchInputRow, { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border }]}>
              <Ionicons name="search-outline" size={18} color={currentThemeColors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: currentThemeColors.text }]}
                placeholder="Search for whole foods..."
                placeholderTextColor={currentThemeColors.textSecondary}
                value={searchQuery}
                onChangeText={(t) => { setSearchQuery(t); searchUSDA(t); }}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => searchUSDA(searchQuery)}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={18} color={currentThemeColors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {searchLoading ? (
              <ActivityIndicator size="large" color={currentThemeColors.primary} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.fdcId.toString()}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 30 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  searchQuery.length > 0 ? (
                    <Text style={[styles.searchEmptyText, { color: currentThemeColors.textSecondary }]}>
                      No results found. Try a different term.
                    </Text>
                  ) : (
                    <Text style={[styles.searchEmptyText, { color: currentThemeColors.textSecondary }]}>
                      Start typing to search the USDA database.
                    </Text>
                  )
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.resultCard,
                      { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => logFoodItem(item)}
                    disabled={loggingId === item.fdcId}
                  >
                    <View style={styles.resultCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultName, { color: currentThemeColors.text }]} numberOfLines={2}>
                          {item.description}
                        </Text>
                        {item.brandOwner ? (
                          <Text style={[styles.resultBrand, { color: currentThemeColors.textSecondary }]} numberOfLines={1}>
                            {item.brandOwner}
                          </Text>
                        ) : null}
                      </View>
                      {loggingId === item.fdcId ? (
                        <ActivityIndicator size="small" color={currentThemeColors.primary} />
                      ) : (
                        <View style={[styles.addBtn, { backgroundColor: currentThemeColors.primary }]}>
                          <Ionicons name="add" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                    {/* Macro pill row */}
                    <View style={styles.resultMacroRow}>
                      <View style={styles.macroPill}>
                        <Text style={[styles.macroPillVal, { color: currentThemeColors.text }]}>{Math.round(item.calories)}</Text>
                        <Text style={[styles.macroPillLbl, { color: currentThemeColors.textSecondary }]}>kcal</Text>
                      </View>
                      <View style={styles.macroPill}>
                        <Text style={[styles.macroPillVal, { color: currentThemeColors.warning }]}>{item.protein}g</Text>
                        <Text style={[styles.macroPillLbl, { color: currentThemeColors.textSecondary }]}>Pro</Text>
                      </View>
                      <View style={styles.macroPill}>
                        <Text style={[styles.macroPillVal, { color: currentThemeColors.info }]}>{item.netCarbs}g</Text>
                        <Text style={[styles.macroPillLbl, { color: currentThemeColors.textSecondary }]}>Net C</Text>
                      </View>
                      <View style={styles.macroPill}>
                        <Text style={[styles.macroPillVal, { color: currentThemeColors.error }]}>{item.fat}g</Text>
                        <Text style={[styles.macroPillLbl, { color: currentThemeColors.textSecondary }]}>Fat</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
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
  },

  // ── + Add Food button ─────────────────────────────────────────────────────
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addFoodFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    gap: 8,
  },
  addFoodFullBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // ── USDA Search Modal ────────────────────────────────────────────────
  searchModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  searchModalSheet: {
    height: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  searchEmptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    fontWeight: '500',
  },

  // Result cards
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  resultCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  resultBrand: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  resultMacroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroPill: {
    alignItems: 'center',
    minWidth: 44,
  },
  macroPillVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  macroPillLbl: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
});
