import axios from 'axios';
import { Platform } from 'react-native';
import { getAuth } from '../utils/secureStore';

// Test / Development modunda (__DEV__ == true) localhost kullanılır.
// Canlı (Production / Release) derlemesinde canlı sunucu kullanılır.
const LOCAL_PORT = '5062';
const LOCAL_HOST = Platform.OS === 'android' ? `http://10.0.2.2:${LOCAL_PORT}` : `http://localhost:${LOCAL_PORT}`;

export const BASE_HOST = __DEV__ ? LOCAL_HOST : 'https://api.hafriyapp.com';
export const API_BASE_URL = `${BASE_HOST}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'text/plain',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async config => {
    const auth = await getAuth();
    console.log('INTERCEPTOR TOKEN', auth?.token);
    if (auth?.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }

    return config;
  },
  error => Promise.reject(error),
);
