import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import apiClient from '../api/apiClient';
import { readRecords } from 'react-native-health-connect';

interface HRDataPoint {
  timestamp: string;
  bpm: number;
}

interface WorkoutSessionContextProps {
  isActive: boolean;
  sessionId: string | number | null;
  currentBpm: number | null;
  heartRateHistory: number[];
  startWorkout: () => Promise<void>;
  finishWorkout: () => Promise<void>;
}

const WorkoutSessionContext = createContext<WorkoutSessionContextProps | undefined>(undefined);

export const WorkoutSessionProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | number | null>(null);
  const [currentBpm, setCurrentBpm] = useState<number | null>(null);
  const [heartRateHistory, setHeartRateHistory] = useState<number[]>([]);
  
  const hrBuffer = useRef<HRDataPoint[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startWorkout = async () => {
    try {
      const response = await apiClient.post('workouts/start/');
      if (response.data && response.data.session_id) {
        setSessionId(response.data.session_id);
        setIsActive(true);
        hrBuffer.current = []; // Reset buffer for new session
      }
    } catch (error) {
      console.error('Failed to start workout:', error);
    }
  };

  const finishWorkout = async () => {
    if (!sessionId) return;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      console.log(`[useWorkoutSession] Finish Workout Triggered.`);
      console.log(`[useWorkoutSession] Total HR Data Points in Buffer: ${hrBuffer.current.length}`);
      if (hrBuffer.current.length > 0) {
        console.log(`[useWorkoutSession] Sample (First Element): ${JSON.stringify(hrBuffer.current[0])}`);
      }

      await apiClient.post(`workouts/${sessionId}/finish/`, {
        hr_data: hrBuffer.current,
      });
      // Reset state upon success
      setIsActive(false);
      setSessionId(null);
      setCurrentBpm(null);
      setHeartRateHistory([]);
      hrBuffer.current = [];
    } catch (error) {
      console.error('Failed to finish workout:', error);
    }
  };

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(async () => {
        try {
          const now = new Date();
          const past = new Date(now.getTime() - 60000); // Check the last minute
          
          const timeRangeFilter = {
            operator: 'between' as const,
            startTime: past.toISOString(),
            endTime: now.toISOString(),
          };

          const result = await readRecords('HeartRate', { timeRangeFilter });
          const records = result.records ?? [];
          
          if (records.length > 0) {
            const lastRecord = records[records.length - 1] as any;
            const samples = lastRecord.samples ?? [];
            if (samples.length > 0) {
              const lastSample = samples[samples.length - 1];
              const bpm = lastSample.beatsPerMinute;
              const timestamp = lastSample.time || now.toISOString();

              console.log(`[HR Polling] Raw Health Connect Data -> timestamp: ${timestamp}, bpm: ${bpm}`);

              const currentBuffer = hrBuffer.current;
              // Prevent duplicate insertions
              if (currentBuffer.length === 0 || currentBuffer[currentBuffer.length - 1].timestamp !== timestamp) {
                hrBuffer.current.push({ timestamp, bpm });
                setCurrentBpm(bpm);
                setHeartRateHistory(prev => {
                  const updated = [...prev, bpm];
                  return updated.slice(-20); // Keep last 20
                });
                console.log(`[HR Polling] ✅ PUSHED to Buffer`);
              } else {
                console.log(`[HR Polling] ❌ REJECTED (Duplicate)`);
              }
            }
          }
        } catch (error) {
          console.error('[HR Polling] Error fetching heart rate:', error);
        }
      }, 10000); // Poll every 10 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  return (
    <WorkoutSessionContext.Provider value={{ isActive, sessionId, currentBpm, heartRateHistory, startWorkout, finishWorkout }}>
      {children}
    </WorkoutSessionContext.Provider>
  );
};

export const useWorkoutSession = () => {
  const context = useContext(WorkoutSessionContext);
  if (context === undefined) {
    throw new Error('useWorkoutSession must be used within a WorkoutSessionProvider');
  }
  return context;
};
