import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SectionList, FlatList, TouchableOpacity, Modal, ScrollView, TextInput, Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Pressable, Alert, Image, RefreshControl, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../hooks';
import BluetoothPrinterModal from '../../components/BluetoothPrinterModal';
import { deleteVehicle, getVehicles, updateVehicle, createVehicle, assignDriver, getVehicleDriver, removeDriver } from '../../services/vehicleService';
import { getHauls, updateHaulPayment, getHaulById, HaulApi } from '../../services/haulService';
import { QRScannerModal, ScannedQRData } from '../../components/QRScannerModal';
import { PlateScannerModal } from '../../components/PlateScannerModal';
import { getCompanyById } from '../../services/userService';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { ensurePrinterReady, printImage, clearSavedPrinter, getReceiptCaptureLayout } from '../../services/printService';
import RNBlobUtil from 'react-native-blob-util';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';

const YELLOW = '#FFD500';
const GRAY = '#F4F4F4';
const DARK = '#222';

/* ================= DATA ================= */
type VehicleApi = {
  id: string;
  plateNumber: string;
  canEdit: boolean;
  canDelete: boolean;
  createdDate: string;
  companyName?: string;
};
type VehicleUI = {
  id: string;
  plate: string;
  canEdit: boolean;
  canDelete: boolean;
  createdDate: string;
  companyName?: string;
  driverName?: string | null;
};

// Sabit trips kaldırıldı — gerçek API verisi kullanılıyor

const resolveReceiptLogo = (path?: string | null): any => {
  if (!path) return require('../../../assets/icons/truck.png');
  if (path.startsWith('data:image')) return { uri: path };

  const fullUrl = path.startsWith('http')
    ? path
    : (path.startsWith('/uploads') || path.startsWith('/'))
    ? `https://api.hafriyapp.com${path}`
    : null;

  if (fullUrl) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    return { uri: `${fullUrl}${separator}v=${Date.now()}` };
  }

  return { uri: `data:image/png;base64,${path}` };
};

/* ================= SCREEN ================= */

