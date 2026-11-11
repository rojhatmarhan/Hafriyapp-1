import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  registerDeviceForRemoteMessages,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { api } from './api';
import { isDumpNotification } from '../utils/notificationRoute';

// Navigasyon modülü bildirim anında yüklenir (servis navigasyondan bağımsız kalsın; testlerde navigasyon sahte olabilir)
const openDumpScreen = () => {
  try {
    require('../navigation/navigationRef').openDumpScreen();
  } catch {
    // navigasyon hazır değil / yok
  }
};

const SYNCED_TOKEN_KEY = 'push_device_token_synced';

// initPushNotifications birden fazla yerden çağrılıyor (App, useAuthBootstrap, RootNavigator, OtpScreen).
// Dinleyiciler uygulama ömrü boyunca TEK kez kurulmalı; aksi halde her bildirim için birden fazla Alert açılır.
let unsubscribeOnMessage: (() => void) | null = null;
let unsubscribeTokenRefresh: (() => void) | null = null;
let unsubscribeOpened: (() => void) | null = null;
let initialNotificationChecked = false;

// Aynı bildirimin (aynı messageId) kısa sürede ikinci kez gösterilmesini engeller
const RECENT_MESSAGE_TTL_MS = 60 * 1000;
const recentMessageIds = new Map<string, number>();

/**
 * Bildirim bu kısa süre içinde zaten gösterildiyse true döner (ve kaydı tutar). Test için dışa açık.
 */
export const isDuplicateMessage = (messageId?: string | null): boolean => {
  if (!messageId) return false;
  const now = Date.now();
  recentMessageIds.forEach((shownAt, id) => {
    if (now - shownAt > RECENT_MESSAGE_TTL_MS) recentMessageIds.delete(id);
  });
  if (recentMessageIds.has(messageId)) return true;
  recentMessageIds.set(messageId, now);
  return false;
};

/**
 * Ön plandaki bildirimi gösterir (aynı messageId tekrar gelirse gösterilmez)
 */
export const handleForegroundMessage = (remoteMessage: any) => {
  console.log('[NotificationService] Foreground message received:', remoteMessage?.messageId);
  if (!remoteMessage?.notification) return;
  if (isDuplicateMessage(remoteMessage.messageId)) return;
  const title = remoteMessage.notification.title || 'HafriyApp';
  const body = remoteMessage.notification.body || '';
  // Döküm / Cebeci bildirimi: "Görüntüle" ile Döküm ekranı açılır
  if (isDumpNotification(remoteMessage.data)) {
    Alert.alert(title, body, [
      { text: 'Kapat', style: 'cancel' },
      { text: 'Görüntüle', onPress: openDumpScreen },
    ]);
    return;
  }
  Alert.alert(title, body);
};

/** Bildirime dokunularak açıldıysa (arka plan / kapalı uygulama) ilgili ekrana git. */
export const handleNotificationOpen = (remoteMessage: any) => {
  if (isDumpNotification(remoteMessage?.data)) openDumpScreen();
};

/**
 * Cihazın push bildirim token'ını backend'e kaydeder.
 */
export const registerDeviceToken = async (token: string, force: boolean = false): Promise<boolean> => {
  try {
    if (!token) return false;

    console.log('[NotificationService] Registering device token with backend...', {
      platform: Platform.OS,
      tokenPreview: token.substring(0, 15) + '...',
    });

    const response = await api.post('/Notification/device-token', {
      token,
      platform: Platform.OS,
    });

    if (response.status >= 200 && response.status < 300) {
      await AsyncStorage.setItem(SYNCED_TOKEN_KEY, token);
      console.log('✅ [NotificationService] Device token successfully registered with backend on', Platform.OS);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('⚠️ [NotificationService] Token register failed:', err?.response?.status, err?.message);
    return false;
  }
};

/**
 * Android 13+ ve iOS için bildirim izinlerini sorgular ve ister
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS,
          {
            title: 'Bildirim İzni Gerekli',
            message: 'Sefer fişi kesildiğinde veya düzenlendiğinde anlık bildirim alabilmek için lütfen bildirimlere izin veriniz.',
            buttonPositive: 'İzin Ver',
            buttonNegative: 'İptal',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } else if (Platform.OS === 'ios') {
      const messagingInstance = getMessaging();
      const authStatus = await requestPermission(messagingInstance);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      return enabled;
    }
    return true;
  } catch (err) {
    console.warn('[NotificationService] Permission request failed:', err);
    return false;
  }
};

/**
 * Firebase Push Bildirim Servisini başlatır, Token alır ve dinleyicileri kurar
 */
export const initPushNotifications = async () => {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[NotificationService] Notification permission not granted.');
      return;
    }

    const messagingInstance = getMessaging();

    // iOS için APNs cihaz kaydı
    if (Platform.OS === 'ios') {
      try {
        await registerDeviceForRemoteMessages(messagingInstance);
        console.log('✅ [NotificationService] iOS registerDeviceForRemoteMessages successful');
      } catch (apnsErr) {
        console.warn('⚠️ [NotificationService] APNs register error:', apnsErr);
      }
    }

    // FCM Token al ve backend'e kaydet
    const token = await getToken(messagingInstance);
    if (token) {
      console.log('✅ [NotificationService] FCM Device Token obtained:', token);
      await registerDeviceToken(token, true);
    }

    // Token yenilendiğinde backend'i güncelle (dinleyici tek kez kurulur)
    if (!unsubscribeTokenRefresh) {
      unsubscribeTokenRefresh = onTokenRefresh(messagingInstance, async (newToken: string) => {
        console.log('[NotificationService] FCM Token refreshed');
        await registerDeviceToken(newToken, true);
      });
    }

    // Bildirime dokunarak açılış: arka plandan (dinleyici) ve kapalıyken (ilk bildirim, bir kez)
    if (!unsubscribeOpened && typeof onNotificationOpenedApp === 'function') {
      unsubscribeOpened = onNotificationOpenedApp(messagingInstance, handleNotificationOpen);
    }
    if (!initialNotificationChecked && typeof getInitialNotification === 'function') {
      initialNotificationChecked = true;
      getInitialNotification(messagingInstance)
        .then(msg => msg && handleNotificationOpen(msg))
        .catch(() => {});
    }

    // Uygulama açıkken (Foreground) gelen bildirimleri yakala (dinleyici tek kez kurulur)
    if (!unsubscribeOnMessage) {
      unsubscribeOnMessage = onMessage(messagingInstance, async (remoteMessage: any) => {
        handleForegroundMessage(remoteMessage);
      });
    }
  } catch (err) {
    console.warn('[NotificationService] Init push notifications failed:', err);
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
