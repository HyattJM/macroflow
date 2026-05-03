import { initialize, requestPermission, readRecords, getGrantedPermissions, openHealthConnectSettings } from 'react-native-health-connect';
import Constants from 'expo-constants';

/**
 * Initializes the Health Connect SDK so the native module is ready for later use.
 *
 * WHY we do NOT call requestPermission() here:
 * The native HealthConnectPermissionDelegate.launchPermissionsDialog() requires an
 * ActivityResultLauncher that is only registered inside Activity.onCreate() via
 * registerForActivityResult(). Calling requestPermission() from JS during app boot
 * — before that launcher is set — throws:
 *   kotlin.UninitializedPropertyAccessException: lateinit property requestPermission
 *
 * Permissions must be requested in response to a deliberate user action (e.g. a
 * button press on the health screen) after the Activity is fully active.
 */
export const setupHealthConnect = async () => {
  if (Constants.appOwnership === 'expo') {
    console.log('Bypassing Health Connect in Expo Go');
    return true;
  }

  try {
    const isInitialized = await initialize();
    console.log('[HealthConnect] SDK initialized:', isInitialized);
    return isInitialized;
  } catch (error) {
    console.warn('[HealthConnect] Initialization failed (non-fatal):', error);
    return false;
  }
};

/**
 * User-triggered sync that reads Steps and Heart Rate from Health Connect.
 *
 * WHY requestPermission is HERE (not in setupHealthConnect):
 * launchPermissionsDialog() requires an ActivityResultLauncher that the native
 * delegate registers in Activity.onCreate(). By the time the user taps the
 * "Sync" button, the Activity is fully active and the launcher is guaranteed
 * to be initialized — making this the only safe call site.
 *
 * Time range: from midnight of the current day to now, so we capture today's
 * accumulated steps and the most recent heart rate reading.
 *
 * @returns { steps: number, heartRate: string } or null on failure.
 */
export const syncHealthConnectData = async (): Promise<{
  steps: number;
  heartRate: string;
} | null> => {
  if (Constants.appOwnership === 'expo') {
    console.log('[HealthConnect] Skipping sync in Expo Go — returning mock data.');
    // Return plausible mock data so UI development still works in Expo Go.
    return { steps: 4200, heartRate: '72' };
  }

  try {
    // ── Step 1: Request permissions (safe here — called from a user gesture) ──
    await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'HeartRate' },
    ]);

    // Check if permissions are actually granted via getGrantedPermissions()
    // This is safer because requestPermission might not return the full list if already granted.
    const granted = await getGrantedPermissions();
    console.log('[HealthConnect] Currently granted permissions:', JSON.stringify(granted));

    const hasSteps = granted.some(p => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read');
    const hasHR = granted.some(p => 'recordType' in p && p.recordType === 'HeartRate' && p.accessType === 'read');

    if (!hasSteps || !hasHR) {
      console.warn('[HealthConnect] Missing required permissions. Opening settings...');
      
      // If Android auto-denied the dialog, open the Health Connect settings directly
      // so the user doesn't have to hunt for it in their phone settings.
      openHealthConnectSettings();
      
      return null;
    }

    // ── Step 2: Build today's time range (midnight → now) ────────────────────
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: midnight.toISOString(),
      endTime: now.toISOString(),
    };

    // ── Step 3: Fetch both record types in parallel ───────────────────────────
    const [stepsResult, heartRateResult] = await Promise.all([
      readRecords('Steps', { timeRangeFilter }),
      readRecords('HeartRate', { timeRangeFilter }),
    ]);

    // ── Step 4: Reduce steps — sum all StepsRecord count values ──────────────
    const totalSteps = (stepsResult.records ?? []).reduce(
      (acc: number, record: any) => acc + (record.count ?? 0),
      0,
    );

    // ── Step 5: Extract most recent heart rate sample ─────────────────────────
    // HeartRateRecord contains a `samples` array; take the last record's last sample.
    let heartRate = '--';
    const hrRecords = heartRateResult.records ?? [];
    if (hrRecords.length > 0) {
      const lastRecord = hrRecords[hrRecords.length - 1] as any;
      const samples = lastRecord.samples ?? [];
      if (samples.length > 0) {
        const lastSample = samples[samples.length - 1];
        heartRate = String(lastSample.beatsPerMinute ?? '--');
      }
    }

    console.log(`[HealthConnect] Sync complete — Steps: ${totalSteps}, HR: ${heartRate} BPM`);
    return { steps: totalSteps, heartRate };
  } catch (error) {
    console.error('[HealthConnect] Sync failed:', error);
    return null;
  }
};

