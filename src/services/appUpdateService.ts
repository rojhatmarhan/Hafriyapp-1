import SpInAppUpdates, {
  IAUUpdateKind,
  StartUpdateOptions,
} from 'sp-react-native-in-app-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_DISMISSED = 'HAFRIYAPP_LAST_UPDATE_DISMISSED_AT';
const SNOOZE_HOURS = 24; // 24 saat hatırlatma aralığı
const APP_VERSION = '1.7.0'; // Mevcut versiyon

let inAppUpdatesInstance: SpInAppUpdates | null = null;

const getInAppUpdates = (): SpInAppUpdates => {
  if (!inAppUpdatesInstance) {
    inAppUpdatesInstance = new SpInAppUpdates(false);
  }
  return inAppUpdatesInstance;
};

/**
 * Hem Android hem iOS için mağazadaki yeni sürümü kontrol eder
 * - Android: Google Play In-App Update API (Flexible / Immediate)
 * - iOS: iTunes Store Lookup API + App Store Deep Link
 * - Kullanıcı "Daha Sonra" derse 24 saat boyunca tekrar rahatsız etmez
 */
export const checkAndPromptAppUpdate = async (options?: { isManualCheck?: boolean }) => {
  try {
    // 1. Kullanıcı 24 saat içinde "Daha Sonra" demiş mi kontrol et (Manuel kontrol değilse)
    if (!options?.isManualCheck) {
      const lastDismissedStr = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED);
      if (lastDismissedStr) {
        const lastDismissed = parseInt(lastDismissedStr, 10);
        const hoursPassed = (Date.now() - lastDismissed) / (1000 * 60 * 60);
        if (hoursPassed < SNOOZE_HOURS) {
          console.log(`[AppUpdate] Update prompt snoozed (${hoursPassed.toFixed(1)}h / ${SNOOZE_HOURS}h)`);
          return;
        }
      }
    }

    const inAppUpdates = getInAppUpdates();

    // 2. Mağaza ile sürüm kontrolü yap
    const result = await inAppUpdates.checkNeedsUpdate({
      curVersion: APP_VERSION,
    });

    console.log('[AppUpdate] checkNeedsUpdate result:', result);

    if (result?.shouldUpdate) {
      let updateOptions: StartUpdateOptions = {};

      if (Platform.OS === 'android') {
        // Android Google Play In-App Updates
        // updatePriority >= 4 ise IMMEDIATE (Zorunlu), aksi halde FLEXIBLE (Esnek)
        const priority = (result?.other as any)?.updatePriority || 0;
        const isForce = priority >= 4;

        updateOptions = {
          updateType: isForce ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE,
        };

        await inAppUpdates.startUpdate(updateOptions);
      } else if (Platform.OS === 'ios') {
        // iOS App Store Güncellemesi
        updateOptions = {
          title: 'Yeni Sürüm Mevcut',
          message:
            'HafriyApp uygulamasının yeni bir sürümü yayınlandı. Yeni özellikleri kullanmak için lütfen güncelleyin.',
          buttonUpgradeText: 'Şimdi Güncelle',
          buttonCancelText: 'Daha Sonra',
        };

        await inAppUpdates.startUpdate(updateOptions);
        // Kullanıcı iOS modalında "Daha Sonra" dediyse 24 saat snooze et
        await AsyncStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
      }
    }
  } catch (error) {
    // Mağazada henüz yayınlanmamışsa veya test ortamındaysa sessizce devam et
    console.log('[AppUpdate] Update check skipped/handled:', error);
  }
};

export const snoozeUpdatePrompt = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
  } catch (e) {
    console.warn(e);
  }
};