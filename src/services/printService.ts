import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore — native bridge module, no types
import { BluetoothManager, BluetoothEscposPrinter } from 'react-native-bluetooth-escpos-printer';

const PRINTER_KEY = '@hafriyapp/bt_printer_address';
const PRINTER_NAME_KEY = '@hafriyapp/bt_printer_name';

export const RECEIPT_IMAGE_PRINT_OPTIONS = { width: 384 } as const;
export const RECEIPT_PRINT_FEED = '\n\n\n\n';
export const RECEIPT_CAPTURE_LAYOUT = {
  outerWidth: 384,
  outerHeight: 760,
  bleedX: 16,
  bleedY: 12,
  frameInset: 8,
  printRightGap: 20,
  bottomSafeArea: 56,
} as const;

export const getReceiptCaptureLayout = () => {
  const outerWidth = RECEIPT_CAPTURE_LAYOUT.outerWidth;
  const outerHeight = RECEIPT_CAPTURE_LAYOUT.outerHeight;
  const contentWidth = outerHeight + RECEIPT_CAPTURE_LAYOUT.bleedY;
  const contentHeight = outerWidth + RECEIPT_CAPTURE_LAYOUT.bleedX;

  return {
    ...RECEIPT_CAPTURE_LAYOUT,
    contentWidth,
    contentHeight,
    translateX: (outerWidth - contentWidth) / 2,
    translateY: (outerHeight - contentHeight) / 2,
    frameBottom: RECEIPT_CAPTURE_LAYOUT.frameInset + 14,
  };
};

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

export interface PrinterReadyResult {
  status: 'connected' | 'needs-selection' | 'connect-failed';
  device?: BluetoothDevice;
}

// ─── Permissions ────────────────────────────────────────────────────────────

export async function requestBluetoothPermissions(): Promise<boolean> {
  // iOS: CoreBluetooth izni sistem tarafından otomatik yönetilir,
  // ilk CBCentralManager init'inde kullanıcıya gösterilir.
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
    // iOS "true"/"false" string döndürür, Android boolean döndürür
    if (typeof enabled === 'string') return enabled === 'true';
    return !!enabled;
  } catch {
    return false;
  }
}

export async function enableBluetooth(): Promise<boolean> {
  // iOS: Bluetooth programatik olarak açılamaz.
  // Sistem zaten CoreBluetooth üzerinden uyarı gösterir.
  if (Platform.OS === 'ios') return false;

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

  // iOS'ta CBCentralManager init sonrası hazır olması için kısa bekleme
  if (Platform.OS === 'ios') {
    await new Promise<void>(resolve => setTimeout(resolve, 800));
  }

  const result = await BluetoothManager.scanDevices();
  const data: { paired?: any; found?: any } = typeof result === 'string' ? JSON.parse(result) : result;

  // iOS'ta paired/found bazen JSON string olarak gelir, bazen array — her ikisini de destekle
  const parseList = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  };

  const toDevice = (d: any): BluetoothDevice => ({
    // iOS'ta d.name yoksa UUID'ye düşmesin — anlaşılır bir fallback kullan
    name: d.name?.trim() || 'Bilinmeyen Cihaz',
    // iOS: adres, MAC değil CBPeripheral UUID'dir (örn. "12345678-ABCD-...")
    address: d.address || d.id || '',
  });

  return {
    // iOS'ta 'paired' kavramı yoktur; tüm BLE cihazlar 'found'da gelir
    paired: parseList(data.paired).map(toDevice),
    found: parseList(data.found).map(toDevice),
  };
}

// ─── Bağlantı ───────────────────────────────────────────────────────────────

export async function connectPrinter(address: string): Promise<boolean> {
  if (!address) return false;

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

const CONNECT_TIMEOUT_MS = 8_000;

function withConnectTimeout(address: string): Promise<void> {
  return Promise.race([
    BluetoothManager.connect(address) as Promise<void>,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('connect-timeout')), CONNECT_TIMEOUT_MS),
    ),
  ]);
}

async function connectResolvedPrinter(): Promise<BluetoothDevice> {
  const saved = await getSavedPrinter();
  if (!saved) {
    throw new Error('Kayitli yazici bulunamadi. Yazici secim ekranindan bir yazici secin.');
  }

  try {
    await withConnectTimeout(saved.address);
    return saved;
  } catch {
    throw new Error(`"${saved.name}" yazicisina baglanamadi. Yazicinin acik ve yakin oldugundan emin olun.`);
  }
}

export async function ensurePrinterReady(): Promise<PrinterReadyResult> {
  await ensureBluetoothPermission();

  const enabled = await isBluetoothEnabled();
  if (!enabled) {
    throw new Error('Bluetooth kapali. Yazdirmadan once Bluetooth\'u acip tekrar deneyin.');
  }

  const saved = await getSavedPrinter();
  if (!saved) {
    return { status: 'needs-selection' };
  }

  try {
    await withConnectTimeout(saved.address);
    return {
      status: 'connected',
      device: saved,
    };
  } catch {
    // Kayıtlı yazıcıyı silme — kullanıcı tekrar denemek isteyebilir
    return { status: 'connect-failed', device: saved };
  }
}

// ─── Yazdırma ───────────────────────────────────────────────────────────────

export const PRINT_IMAGE_TIMEOUT_MS = 30_000;

function withPrintTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Yazici cevap vermedi. Yazicinin acik ve baglantida oldugundan emin olup tekrar deneyin.')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * View'dan yakalanan base64 PNG'yi yazıcıya gönderir.
 * Kayıtlı yazıcı varsa önce bağlanır, sonra görsel gönderir.
 * Native BLE callback'i kaybolursa UI sonsuz kilitlenmesin diye timeout uygulanır.
 */
export async function printImage(base64: string): Promise<void> {
  await ensureBluetoothPermission();

  await connectResolvedPrinter();

  await withPrintTimeout(BluetoothEscposPrinter.printerInit(), PRINT_IMAGE_TIMEOUT_MS);
  await withPrintTimeout(BluetoothEscposPrinter.printPic(base64, RECEIPT_IMAGE_PRINT_OPTIONS), PRINT_IMAGE_TIMEOUT_MS);
  await withPrintTimeout(BluetoothEscposPrinter.printText(RECEIPT_PRINT_FEED, {}), PRINT_IMAGE_TIMEOUT_MS);
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
