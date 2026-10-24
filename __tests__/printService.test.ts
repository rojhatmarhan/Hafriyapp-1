jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 31,
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    requestMultiple: jest.fn(),
    request: jest.fn(),
  },
}));

jest.mock('react-native-bluetooth-escpos-printer', () => ({
  BluetoothManager: {
    isBluetoothEnabled: jest.fn(),
    enableBluetooth: jest.fn(),
    scanDevices: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
  BluetoothEscposPrinter: {
    printerInit: jest.fn(),
    printPic: jest.fn(),
    printText: jest.fn(),
  },
}));

// printImage yazdırmadan önce yazıcı yetkisini API'de doğrular (POST /Printer/validate)
jest.mock('../src/services/api', () => ({
  api: { post: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
// @ts-ignore - native bridge module, no types
import { BluetoothEscposPrinter, BluetoothManager } from 'react-native-bluetooth-escpos-printer';
import { api } from '../src/services/api';
import { ensurePrinterReady, getPairedAndScannedDevices, printImage, RECEIPT_IMAGE_PRINT_OPTIONS, RECEIPT_PRINT_FEED, getReceiptCaptureLayout } from '../src/services/printService';

const PRINTER_KEY = '@hafriyapp/bt_printer_address';
const PRINTER_NAME_KEY = '@hafriyapp/bt_printer_name';

/** Kayıtlı yazıcıyı AsyncStorage anahtarına göre döndürür (getSavedPrinter birden çok kez çağrılabilir). */
const mockSavedPrinter = (address: string | null, name: string | null) => {
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
    if (key === PRINTER_KEY) return address;
    if (key === PRINTER_NAME_KEY) return name;
    return null;
  });
};

const grantPermissions = () => {
  (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
    [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
  });
};

const denyPermissions = () => {
  (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.DENIED,
    [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.DENIED,
  });
};

beforeEach(() => {
  jest.resetAllMocks();
  (BluetoothManager.isBluetoothEnabled as jest.Mock).mockResolvedValue(true);
  (BluetoothManager.connect as jest.Mock).mockResolvedValue(undefined);
  (api.post as jest.Mock).mockResolvedValue({ data: { isAllowed: true } });
  grantPermissions();
  mockSavedPrinter(null, null);
});

describe('printService.printImage', () => {
  it('prints through the saved printer with global receipt sizing', async () => {
    mockSavedPrinter('AA:BB:CC', 'Mini Printer');

    await printImage('base64-image');

    expect(api.post).toHaveBeenCalledWith('/Printer/validate', { macAddress: 'AA:BB:CC', deviceName: 'Mini Printer', platform: 'android' });
    expect(BluetoothManager.connect).toHaveBeenCalledWith('AA:BB:CC');
    expect(BluetoothEscposPrinter.printerInit).toHaveBeenCalled();
    expect(BluetoothEscposPrinter.printPic).toHaveBeenCalledWith('base64-image', RECEIPT_IMAGE_PRINT_OPTIONS);
  });

  it('uses global receipt print sizing and leaves feed space after the image', async () => {
    mockSavedPrinter('AA:BB:CC', 'Mini Printer');

    await printImage('base64-image');

    expect(BluetoothEscposPrinter.printPic).toHaveBeenCalledWith('base64-image', RECEIPT_IMAGE_PRINT_OPTIONS);
    expect(BluetoothEscposPrinter.printText).toHaveBeenCalledWith(RECEIPT_PRINT_FEED, {});
  });

  it('throws a clear error when no printer has been saved before printing', async () => {
    mockSavedPrinter(null, null);

    await expect(printImage('base64-image')).rejects.toThrow('Kayıtlı yazıcı bulunamadı. Lütfen yazıcı seçim ekranından bir yazıcı seçiniz.');

    expect(api.post).not.toHaveBeenCalled();
    expect(BluetoothManager.connect).not.toHaveBeenCalled();
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('refuses to print when the server does not authorize the printer', async () => {
    mockSavedPrinter('AA:BB:CC', 'Mini Printer');
    (api.post as jest.Mock).mockResolvedValue({ data: { isAllowed: false, message: 'Yetkisiz yazıcı.' } });

    await expect(printImage('base64-image')).rejects.toThrow('YETKI_ENGEL: Yetkisiz yazıcı.');

    expect(BluetoothManager.connect).not.toHaveBeenCalled();
    expect(BluetoothEscposPrinter.printPic).not.toHaveBeenCalled();
  });

  it('refuses to print when printer authorization cannot be verified (API error)', async () => {
    mockSavedPrinter('AA:BB:CC', 'Mini Printer');
    (api.post as jest.Mock).mockRejectedValue(new Error('Network Error'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(printImage('base64-image')).rejects.toThrow(/^YETKI_ENGEL: /);

    expect(BluetoothManager.connect).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('throws a clear error when the saved printer cannot be connected', async () => {
    mockSavedPrinter('OLD:AA:BB', 't58_570C');
    (BluetoothManager.connect as jest.Mock).mockRejectedValueOnce(new Error('Device not found'));

    await expect(printImage('base64-image')).rejects.toThrow('"t58_570C" yazicisina baglanamadi. Yazicinin acik ve yakin oldugundan emin olun.');

    expect(BluetoothManager.connect).toHaveBeenCalledTimes(1);
    expect(BluetoothManager.connect).toHaveBeenCalledWith('OLD:AA:BB');
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('throws a clear error when bluetooth permission is denied before printing', async () => {
    denyPermissions();

    await expect(printImage('base64-image')).rejects.toThrow('Bluetooth izni verilmedi. Ayarlardan yakin cihaz iznini acip tekrar deneyin.');
    expect(BluetoothManager.connect).not.toHaveBeenCalled();
  });
});

describe('printService.getPairedAndScannedDevices', () => {
  it('throws a clear error when bluetooth permission is denied before scanning', async () => {
    denyPermissions();

    await expect(getPairedAndScannedDevices()).rejects.toThrow('Bluetooth izni verilmedi. Ayarlardan yakin cihaz iznini acip tekrar deneyin.');
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });
});

describe('printService.ensurePrinterReady', () => {
  it('returns connected when the saved printer is reachable', async () => {
    mockSavedPrinter('AA:BB:CC', 'Mini Printer');

    const result = await ensurePrinterReady();

    expect(result).toEqual({
      status: 'connected',
      device: { address: 'AA:BB:CC', name: 'Mini Printer' },
    });
    expect(BluetoothManager.connect).toHaveBeenCalledWith('AA:BB:CC');
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('returns needs-selection when there is no saved printer', async () => {
    mockSavedPrinter(null, null);

    const result = await ensurePrinterReady();

    expect(result).toEqual({ status: 'needs-selection' });
    expect(BluetoothManager.connect).not.toHaveBeenCalled();
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('returns connect-failed when the saved printer cannot be reached', async () => {
    mockSavedPrinter('OLD:AA:BB', 'Mini Printer');
    (BluetoothManager.connect as jest.Mock).mockRejectedValueOnce(new Error('Device not found'));

    const result = await ensurePrinterReady();

    expect(result).toEqual({
      status: 'connect-failed',
      device: { address: 'OLD:AA:BB', name: 'Mini Printer' },
    });
    expect(BluetoothManager.connect).toHaveBeenCalledTimes(1);
    expect(BluetoothManager.connect).toHaveBeenCalledWith('OLD:AA:BB');
  });
});

describe('printService.getReceiptCaptureLayout', () => {
  it('calculates the global hidden receipt capture dimensions', () => {
    expect(getReceiptCaptureLayout()).toEqual({
      outerWidth: 384,
      outerHeight: 760,
      bleedX: 16,
      bleedY: 12,
      frameInset: 8,
      printRightGap: 20,
      bottomSafeArea: 56,
      contentWidth: 772,
      contentHeight: 400,
      translateX: -194,
      translateY: 180,
      frameBottom: 22, // frameInset (8) + 14 — kaynakta eklendiğinden beri böyle (cc20933b)
    });
  });
});
