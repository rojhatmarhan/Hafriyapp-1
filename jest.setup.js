/* eslint-env jest */
// Testlerde, uygulamanın modül yükleme anında içe aktardığı native modülleri sahte modüllerle değiştirir.
// Sadece test altyapısıdır; uygulama koduna dokunmaz. Mümkün olan yerde paketlerin kendi jest mock'ları kullanılır.

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('@react-native-clipboard/clipboard', () => require('@react-native-clipboard/clipboard/jest/clipboard-mock'));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED: 'AccessibleWhenUnlocked', AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock' },
  SECURITY_LEVEL: { ANY: 'ANY', SECURE_SOFTWARE: 'SECURE_SOFTWARE', SECURE_HARDWARE: 'SECURE_HARDWARE' },
  STORAGE_TYPE: { AES: 'AES', RSA: 'RSA' },
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
  setInternetCredentials: jest.fn(() => Promise.resolve(true)),
  getInternetCredentials: jest.fn(() => Promise.resolve(false)),
  resetInternetCredentials: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: () => ({}),
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/messaging', () => {
  const api = {
    requestPermission: jest.fn(() => Promise.resolve(1)),
    hasPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
    deleteToken: jest.fn(() => Promise.resolve()),
    onMessage: jest.fn(() => jest.fn()),
    onTokenRefresh: jest.fn(() => jest.fn()),
    onNotificationOpenedApp: jest.fn(() => jest.fn()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    setBackgroundMessageHandler: jest.fn(),
    registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
    isDeviceRegisteredForRemoteMessages: true,
  };
  const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 };
  const messaging = () => api;
  messaging.AuthorizationStatus = AuthorizationStatus;
  return {
    __esModule: true,
    default: messaging,
    AuthorizationStatus,
    getMessaging: jest.fn(() => api),
    ...api,
  };
});

jest.mock('react-native-bluetooth-escpos-printer', () => ({
  BluetoothManager: {
    isBluetoothEnabled: jest.fn(() => Promise.resolve(true)),
    enableBluetooth: jest.fn(() => Promise.resolve([])),
    scanDevices: jest.fn(() => Promise.resolve(JSON.stringify({ paired: [], found: [] }))),
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
  },
  BluetoothEscposPrinter: {
    printerInit: jest.fn(() => Promise.resolve()),
    printPic: jest.fn(() => Promise.resolve()),
    printText: jest.fn(() => Promise.resolve()),
  },
  BluetoothTscPrinter: {},
}));

const mockHostComponent = name => {
  const React = require('react');
  const { View } = require('react-native');
  const Comp = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));
  Comp.displayName = name;
  return Comp;
};

jest.mock('react-native-camera-kit', () => {
  const Camera = mockHostComponent('Camera');
  return { __esModule: true, Camera, CameraScreen: Camera, CameraType: { Back: 'back', Front: 'front' } };
});

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn(() => Promise.resolve({ text: '', blocks: [] })) },
}));

jest.mock('react-native-blob-util', () => {
  const response = { path: () => '/tmp/file', info: () => ({ status: 200 }), base64: () => '' };
  const blobUtil = {
    fs: {
      dirs: { DocumentDir: '/docs', CacheDir: '/cache', DownloadDir: '/downloads' },
      writeFile: jest.fn(() => Promise.resolve()),
      readFile: jest.fn(() => Promise.resolve('')),
      exists: jest.fn(() => Promise.resolve(false)),
      unlink: jest.fn(() => Promise.resolve()),
    },
    config: jest.fn(() => ({ fetch: jest.fn(() => Promise.resolve(response)) })),
    fetch: jest.fn(() => Promise.resolve(response)),
    android: { actionViewIntent: jest.fn(), addCompleteDownload: jest.fn() },
    ios: { openDocument: jest.fn(), previewDocument: jest.fn() },
  };
  return { __esModule: true, default: blobUtil, ...blobUtil };
});

jest.mock('react-native-view-shot', () => ({
  __esModule: true,
  default: mockHostComponent('ViewShot'),
  captureRef: jest.fn(() => Promise.resolve('base64')),
  captureScreen: jest.fn(() => Promise.resolve('base64')),
}));

jest.mock('sp-react-native-in-app-updates', () => {
  class SpInAppUpdates {
    checkNeedsUpdate() {
      return Promise.resolve({ shouldUpdate: false });
    }
    startUpdate() {
      return Promise.resolve();
    }
    addStatusUpdateListener() {}
    removeStatusUpdateListener() {}
    installUpdate() {}
  }
  return { __esModule: true, default: SpInAppUpdates, IAUUpdateKind: { FLEXIBLE: 0, IMMEDIATE: 1 }, IAUInstallStatus: {} };
});

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: mockHostComponent('DateTimePicker'),
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(() => Promise.resolve({ didCancel: true })),
  launchImageLibrary: jest.fn(() => Promise.resolve({ didCancel: true })),
}));

jest.mock('react-native-webview', () => {
  const WebView = mockHostComponent('WebView');
  return { __esModule: true, default: WebView, WebView };
});

jest.mock('react-native-linear-gradient', () => ({
  __esModule: true,
  default: mockHostComponent('LinearGradient'),
}));