export default function SupplierVehicles() {
  const [activeTab, setActiveTab] = useState<'vehicles' | 'trips'>('vehicles');

  const [vehicleModal, setVehicleModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [sections, setSections] = useState<{ title: string; data: VehicleUI[][] }[]>([]);
  const [vehicles, setVehicles] = useState<VehicleUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [initialPlate, setInitialPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [addVehicleModal, setAddVehicleModal] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');

  const [driver, setDriver] = useState<{
    id: string;
    name: string;
    phone: string;
  } | null>(null); // null olursa şoför yok

  const [driverRemoved, setDriverRemoved] = useState(false);
  const [driverFetching, setDriverFetching] = useState(false);

  const [receiptVisible, setReceiptVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<HaulApi | null>(null);
  const [cachedCompanyLogoPath, setCachedCompanyLogoPath] = useState<string | null>(null);

  // ── Yazdırma
  const [printTargetHaul, setPrintTargetHaul] = useState<HaulApi | null>(null);
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [pendingPrintBase64, setPendingPrintBase64] = useState<string | null>(null);
  const printReceiptRef = useRef<View>(null);

  // Seferler (Hauls)
  const [hauls, setHauls] = useState<HaulApi[]>([]);
  const [haulsLoading, setHaulsLoading] = useState(false);
  const [haulsRefreshing, setHaulsRefreshing] = useState(false);
  const [haulsError, setHaulsError] = useState<string | null>(null);
  const [confirmPaymentModal, setConfirmPaymentModal] = useState(false);
  const [paymentHaul, setPaymentHaul] = useState<HaulApi | null>(null);
  const [paymentType, setPaymentType] = useState<0 | 1>(0); // 0=Nakit, 1=Yakıt
  const [paymentCash, setPaymentCash] = useState('');
  const [paymentFuel, setPaymentFuel] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [haulFilter, setHaulFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [excelDownloading, setExcelDownloading] = useState(false);

  const token = useAppSelector(state => state.auth.token);
  const user = useAppSelector(state => state.auth.user);
  const companyId = useAppSelector(state => state.auth.companyId) || user?.companyId;

  const normalizePhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length === 12) return '+' + digits;
    if (digits.startsWith('0') && digits.length === 11) return '+90' + digits.substring(1);
    if (digits.startsWith('5') && digits.length === 10) return '+90' + digits;
    if (digits.length === 10) return '+90' + digits;
    return '+' + digits;
  };

  const handleCreateVehicle = async () => {
    if (!token || !companyId) {
      Alert.alert('Hata', 'Firma bilgisi eksik. Lütfen tekrar giriş yapın.');
      return;
    }
    if (!newPlate) {
      Alert.alert('Eksik Bilgi', 'Lütfen plaka giriniz.');
      return;
    }
    const rawPhone = newDriverPhone.replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) {
      Alert.alert('Eksik Bilgi', 'Lütfen şoför telefon numarasını giriniz.');
      return;
    }

    try {
      setSaving(true);
      const plateForApi = normalizedPlate(newPlate);
      const driverPhoneNumber = normalizePhoneNumber(rawPhone);

      await createVehicle(plateForApi, companyId, driverPhoneNumber, token);

      Alert.alert('Başarılı', 'Araç ve şoför başarıyla eklendi.');
      setAddVehicleModal(false);
      setNewPlate('');
      setNewDriverPhone('');
      fetchVehicles();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Araç eklenirken bir sorun oluştu.';
      Alert.alert('Hata', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDriver = async () => {
    if (!token || !selectedVehicle?.id || !driver?.id) return;

    try {
      setSaving(true);
      await removeDriver(selectedVehicle.id, driver.id, token);

      setDriver(null);
      setDriverRemoved(true);
      setNewDriverPhone('');
      Keyboard.dismiss();

      Alert.alert('Başarılı', 'Şoför başarıyla kaldırıldı.');
    } catch (error: any) {
      console.log('Remove driver error:', error);
      Alert.alert('Hata', 'Şoför kaldırılırken bir sorun oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!token || !selectedVehicle?.id || !newDriverPhone) return;

    // Sadece rakamları al
    const cleanPhone = newDriverPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası giriniz.');
      return;
    }

    try {
      setSaving(true);
      console.log('👤 Assigning Driver:', selectedVehicle.id, cleanPhone);

      await assignDriver(selectedVehicle.id, cleanPhone, token);

      Alert.alert('Başarılı', 'Şoför ataması yapıldı.');

      // Modal kapat ve yenile
      setVehicleModal(false);
      setSelectedVehicle(null);
      setNewDriverPhone('');
      fetchVehicles();
    } catch (error: any) {
      console.log('Assign Driver error:', error);
      const errorMsg = error.response?.data?.message || 'Şoför atanırken bir sorun oluştu.';
      Alert.alert('Hata', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  /* ================= ACTIONS ================= */
  const formatDateDMY = (isoDate: string) => {
    if (!isoDate) return '-';

    const date = new Date(isoDate);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  };

  const formatPhone = (value: string) => {
    // sadece rakamları al
    const digits = value.replace(/\D/g, '').slice(0, 11);

    // 0XXX XXX XX XX
    const part1 = digits.slice(0, 4);
    const part2 = digits.slice(4, 7);
    const part3 = digits.slice(7, 9);
    const part4 = digits.slice(9, 11);

    let formatted = part1;

    if (part2) formatted += ` ${part2}`;
    if (part3) formatted += ` ${part3}`;
    if (part4) formatted += ` ${part4}`;

    return formatted;
  };

  const mapVehicleFromApi = (item: VehicleApi): VehicleUI => ({
    id: item.id,
    plate: item.plateNumber.toUpperCase().replace(/^(\d{2})([A-Z]+)(\d+)$/, '$1 $2 $3'), // 11ASD1234 → 11 ASD 1234
    canEdit: item.canEdit,
    canDelete: item.canDelete,
    createdDate: item.createdDate,
    companyName: item.companyName,
  });
  const normalizedPlate = (value: string) => value.replace(/\s/g, '').toUpperCase();

  const isPlateChanged = normalizedPlate(plate) !== normalizedPlate(initialPlate);

  const handleDeleteVehicle = async () => {
    if (!token || !selectedVehicle?.id) return;

    try {
      setDeleting(true);
      console.log('🗑 handleDeleteVehicle:', selectedVehicle.id);

      await deleteVehicle(selectedVehicle.id, token);

      // modal & confirm kapat
      setDeleteConfirm(false);
      setVehicleModal(false);
      setSelectedVehicle(null);

      // listeyi yenile
      await fetchVehicles();

      console.log('✅ Araç silindi ve liste güncellendi');
    } catch (err) {
      console.log('❌ handleDeleteVehicle error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const driverMissing = !driverFetching && driver === null && newDriverPhone.replace(/\D/g, '').length < 10;

  const handleCloseVehicleModal = () => {
    if (driverMissing) {
      Alert.alert('Şoför Numarası Gerekli', 'Şoför numarası boş geçilemez. Şoför yoksa kendi numaranızı yazın.', [{ text: 'Tamam' }]);
      return;
    }
    Keyboard.dismiss();
    setVehicleModal(false);
  };

  const handleUpdatePlate = async () => {
    if (!token || !selectedVehicle?.id) return;

    if (driverMissing) {
      Alert.alert('Şoför Numarası Gerekli', 'Şoför numarası boş geçilemez. Şoför yoksa kendi numaranızı yazın.');
      return;
    }

    try {
      setSaving(true);

      const plateForApi = normalizedPlate(plate);

      console.log('✏️ Güncellenecek plaka:', plateForApi);

      await updateVehicle(selectedVehicle.id, plateForApi, selectedVehicle.companyId, token);

      // modal kapat
      setVehicleModal(false);
      setSelectedVehicle(null);

      // listeyi yenile
      await fetchVehicles();

      console.log('✅ Plaka güncellendi');
    } catch (e) {
      console.log('❌ handleUpdatePlate error:', e);
    } finally {
      setSaving(false);
    }
  };

  const openVehicleDetail = async (item: any) => {
    setSelectedVehicle(item);
    setPlate(item.plate);
    setDriverRemoved(false);
    setVehicleModal(true);
    setDriver(null);
    setDriverFetching(true);

    if (!token) {
      setDriverFetching(false);
      return;
    }

    try {
      const driverData = await getVehicleDriver(item.id, token);
      if (driverData) {
        const displayName = driverData.displayName || [driverData.firstName, driverData.lastName].filter(Boolean).join(' ') || driverData.phoneNumber;

        setDriver({
          id: driverData.id || driverData.userId || '',
          name: displayName,
          phone: driverData.phoneNumber,
        });
      } else {
        setDriver(null);
      }
    } catch (err) {
      console.log('Driver fetch error:', err);
      setDriver(null);
    } finally {
      setDriverFetching(false);
    }
  };

  const confirmDeleteWithAlert = () => {
    Alert.alert('Aracı Sil', 'Bu işlem geri alınamaz. Emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: handleDeleteVehicle,
      },
    ]);
  };

  const normalizeReceiptHaul = (item: HaulApi): HaulApi => {
    const normalizedPlate = (item.plateNumber || '').replace(/\s/g, '').toUpperCase();
    const matchedVehicle = vehicles.find(v => v.plate.replace(/\s/g, '').toUpperCase() === normalizedPlate);
    return {
      ...item,
      contactPhone: item.contactPhone || (item as any).ContactPhone || user?.phoneNumber || undefined,
      driverName: item.driverName || (item as any).DriverName || matchedVehicle?.driverName || undefined,
      driverPhone: item.driverPhone || (item as any).DriverPhone || undefined,
      companyLogoPath: item.companyLogoPath || (item as any).CompanyLogoPath || cachedCompanyLogoPath || undefined,
      companyName: item.companyName || (item as any).CompanyName || user?.companyName || undefined,
    };
  };

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [plateScannerVisible, setPlateScannerVisible] = useState(false);

  const openReceipt = (item: HaulApi) => {
    console.log('[FİŞ] Ham API verisi:', JSON.stringify(item, null, 2));
    setSelectedTrip(normalizeReceiptHaul(item));
    setReceiptVisible(true);
  };

  const handleQRScan = async (scanned: ScannedQRData) => {
    const cleanScannedPlate = scanned.plateNumber?.replace(/\s/g, '').toUpperCase();

    // 1. Araç Yetkisi Kontrolü
    if (cleanScannedPlate) {
      const isMyVehicle = vehicles.some(v => v.plate.replace(/\s/g, '').toUpperCase() === cleanScannedPlate);
      if (!isMyVehicle) {
        Alert.alert('Yetkisiz Sefer', 'Bu sefer fişi sizin veya firmanızın araçlarına ait değildir.');
        return;
      }
    }

    // 2. Mevcut listede eşleşen seferi ara
    const matched = hauls.find(h =>
      (scanned.haulId && h.id.toLowerCase() === scanned.haulId.toLowerCase()) ||
      (scanned.serialNumber && autoSerial(h) === scanned.serialNumber) ||
      (scanned.raw && (h.id.toLowerCase() === scanned.raw.toLowerCase() || autoSerial(h) === scanned.raw))
    );

    if (matched) {
      openReceipt(matched);
      return;
    }

    // 3. Listede yoksa API'den çek
    if (scanned.haulId && token) {
      try {
        const res = await getHaulById(token, scanned.haulId);
        if (res) {
          const resPlate = res.plateNumber?.replace(/\s/g, '').toUpperCase();
          const isMyVehicle = vehicles.some(v => v.plate.replace(/\s/g, '').toUpperCase() === resPlate);
          if (isMyVehicle) {
            openReceipt(res);
            return;
          } else {
            Alert.alert('Yetkisiz Sefer', 'Bu sefer fişi sizin veya firmanızın araçlarına ait değildir.');
            return;
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 403 || err?.response?.status === 401) {
          Alert.alert('Erişim Engellendi', 'Bu sefere ait bilgileri ve fişi görüntüleme yetkiniz bulunmamaktadır.');
          return;
        }
      }
    }

    // 4. Plaka veya Seri Numarası ile arama kutusunu filtrele
    if (scanned.plateNumber) {
      setHaulFilter(scanned.plateNumber);
    } else if (scanned.serialNumber) {
      setHaulFilter(scanned.serialNumber);
    } else {
      Alert.alert('Bulunamadı', 'Okutulan QR koda ait sefer araçlarınız arasında bulunamadı.');
    }
  };

  const getAuthorizedContact = (haul?: HaulApi | null) => {
    return haul?.contactPhone || user?.phoneNumber || '-';
  };

  const reopenPrinterSelection = useCallback(async (base64: string) => {
    await clearSavedPrinter();
    setPendingPrintBase64(base64);
    setReceiptVisible(false);
    await new Promise<void>(resolve => setTimeout(resolve, 400));
    setPrinterModalVisible(true);
  }, []);

  const finishPrintFlow = useCallback(() => {
    setPrinterModalVisible(false);
    setReceiptVisible(false);
    setPrintTargetHaul(null);
    setPendingPrintBase64(null);
  }, []);

  const openPaymentConfirm = (item: HaulApi) => {
    setPaymentHaul(item);
    const hasCash = (item.cashAmount ?? 0) > 0;
    const hasFuel = (item.fuelAmount ?? 0) > 0;
    setPaymentType(!hasCash && hasFuel ? 1 : 0);
    setPaymentCash(hasCash ? String(item.cashAmount) : '');
    setPaymentFuel(hasFuel ? String(item.fuelAmount) : '');
    setConfirmPaymentModal(true);
  };

  // ── Yazdır (Bluetooth görsel fiş)
  const triggerPrint = async (haul: HaulApi) => {
    setPrintTargetHaul(normalizeReceiptHaul(haul));
    await new Promise<void>(resolve => setTimeout(resolve, 300));
    if (!printReceiptRef.current) {
      Alert.alert('Hata', 'Fiş görünümü hazırlanamadı, tekrar deneyin.');
      return;
    }
    let base64: string;
    try {
      base64 = await captureRef(printReceiptRef, {
        format: 'png',
        quality: 1.0,
        result: 'base64',
      });
    } catch (e) {
      Alert.alert('Görüntü Hatası', 'Fiş yakalanamadı: ' + String(e));
      return;
    }
    try {
      const printerState = await ensurePrinterReady();
      if (printerState.status === 'needs-selection') {
        await reopenPrinterSelection(base64);
        return;
      }
      if (printerState.status === 'connect-failed') {
        await reopenPrinterSelection(base64);
        return;
      }
      try {
        await printImage(base64);
      } finally {
        finishPrintFlow();
      }
    } catch (e: any) {
      const message = e?.message || String(e);
      if (message.includes('YETKI_ENGEL:') || message.includes('yetkiniz bulunmamaktadır') || message.includes('tanımlı değil')) {
        Alert.alert(
          'Yetkisiz Yazıcı',
          'Bu yazıcı için fiş kesme yetkiniz bulunmamaktadır. Lütfen şirketiniz tarafından tanımlanmış yetkili yazıcıyı kullanınız.',
          [
            { text: 'Tamam', style: 'cancel' },
            {
              text: 'Yeni Cihaz Tara',
              onPress: async () => {
                await clearSavedPrinter();
                await reopenPrinterSelection(base64);
              },
            },
          ],
        );
        return;
      }
      if (/bluetooth|yazici|printer/i.test(message)) {
        await reopenPrinterSelection(base64);
        return;
      }
      Alert.alert('Yazdırma Hatası', message);
    }
  };

  const handlePrinterConnected = useCallback(async () => {
    // Modal'ı hemen kapat — printImage'ı beklemeden
    setPrinterModalVisible(false);
    const base64 = pendingPrintBase64;
    setPendingPrintBase64(null);
    if (!base64) return;
    try {
      try {
        await printImage(base64);
      } finally {
        finishPrintFlow();
      }
    } catch (e: any) {
      const message = e?.message || String(e);
      if (message.includes('YETKI_ENGEL:') || message.includes('yetkiniz bulunmamaktadır') || message.includes('tanımlı değil')) {
        Alert.alert(
          'Yetkisiz Yazıcı',
          'Bu yazıcı için fiş kesme yetkiniz bulunmamaktadır. Lütfen şirketiniz tarafından tanımlanmış yetkili yazıcıyı kullanınız.',
          [
            { text: 'Tamam', style: 'cancel' },
            {
              text: 'Yeni Cihaz Tara',
              onPress: async () => {
                await clearSavedPrinter();
                setPrinterModalVisible(true);
              },
            },
          ],
        );
        return;
      }
      Alert.alert('Yazdırma Hatası', message || 'Yazıcıya basılamadı.');
    }
  }, [finishPrintFlow, pendingPrintBase64, reopenPrinterSelection]);

  const formatHaulDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hour}:${min}`;
  };

  const paymentLabel = (haul: HaulApi) => {
    if (haul.paymentType === 0) return haul.cashAmount > 0 ? `${haul.cashAmount}₺` : 'Nakit';
    if (haul.paymentType === 1) return haul.fuelAmount > 0 ? `${haul.fuelAmount}Lt` : 'Yakıt';
    if (haul.paymentType === 2) {
      const parts = [];
      if (haul.cashAmount > 0) parts.push(`${haul.cashAmount}₺`);
      if (haul.fuelAmount > 0) parts.push(`${haul.fuelAmount}Lt`);
      return parts.length > 0 ? parts.join('+') : 'Nakit+Yakıt';
    }
    return '-';
  };

  const fetchVehicles = async () => {
    if (!token) return; // ✅ burada null engellenir

    try {
      setLoading(true);
      setError(null);

      const data = await getVehicles(token); // artık TS mutlu
      const mapped = data.map(mapVehicleFromApi);

      // Batch-fetch driver names
      const driverResults = await Promise.all(mapped.map((v: VehicleUI) => getVehicleDriver(v.id, token).catch(() => null)));
      const mappedWithDrivers: VehicleUI[] = mapped.map((v: VehicleUI, i: number) => {
        const d = driverResults[i];
        const driverName = d ? d.displayName || [d.firstName, d.lastName].filter(Boolean).join(' ') || d.phoneNumber || null : null;
        return { ...v, driverName };
      });

      setVehicles(mappedWithDrivers);

      // İkişerli grupla (2 kolon grid)
      const chunkedData: VehicleUI[][] = [];
      for (let i = 0; i < mappedWithDrivers.length; i += 2) {
        chunkedData.push(mappedWithDrivers.slice(i, i + 2));
      }
      setSections([{ title: '', data: chunkedData }]);
    } catch (e) {
      setError('Araçlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const downloadFilteredExcel = async () => {
    if (!token) return;
    setExcelDownloading(true);
    try {
      const year = filterYear ?? new Date().getFullYear();
      const month = filterMonth ?? new Date().getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      const monthLabel = filterMonth ? `${year}_${String(month).padStart(2, '0')}` : String(year);
      const res = await RNBlobUtil.config({ fileCache: true, appendExt: 'xlsx' }).fetch('GET', `https://api.hafriyapp.com/api/Haul/my/filtered/export?startDate=${startDate}&endDate=${endDate}`, {
        Authorization: `Bearer ${token}`,
      });
      const path = res.path();
      if (Platform.OS === 'ios') {
        await RNBlobUtil.ios.openDocument(path);
      } else {
        await RNBlobUtil.android.actionViewIntent(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
    } catch {
      Alert.alert('Hata', 'Excel dosyası indirilemedi.');
    } finally {
      setExcelDownloading(false);
    }
  };

  const fetchHauls = async () => {
    if (!token) return;
    try {
      setHaulsLoading(true);
      setHaulsError(null);
      const data = await getHauls(token);
      const sorted = [...data].sort((a, b) => new Date(b.timeOfHaul).getTime() - new Date(a.timeOfHaul).getTime());
      setHauls(sorted);
    } catch {
      setHaulsError('Seferler yüklenemedi');
    } finally {
      setHaulsLoading(false);
    }
  };

  const onHaulsRefresh = useCallback(async () => {
    if (!token) return;
    setHaulsRefreshing(true);
    try {
      const data = await getHauls(token);
      const sorted = [...data].sort((a, b) => new Date(b.timeOfHaul).getTime() - new Date(a.timeOfHaul).getTime());
      setHauls(sorted);
      setHaulsError(null);
    } catch {
      setHaulsError('Seferler yüklenemedi');
    } finally {
      setHaulsRefreshing(false);
    }
  }, [token]);

  const handleConfirmPayment = async () => {
    if (!token || !paymentHaul) return;
    try {
      setPaymentSaving(true);
      await updateHaulPayment(
        {
          haulId: paymentHaul.id,
          isPaid: true,
          paymentType,
          cashAmount: paymentType === 0 ? parseFloat(paymentCash) || 0 : 0,
          fuelAmount: paymentType === 1 ? parseFloat(paymentFuel) || 0 : 0,
          tonage: paymentHaul.tonage,
          dumpLocation: paymentHaul.dumpLocation,
        },
        token,
      );
      setConfirmPaymentModal(false);
      setPaymentHaul(null);
      setPaymentCash('');
      setPaymentFuel('');
      Alert.alert('Başarılı', 'Ödeme onaylandı.');
      fetchHauls();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Ödeme onaylanırken hata oluştu.';
      Alert.alert('Hata', msg);
    } finally {
      setPaymentSaving(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchVehicles();
      fetchHauls();
      if (token && companyId) {
        getCompanyById(companyId, token)
          .then(res => {
            const companyData = res?.isSuccess ? res.data : res?.data || res;
            const path = companyData?.logoPath || companyData?.LogoPath || null;
            if (path) setCachedCompanyLogoPath(path);
          })
          .catch(() => {});
      }
    }, [token, companyId])
  );

  /* ================= RENDERS ================= */

  const renderVehicle = ({ item }: { item: VehicleUI[] }) => (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {item.map(vehicle => (
        <TouchableOpacity key={vehicle.id} style={[styles.vehicleCard, { flex: 1 }]} activeOpacity={0.85} onPress={() => openVehicleDetail(vehicle)}>
          <View style={styles.plateBox}>
            <View style={styles.plateTrStrip}>
              <Text style={styles.plateTrText}>TR</Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={styles.plateText} numberOfLines={1}>{vehicle.plate}</Text>
            </View>
          </View>
          {vehicle.driverName ? <Text style={styles.vehicleDriverName}>{vehicle.driverName}</Text> : <Text style={styles.vehicleNoDriver}>Şoför Atanmamış</Text>}
          <Text style={styles.vehicleDate}>Kayıt: {formatDateDMY(vehicle.createdDate)}</Text>
        </TouchableOpacity>
      ))}
      {item.length === 1 && <View style={{ flex: 1 }} />}
    </View>
  );

  const renderSectionHeader = () => null;

  const autoSerial = (haul: HaulApi) => {
    if (haul.serialNumber) return haul.serialNumber;
    const d = new Date(haul.createdDate);
    const datePart = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const idPart = haul.id.substring(0, 4).toUpperCase();
    return `${datePart}${idPart}`;
  };

  const copyWithFeedback = (value: string, key: string) => {
    Clipboard.setString(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Mevcut haul listesinden benzersiz yılları çıkar
  const availableYears = Array.from(new Set(hauls.map(h => new Date(h.timeOfHaul).getFullYear()))).sort((a, b) => b - a);

  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  // ── Sefer arama yardımcıları (Plaka, Şantiye, Döküm Yeri, Tarih, Şoför, Seri No)
  const getHaulDateStrings = (dateIso?: string): string[] => {
    if (!dateIso) return [];
    const d = new Date(dateIso.endsWith('Z') ? dateIso : dateIso + 'Z');
    if (isNaN(d.getTime())) return [];

    const tr = new Date(d.getTime() + 3 * 3600 * 1000);
    const day = String(tr.getUTCDate()).padStart(2, '0');
    const month = String(tr.getUTCMonth() + 1).padStart(2, '0');
    const year = String(tr.getUTCFullYear());
    const hour = String(tr.getUTCHours()).padStart(2, '0');
    const min = String(tr.getUTCMinutes()).padStart(2, '0');

    const monthNamesTR = [
      'ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
      'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık',
    ];
    const monthName = monthNamesTR[tr.getUTCMonth()] || '';

    return [
      `${day}.${month}.${year}`,
      `${day}.${month}`,
      `${month}.${year}`,
      `${day}/${month}/${year}`,
      `${day}/${month}`,
      `${day}-${month}-${year}`,
      `${day}-${month}`,
      `${day} ${monthName} ${year}`,
      `${day} ${monthName}`,
      monthName,
      year,
      `${hour}:${min}`,
    ];
  };

  const matchesHaulSearch = (h: HaulApi, query: string): boolean => {
    if (!query || !query.trim()) return true;
    const q = query.trim().toLowerCase();
    const qClean = q.replace(/\s/g, '');

    // 1. Plaka
    const plate = (h.plateNumber || '').toLowerCase();
    const plateClean = plate.replace(/\s/g, '');
    if (plateClean.includes(qClean) || plate.includes(q)) return true;

    // 2. Seri No
    const serial = autoSerial(h).toLowerCase();
    const serialClean = serial.replace(/\s/g, '');
    const rawSerial = (h.serialNumber || '').toLowerCase().replace(/\s/g, '');
    if (serialClean.includes(qClean) || serial.includes(q) || rawSerial.includes(qClean)) return true;

    // 3. Döküm Sahası / Yeri
    const dump = (h.dumpLocation || '').toLowerCase();
    if (dump.includes(q)) return true;

    // 4. Şantiye Adı
    const jobSite = (h.jobSiteName || '').toLowerCase();
    if (jobSite.includes(q)) return true;

    // 5. Şoför Adı
    const driver = (h.driverName || '').toLowerCase();
    if (driver.includes(q)) return true;

    // 6. Rota / Teklif Adı / Not
    const offer1 = (h.offer1Name || '').toLowerCase();
    const offer2 = (h.offer2Name || '').toLowerCase();
    const note = (h.note || '').toLowerCase();
    if (offer1.includes(q) || offer2.includes(q) || note.includes(q)) return true;

    // 7. Tarih ve Saat Eşleşmeleri
    const timeDates = getHaulDateStrings(h.timeOfHaul);
    const createdDates = getHaulDateStrings(h.createdDate);
    const allDates = [...timeDates, ...createdDates];
    for (const dt of allDates) {
      if (dt.toLowerCase().includes(q)) return true;
    }

    return false;
  };

  // Aktif filtreye göre gösterilecek sefer listesi
  const filteredHauls = hauls.filter(h => {
    const d = new Date(h.timeOfHaul);
    if (filterYear !== null && d.getFullYear() !== filterYear) return false;
    if (filterMonth !== null && d.getMonth() + 1 !== filterMonth) return false;
    if (haulFilter && !matchesHaulSearch(h, haulFilter)) return false;
    return true;
  });

  const todayInFiltered = filteredHauls.filter(h => isToday(h.timeOfHaul)).length;

  const formatUpdatedDate = (dateString?: string) => {
    if (!dateString || dateString.startsWith('0001-01-01')) return '';
    const utcMs = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z').getTime();
    if (!isNaN(utcMs)) {
      const tr = new Date(utcMs + 3 * 3600 * 1000);
      const day = String(tr.getUTCDate()).padStart(2, '0');
      const month = String(tr.getUTCMonth() + 1).padStart(2, '0');
      const year = tr.getUTCFullYear();
      const hour = String(tr.getUTCHours()).padStart(2, '0');
      const min = String(tr.getUTCMinutes()).padStart(2, '0');
      return `${day}.${month}.${year} ${hour}:${min}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const isHaulUpdated = (item: any): boolean => {
    if (item?.isUpdated !== undefined) return Boolean(item.isUpdated);
    if (item?.IsUpdated !== undefined) return Boolean(item.IsUpdated);
    return false;
  };

  const renderTrip = ({ item }: { item: HaulApi }) => {
    const today = isToday(item.timeOfHaul);
    const paid = item.isPaid;

    return (
      <View style={[styles.haulCard, paid ? styles.haulCardPaid : styles.haulCardUnpaid, today && styles.haulCardToday]}>
        {/* Üst Satır: Seri No + Bugün Badge */}
        <View style={styles.haulCardTopRow}>
          <View style={styles.serialBox}>
            <TouchableOpacity onPress={() => copyWithFeedback(autoSerial(item), `${item.id}-sn`)} activeOpacity={0.7}>
              <Text style={[styles.serialAuto, copiedKey === `${item.id}-sn` && styles.serialCopied]}>
                {copiedKey === `${item.id}-sn` ? '✓ ' : ''}
                {autoSerial(item)}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {today && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayText}>Bugün</Text>
              </View>
            )}
            {paid && (
              <View style={styles.statusPaid}>
                <Text style={styles.statusPaidText}>✔ Ödendi</Text>
              </View>
            )}
            {isHaulUpdated(item) && (
              <View style={styles.updatedBadge}>
                <Text style={styles.updatedBadgeText}>✏️ Düzenlendi</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tarih + Plaka & Nakit / Mazot / Tonaj */}
        <View style={styles.haulCardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.haulDateText}>{formatHaulDate(item.timeOfHaul)}</Text>
            <Text style={styles.haulPlateText}>{item.plateNumber}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {item.tonage > 0 && (
              <Text style={styles.tonageText}>
                {(item.tonage / 1000).toFixed(2)} t
              </Text>
            )}
            {(item.cashAmount ?? 0) > 0 && (
              <View style={styles.cashBadge}>
                <Text style={styles.cashBadgeText}>
                  {(item.cashAmount ?? 0).toLocaleString('tr-TR')} ₺
                </Text>
              </View>
            )}
            {(item.fuelAmount ?? 0) > 0 && (
              <View style={styles.fuelBadge}>
                <Text style={styles.fuelBadgeText}>
                  {(item.fuelAmount ?? 0).toLocaleString('tr-TR')} Lt
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Yükleme → Döküm */}
        <View style={styles.haulCardRow}>
          <Text style={styles.haulSiteLabel} numberOfLines={1}>
            📍 {item.jobSiteName || item.companyName || '-'}
          </Text>
          {item.dumpLocation ? (
            <Text style={styles.haulDumpText} numberOfLines={1}>
              → {item.dumpLocation}
            </Text>
          ) : null}
        </View>

        {/* Alt Butonlar */}
        <View style={styles.haulCardActions}>
          <TouchableOpacity style={styles.haulFisBtn} onPress={() => openReceipt(item)}>
            <Text style={styles.haulFisBtnText}>👁 Fiş</Text>
          </TouchableOpacity>

          {!paid && !item.isPrintedReceipt ? (
            <TouchableOpacity style={styles.haulApproveBtn} onPress={() => openPaymentConfirm(item)}>
              <Text style={styles.haulApproveBtnText}>Ödeme</Text>
            </TouchableOpacity>
          ) : paid ? (
            <View style={styles.haulApprovedTag}>
              <Text style={styles.haulApprovedTagText}>✔ Onaylı</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* HEADER */}
      <Text style={styles.title}>Araç Yönetimi</Text>
      <Text style={styles.subTitle}>Araç listeniz ve yönetim işlemleri</Text>

      {/* TABS */}
      <View style={styles.tabRow}>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'vehicles' && styles.tabActive]} onPress={() => setActiveTab('vehicles')}>
            <Text style={activeTab === 'vehicles' ? styles.tabTextActive : styles.tabText}>Araçlar ({vehicles.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tabBtn, activeTab === 'trips' && styles.tabActive]} onPress={() => setActiveTab('trips')}>
            <Text style={activeTab === 'trips' ? styles.tabTextActive : styles.tabText}>Seferler ({filteredHauls.length})</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'trips' ? (
          <TouchableOpacity style={styles.addBtn} onPress={onHaulsRefresh} disabled={haulsRefreshing}>
            <Text style={styles.addBtnText}>{haulsRefreshing ? '⏳ Yenileniyor...' : '🔄 Yenile'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVehicleModal(true)}>
            <Text style={styles.addBtnText}>＋ Yeni Araç Ekle</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ================= VEHICLES ================= */}
      {activeTab === 'vehicles' && <SectionList sections={sections} keyExtractor={item => item[0].id} renderItem={renderVehicle} renderSectionHeader={renderSectionHeader} contentContainerStyle={{ paddingTop: 12, paddingBottom: 20, gap: 10, paddingHorizontal: 5 }} stickySectionHeadersEnabled={false} renderSectionFooter={() => <View style={{ height: 10 }} />} />}

      {/* ================= TRIPS ================= */}
      {activeTab === 'trips' && (
        <>
          {/* Özet Çubuğu */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#E65100' }]}>{todayInFiltered}</Text>
              <Text style={styles.summaryLabel}>Bugün</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>{filteredHauls.filter(h => h.isPaid).length}</Text>
              <Text style={styles.summaryLabel}>Ödendi</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#E53935' }]}>{filteredHauls.filter(h => !h.isPaid).length}</Text>
              <Text style={styles.summaryLabel}>Bekliyor</Text>
            </View>
            <View style={styles.summaryDivider} />
            <TouchableOpacity style={styles.summaryExcelBtn} onPress={downloadFilteredExcel} disabled={excelDownloading}>
              <Text style={styles.summaryExcelText}>{excelDownloading ? '⏳' : '⬇ Excel'}</Text>
            </TouchableOpacity>
          </View>

          {/* Filtre satırı */}
          {!haulsLoading && !haulsError && hauls.length > 0 && (
            <>
              {/* Metin arama & QR */}
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Plaka, şantiye, döküm yeri, tarih..."
                    placeholderTextColor="#aaa"
                    value={haulFilter}
                    onChangeText={setHaulFilter}
                    autoCapitalize="none"
                  />
                  {haulFilter.length > 0 && (
                    <TouchableOpacity onPress={() => setHaulFilter('')}>
                      <Text style={styles.searchClear}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity style={styles.qrScanBtn} onPress={() => setQrModalVisible(true)} activeOpacity={0.8}>
                  <Text style={styles.qrScanBtnText}>📷 QR</Text>
                </TouchableOpacity>
              </View>

              {/* Yıl / Ay filtresi */}
              <View style={styles.dateFilterRow}>
                <TouchableOpacity style={[styles.dateFilterBtn, filterYear !== null && styles.dateFilterBtnActive]} onPress={() => setYearPickerVisible(true)}>
                  <Text style={[styles.dateFilterBtnText, filterYear !== null && styles.dateFilterBtnTextActive]}>📅 {filterYear !== null ? String(filterYear) : 'Yıl'}</Text>
                  {filterYear !== new Date().getFullYear() && filterYear !== null && (
                    <TouchableOpacity
                      onPress={() => {
                        setFilterYear(new Date().getFullYear());
                        setFilterMonth(new Date().getMonth() + 1);
                      }}
                      style={styles.dateFilterClear}>
                      <Text style={styles.dateFilterClearText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateFilterBtn, filterMonth !== null && styles.dateFilterBtnActive]}
                  onPress={() => {
                    if (filterYear !== null) setMonthPickerVisible(true);
                    else setMonthPickerVisible(true);
                  }}>
                  <Text style={[styles.dateFilterBtnText, filterMonth !== null && styles.dateFilterBtnTextActive]}>🗓 {filterMonth !== null ? TR_MONTHS[filterMonth - 1] : 'Ay'}</Text>
                  {filterMonth !== null && filterMonth !== new Date().getMonth() + 1 && (
                    <TouchableOpacity onPress={() => setFilterMonth(new Date().getMonth() + 1)} style={styles.dateFilterClear}>
                      <Text style={styles.dateFilterClearText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {haulFilter ? (
                  <TouchableOpacity style={styles.dateFilterResetBtn} onPress={() => setHaulFilter('')}>
                    <Text style={styles.dateFilterResetText}>Temizle</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}

          {haulsLoading ? (
            <View style={styles.centerBox}>
              <Text style={styles.loadingText}>Seferler yükleniyor...</Text>
            </View>
          ) : haulsError ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{haulsError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchHauls}>
                <Text style={styles.retryText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          ) : hauls.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={{ fontSize: 40 }}>🚛</Text>
              <Text style={styles.emptyText}>Henüz sefer kaydı yok.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredHauls}
              keyExtractor={i => i.id}
              renderItem={renderTrip}
              contentContainerStyle={{ paddingBottom: 20, gap: 10 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={haulsRefreshing} onRefresh={onHaulsRefresh} colors={['#1976D2']} tintColor="#1976D2" />}
              ListEmptyComponent={
                <View style={styles.centerBox}>
                  <Text style={styles.emptyText}>Filtre sonucu bulunamadı.</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* ================= VEHICLE DETAIL MODAL ================= */}
      <Modal visible={vehicleModal} transparent animationType="fade" onRequestClose={handleCloseVehicleModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center' }}>
                <View style={styles.editCard}>
                  {/* HEADER */}
                  <View style={styles.headerRow}>
                    <Text style={styles.editTitle}>🚚 Araç Düzenle</Text>

                    <Pressable onPress={handleCloseVehicleModal}>
                      <Text style={styles.closeX}>✕</Text>
                    </Pressable>
                  </View>

                  {/* SUCCESS */}
                  {driverRemoved && (
                    <View style={styles.successBox}>
                      <Text style={styles.successText}>✔ Şoför başarıyla kaldırıldı.</Text>
                    </View>
                  )}

                  {/* PLAKA */}
                  <Text style={styles.label}>Plaka Numarası *</Text>
                  <TextInput value={plate} onChangeText={setPlate} style={styles.plateInput} placeholder="Plaka giriniz" autoCapitalize="characters" />

                  {/* ACTIONS */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.saveBtn, !isPlateChanged && { opacity: 0.5 }]} disabled={!isPlateChanged || saving} onPress={handleUpdatePlate}>
                      <Text style={styles.saveText}>{saving ? 'Kaydediliyor…' : '✔ Kaydet'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmDeleteWithAlert} disabled={deleting}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{deleting ? 'Siliniyor...' : 'Plakayı Sil'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  {/* DRIVER */}
                  <Text style={styles.section}>👤 Şoför Bilgisi</Text>

                  {driver ? (
                    <View style={styles.driverCard}>
                      <View>
                        <Text style={styles.driverName}>{driver.name}</Text>
                        <Text style={styles.driverPhone}>{driver.phone}</Text>
                      </View>

                      <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveDriver}>
                        <Text style={styles.removeText}>Kaldır</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={styles.warningBox}>
                        <Text style={styles.warningText}>⚠ Bu araca henüz şoför atanmamış. Aşağıdan şoför atayabilirsiniz.</Text>
                      </View>

                      <Text style={styles.label}>Şoför Telefon Numarası *</Text>

                      <View style={styles.assignRow}>
                        <TextInput
                          value={newDriverPhone}
                          onChangeText={text => setNewDriverPhone(formatPhone(text))} //newDriverPhone.replace(/\s/g, '') servise giderken boşlukları siler
                          style={styles.phoneInput}
                          keyboardType="phone-pad"
                          placeholder="05__ ___ __ __"
                          maxLength={14}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                        />

                        <TouchableOpacity style={[styles.assignBtn, !newDriverPhone && { opacity: 0.5 }]} disabled={!newDriverPhone || saving} onPress={handleAssignDriver}>
                          <Text style={styles.assignText}>👤 Şoför Ata</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.helpText}>ℹ Şoför olarak atanacak kişinin telefon numarasını girin.</Text>
                      <Text style={styles.helpText}>💡 Şoför yoksa kendi numaranızı yazın.</Text>
                    </>
                  )}
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>

        {/* DELETE CONFIRM */}
        <Modal visible={deleteConfirm} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <Text style={{ fontSize: 16, fontWeight: '800', marginBottom: 10 }}>Aracı silmek istiyor musunuz?</Text>
              <Text style={{ color: '#666', marginBottom: 20 }}>Bu işlem geri alınamaz.</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteConfirm(false)}>
                  <Text>Vazgeç</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.confirmDeleteBtn}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Modal>

      {/* ================= RECEIPT MODAL ================= */}
      {selectedTrip && (
        <Modal visible={receiptVisible} transparent animationType="fade" onRequestClose={() => setReceiptVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.receiptWrapper}>
              {/* ── Fiş Kart ── */}
              <View style={styles.receiptCard}>
                {/* Sol dikey şerit */}
                <View style={styles.receiptStrip}>
                  <Text style={styles.receiptStripText}>HAFRİYAPP</Text>
                </View>

                {/* Ana içerik */}
                <View style={styles.receiptMain}>
                  {/* Başlık: Logo + Firma/Şantiye + Saat */}
                  <View style={styles.receiptHead}>
                    <View style={styles.receiptLogoBox}>
                      <Image
                        source={resolveReceiptLogo(selectedTrip.companyLogoPath || cachedCompanyLogoPath)}
                        style={styles.receiptLogoImg}
                        resizeMode={selectedTrip.companyLogoPath || cachedCompanyLogoPath ? "cover" : "contain"}
                      />
                    </View>
                    <View style={styles.receiptCompanyBlock}>
                      <Text style={styles.receiptCompany}>{(selectedTrip.companyName || user?.companyName || '').toUpperCase()}</Text>
                      <Text style={styles.receiptJobsite}>{(selectedTrip.jobSiteName || '').toUpperCase()}</Text>
                    </View>
                    <Text style={styles.receiptBigTime}>{new Date(selectedTrip.timeOfHaul).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>

                  {/* Gövde: Satırlar (sol) + QR (sağ) */}
                  <View style={styles.receiptBodyWrap}>
                    <View style={styles.receiptBody}>
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Tarih :</Text>
                        <Text style={styles.receiptRowValue}>{new Date(selectedTrip.timeOfHaul).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Seri No :</Text>
                        <Text style={styles.receiptRowValue}>{autoSerial(selectedTrip)}</Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Plaka :</Text>
                        <Text style={styles.receiptRowValue}>{selectedTrip.plateNumber}</Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Şoför :</Text>
                        <Text style={styles.receiptRowValue}>{selectedTrip.driverName && selectedTrip.driverPhone && selectedTrip.driverName !== selectedTrip.driverPhone ? `${selectedTrip.driverName} - ${selectedTrip.driverPhone}` : selectedTrip.driverName || selectedTrip.driverPhone || '-'}</Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Döküm :</Text>
                        <Text style={styles.receiptRowValue}>{selectedTrip.dumpLocation || '-'}</Text>
                      </View>

                      {selectedTrip.tonage > 0 && (
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptRowLabel}>Tonaj :</Text>
                          <Text style={styles.receiptRowValue}>{selectedTrip.tonage.toFixed(2)} Ton</Text>
                        </View>
                      )}

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Ücret :</Text>
                        <Text style={[styles.receiptRowValue, { fontWeight: '800' }]}>{[selectedTrip.cashAmount > 0 ? `${selectedTrip.cashAmount.toLocaleString('tr-TR')}₺` : '', selectedTrip.fuelAmount > 0 ? `${selectedTrip.fuelAmount.toLocaleString('tr-TR')}lt` : ''].filter(Boolean).join(' / ') || '-'}</Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Durum :</Text>
                        <Text
                          style={[
                            styles.receiptRowValue,
                            {
                              color: selectedTrip.isPaid ? '#2E7D32' : '#E65100',
                              fontWeight: '800',
                            },
                          ]}>
                          {selectedTrip.isPaid ? '✔ Ödendi' : '⏳ Bekliyor'}
                        </Text>
                      </View>

                      {isHaulUpdated(selectedTrip) && (
                        <View style={[styles.receiptRow, { backgroundColor: '#FFFBEB', paddingVertical: 4, borderRadius: 4 }]}>
                          <Text style={[styles.receiptRowLabel, { color: '#D97706', fontWeight: '700' }]}>Düzenleme Tarihi :</Text>
                          <Text style={[styles.receiptRowValue, { color: '#D97706', fontWeight: '800' }]}>
                            {formatUpdatedDate(selectedTrip.updatedDate || (selectedTrip as any).UpdatedDate)}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.receiptRowLabel}>Yetkili :</Text>
                        <Text style={styles.receiptRowValue}>{getAuthorizedContact(selectedTrip)}</Text>
                      </View>
                    </View>

                    {/* QR Kod — sağ taraf */}
                    {selectedTrip.qrCodeBase64 && (
                      <View style={styles.receiptQRBox}>
                        <Image source={{ uri: `data:image/png;base64,${selectedTrip.qrCodeBase64}` }} style={styles.receiptQRImg} />
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Footer butonlar — kart dışında */}
              <View style={styles.receiptFooterRow}>
                <TouchableOpacity style={styles.receiptCloseBtnNew} onPress={() => setReceiptVisible(false)}>
                  <Text style={styles.receiptCloseBtnNewText}>Kapat</Text>
                </TouchableOpacity>
                {!selectedTrip.isPaid && !selectedTrip.isPrintedReceipt ? (
                  <TouchableOpacity
                    style={styles.receiptApproveBtnNew}
                    onPress={() => {
                      setReceiptVisible(false);
                      openPaymentConfirm(selectedTrip);
                    }}>
                    <Text style={styles.receiptApproveBtnNewText}>Ödeme</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ═══════════════ GİZLİ PRINT VIEW (görünmez, 0,0 konumunda) ═══════════════ */}
      {printTargetHaul &&
        (() => {
          const ph = printTargetHaul;
          const layout = getReceiptCaptureLayout();
          // Logo resolved inline via resolveReceiptLogo
          const timeStr = new Date(ph.timeOfHaul).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          const dateStr = new Date(ph.timeOfHaul).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const ucretStr = [ph.cashAmount > 0 ? `${ph.cashAmount.toLocaleString('tr-TR')}₺` : '', ph.fuelAmount > 0 ? `${ph.fuelAmount.toLocaleString('tr-TR')}lt` : ''].filter(Boolean).join(' / ') || '-';
          const rows = [
            { label: 'Tarih :', value: dateStr },
            { label: 'Seri No :', value: autoSerial(ph) },
            { label: 'Plaka :', value: ph.plateNumber },
            { label: 'Şoför :', value: ph.driverName && ph.driverPhone && ph.driverName !== ph.driverPhone ? `${ph.driverName} - ${ph.driverPhone}` : ph.driverName || ph.driverPhone || '-' },
            { label: 'Döküm :', value: ph.dumpLocation || '-' },
            { label: 'Ücret :', value: ucretStr },
            { label: 'Yetkili :', value: getAuthorizedContact(ph) },
          ];
          const OW = layout.outerWidth;
          const OH = layout.outerHeight;
          const FRAME_INSET = layout.frameInset;
          const PRINT_RIGHT_GAP = layout.printRightGap;
          const FRAME_BOTTOM = layout.frameBottom;
          const CW = layout.contentWidth;
          const CH = layout.contentHeight;
          const tx = layout.translateX;
          const ty = layout.translateY;
          const BOTTOM_SAFE_AREA = layout.bottomSafeArea;
          return (
            <View pointerEvents="none" style={{ position: 'absolute', top: -10000, left: 0 }}>
              <View ref={printReceiptRef} collapsable={false} style={{ width: OW, height: OH, overflow: 'hidden', backgroundColor: '#fff' }}>
                <View
                  style={{
                    width: CW,
                    height: CH,
                    transform: [{ translateX: tx }, { translateY: ty }, { rotate: '90deg' }],
                    backgroundColor: '#ffffff',
                    paddingTop: 40,
                    paddingRight: 22,
                    paddingBottom: 26,
                    paddingLeft: 22,
                  }}>
                  <View
                    style={{
                      position: 'absolute',
                      top: FRAME_INSET + PRINT_RIGHT_GAP,
                      right: FRAME_INSET,
                      bottom: FRAME_BOTTOM,
                      left: FRAME_INSET,
                      borderWidth: 3,
                      borderColor: '#000000',
                      borderRadius: 16,
                    }}
                  />
                  <Text style={{ position: 'absolute', top: 34, right: 12, fontSize: 22, fontWeight: '700', color: '#000' }}>{timeStr}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4, paddingRight: 60 }}>
                    <View
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 27,
                        borderWidth: 2,
                        borderColor: '#000',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                        overflow: 'hidden',
                      }}>
                      <Image
                        source={resolveReceiptLogo(ph.companyLogoPath || cachedCompanyLogoPath)}
                        style={ph.companyLogoPath || cachedCompanyLogoPath ? { width: 46, height: 46, borderRadius: 23 } : { width: 40, height: 40 }}
                        resizeMode={ph.companyLogoPath || cachedCompanyLogoPath ? "cover" : "contain"}
                      />
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.5, color: '#000', textAlign: 'center' }}>{(ph.companyName || user?.companyName || 'HAFRİYAT').toUpperCase()}</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', letterSpacing: 0.3, color: '#000', textAlign: 'center', marginTop: 2 }}>{(ph.jobSiteName || '-').toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'stretch', flex: 1 }}>
                    <View style={{ width: 34, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Text
                        style={{
                          fontSize: 30,
                          fontWeight: '900',
                          letterSpacing: 4,
                          color: '#000',
                          transform: [{ rotate: '-90deg' }],
                          width: 240,
                          textAlign: 'center',
                        }}>
                        HAFRİYAPP
                      </Text>
                    </View>
                    <View style={{ flex: 1, justifyContent: 'space-between' }}>
                      {rows.map(({ label, value }) => (
                        <View
                          key={label}
                          style={{
                            minHeight: 36,
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            borderBottomWidth: 1.5,
                            borderStyle: 'dotted',
                            borderColor: '#000',
                            paddingBottom: 2,
                          }}>
                          <Text style={{ color: '#888', fontWeight: '700', width: 108, fontSize: 18 }}>{label}</Text>
                          <Text style={{ fontWeight: '700', color: '#000', fontSize: 18, flex: 1 }}>{value}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ width: 128, justifyContent: 'flex-end', alignItems: 'flex-end', marginLeft: 14 }}>
                      <View style={{ width: 120, height: 120, borderWidth: 2, borderColor: '#000', borderRadius: 8, padding: 5, backgroundColor: '#fff' }}>
                        <QRCode value={autoSerial(ph) || 'HAFRIYAPP'} size={106} color="#000" backgroundColor="#fff" />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        })()}

      {/* ================= ÖDEME ONAY MODAL ================= */}
      <Modal visible={confirmPaymentModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <View style={styles.paymentCard}>
                <View style={styles.headerRow}>
                  <Text style={styles.editTitle}>💰 Ödeme Onayla</Text>
                  <Pressable onPress={() => setConfirmPaymentModal(false)}>
                    <Text style={styles.closeX}>✕</Text>
                  </Pressable>
                </View>

                {paymentHaul && (
                  <View style={styles.paymentInfoBox}>
                    <Text style={styles.paymentInfoPlate}>{paymentHaul.plateNumber}</Text>
                    <Text style={styles.paymentInfoDate}>{formatHaulDate(paymentHaul.timeOfHaul)}</Text>
                    <Text style={styles.paymentInfoSite}>{paymentHaul.jobSiteName}</Text>
                  </View>
                )}

                {/* Ödeme Türü Seçimi */}
                <Text style={styles.label}>Ödeme Türü</Text>
                <View style={styles.payTypeRow}>
                  <TouchableOpacity style={[styles.payTypeBtn, paymentType === 0 && styles.payTypeActive, !((paymentHaul?.cashAmount ?? 0) > 0) && { opacity: 0.35 }]} onPress={() => setPaymentType(0)} disabled={!((paymentHaul?.cashAmount ?? 0) > 0)}>
                    <Text style={[styles.payTypeText, paymentType === 0 && styles.payTypeTextActive]}>💵 Nakit (₺)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.payTypeBtn, paymentType === 1 && styles.payTypeActive, !((paymentHaul?.fuelAmount ?? 0) > 0) && { opacity: 0.35 }]} onPress={() => setPaymentType(1)} disabled={!((paymentHaul?.fuelAmount ?? 0) > 0)}>
                    <Text style={[styles.payTypeText, paymentType === 1 && styles.payTypeTextActive]}>⛽ Yakıt (Lt)</Text>
                  </TouchableOpacity>
                </View>

                {paymentType === 0 ? (
                  <>
                    <Text style={styles.label}>Nakit Tutar (₺)</Text>
                    <TextInput value={paymentCash} editable={false} style={[styles.plateInput, styles.inputReadonly]} />
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Yakıt Miktarı (Litre)</Text>
                    <TextInput value={paymentFuel} editable={false} style={[styles.plateInput, styles.inputReadonly]} />
                  </>
                )}

                <TouchableOpacity style={[styles.saveBigBtn, paymentSaving && { opacity: 0.6 }]} onPress={handleConfirmPayment} disabled={paymentSaving}>
                  <Text style={styles.saveBigText}>{paymentSaving ? 'Kaydediliyor...' : '✔ Ödemeyi Onayla'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setConfirmPaymentModal(false)}>
                  <Text style={styles.cancelText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* ================= New vehicle MODAL ================= */}
      <Modal visible={addVehicleModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center' }}>
                <View style={styles.addCard}>
                  {/* HEADER */}
                  <View style={styles.addHeader}>
                    <Text style={styles.addIcon}>🚚</Text>
                    <Text style={styles.addTitle}>Yeni Araç Ekle</Text>
                  </View>

                  {/* PLAKA */}
                  <View style={{ padding: '5%' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={styles.label}>PLAKA NUMARASI *</Text>
                      <TouchableOpacity
                        style={styles.plateScanBtn}
                        onPress={() => setPlateScannerVisible(true)}
                        activeOpacity={0.8}>
                        <Text style={styles.plateScanBtnText}>📷 Plaka Tara</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput value={newPlate} onChangeText={setNewPlate} style={styles.plateInput} placeholder="34 ABC 123" autoCapitalize="characters" />
                    <Text style={styles.hint}>ℹ Örn: 34 ABC 123</Text>

                    <View style={styles.divider} />

                    {/* DRIVER PHONE */}
                    <Text style={styles.label}>ŞOFÖR TELEFON NUMARASI *</Text>
                    <TextInput
                      value={newDriverPhone}
                      onChangeText={text => setNewDriverPhone(formatPhone(text))}
                      style={styles.phoneInput}
                      keyboardType="phone-pad"
                      placeholder="05__ ___ __ __"
                      maxLength={14} // boşluklar dahil
                    />

                    <Text style={styles.helpText}>ℹ Şoförün telefon numarasını girin.</Text>
                    <Text style={styles.helpText}>💡 Kendiniz kullanacaksanız kendi numaranızı yazın.</Text>

                    {/* SAVE */}
                    <TouchableOpacity style={[styles.saveBigBtn, (!newPlate || newDriverPhone.replace(/\D/g, '').length < 10) && { opacity: 0.5 }]} disabled={!newPlate || newDriverPhone.replace(/\D/g, '').length < 10 || saving} onPress={handleCreateVehicle}>
                      <Text style={styles.saveBigText}>✔ Aracı Kaydet</Text>
                    </TouchableOpacity>

                    {/* CANCEL */}
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setAddVehicleModal(false);
                        setNewPlate('');
                        setNewDriverPhone('');
                      }}>
                      <Text style={styles.cancelText}>İptal</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
        <PlateScannerModal
          visible={plateScannerVisible}
          onClose={() => setPlateScannerVisible(false)}
          onPlateDetected={plate => setNewPlate(plate)}
        />
      </Modal>

      <BluetoothPrinterModal
        visible={printerModalVisible}
        onClose={() => {
          setPrinterModalVisible(false);
          setPendingPrintBase64(null);
        }}
        onConnected={handlePrinterConnected}
      />

      {/* ================= YIL SEÇİCİ ================= */}
      <Modal visible={yearPickerVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setYearPickerVisible(false)}>
          <View style={styles.pickerOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerHeaderText}>Yıl Seçin</Text>
                  <TouchableOpacity onPress={() => setYearPickerVisible(false)}>
                    <Text style={styles.pickerHeaderClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={availableYears}
                  keyExtractor={y => String(y)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, filterYear === item && styles.pickerItemActive]}
                      onPress={() => {
                        setFilterYear(item);
                        setFilterMonth(null);
                        setYearPickerVisible(false);
                      }}>
                      <Text style={[styles.pickerItemText, filterYear === item && styles.pickerItemTextActive]}>{item}</Text>
                      {filterYear === item && <Text style={{ color: '#1976D2', fontWeight: '800' }}>✔</Text>}
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ================= AY SEÇİCİ ================= */}
      <Modal visible={monthPickerVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setMonthPickerVisible(false)}>
          <View style={styles.pickerOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerHeaderText}>Ay Seçin — {filterYear}</Text>
                  <TouchableOpacity onPress={() => setMonthPickerVisible(false)}>
                    <Text style={styles.pickerHeaderClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={TR_MONTHS.map((name, i) => ({ name, month: i + 1 }))}
                  keyExtractor={m => String(m.month)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, filterMonth === item.month && styles.pickerItemActive]}
                      onPress={() => {
                        setFilterMonth(item.month);
                        setMonthPickerVisible(false);
                      }}>
                      <Text style={[styles.pickerItemText, filterMonth === item.month && styles.pickerItemTextActive]}>{item.name}</Text>
                      {filterMonth === item.month && <Text style={{ color: '#1976D2', fontWeight: '800' }}>✔</Text>}
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <QRScannerModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        onScan={handleQRScan}
        title="Araç Sefer Fişi Okutun"
      />
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEA', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },

  title: { fontSize: 22, fontWeight: '800', color: DARK },
  subTitle: { fontSize: 13, color: '#777', marginBottom: 12 },

  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
  },

  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  tabActive: { backgroundColor: YELLOW },

  tabText: { color: '#777', fontWeight: '600' },
  tabTextActive: { color: '#222', fontWeight: '700' },

  addBtn: {
    backgroundColor: YELLOW,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },

  addBtnText: { fontWeight: '700' },

  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 1.22,

    elevation: 3,
  },

  plateBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 2.5,
    borderColor: '#111',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#fff',
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  plateTrStrip: {
    backgroundColor: '#003DA5',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 5,
    paddingBottom: 5,
    paddingTop: 3,
    minWidth: 24,
  },
  plateTrText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  plateText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  vehicleInfo: { fontSize: 12, color: '#444' },
  vehicleDate: { fontSize: 11, color: '#999', marginTop: 4 },
  vehicleDriverName: { fontSize: 12, color: '#444', marginTop: 4 },
  vehicleNoDriver: { fontSize: 12, color: '#E53E3E', marginTop: 4, fontStyle: 'italic' },

  approveBtn: {
    backgroundColor: YELLOW,
    width: 60,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  approveText: { fontSize: 11, fontWeight: '700' },

  // Arama kutusu
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    flex: 1,
    marginBottom: 0,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: 10,
  },

  qrScanBtn: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  qrScanBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  searchIcon: { fontSize: 14, marginRight: 8 },

  plateScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },

  plateScanBtnText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '700',
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: DARK,
  },

  searchClear: {
    fontSize: 14,
    color: '#aaa',
    paddingHorizontal: 4,
  },

  // Haul Card
  haulCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },

  haulCardPaid: {
    backgroundColor: '#fff',
    borderLeftColor: '#4CAF50',
  },

  haulCardUnpaid: {
    backgroundColor: '#FFFDE7',
    borderLeftColor: '#FFC107',
  },

  haulCardToday: {
    borderLeftColor: '#1565C0',
  },

  haulCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  serialBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  serialAuto: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#555',
    fontWeight: '600',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  serialCustom: {
    fontSize: 11,
    color: '#1565C0',
    fontWeight: '700',
  },

  serialCopied: { backgroundColor: '#E8F5E9', color: '#2E7D32' },

  todayBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  todayText: {
    fontSize: 10,
    color: '#1565C0',
    fontWeight: '700',
  },

  updatedBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },

  updatedBadgeText: {
    fontSize: 10,
    color: '#E65100',
    fontWeight: '700',
  },

  statusPaid: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  statusPaidText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '700',
  },

  statusPending: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FFC107',
  },

  statusPendingText: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '700',
  },

  haulCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },

  haulDateText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },

  haulPlateText: {
    fontSize: 17,
    fontWeight: '800',
    color: DARK,
    letterSpacing: 1,
  },

  tonageText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'right',
  },

  cashBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },

  cashBadgeText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '700',
  },

  fuelBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },

  fuelBadgeText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '700',
  },

  haulSiteLabel: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
    flex: 1,
  },

  haulDumpText: {
    fontSize: 12,
    color: '#888',
    flex: 1,
    textAlign: 'right',
  },

  haulNoteText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginBottom: 6,
  },

  haulCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  haulFisBtn: {
    borderWidth: 1.5,
    borderColor: '#1565C0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  haulFisBtnText: {
    color: '#1565C0',
    fontSize: 12,
    fontWeight: '700',
  },

  haulApproveBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },

  haulApproveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  haulApprovedTag: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  haulApprovedTagText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  detailCard: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },

  detailPlate: { fontSize: 18, fontWeight: '800', marginBottom: 10 },

  closeText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#555',
  },
  editCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },

  editHeader: {
    marginBottom: 14,
  },

  editTitle: {
    fontSize: 20,
    fontWeight: '800',
  },

  label: {
    marginTop: 10,
    fontWeight: '600',
    color: '#666',
  },

  inputBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    marginTop: 6,
  },

  inputText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
  },

  saveBtn: {
    backgroundColor: '#F5A623',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 10,
  },

  saveText: {
    color: '#fff',
    fontWeight: '700',
  },

  backBtn: {
    backgroundColor: '#777',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },

  backText: {
    color: '#fff',
    fontWeight: '700',
  },

  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 20,
  },

  section: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },

  driverCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  driverName: {
    fontWeight: '700',
    fontSize: 15,
  },

  driverPhone: {
    color: '#F5A623',
    marginTop: 4,
  },

  removeBtn: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },

  removeText: {
    color: '#FF3B30',
    fontWeight: '700',
  },

  successBox: {
    backgroundColor: '#EAF7EA',
    borderColor: '#4CAF50',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  successText: {
    color: '#2E7D32',
    fontWeight: '600',
  },

  warningBox: {
    backgroundColor: '#FFF4E5',
    borderColor: '#FF9800',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },

  warningText: {
    color: '#E65100',
    fontWeight: '600',
  },

  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginRight: 10,
    fontSize: 15,
  },

  assignBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },

  assignText: {
    color: '#fff',
    fontWeight: '700',
  },

  helpText: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  plateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  inputReadonly: {
    backgroundColor: '#F0F0F0',
    borderColor: '#e0e0e0',
    color: '#555',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  closeX: {
    fontSize: 22,
    fontWeight: '700',
    color: '#555',
  },

  deleteBtn: {
    backgroundColor: '#FFEAEA',
    borderWidth: 1,
    borderColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },

  deleteText: {
    color: '#FF3B30',
    fontWeight: '700',
  },

  confirmCard: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },

  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#eee',
  },

  confirmDeleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
  },
  addCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
  },

  addHeader: {
    backgroundColor: '#F5A623',
    paddingVertical: 26,
    alignItems: 'center',
  },

  addIcon: {
    fontSize: 36,
    color: '#fff',
    marginBottom: 6,
  },

  addTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },

  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },

  saveBigBtn: {
    backgroundColor: '#0A66FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 26,
  },

  saveBigText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  cancelText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#999',
    fontSize: 14,
  },

  sectionHeader: {
    backgroundColor: '#FFFBEA',
    paddingVertical: 10,
    marginTop: 10,
  },

  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },

  // Özet çubuğu
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: DARK },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#EEEEEE' },
  summaryExcelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryExcelText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },

  // Haul / Trips stiller (legacy — kept for compatibility)
  haulSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  haulSummaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  haulSummaryNum: {
    fontSize: 22,
    fontWeight: '800',
    color: DARK,
  },

  haulSummaryLabel: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },

  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  loadingText: {
    color: '#777',
    fontSize: 14,
  },

  errorText: {
    color: '#E65100',
    fontSize: 14,
    marginBottom: 12,
  },

  emptyText: {
    color: '#777',
    fontSize: 14,
    marginTop: 10,
  },

  retryBtn: {
    backgroundColor: YELLOW,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },

  retryText: {
    fontWeight: '700',
  },

  paidBadge: {
    backgroundColor: '#EAF7EA',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  paidText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: '700',
  },

  receiptWrapper: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 12,
  },
  receiptCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  receiptStrip: {
    width: 38,
    backgroundColor: '#2c2c2c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptStripText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    transform: [{ rotate: '-90deg' }],
    width: 140,
    textAlign: 'center',
  },
  receiptMain: { flex: 1 },
  receiptHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
  },
  receiptLogoBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  receiptLogoImg: {
    width: 44,
    height: 44,
  },
  receiptCompanyBlock: {
    flex: 1,
    marginLeft: 10,
  },
  receiptCompany: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 0.2,
  },
  receiptJobsite: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
    marginTop: 2,
  },
  receiptBigTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    marginLeft: 6,
  },
  receiptBodyWrap: {
    flexDirection: 'row',
    paddingLeft: 14,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  receiptBody: {
    flex: 1,
    minWidth: 0,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    borderStyle: 'dashed',
  },
  receiptRowLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    width: 68,
  },
  receiptRowValue: {
    fontSize: 13,
    color: '#111',
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
  },
  receiptQRBox: {
    width: 82,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
    paddingLeft: 6,
  },
  receiptQRImg: {
    width: 76,
    height: 76,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  receiptFooterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  receiptCloseBtnNew: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#bbb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  receiptCloseBtnNewText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 15,
  },
  receiptPrintBtnNew: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPrintBtnNewText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  receiptApproveBtnNew: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptApproveBtnNewText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Payment Modal
  paymentCard: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    alignSelf: 'center',
  },

  paymentInfoBox: {
    backgroundColor: GRAY,
    borderRadius: 12,
    padding: 14,
    marginVertical: 14,
  },

  paymentInfoPlate: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
    marginBottom: 4,
  },

  paymentInfoDate: {
    fontSize: 12,
    color: '#888',
  },

  paymentInfoSite: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
    fontWeight: '600',
  },

  payTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },

  payTypeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },

  payTypeActive: {
    borderColor: YELLOW,
    backgroundColor: '#FFFBEA',
  },

  payTypeText: {
    fontWeight: '600',
    color: '#888',
  },

  payTypeTextActive: {
    color: DARK,
    fontWeight: '800',
  },

  // ── Yıl/Ay filtre satırı
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  dateFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  dateFilterBtnActive: {
    borderColor: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  dateFilterBtnText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  dateFilterBtnTextActive: {
    color: '#1976D2',
    fontWeight: '800',
  },
  dateFilterClear: {
    marginLeft: 4,
    padding: 2,
  },
  dateFilterClearText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '700',
  },
  dateFilterResetBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  dateFilterResetText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '700',
  },
  filterResultText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },

  // ── Picker modal (yıl/ay)
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerHeaderText: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK,
  },
  pickerHeaderClose: {
    fontSize: 20,
    color: '#888',
    fontWeight: '700',
    padding: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  pickerItemActive: {
    backgroundColor: '#E3F2FD',
  },
  pickerItemText: {
    fontSize: 16,
    color: DARK,
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: '#1976D2',
    fontWeight: '800',
  },
  pickerSeparator: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
  },
});
