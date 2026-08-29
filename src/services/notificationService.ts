import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from './api';

const SYNCED_TOKEN_KEY = 'push_device_token_synced';

/**
 * Cihazın push bildirim token'ını backend'e kaydeder.
 * Başarılı olduğunda yerel hafızaya işaretler.
 * Başarısız olursa (ağ yokluğu, sunucu hatası vb.) bir sonraki açılışta veya işlemde otomatik tekrar denenir.
 */
export const registerDeviceToken = async (token: string, force: boolean = false): Promise<boolean> => {
  try {
    if (!token) return false;

    // Eğer bu token zaten başarıyla sunucuya iletilmişse gereksiz istek atma
    if (!force) {
      const lastSynced = await AsyncStorage.getItem(SYNCED_TOKEN_KEY);
      if (lastSynced === token) {
        return true;
      }
    }

    const response = await api.post('/Notification/device-token', {
      token,
      platform: Platform.OS,
    });

    if (response.status >= 200 && response.status < 300) {
      await AsyncStorage.setItem(SYNCED_TOKEN_KEY, token);
      console.log('[NotificationService] Device token successfully registered.');
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[NotificationService] Token register failed, will retry automatically on next launch:', err);
    return false;
  }
};

/**
 * Oturum kapatıldığında veya kullanıcı değiştiğinde token senkron durumunu sıfırlar
 */
export const clearDeviceTokenSync = async () => {
  try {
    await AsyncStorage.removeItem(SYNCED_TOKEN_KEY);
  } catch {}
};
