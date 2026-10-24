/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Push kaydı test sırasında gerçek ağ isteği (cihaz token kaydı) atmasın
jest.mock('../src/services/notificationService', () => ({
  initPushNotifications: jest.fn(() => Promise.resolve()),
  registerDeviceToken: jest.fn(() => Promise.resolve(false)),
  requestNotificationPermission: jest.fn(() => Promise.resolve(false)),
  clearDeviceTokenSync: jest.fn(() => Promise.resolve()),
}));

// Navigasyon animasyonları ve periyodik profil kontrolü zamanlayıcı kurar;
// sahte zamanlayıcı + unmount ile test ortamı kapandıktan sonra çalışmalarını engelliyoruz.
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('renders correctly', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(renderer!.toJSON()).toBeTruthy();
  await ReactTestRenderer.act(() => {
    renderer!.unmount();
  });
});
