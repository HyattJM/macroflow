import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { EXERCISE_DATABASE } from '../../../app/(tabs)/workout';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkoutLog {
  id: number | string;
  exercise_name: string;
  weight: number;
  reps: number;
  sets?: number;
  created_at: string; // ISO string, e.g. '2026-04-22T12:00:00Z'
  category?: string;
}

interface WorkoutCalendarHistoryProps {
  /** Flat array of individual set objects from /workouts/ endpoint. */
  workouts: WorkoutLog[];
}

// ─── WorkoutCalendarHistory ────────────────────────────────────────────────────

export function WorkoutCalendarHistory({ workouts }: WorkoutCalendarHistoryProps) {
  const { currentThemeColors } = useAppTheme();

  // Default selectedDate to today in strict YYYY-MM-DD format
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // ── Stable lookup tables from EXERCISE_DATABASE ──────────────────────────────

  // categoryColorMap: 'Chest' → '#F44336'
  const categoryColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    EXERCISE_DATABASE.forEach(cat => { map[cat.category] = cat.color; });
    return map;
  }, []);

  // exerciseCategoryMap: 'Flat Barbell Bench Press' → 'Chest'
  const exerciseCategoryMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    EXERCISE_DATABASE.forEach(cat => {
      cat.exercises.forEach(ex => { map[ex] = cat.category; });
    });
    return map;
  }, []);

  // ── markedDates: multi-dot, one unique color per muscle group per day ─────────
  const markedDates = useMemo(() => {
    // Accumulate unique category colors per date using .slice(0,10) to avoid
    // timezone-induced day shifts from new Date().toISOString()
    const dateColorSets: Record<string, Set<string>> = {};
    workouts.forEach(w => {
      const dateKey = (w.created_at as string).slice(0, 10);
      if (!dateColorSets[dateKey]) dateColorSets[dateKey] = new Set();
      const category = exerciseCategoryMap[w.exercise_name] || '';
      const color = categoryColorMap[category] || currentThemeColors.primary;
      dateColorSets[dateKey].add(color);
    });

    const marks: Record<string, any> = {};
    Object.entries(dateColorSets).forEach(([dateKey, colorSet]) => {
      const dots = Array.from(colorSet).map((color, i) => ({ key: `dot-${i}`, color }));
      marks[dateKey] = { dots };
    });

    // Overlay selected day — preserve its dots
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: currentThemeColors.primary,
      selectedTextColor: '#fff',
    };

    return marks;
  }, [workouts, selectedDate, currentThemeColors.primary, categoryColorMap, exerciseCategoryMap]);

  // ── Filter to selected day (strict YYYY-MM-DD slice) ─────────────────────────
  const workoutsForSelectedDate = useMemo(() => {
    return workouts.filter(w => (w.created_at as string).slice(0, 10) === selectedDate);
  }, [workouts, selectedDate]);

  // ── Group by exercise_name for FitNotes set-list rendering ───────────────────
  const workoutsByExercise = useMemo(() => {
    const grouped: Record<string, WorkoutLog[]> = {};
    workoutsForSelectedDate.forEach(w => {
      if (!grouped[w.exercise_name]) grouped[w.exercise_name] = [];
      grouped[w.exercise_name].push(w);
    });
    return grouped;
  }, [workoutsForSelectedDate]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Multi-dot Calendar ── */}
      <View
        style={[
          styles.calendarWrapper,
          { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border },
        ]}
      >
        <Calendar
          current={selectedDate}
          onDayPress={day => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          markingType={'multi-dot'}
          theme={{
            calendarBackground: currentThemeColors.card,
            backgroundColor: currentThemeColors.card,
            dayTextColor: currentThemeColors.text,
            todayTextColor: currentThemeColors.primary,
            selectedDayTextColor: '#fff',
            selectedDayBackgroundColor: currentThemeColors.primary,
            monthTextColor: currentThemeColors.text,
            textMonthFontWeight: '800',
            textMonthFontSize: 16,
            arrowColor: currentThemeColors.primary,
            dotColor: currentThemeColors.primary,
            textDayFontWeight: '600',
            textDayHeaderFontWeight: '700',
            textDayHeaderFontSize: 11,
            textSectionTitleColor: currentThemeColors.textSecondary,
            textDisabledColor: currentThemeColors.textSecondary + '55',
          }}
        />
      </View>

      {/* ── FitNotes Granular Set List ── */}
      {workoutsForSelectedDate.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <Ionicons name="calendar-outline" size={40} color={currentThemeColors.textSecondary} />
          <Text style={[styles.emptyText, { color: currentThemeColors.textSecondary }]}>
            Workout Log Empty
          </Text>
        </View>
      ) : (
        Object.entries(workoutsByExercise).map(([exerciseName, logs]) => {
          const category = exerciseCategoryMap[exerciseName] || '';
          const catColor = categoryColorMap[category] || currentThemeColors.primary;

          return (
            <View
              key={exerciseName}
              style={[
                styles.exerciseCard,
                { backgroundColor: currentThemeColors.card, borderColor: currentThemeColors.border },
              ]}
            >
              {/* Exercise header */}
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseHeaderLeft}>
                  <View style={[styles.catDot, { backgroundColor: catColor }]} />
                  <Text style={[styles.exerciseName, { color: currentThemeColors.text }]}>
                    {exerciseName}
                  </Text>
                </View>
                {category ? (
                  <Text style={[styles.categoryLabel, { color: catColor }]}>
                    {category.toUpperCase()}
                  </Text>
                ) : null}
              </View>

              {/* Individual set rows */}
              {logs.map((log, idx) => (
                <View
                  key={log.id ?? idx}
                  style={[
                    styles.setRow,
                    { borderTopColor: currentThemeColors.border },
                    idx === 0 && { borderTopWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <Text style={[styles.setNum, { color: currentThemeColors.primary }]}>
                    Set {idx + 1}
                  </Text>
                  <View style={styles.setStat}>
                    <Text style={[styles.setStatValue, { color: currentThemeColors.text }]}>
                      {log.weight}
                    </Text>
                    <Text style={[styles.setStatLabel, { color: currentThemeColors.textSecondary }]}>
                      lbs
                    </Text>
                  </View>
                  <Text style={{ color: currentThemeColors.border, fontSize: 16 }}>·</Text>
                  <View style={styles.setStat}>
                    <Text style={[styles.setStatValue, { color: currentThemeColors.text }]}>
                      {log.reps}
                    </Text>
                    <Text style={[styles.setStatLabel, { color: currentThemeColors.textSecondary }]}>
                      reps
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: {
    paddingTop: 14,
    paddingBottom: 30,
  },

  // Calendar
  calendarWrapper: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },

  // Empty state
  emptyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Exercise card
  exerciseCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Set rows
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 0,
  },
  setNum: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    width: 46,
  },
  setStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  setStatValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  setStatLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
