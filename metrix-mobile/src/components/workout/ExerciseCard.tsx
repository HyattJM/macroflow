import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompletedSet {
  id: string;
  weight: number;
  reps: number;
  is_pr?: boolean;
}

export interface Exercise {
  name: string;
  category?: string;
}

export interface ExerciseCardProps {
  exercise: Exercise;
  /** Optional pre-existing history to display beneath the inputs. */
  history?: CompletedSet[];
  /** Called when the user presses SAVE with the full list of logged sets. */
  onSave?: (sets: CompletedSet[]) => void;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

interface StepperProps {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onChangeText: (v: string) => void;
  step?: number;
}

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  onChangeText,
}: StepperProps) {
  const { currentThemeColors } = useAppTheme();

  return (
    <View style={styles.stepperWrapper}>
      <Text style={[styles.stepperLabel, { color: currentThemeColors.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          styles.stepperRow,
          { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            onDecrement();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.stepperBtn}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Ionicons name="remove" size={18} color={currentThemeColors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={[styles.stepperInput, { color: currentThemeColors.text }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          keyboardAppearance="dark"
          selectTextOnFocus
          accessibilityLabel={`${label} value`}
        />

        <TouchableOpacity
          onPress={() => {
            onIncrement();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.stepperBtn}
          accessibilityLabel={`Increase ${label}`}
        >
          <Ionicons name="add" size={18} color={currentThemeColors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Set Row (history item) ────────────────────────────────────────────────────

function SetRow({ item, index, isPr }: { item: CompletedSet; index: number; isPr: boolean }) {
  const { currentThemeColors } = useAppTheme();

  return (
    <View
      style={[
        styles.setRow,
        { backgroundColor: currentThemeColors.surface, borderColor: currentThemeColors.border },
      ]}
    >
      {/* Set number badge */}
      <View style={[styles.setBadge, { backgroundColor: currentThemeColors.primary + '22' }]}>
        <Text style={[styles.setBadgeText, { color: currentThemeColors.primary }]}>
          {index + 1}
        </Text>
      </View>

      {/* Weight */}
      <View style={styles.setCell}>
        <Text style={[styles.setCellValue, { color: currentThemeColors.text }]}>
          {item.weight}
        </Text>
        <Text style={[styles.setCellUnit, { color: currentThemeColors.textSecondary }]}>lbs</Text>
      </View>

      {/* Divider */}
      <Text style={[styles.setDivider, { color: currentThemeColors.border }]}>×</Text>

      {/* Reps */}
      <View style={styles.setCell}>
        <Text style={[styles.setCellValue, { color: currentThemeColors.text }]}>
          {item.reps}
        </Text>
        <Text style={[styles.setCellUnit, { color: currentThemeColors.textSecondary }]}>reps</Text>
      </View>

      {/* PR crown — driven by dynamic maxRepsPerWeight, not a stored flag */}
      {isPr && (
        <View style={styles.prBadge}>
          <Ionicons name="trophy" size={14} color="#FFD700" />
          <Text style={styles.prText}>PR</Text>
        </View>
      )}
    </View>
  );
}

// ─── ExerciseCard ──────────────────────────────────────────────────────────────

export function ExerciseCard({ exercise, history = [], onSave }: ExerciseCardProps) {
  const { currentThemeColors } = useAppTheme();

  // Input state
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  // Current-session set stack (shown below the inputs)
  const [sets, setSets] = useState<CompletedSet[]>(history);
  const [isSaving, setIsSaving] = useState(false);

  // ── Dynamic PR detection ─────────────────────────────────────────────────────
  // Walk the set stack in order. The FIRST set that strictly beats the running
  // max for its weight class earns the PR badge. Ties never qualify — only
  // the set that originally set the record is awarded the trophy.
 
  const prSetIndices = useMemo(() => {
  // Step 1: Find the absolute best set index for each weight class
  const bestIndices: Record<number, number> = {}; 
  const maxReps: Record<number, number> = {}; 

  sets.forEach((set, index) => {
    // If we haven't seen this weight yet, or if these reps strictly beat the old max
    if (maxReps[set.weight] === undefined || set.reps > maxReps[set.weight]) {
      maxReps[set.weight] = set.reps;
      bestIndices[set.weight] = index; // Overwrites the old index, stealing the crown
    }
  });

  // Step 2: Return a Set of ONLY the final, absolute winners
  return new Set(Object.values(bestIndices));
}, [sets]);

  // ── Stepper helpers ──────────────────────────────────────────────────────────
  const adjustWeight = useCallback(
    (delta: number) =>
      setWeight(prev => String(Math.max(0, Math.round(((parseFloat(prev) || 0) + delta) * 10) / 10))),
    []
  );

  const adjustReps = useCallback(
    (delta: number) =>
      setReps(prev => String(Math.max(0, (parseInt(prev, 10) || 0) + delta))),
    []
  );

  // ── Add set to local stack ───────────────────────────────────────────────────
  const handleAddSet = useCallback(() => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r) return;

    // No is_pr flag stored — PR status is derived dynamically from maxRepsPerWeight.
    const newSet: CompletedSet = {
      id: `${Date.now()}-${Math.random()}`,
      weight: w,
      reps: r,
    };

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSets(prev => [...prev, newSet]);
    // Both weight and reps are intentionally retained for rapid consecutive entry.
  }, [weight, reps]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (sets.length === 0) return;
    setIsSaving(true);
    await onSave?.(sets);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSaving(false);
  }, [sets, onSave]);

  // ── Render history item ───────────────────────────────────────────────────────
  const renderSetItem = useCallback(
    ({ item, index }: ListRenderItemInfo<CompletedSet>) => (
      <SetRow
        item={item}
        index={index}
        isPr={prSetIndices.has(index)}
      />
    ),
    [prSetIndices]
  );

  const isAddDisabled = !weight || !reps;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: currentThemeColors.card,
          borderColor: currentThemeColors.border,
          shadowColor: currentThemeColors.primary,
        },
      ]}
    >
      {/* ── Header ── */}
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="barbell-outline" size={20} color={currentThemeColors.primary} />
          <Text style={[styles.cardTitle, { color: currentThemeColors.text }]} numberOfLines={1}>
            {exercise.name}
          </Text>
        </View>
        {exercise.category && (
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: currentThemeColors.primary + '18' },
            ]}
          >
            <Text style={[styles.categoryText, { color: currentThemeColors.primary }]}>
              {exercise.category.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* ── Steppers ── */}
      <View style={styles.steppersRow}>
        <Stepper
          label="WEIGHT (LBS)"
          value={weight}
          onDecrement={() => adjustWeight(-5)}
          onIncrement={() => adjustWeight(5)}
          onChangeText={setWeight}
        />
        <View style={styles.stepperDivider} />
        <Stepper
          label="REPS"
          value={reps}
          onDecrement={() => adjustReps(-1)}
          onIncrement={() => adjustReps(1)}
          onChangeText={setReps}
        />
      </View>

      {/* ── Add Set Button ── */}
      <TouchableOpacity
        style={[
          styles.addSetBtn,
          {
            backgroundColor: isAddDisabled
              ? currentThemeColors.surface
              : currentThemeColors.primary + '22',
            borderColor: isAddDisabled
              ? currentThemeColors.border
              : currentThemeColors.primary,
          },
        ]}
        onPress={handleAddSet}
        disabled={isAddDisabled}
        accessibilityLabel="Add set"
      >
        <Ionicons
          name="add-circle-outline"
          size={18}
          color={isAddDisabled ? currentThemeColors.textSecondary : currentThemeColors.primary}
        />
        <Text
          style={[
            styles.addSetBtnText,
            {
              color: isAddDisabled
                ? currentThemeColors.textSecondary
                : currentThemeColors.primary,
            },
          ]}
        >
          ADD SET
        </Text>
      </TouchableOpacity>

      {/* ── History Stack ── */}
      {sets.length > 0 && (
        <View style={styles.historySection}>
          {/* Column headers */}
          <View style={styles.historyHeader}>
            <Text style={[styles.historyHeaderText, { color: currentThemeColors.textSecondary }]}>
              SET
            </Text>
            <Text style={[styles.historyHeaderText, { flex: 1, color: currentThemeColors.textSecondary }]}>
              WEIGHT
            </Text>
            <Text style={[styles.historyHeaderText, { flex: 1, color: currentThemeColors.textSecondary }]}>
              REPS
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <FlatList<CompletedSet>
            data={sets}
            keyExtractor={item => item.id}
            renderItem={renderSetItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: currentThemeColors.border }]} />
            )}
          />

          {/* Volume summary */}
          <View
            style={[
              styles.volumeRow,
              { backgroundColor: currentThemeColors.primary + '10', borderColor: currentThemeColors.border },
            ]}
          >
            <Ionicons name="flash-outline" size={14} color={currentThemeColors.primary} />
            <Text style={[styles.volumeLabel, { color: currentThemeColors.primary }]}>
              TOTAL VOLUME
            </Text>
            <Text style={[styles.volumeValue, { color: currentThemeColors.text }]}>
              {sets.reduce((sum, s) => sum + s.weight * s.reps, 0).toLocaleString()} lbs
            </Text>
          </View>
        </View>
      )}

      {/* ── SAVE Button ── */}
      <TouchableOpacity
        style={[
          styles.saveBtn,
          {
            backgroundColor:
              sets.length === 0 || isSaving
                ? currentThemeColors.surface
                : currentThemeColors.success,
            opacity: sets.length === 0 ? 0.5 : 1,
          },
        ]}
        onPress={handleSave}
        disabled={sets.length === 0 || isSaving}
        accessibilityLabel="Save exercise"
      >
        {isSaving ? (
          <Text style={styles.saveBtnText}>SAVING…</Text>
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>SAVE</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Card
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },

  // Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Steppers
  steppersRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepperWrapper: {
    flex: 1,
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 48,
  },
  stepperBtn: {
    width: 42,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepperDivider: {
    width: 12,
  },

  // Add Set
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  addSetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // History
  historySection: {
    marginBottom: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  historyHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    width: 42,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  setBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  setBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  setCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  setCellValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  setCellUnit: {
    fontSize: 11,
    fontWeight: '500',
  },
  setDivider: {
    fontSize: 16,
    fontWeight: '300',
    marginHorizontal: 6,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFD70022',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  prText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  separator: {
    height: 6,
    backgroundColor: 'transparent',
  },

  // Volume summary
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  volumeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    flex: 1,
  },
  volumeValue: {
    fontSize: 14,
    fontWeight: '800',
  },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
});
