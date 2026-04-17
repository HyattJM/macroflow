import { initialize, requestPermission, readRecords } from 'react-native-health-connect';
import Constants from 'expo-constants';

export const setupHealthConnect = async () => {
  if (Constants.appOwnership === 'expo') {
    console.log('Bypassing Health Connect in Expo Go');
    return true;
  }

  try {
    const isInitialized = await initialize();
    if (isInitialized) {
      await requestPermission([{ accessType: 'read', recordType: 'HeartRate' }]);
      return true;
    }
  } catch (error) {
    console.error("Health Connect Setup Failed:", error);
    return false;
  }
};
