import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';

console.log('Current API URL:', API_URL);

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

axiosClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config;
    console.log(`[API ERROR] ${config?.method?.toUpperCase()} ${config?.url}`);

    if (error.response) {
      console.log('Status:', error.response.status);
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
