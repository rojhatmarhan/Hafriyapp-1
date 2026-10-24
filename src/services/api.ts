import axios from 'axios';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getAuth } from '../utils/secureStore';

export const BASE_HOST = __DEV__
  ? 'http://localhost:5062'
  : 'https://api.hafriyapp.com';
export const API_BASE_URL = `${BASE_HOST}/api`;

// Yüklenen dosyalar (logo, ilan/grup resimleri) canlı sunucuda durur; debug'da local API canlı veritabanıyla
// çalışırken de resimler görünsün diye her zaman canlı adresten okunur.
export const UPLOADS_HOST = 'https://api.hafriyapp.com';

// Uygulama sürüm başlıkları: API bir davranışı sadece yeni sürümlere uygulamak isterse bunlara bakar.
// Eski sürümler bu başlıkları göndermez (bkz. docs/UYUMLULUK.md). Kaldırmayın, adlarını değiştirmeyin.
export const APP_VERSION_HEADERS = {
  'X-App-Platform': Platform.OS,
  'X-App-Version': DeviceInfo.getVersion(),
  'X-App-Build': DeviceInfo.getBuildNumber(),
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'text/plain',
    'Content-Type': 'application/json',
    ...APP_VERSION_HEADERS,
  },
});

api.interceptors.request.use(
  async config => {
    const auth = await getAuth();
    if (auth?.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }

    return config;
  },
  error => Promise.reject(error),
);
