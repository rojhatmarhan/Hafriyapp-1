import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore — native bridge module, no types
import { BluetoothManager, BluetoothEscposPrinter } from 'react-native-bluetooth-escpos-printer';

const PRINTER_KEY = '@hafriyapp/bt_printer_address';
const PRINTER_NAME_KEY = '@hafriyapp/bt_printer_name';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface PrintReceiptParams {
  companyName: string;
  jobSiteName: string;
  serialNumber: string;
  date: string; // Formatted: "18.05.2026 10:30"
  plateNumber: string;
  driverName?: string;
  dumpLocation: string;
  tonage: number;
  cashAmount: number;
  fuelAmount: number;
  isPaid: boolean;
  contactPhone?: string;
}

// ─── Permissions ────────────────────────────────────────────────────────────

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      // Android 12+ — BLUETOOTH_SCAN + BLUETOOTH_CONNECT
      const results = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]);
      return results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED && results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      // Android 6–11 — konum izni tarama için gerekli
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
        title: 'Konum İzni',
        message: 'Bluetooth yazıcı taraması için konum izni gereklidir.',
        buttonPositive: 'Tamam',
        buttonNegative: 'İptal',
      });
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch {
    return false;
  }
}

async function ensureBluetoothPermission(): Promise<void> {
  const granted = await requestBluetoothPermissions();
  if (!granted) {
    throw new Error('Bluetooth izni verilmedi. Ayarlardan yakin cihaz iznini acip tekrar deneyin.');
  }
}

// ─── Bluetooth Durumu ────────────────────────────────────────────────────────

export async function isBluetoothEnabled(): Promise<boolean> {
  try {
    const enabled = await BluetoothManager.isBluetoothEnabled();
    return !!enabled;
  } catch {
    return false;
  }
}

export async function enableBluetooth(): Promise<boolean> {
  try {
    await BluetoothManager.enableBluetooth();
    return true;
  } catch {
    return false;
  }
}

// ─── Kayıtlı Yazıcı ────────────────────────────────────────────────────────

export async function getSavedPrinter(): Promise<BluetoothDevice | null> {
  try {
    const address = await AsyncStorage.getItem(PRINTER_KEY);
    const name = await AsyncStorage.getItem(PRINTER_NAME_KEY);
    if (!address) return null;
    return { address, name: name || address };
  } catch {
    return null;
  }
}

export async function savePrinter(device: BluetoothDevice): Promise<void> {
  await AsyncStorage.setItem(PRINTER_KEY, device.address);
  await AsyncStorage.setItem(PRINTER_NAME_KEY, device.name);
}

export async function clearSavedPrinter(): Promise<void> {
  await AsyncStorage.multiRemove([PRINTER_KEY, PRINTER_NAME_KEY]);
}

// ─── Cihaz Tarama ───────────────────────────────────────────────────────────

export async function getPairedAndScannedDevices(): Promise<{ paired: BluetoothDevice[]; found: BluetoothDevice[] }> {
  await ensureBluetoothPermission();

  const result = await BluetoothManager.scanDevices();
  const data: { paired?: any[]; found?: any[] } = typeof result === 'string' ? JSON.parse(result) : result;

  const toDevice = (d: any): BluetoothDevice => ({
    name: d.name?.trim() || d.address,
    address: d.address,
  });

  return {
    paired: (data.paired || []).map(toDevice),
    found: (data.found || []).map(toDevice),
  };
}

// ─── Bağlantı ───────────────────────────────────────────────────────────────

export async function connectPrinter(address: string): Promise<boolean> {
  try {
    await ensureBluetoothPermission();
    await BluetoothManager.connect(address);
    return true;
  } catch {
    return false;
  }
}

export async function disconnectPrinter(): Promise<void> {
  try {
    await BluetoothManager.disconnect();
  } catch {}
}

function normalizeDeviceName(name?: string): string {
  return (name || '').trim().toLowerCase();
}

function isPrinterLikeDevice(device: BluetoothDevice): boolean {
  const normalizedName = normalizeDeviceName(device.name);
  return /printer|print|pos|esc|tsc|t58|58_|58-|80mm|xp-|rp-|tp-/i.test(normalizedName);
}

function getAvailablePrinters(saved: BluetoothDevice | null, paired: BluetoothDevice[], found: BluetoothDevice[]): BluetoothDevice[] {
  const available = [...paired, ...found.filter(device => !paired.some(pairedDevice => pairedDevice.address === device.address))];
  const ranked: BluetoothDevice[] = [];

  const pushUnique = (device?: BluetoothDevice | null) => {
    if (!device) return;
    if (!ranked.some(item => item.address === device.address)) {
      ranked.push(device);
    }
  };

  if (saved) {
    const byAddress = available.find(device => device.address === saved.address);
    pushUnique(byAddress);

    const savedName = normalizeDeviceName(saved.name);
    if (savedName) {
      const byName = available.find(device => normalizeDeviceName(device.name) === savedName);
      pushUnique(byName);
    }
  }

  available.filter(isPrinterLikeDevice).forEach(pushUnique);
  available.forEach(pushUnique);

  return ranked;
}

