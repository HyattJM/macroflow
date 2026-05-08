import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The base URL for the Django REST API.
 * Update this to your local machine's IP address when testing on physical devices.
 */
export const BASE_URL = 'http://192.168.1.59:8000/api/';

/**
 * Axios instance configured for the MacroFlow backend.
 * 
 * Logic Rationale:
 * - Request Interceptor: Automatically injects the 'Token <key>' Authorization header 
 *   into every outgoing request if an `auth_token` is found in AsyncStorage.
 * - Exclusion Logic: Skips header injection for /login and /register routes 
 *   to avoid pre-authentication errors.
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token && !config.url.includes('/login') && !config.url.includes('/register')) {
      config.headers.Authorization = `Token ${token}`;
    }
  } catch (error) {
    console.error("Error fetching token from AsyncStorage", error);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;
