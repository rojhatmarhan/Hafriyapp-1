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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
// @ts-ignore - native bridge module, no types
import { BluetoothEscposPrinter, BluetoothManager } from 'react-native-bluetooth-escpos-printer';
import { ensurePrinterReady, getPairedAndScannedDevices, printImage, RECEIPT_IMAGE_PRINT_OPTIONS, RECEIPT_PRINT_FEED, getReceiptCaptureLayout } from '../src/services/printService';

describe('printService.printImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (BluetoothManager.isBluetoothEnabled as jest.Mock).mockResolvedValue(true);
    (BluetoothManager.connect as jest.Mock).mockResolvedValue(undefined);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
    });
  });

  it('prints through the saved printer with global receipt sizing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('AA:BB:CC').mockResolvedValueOnce('Mini Printer');

    await printImage('base64-image');

    expect(BluetoothManager.connect).toHaveBeenCalledWith('AA:BB:CC');
    expect(BluetoothEscposPrinter.printerInit).toHaveBeenCalled();
    expect(BluetoothEscposPrinter.printPic).toHaveBeenCalledWith('base64-image', RECEIPT_IMAGE_PRINT_OPTIONS);
  });

  it('uses global receipt print sizing and leaves feed space after the image', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('AA:BB:CC').mockResolvedValueOnce('Mini Printer');

    await printImage('base64-image');

    expect(BluetoothEscposPrinter.printPic).toHaveBeenCalledWith('base64-image', RECEIPT_IMAGE_PRINT_OPTIONS);
    expect(BluetoothEscposPrinter.printText).toHaveBeenCalledWith(RECEIPT_PRINT_FEED, {});
  });

  it('throws a clear error when no printer has been saved before printing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(printImage('base64-image')).rejects.toThrow('Kayitli yazici bulunamadi. Yazici secim ekranindan bir yazici secin.');

    expect(BluetoothManager.connect).not.toHaveBeenCalled();
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('throws a clear error when the saved printer cannot be connected', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('OLD:AA:BB').mockResolvedValueOnce('t58_570C');
    (BluetoothManager.connect as jest.Mock).mockRejectedValueOnce(new Error('Device not found'));

    await expect(printImage('base64-image')).rejects.toThrow('"t58_570C" yazicisina baglanamadi. Yazicinin acik ve yakin oldugundan emin olun.');

    expect(BluetoothManager.connect).toHaveBeenCalledTimes(1);
    expect(BluetoothManager.connect).toHaveBeenCalledWith('OLD:AA:BB');
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('throws a clear error when bluetooth permission is denied before printing', async () => {
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.DENIED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.DENIED,
    });

    await expect(printImage('base64-image')).rejects.toThrow('Bluetooth izni verilmedi. Ayarlardan yakin cihaz iznini acip tekrar deneyin.');
    expect(BluetoothManager.connect).not.toHaveBeenCalled();
  });
});

describe('printService.getPairedAndScannedDevices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (BluetoothManager.isBluetoothEnabled as jest.Mock).mockResolvedValue(true);
    (BluetoothManager.connect as jest.Mock).mockResolvedValue(undefined);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
    });
  });

  it('throws a clear error when bluetooth permission is denied before scanning', async () => {
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.DENIED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.DENIED,
    });

    await expect(getPairedAndScannedDevices()).rejects.toThrow('Bluetooth izni verilmedi. Ayarlardan yakin cihaz iznini acip tekrar deneyin.');
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });
});

describe('printService.ensurePrinterReady', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (BluetoothManager.isBluetoothEnabled as jest.Mock).mockResolvedValue(true);
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
    });
  });

  it('returns connected when the saved printer is reachable', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('AA:BB:CC').mockResolvedValueOnce('Mini Printer');

    const result = await ensurePrinterReady();

    expect(result).toEqual({
      status: 'connected',
      device: { address: 'AA:BB:CC', name: 'Mini Printer' },
    });
    expect(BluetoothManager.connect).toHaveBeenCalledWith('AA:BB:CC');
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('returns needs-selection when there is no saved printer', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await ensurePrinterReady();

    expect(result).toEqual({ status: 'needs-selection' });
    expect(BluetoothManager.connect).not.toHaveBeenCalled();
    expect(BluetoothManager.scanDevices).not.toHaveBeenCalled();
  });

  it('returns connect-failed when the saved printer cannot be reached', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('OLD:AA:BB').mockResolvedValueOnce('Mini Printer');
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
      frameBottom: 0,
    });
  });
});
