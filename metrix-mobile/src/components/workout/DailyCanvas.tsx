import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../context/ThemeContext';
import { ExerciseCard, CompletedSet, Exercise } from './ExerciseCard';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single exercise slot on today's canvas. */
export interface ActiveExerciseEntry {
  /** Unique key for this slot (e.g. exercise name + timestamp). */
  id: string;
  exercise: Exercise;
  /** Previously completed sets for this entry, if any. */
  history?: CompletedSet[];
}

export interface DailyCanvasProps {
  /** The list of exercises the user has added to today's session. */
  activeExercises: ActiveExerciseEntry[];
  /** Called when the user taps the FAB — parent wires this to its bottom sheet. */
  onOpenExerciseSelector: () => void;
  /** Called when the user presses SAVE on any card. */
  onSaveExercise?: (id: string, sets: CompletedSet[]) => void;
}

// ─── Floating Action Button ────────────────────────────────────────────────────

interface FABProps {
  onPress: () => void;
}

function FAB({ onPress }: FABProps) {
  const { currentThemeColors } = useAppTheme();

  // Subtle scale press-in animation
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.45);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: shadowOpacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.93, { damping: 15, stiffness: 300 });
    shadowOpacity.value = withTiming(0.15, { duration: 120 });
  }, [scale, shadowOpacity]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 250 });
    shadowOpacity.value = withTiming(0.45, { duration: 180 });
  }, [scale, shadowOpacity]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <Animated.View
      style={[
        styles.fabShadowWrapper,
        animStyle,
        {
          shadowColor: currentThemeColors.primary,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityLabel="Add exercise"
        accessibilityRole="button"
        style={[
          styles.fab,
          {
            backgroundColor: currentThemeColors.primary,
          },
        ]}
      >
        {/* Pill label */}
        <View style={styles.fabInner}>
          <View style={[styles.fabIconCircle, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Ionicons name="add" size={22} color="#fff" />
          </View>
          <Text style={styles.fabLabel}>ADD EXERCISE</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { currentThemeColors } = useAppTheme();

  return (
    <View style={styles.emptyWrapper}>
      {/* Glowing icon */}
      <View
        style={[
          styles.emptyIconRing,
          {
            backgroundColor: currentThemeColors.primary + '12',
            borderColor: currentThemeColors.primary + '30',
          },
        ]}
      >
        <Ionicons name="barbell-outline" size={44} color={currentThemeColors.primary} />
      </View>

      <Text style={[styles.emptyTitle, { color: currentThemeColors.text }]}>
        No exercises yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: currentThemeColors.textSecondary }]}>
        Tap{' '}
        <Text style={{ color: currentThemeColors.primary, fontWeight: '700' }}>
          + ADD EXERCISE
        </Text>{' '}
        below to start your session.
      </Text>
    </View>
  );
}

// ─── Session Summary Bar ───────────────────────────────────────────────────────

interface SummaryBarProps {
  activeExercises: ActiveExerciseEntry[];
}

function SummaryBar({ activeExercises }: SummaryBarProps) {
  const { currentThemeColors } = useAppTheme();
  const count = activeExercises.length;

  if (count === 0) return null;

  return (
    <View
      style={[
        styles.summaryBar,
        {
          backgroundColor: currentThemeColors.card,
          borderColor: currentThemeColors.border,
        },
      ]}
    >
      <View style={styles.summaryItem}>
        <Ionicons name="layers-outline" size={16} color={currentThemeColors.primary} />
        <Text style={[styles.summaryValue, { color: currentThemeColors.text }]}>{count}</Text>
        <Text style={[styles.summaryLabel, { color: currentThemeColors.textSecondary }]}>
          {count === 1 ? 'Exercise' : 'Exercises'}
        </Text>
      </View>

      <View style={[styles.summaryDivider, { backgroundColor: currentThemeColors.border }]} />

      <View style={styles.summaryItem}>
        <Ionicons name="today-outline" size={16} color={currentThemeColors.accent} />
        <Text style={[styles.summaryValue, { color: currentThemeColors.text }]}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
      </View>
    </View>
  );
}

// ─── DailyCanvas ──────────────────────────────────────────────────────────────

export function DailyCanvas({
  activeExercises,
  onOpenExerciseSelector,
  onSaveExercise,
}: DailyCanvasProps) {
  const { currentThemeColors } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: currentThemeColors.background }]}>
      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page title */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: currentThemeColors.text }]}>Today's Session</Text>
          {activeExercises.length > 0 && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: currentThemeColors.primary + '20' },
              ]}
            >
              <Text style={[styles.countBadgeText, { color: currentThemeColors.primary }]}>
                {activeExercises.length}
              </Text>
            </View>
          )}
        </View>

        {/* Summary bar */}
        <SummaryBar activeExercises={activeExercises} />

        {/* Cards or empty state */}
        {activeExercises.length === 0 ? (
          <EmptyState />
        ) : (
          activeExercises.map(entry => (
            <ExerciseCard
              key={entry.id}
              exercise={entry.exercise}
              history={entry.history}
              onSave={sets => onSaveExercise?.(entry.id, sets)}
            />
          ))
        )}

        {/* Bottom padding so FAB never occludes the last card */}
        <View style={styles.fabSpacer} />
      </ScrollView>

      {/* ── Persistent FAB — sibling of ScrollView, floats via absolute positioning ── */}
      <FAB onPress={onOpenExerciseSelector} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FAB_HEIGHT = 58;
const FAB_BOTTOM_MARGIN = Platform.OS === 'ios' ? 28 : 18;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: FAB_HEIGHT + FAB_BOTTOM_MARGIN + 20,
  },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 10,
  },

  // Empty state
  emptyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    paddingHorizontal: 32,
  },
  emptyIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },

  fabSpacer: {
    height: FAB_HEIGHT + FAB_BOTTOM_MARGIN + 20,
  },

  // FAB itself — absolutely positioned so it floats over the scroll canvas
  fabShadowWrapper: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: '88%',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 12,
    borderRadius: 18,
  },
  fab: {
    height: FAB_HEIGHT,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.2,
  },
});
