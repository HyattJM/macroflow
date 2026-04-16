import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ensure this matches your local machine running Django
export const BASE_URL = 'http://192.168.1.59:8000/api';

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