async function connectResolvedPrinter(): Promise<BluetoothDevice> {
  let saved = await getSavedPrinter();
  if (saved) {
    try {
      await BluetoothManager.connect(saved.address);
      return saved;
    } catch {
      await clearSavedPrinter();
      saved = null;
    }
  }

  const { paired, found } = await getPairedAndScannedDevices();
  const candidates = getAvailablePrinters(saved, paired, found);

  if (candidates.length === 0) {
    throw new Error('Bluetooth yazici bulunamadi. Once yaziciyi eslestirip tekrar deneyin.');
  }

  for (const candidate of candidates) {
    try {
      await BluetoothManager.connect(candidate.address);
      await savePrinter(candidate);
      return candidate;
    } catch {
      // Bir sonraki uygun cihazi dene.
    }
  }

  throw new Error('Bluetooth yaziciya baglanilamadi. Android Bluetooth ayarlarinda yazicinin eslesmis oldugunu kontrol edip tekrar deneyin.');
}

// ─── Yazdırma ───────────────────────────────────────────────────────────────

/**
 * View'dan yakalanan base64 PNG'yi yazıcıya gönderir.
 * Kayıtlı yazıcı varsa önce bağlanır, sonra görsel gönderir.
 */
export async function printImage(base64: string): Promise<void> {
  await ensureBluetoothPermission();

  await connectResolvedPrinter();

  await BluetoothEscposPrinter.printerInit();
  // width: 0 → yazıcının kendi genişliğini kullanır
  await BluetoothEscposPrinter.printPic(base64, { width: 0 });
  await BluetoothEscposPrinter.printText('\n\n', {});
}

const SEP = '--------------------------------';

export async function printReceipt(params: PrintReceiptParams): Promise<void> {
  // Tarih ve saati ayır  ("18.05.2026 10:30"  →  datePart="18.05.2026"  timePart="10:30")
  const spacIdx = params.date.indexOf(' ');
  const datePart = spacIdx > -1 ? params.date.slice(0, spacIdx) : params.date;
  const timePart = spacIdx > -1 ? params.date.slice(spacIdx + 1) : '';

  await BluetoothEscposPrinter.printerInit();

  // ── Başlık: Firma adı (bold, sol) + Saat (sağ) ──────────────────────────
  await BluetoothEscposPrinter.setBlob(1); // bold
  await BluetoothEscposPrinter.printColumn([22, 10], [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT], [sanitize(params.companyName).toUpperCase(), timePart], {});
  await BluetoothEscposPrinter.setBlob(0); // normal

  // Şantiye adı
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText(sanitize(params.jobSiteName).toUpperCase() + '\n', {});

  // Ayırıcı
  await BluetoothEscposPrinter.printText(SEP + '\n', {});

  // ── Detay satırları ──────────────────────────────────────────────────────
  await BluetoothEscposPrinter.printText(`Tarih   : ${datePart}\n`, {});
  await BluetoothEscposPrinter.printText(`Seri No : ${params.serialNumber}\n`, {});
  await BluetoothEscposPrinter.printText(`Plaka   : ${sanitize(params.plateNumber)}\n`, {});

  if (params.driverName) {
    await BluetoothEscposPrinter.printText(`Sofor   : ${sanitize(params.driverName)}\n`, {});
  }

  await BluetoothEscposPrinter.printText(`Dokum   : ${sanitize(params.dumpLocation || '-')}\n`, {});

  if (params.tonage > 0) {
    await BluetoothEscposPrinter.printText(`Tonaj   : ${params.tonage.toFixed(2)} Ton\n`, {});
  }

  // Ücret — bold (UI'da da bold)
  const ucretParts: string[] = [];
  if (params.cashAmount > 0) ucretParts.push(`${params.cashAmount.toLocaleString('tr-TR')} TL`);
  if (params.fuelAmount > 0) ucretParts.push(`${params.fuelAmount.toLocaleString('tr-TR')} Lt`);
  await BluetoothEscposPrinter.setBlob(1); // bold
  await BluetoothEscposPrinter.printText(`Ucret   : ${ucretParts.join(' / ') || '-'}\n`, {});
  await BluetoothEscposPrinter.setBlob(0); // normal

  // Durum
  await BluetoothEscposPrinter.printText(`Durum   : ${params.isPaid ? '(V) Odendi' : '(!) Bekliyor'}\n`, {});

  if (params.contactPhone) {
    await BluetoothEscposPrinter.printText(`Yetkili : ${params.contactPhone}\n`, {});
  }

  // Ayırıcı
  await BluetoothEscposPrinter.printText(SEP + '\n', {});

  // ── QR Kod — ortalı ─────────────────────────────────────────────────────
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printQRCode(params.serialNumber, 200, BluetoothEscposPrinter.ERROR_CORRECTION.H);

  // Footer
  await BluetoothEscposPrinter.printText('\nHafriyApp\n', {});
  await BluetoothEscposPrinter.printText('www.hafriyapp.com\n', {});

  // Kağıt besleme
  await BluetoothEscposPrinter.printText('\n\n\n', {});
}

// ─── Yardımcılar ────────────────────────────────────────────────────────────

/**
 * Termal yazıcılar ASCII dışı karakterleri desteklemeyebilir.
 * Türkçe özel karakterleri ASCII karşılıklarına çevirir.
 */
function sanitize(text: string): string {
  return text.replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c');
}
