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
import { getPairedAndScannedDevices, printImage } from '../src/services/printService';

describe('printService.printImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PermissionsAndroid.requestMultiple as jest.Mock).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
    });
  });

  it('falls back to the first paired printer when no saved printer exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    (BluetoothManager.scanDevices as jest.Mock).mockResolvedValue({
      paired: [{ name: 'Mini Printer', address: 'AA:BB:CC' }],
      found: [],
    });

    await printImage('base64-image');

    expect(BluetoothManager.connect).toHaveBeenCalledWith('AA:BB:CC');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@hafriyapp/bt_printer_address', 'AA:BB:CC');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@hafriyapp/bt_printer_name', 'Mini Printer');
    expect(BluetoothEscposPrinter.printerInit).toHaveBeenCalled();
    expect(BluetoothEscposPrinter.printPic).toHaveBeenCalledWith('base64-image', { width: 0 });
  });

  it('tries the printer device when the first paired bluetooth device is not connectable', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    (BluetoothManager.scanDevices as jest.Mock).mockResolvedValue({
      paired: [
        { name: 'Galaxy Buds', address: '11:22:33' },
        { name: 't58_570C', address: 'AA:BB:CC' },
      ],
      found: [],
    });
    (BluetoothManager.connect as jest.Mock).mockResolvedValueOnce(undefined);

    await printImage('base64-image');

    expect(BluetoothManager.connect).toHaveBeenNthCalledWith(1, 'AA:BB:CC');
    expect(BluetoothManager.connect).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@hafriyapp/bt_printer_address', 'AA:BB:CC');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@hafriyapp/bt_printer_name', 't58_570C');
  });

  it('retries with the currently paired printer when the saved printer address is stale', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('OLD:AA:BB').mockResolvedValueOnce('t58_570C');
    (BluetoothManager.connect as jest.Mock).mockRejectedValueOnce(new Error('Device not found')).mockResolvedValueOnce(undefined);
    (BluetoothManager.scanDevices as jest.Mock).mockResolvedValue({
      paired: [{ name: 't58_570C', address: 'NEW:11:22' }],
      found: [],
    });

    await printImage('base64-image');

    expect(BluetoothManager.connect).toHaveBeenNthCalledWith(1, 'OLD:AA:BB');
    expect(BluetoothManager.connect).toHaveBeenNthCalledWith(2, 'NEW:11:22');
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['@hafriyapp/bt_printer_address', '@hafriyapp/bt_printer_name']);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@hafriyapp/bt_printer_address', 'NEW:11:22');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@hafriyapp/bt_printer_name', 't58_570C');
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
