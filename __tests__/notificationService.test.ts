// Bildirim dinleyicisi tek kez kurulmalı: initPushNotifications 4 yerden çağrılıyor ve
// her çağrı yeni dinleyici eklediğinde tek bildirim için üst üste birden fazla Alert açılıyordu.
const mockOnMessage = jest.fn((_instance: any, _handler: any) => jest.fn());
const mockOnTokenRefresh = jest.fn((_instance: any, _handler: any) => jest.fn());

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(async () => 'test-token'),
  onMessage: (instance: any, handler: any) => mockOnMessage(instance, handler),
  onTokenRefresh: (instance: any, handler: any) => mockOnTokenRefresh(instance, handler),
  requestPermission: jest.fn(async () => 1),
  registerDeviceForRemoteMessages: jest.fn(async () => {}),
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
}));

jest.mock('../src/services/api', () => ({
  api: { post: jest.fn(async () => ({ status: 200 })) },
}));

import { Alert } from 'react-native';
import { initPushNotifications, handleForegroundMessage } from '../src/services/notificationService';

describe('notificationService', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore();
  });

  it('initPushNotifications kaç kez çağrılırsa çağrılsın dinleyiciler tek kez kurulur', async () => {
    await initPushNotifications();
    await initPushNotifications();
    await initPushNotifications();
    await initPushNotifications();

    expect(mockOnMessage).toHaveBeenCalledTimes(1);
    expect(mockOnTokenRefresh).toHaveBeenCalledTimes(1);
  });

  it('tek bildirim tek Alert açar', async () => {
    await initPushNotifications();
    const handler = mockOnMessage.mock.calls[0][1];

    await handler({ messageId: 'm-1', notification: { title: 'HafriyApp', body: '34NNB371 bir sefer attı.' } });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('HafriyApp', '34NNB371 bir sefer attı.');
  });

  it('aynı bildirim (aynı messageId) ikinci kez gelirse tekrar gösterilmez', () => {
    const msg = { messageId: 'm-2', notification: { title: 'T', body: 'B' } };

    handleForegroundMessage(msg);
    handleForegroundMessage(msg);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('farklı bildirimler ayrı ayrı gösterilir', () => {
    handleForegroundMessage({ messageId: 'm-3', notification: { title: 'T', body: '1' } });
    handleForegroundMessage({ messageId: 'm-4', notification: { title: 'T', body: '2' } });

    expect(Alert.alert).toHaveBeenCalledTimes(2);
  });

  it('notification alanı olmayan (sadece veri) mesaj Alert açmaz', () => {
    handleForegroundMessage({ messageId: 'm-5', data: { type: 'x' } });

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
