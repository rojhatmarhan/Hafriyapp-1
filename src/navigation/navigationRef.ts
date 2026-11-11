import { createNavigationContainerRef } from '@react-navigation/native';

// Ekran dışından (push bildirimi) yönlendirme için ortak navigation ref (RootNavigator'daki ana NavigationContainer'a bağlı).
export const navigationRef = createNavigationContainerRef<any>();

// Navigasyon hazır değilken (uygulama bildirimle soğuk açıldı) gelen istek hazır olunca uygulanır
let pendingDump = false;

/** İşlerim → Döküm sekmesini açar (sadece firma/araç sahibi sekmelerinde var; yoksa sessizce geçer). */
export const openDumpScreen = () => {
  if (!navigationRef.isReady()) {
    pendingDump = true;
    return;
  }
  pendingDump = false;
  try {
    navigationRef.navigate('HomeTabs', { screen: 'MyJobs', params: { screen: 'MyJobsList', params: { tab: 'dump', openedAt: Date.now() } } });
  } catch {
    // Şoför hesabında İşlerim sekmesi yok
  }
};

/** NavigationContainer onReady: bekleyen yönlendirmeyi uygular. */
export const flushPendingNavigation = () => {
  if (pendingDump) setTimeout(openDumpScreen, 300);
};
