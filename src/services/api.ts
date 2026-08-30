import axios from 'axios';
import { Platform } from 'react-native';
import { getAuth } from '../utils/secureStore';

export const BASE_HOST = 'https://api.hafriyapp.com';
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
