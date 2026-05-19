import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Image, Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, AppState, Share, RefreshControl, ActionSheetIOS,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { getJobHauls, getJobSite, deleteJobSite, forceDeleteJobSite, updateJobSite } from '../../services/jobSiteNewService';
import RNBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NewJobModal from '../../components/NewJobModal';
import { createHaul, updateHaulPayment, deleteHaul, HaulApi } from '../../services/haulService';
import { getCompanyById } from '../../services/userService';
import {
  addPendingHaul,
  removePendingHaul,
  PendingHaul,
} from '../../store/slices/pendingHaulSlice';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { printImage } from '../../services/printService';

const YELLOW = '#FFD500';
const DARK = '#222';

// ── İnterneti test et (netinfo paketi olmadan)
const nowTR = (): string => {
  const trMs = Date.now() + 3 * 60 * 60000;
  return new Date(trMs).toISOString().replace('Z', '');
};

const checkOnline = async (): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch('https://api.hafriyapp.com/api/user/profile', {
      method: 'HEAD',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

// ── Teklif tipi (Hafriyat: cash=sabit/trip, fuel=sabit/trip | Kum/Mıcır: cash=cashPerTon, fuel=0)
type Offer = {
  name: string;
  cash: number;
  fuel: number;
  material?: string;
  cashPerTon?: number;
  loading?: string;
  unloading?: string;
};

// ── Job'dan teklifleri parse et
const getOffersFromJob = (job: any): Offer[] => {
  const isKum = job?.jobType === 1;
  const offers: Offer[] = [];

  if (isKum) {
    // ── Kum/Mıcır: rotalar extraOffersJson içinde {loading, unloading, cash, material}
    try {
      const extras = JSON.parse(job?.extraOffersJson || '[]');
      if (Array.isArray(extras)) {
        extras.forEach((e: any) => {
          const ld = e.loading || e.Loading || '-';
          const ul = e.unloading || e.Unloading || '-';
          const cashPerTon = parseFloat(e.Cash ?? e.cash ?? 0) || 0;
          offers.push({
            name: `${ld} → ${ul}`,
            cash: cashPerTon,
            fuel: 0,
            material: e.material || e.Material || '',
            cashPerTon,
            loading: ld,
            unloading: ul,
          });
        });
      }
    } catch { }
  } else {
    // ── Hafriyat: yeni birleşik format (isVisible) veya eski offer1Name + extraOffersJson
    try {
      const extras = JSON.parse(job?.extraOffersJson || '[]');
      if (Array.isArray(extras) && extras.length > 0) {
        const hasIsVisible = 'isVisible' in extras[0] || 'IsVisible' in extras[0];
        if (hasIsVisible) {
          // Yeni format: isVisible'dan bağımsız tüm teklifleri göster (piyasada değil, işlerim içinde)
          extras
            .forEach((e: any) => {
              const name = e.name || e.Name || '-';
              const cash = parseFloat(e.cash ?? e.Cash ?? 0) || 0;
              const fuel = parseFloat(e.fuel ?? e.Fuel ?? 0) || 0;
              offers.push({ name, cash, fuel });
            });
        } else {
          // Eski format: offer1Name + extras
          if (job?.offer1Name) {
            offers.push({ name: job.offer1Name, cash: Number(job.offer1Cash) || 0, fuel: Number(job.offer1Fuel) || 0 });
          }
          if (job?.offer2Name) {
            offers.push({ name: job.offer2Name, cash: Number(job.offer2Cash) || 0, fuel: Number(job.offer2Fuel) || 0 });
          }
          extras.forEach((e: any) => {
            const name = e.Name || e.name || e.dumpLocation || e.DumpLocation;
            if (name) offers.push({ name, cash: parseFloat(e.Cash ?? e.cash ?? 0) || 0, fuel: parseFloat(e.Fuel ?? e.fuel ?? 0) || 0 });
          });
        }
      }
    } catch { }
    // Fallback: eğer JSON yoksa offer1Name'e bak
    if (offers.length === 0 && job?.offer1Name) {
      offers.push({ name: job.offer1Name, cash: Number(job.offer1Cash) || 0, fuel: Number(job.offer1Fuel) || 0 });
      if (job?.offer2Name) offers.push({ name: job.offer2Name, cash: Number(job.offer2Cash) || 0, fuel: Number(job.offer2Fuel) || 0 });
    }
  }

  return offers;
};

export default function JobDetails() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { job } = route.params || {};
  console.log('[JobDetails] job from params:', JSON.stringify(job, null, 2));
  const dispatch = useAppDispatch();

  const token = useAppSelector(state => state.auth.token);
  const user = useAppSelector(state => state.auth.user);
  const pendingQueue = useAppSelector(state => state.pendingHaul.queue);
  const isKum = job?.jobType === 1;

  const normalizeHaul = (h: HaulApi): HaulApi => ({
    ...h,
    driverName: h.driverName || (h as any).DriverName || undefined,
    driverPhone: h.driverPhone || (h as any).DriverPhone || undefined,
    companyLogoPath: h.companyLogoPath || (h as any).CompanyLogoPath || cachedCompanyLogoPath || undefined,
    companyName: h.companyName || (h as any).CompanyName || user?.companyName || undefined,
    jobSiteName: h.jobSiteName || (h as any).JobSiteName || job?.name || undefined,
  });

  // ── Ana liste
  const [selectedHaul, setSelectedHaul] = useState<HaulApi | null>(null);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [hauls, setHauls] = useState<HaulApi[]>([]);
  const [plateFilter, setPlateFilter] = useState('');
  const [cachedCompanyLogoPath, setCachedCompanyLogoPath] = useState<string | null>(null);
  const [showHaulsToOwners, setShowHaulsToOwners] = useState<boolean>(
    job?.isHaulVisibleToVehicleOwners ?? job?.showHaulsToVehicleOwners ?? true
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ── Yazdırma
  const [printTargetHaul, setPrintTargetHaul] = useState<HaulApi | null>(null);
  const printReceiptRef = useRef<View>(null);

  // ── Sefer Gir modal
  const [addModal, setAddModal] = useState(false);
  const [formPlate, setFormPlate] = useState('');
  const [selectedOfferIdx, setSelectedOfferIdx] = useState<number | null>(null);
  const [formTonage, setFormTonage] = useState('');   // Kum/Mıcır: kg
  const [formNote, setFormNote] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // ── Manuel Ekle modal (Hafriyat alanları)
  const [manualModal, setManualModal] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [manualDump, setManualDump] = useState('');
  const [manualCash, setManualCash] = useState('');
  const [manualFuel, setManualFuel] = useState('');
  const [manualTonage, setManualTonage] = useState('');
  const [manualNote, setManualNote] = useState('');
  // ── Manuel Ekle modal (Kum/Mıcır alanları)
  const [manualLoading, setManualLoading] = useState('');
  const [manualUnloading, setManualUnloading] = useState('');
  const [manualPricePerTon, setManualPricePerTon] = useState('');
  const [manualMaterial, setManualMaterial] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  // ── Son plakalar
  const [recentPlates, setRecentPlates] = useState<string[]>([]);

  const loadRecentPlates = async () => {
    try {
      const raw = await AsyncStorage.getItem('recent_plates');
      if (raw) setRecentPlates(JSON.parse(raw));
    } catch { }
  };

  const saveRecentPlate = async (plate: string) => {
    try {
      const raw = await AsyncStorage.getItem('recent_plates');
      const existing: string[] = raw ? JSON.parse(raw) : [];
      const updated = [plate, ...existing.filter(p => p !== plate)].slice(0, 10);
      await AsyncStorage.setItem('recent_plates', JSON.stringify(updated));
      setRecentPlates(updated);
    } catch { }
  };

  // ── Ayarlar: Düzenle / Yakıt Ekle / İşi Sil / İndir
  const [editModal, setEditModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteStep1Visible, setDeleteStep1Visible] = useState(false);
  const [deleteStep2Visible, setDeleteStep2Visible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fuelModal, setFuelModal] = useState(false);
  const [fuelInput, setFuelInput] = useState('');
  const [fuelSaving, setFuelSaving] = useState(false);
  const [fuelStock, setFuelStock] = useState<number>(job?.fuelStock ?? 0);

  // ── Kopyalama feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyWithFeedback = (value: string, key: string) => {
    Clipboard.setString(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // ── Ödeme Onay modal
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentHaul, setPaymentHaul] = useState<HaulApi | null>(null);
  const [paymentType, setPaymentType] = useState(0); // 0=nakit, 1=yakıt
  const [paymentCash, setPaymentCash] = useState('');
  const [paymentFuel, setPaymentFuel] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);

  const pendingForThisJob = pendingQueue.filter(h => h.jobSiteId === job?.id);
  const offers = getOffersFromJob(job);

  // ── Güncel fuelStock'u API'dan çek
  const fetchFuelStock = async () => {
    if (!token || !job?.id) return;
    try {
      const data = await getJobSite(token, job.id);
      if (data?.fuelStock != null) setFuelStock(data.fuelStock);
      const visible = data?.isHaulVisibleToVehicleOwners ?? data?.showHaulsToVehicleOwners;
      if (visible != null) setShowHaulsToOwners(visible);
    } catch { }
  };

  // ── Seferleri yükle
  const fetchHauls = async () => {
    if (!token || !job?.id) return;
    try {
      setLoading(true);
      const [data] = await Promise.all([getJobHauls(token, job.id), fetchFuelStock()]);
      setHauls(data);
    } catch (error) {
      console.log('Error fetching hauls:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (!token || !job?.id) return;
    setRefreshing(true);
    try {
      const [data] = await Promise.all([getJobHauls(token, job.id), fetchFuelStock()]);
      setHauls(data);
    } catch (error) {
      console.log('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [token, job?.id]);

  // ── Bekleyen seferleri sunucuya gönder
  const syncPending = useCallback(async () => {
    if (!token || pendingQueue.length === 0) return;
    const online = await checkOnline();
    if (!online) return;

    setSyncing(true);
    let synced = 0;
    for (const pending of pendingQueue) {
      try {
        await createHaul(
          {
            jobSiteId: pending.jobSiteId,
            plateNumber: pending.plateNumber,
            paymentType: pending.paymentType,
            tonage: pending.tonage,
            cashAmount: pending.cashAmount,
            fuelAmount: pending.fuelAmount,
            dumpLocation: pending.dumpLocation,
            note: pending.note,
            timeOfHaul: pending.timeOfHaul,
            isPrintedReceipt: pending.isPrintedReceipt,
          },
          token
        );
        dispatch(removePendingHaul(pending.localId));
        synced++;
      } catch (err) {
        console.log('Sync fail:', pending.localId, err);
      }
    }
    setSyncing(false);
    if (synced > 0) {
      fetchHauls();
      Alert.alert('Senkronize Edildi', `${synced} bekleyen sefer sunucuya gönderildi.`);
    }
  }, [token, pendingQueue]);

  useFocusEffect(
    useCallback(() => {
      fetchHauls();
      syncPending();
    }, [token, job?.id])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') syncPending();
    });
    return () => sub.remove();
  }, [syncPending]);

  useEffect(() => {
    if (!token || !job?.companyId) return;
    getCompanyById(job.companyId, token)
      .then(res => {
        const companyData = res?.isSuccess ? res.data : (res?.data || res);
        const path = companyData?.logoPath || companyData?.LogoPath || null;
        if (path) setCachedCompanyLogoPath(path);
      })
      .catch(() => { });
  }, [token, job?.companyId]);

  // ── Sefer Gir submit (teklif seçimli)
  const handleAddHaul = async (isPrinted: boolean) => {
    const cleanPlate = formPlate.replace(/\s/g, '').toUpperCase();
    if (!cleanPlate) { Alert.alert('Eksik Bilgi', 'Plaka numarası zorunludur.'); return; }
    if (selectedOfferIdx === null) { Alert.alert('Eksik Bilgi', isKum ? 'Rota seçiniz.' : 'Teklif seçiniz.'); return; }

    const offer = offers[selectedOfferIdx];

    // ── Kum/Mıcır: tonage zorunlu, cashAmount hesaplama
    let tonageKg = 0;
    let cashAmount = offer.cash;
    let fuelAmount = offer.fuel;
    let paymentType = offer.cash > 0 && offer.fuel > 0 ? 2 : offer.fuel > 0 ? 1 : 0;
    let dumpLocation = offer.name; // Hafriyat: teklif adı, Kum/Mıcır: rota adı

    if (isKum) {
      tonageKg = parseFloat(formTonage.replace(',', '.')) || 0;
      if (tonageKg <= 0) { Alert.alert('Eksik Bilgi', 'Miktar (kg) giriniz.'); return; }
      const cashPerTon = offer.cashPerTon ?? offer.cash;
      cashAmount = parseFloat((cashPerTon * tonageKg / 1000).toFixed(2));
      fuelAmount = 0;
      paymentType = 0;
    }

    const timeNow = nowTR();
    setFormSaving(true);
    const online = await checkOnline();
    console.log('timeNow', timeNow);

    if (online) {
      try {
        const created = await createHaul(
          {
            jobSiteId: job.id,
            plateNumber: cleanPlate,
            paymentType,
            cashAmount,
            fuelAmount,
            tonage: tonageKg,
            dumpLocation,
            note: formNote.trim(),
            timeOfHaul: timeNow,
            isPrintedReceipt: isPrinted,
            isVisibleToVehicleOwner: showHaulsToOwners,
          },
          token!
        );
        setFormSaving(false);
        saveRecentPlate(cleanPlate);
        closeAddModal();
        fetchHauls();
        setSelectedHaul(normalizeHaul(created));
        setReceiptVisible(true);
        if (isPrinted) {
          triggerPrint(created);
        }
      } catch (err: any) {
        setFormSaving(false);
        Alert.alert('Hata', err.response?.data?.message || 'Sefer kaydedilemedi.');
      }
    } else {
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const pending: PendingHaul = {
        localId,
        jobSiteId: job.id,
        plateNumber: cleanPlate,
        paymentType,
        tonage: tonageKg,
        cashAmount,
        fuelAmount,
        dumpLocation,
        note: formNote.trim(),
        isPrintedReceipt: isPrinted,
        timeOfHaul: timeNow,
        createdAt: timeNow,
      };
      dispatch(addPendingHaul(pending));
      saveRecentPlate(cleanPlate);
      setFormSaving(false);
      closeAddModal();
      Alert.alert('Çevrimdışı Kaydedildi', 'İnternet yok. İnternete bağlandığında otomatik gönderilecek.');
    }
  };

  // ── Manuel Ekle submit
  const handleManualHaul = async (isPrinted: boolean) => {
    const cleanPlate = manualPlate.replace(/\s/g, '').toUpperCase();
    if (!cleanPlate) { Alert.alert('Eksik Bilgi', 'Plaka zorunludur.'); return; }

    let dumpLoc: string;
    let cash: number;
    let fuel: number;
    let tonage: number;
    let paymentType: number;

    if (isKum) {
      if (!manualLoading.trim()) { Alert.alert('Eksik Bilgi', 'Yükleme yeri zorunludur.'); return; }
      if (!manualUnloading.trim()) { Alert.alert('Eksik Bilgi', 'Boşaltma yeri zorunludur.'); return; }
      const pricePerTon = parseFloat(manualPricePerTon.replace(',', '.')) || 0;
      if (pricePerTon <= 0) { Alert.alert('Eksik Bilgi', 'Ton başına fiyat giriniz.'); return; }
      const kg = parseFloat(manualTonage.replace(',', '.')) || 0;
      if (kg <= 0) { Alert.alert('Eksik Bilgi', 'Miktar (kg) giriniz.'); return; }
      dumpLoc = `${manualLoading.trim()} → ${manualUnloading.trim()}`;
      tonage = kg;
      cash = parseFloat((pricePerTon * kg / 1000).toFixed(2));
      fuel = 0;
      paymentType = 0;
    } else {
      if (!manualDump.trim()) { Alert.alert('Eksik Bilgi', 'Döküm yeri zorunludur.'); return; }
      dumpLoc = manualDump.trim();
      cash = parseFloat(manualCash.replace(',', '.')) || 0;
      fuel = parseFloat(manualFuel.replace(',', '.')) || 0;
      tonage = 0; // Hafriyat tonaj alanı kaldırıldı
      paymentType = cash > 0 && fuel > 0 ? 2 : fuel > 0 ? 1 : 0;
    }

    const timeNow = nowTR();
    setManualSaving(true);
    const online = await checkOnline();

    if (online) {
      try {
        const created = await createHaul(
          {
            jobSiteId: job.id,
            plateNumber: cleanPlate,
            paymentType,
            cashAmount: cash,
            fuelAmount: fuel,
            tonage,
            dumpLocation: dumpLoc,
            note: manualNote.trim(),
            timeOfHaul: timeNow,
            isPrintedReceipt: isPrinted,
            isVisibleToVehicleOwner: showHaulsToOwners,
          },
          token!
        );
        setManualSaving(false);
        closeManualModal();
        fetchHauls();
        setSelectedHaul(normalizeHaul(created));
        setReceiptVisible(true);
        if (isPrinted) {
          triggerPrint(created);
        }
      } catch (err: any) {
        setManualSaving(false);
        Alert.alert('Hata', err.response?.data?.message || 'Sefer kaydedilemedi.');
      }
    } else {
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const pending: PendingHaul = {
        localId,
        jobSiteId: job.id,
        plateNumber: cleanPlate,
        paymentType,
        tonage,
        cashAmount: cash,
        fuelAmount: fuel,
        dumpLocation: dumpLoc,
        note: manualNote.trim(),
        isPrintedReceipt: isPrinted,
        timeOfHaul: timeNow,
        createdAt: timeNow,
      };
      dispatch(addPendingHaul(pending));
      setManualSaving(false);
      closeManualModal();
      if (isPrinted) {
        openPendingReceipt(pending);
      } else {
        Alert.alert('Çevrimdışı Kaydedildi', 'İnternet yok. İnternete bağlandığında otomatik gönderilecek.');
      }
    }
  };

  // ── Ödeme onay modal aç
  const openPaymentConfirm = (item: HaulApi) => {
    setPaymentHaul(item);
    const hasCash = (item.cashAmount ?? 0) > 0;
    const hasFuel = (item.fuelAmount ?? 0) > 0;
    setPaymentType(!hasCash && hasFuel ? 1 : 0);
    setPaymentCash(hasCash ? String(item.cashAmount) : '');
    setPaymentFuel(hasFuel ? String(item.fuelAmount) : '');
    setPaymentModal(true);
  };

  const closePaymentModal = () => {
    setPaymentModal(false);
    setPaymentHaul(null);
    setPaymentCash('');
    setPaymentFuel('');
  };

  const handleConfirmPayment = async () => {
    if (!token || !paymentHaul) return;
    try {
      setPaymentSaving(true);
      await updateHaulPayment(
        {
          haulId: paymentHaul.id,
          isPaid: true,
          paymentType,
          cashAmount: paymentType === 0 ? parseFloat(paymentCash.replace(',', '.')) || 0 : 0,
          fuelAmount: paymentType === 1 ? parseFloat(paymentFuel.replace(',', '.')) || 0 : 0,
          tonage: paymentHaul.tonage,
          dumpLocation: paymentHaul.dumpLocation,
        },
        token,
      );
      closePaymentModal();
      fetchHauls();
      Alert.alert('Başarılı', 'Ödeme onaylandı.');
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.message || 'Ödeme onaylanırken hata oluştu.');
    } finally {
      setPaymentSaving(false);
    }
  };

  // ── Yazdır (Bluetooth görsel fiş)
  const triggerPrint = async (haul: HaulApi) => {
    setPrintTargetHaul(haul);
    await new Promise(r => setTimeout(r, 300));
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
      await printImage(base64);
    } catch (e) {
      Alert.alert('Yazdırma Hatası', String(e));
    }
  };

  const openPendingReceipt = (item: PendingHaul) => {
    // PendingHaul → HaulApi şekline dönüştür, mevcut fiş modal'ını yeniden kullan
    const fakeHaul: HaulApi = {
      id: item.localId,
      jobSiteId: item.jobSiteId,
      jobSiteName: job?.name || '-',
      companyName: '',
      plateNumber: item.plateNumber,
      timeOfHaul: item.timeOfHaul,
      dumpLocation: item.dumpLocation,
      tonage: item.tonage,
      cashAmount: item.cashAmount,
      fuelAmount: item.fuelAmount,
      isPaid: false,
      isPrintedReceipt: item.isPrintedReceipt,
      paymentType: item.paymentType,
      createdDate: item.createdAt,   // autoSerial bu alanı kullanır
      isVisibleToVehicleOwner: false,
      note: item.note,
    };
    setSelectedHaul(fakeHaul);
    setReceiptVisible(true);
  };

  const closeAddModal = () => {
    setAddModal(false);
    setFormPlate('');
    setSelectedOfferIdx(null);
    setFormTonage('');
    setFormNote('');
  };

  const closeManualModal = () => {
    setManualModal(false);
    setManualPlate('');
    setManualDump('');
    setManualCash('');
    setManualFuel('');
    setManualTonage('');
    setManualNote('');
    setManualLoading('');
    setManualUnloading('');
    setManualPricePerTon('');
    setManualMaterial('');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}  ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const autoSerial = (haul: HaulApi) => {
    if (haul.serialNumber) return haul.serialNumber;
    const d = new Date(haul.createdDate);
    const datePart = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const idPart = haul.id.substring(0, 4).toUpperCase();
    return `${datePart}${idPart}`;
  };

  // ── Ayarlar menüsü
  const downloadExcel = async () => {
    if (!token || !job?.id) return;
    setDownloading(true);
    // Modal kapatılmadan openDocument sunamaz; önce kapat, animasyon bitince aç
    setDeleteStep1Visible(false);
    try {
      const res = await RNBlobUtil.config({ fileCache: true, appendExt: 'xlsx' })
        .fetch('GET', `https://api.hafriyapp.com/api/Haul/jobsite/${job.id}/export`, {
          Authorization: `Bearer ${token}`,
        });
      const path = res.path();
      await new Promise<void>(r => setTimeout(r, 350));
      if (Platform.OS === 'ios') {
        await RNBlobUtil.ios.openDocument(path);
      } else {
        await RNBlobUtil.android.actionViewIntent(
          path,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      }
    } catch {
      Alert.alert('Hata', 'Excel dosyası indirilemedi.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSettingsPress = () => {
    const options = ['İptal', 'Düzenle', 'Yakıt Ekle', 'İndir', 'İşi Sil'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, destructiveButtonIndex: 4 },
        idx => {
          if (idx === 1) setEditModal(true);
          if (idx === 2) { setFuelInput(''); setFuelModal(true); }
          if (idx === 3) downloadExcel();
          if (idx === 4) handleFinishJob();
        },
      );
    } else {
      Alert.alert('Ayarlar', '', [
        { text: 'Düzenle', onPress: () => setEditModal(true) },
        { text: 'Yakıt Ekle', onPress: () => { setFuelInput(''); setFuelModal(true); } },
        { text: 'İndir', onPress: downloadExcel },
        { text: 'İşi Sil', style: 'destructive', onPress: handleFinishJob },
        { text: 'İptal', style: 'cancel' },
      ]);
    }
  };

  // ── Yakıt Ekle
  const handleAddFuel = async () => {
    if (!token || !job?.id) return;
    const amount = parseInt(fuelInput.replace(/[^0-9]/g, ''), 10);
    if (!amount || amount <= 0) { Alert.alert('Hata', 'Geçerli bir miktar giriniz.'); return; }
    setFuelSaving(true);
    try {
      const currentStock = fuelStock;
      await updateJobSite(token, job.id, {
        companyId: job.companyId,
        name: job.name,
        jobType: job.jobType,
        provinceCode: job.provinceCode,
        districtName: job.districtName ?? '',
        locationUrl: job.locationUrl ?? '',
        description: job.description ?? '',
        signDescription: job.signDescription ?? '',
        contactPhone: job.contactPhone ?? '',
        fuelStock: currentStock + amount,
        offer1Name: null,
        offer1Cash: 0,
        offer1Fuel: 0,
        offer2Name: null,
        offer2Cash: 0,
        offer2Fuel: 0,
        extraOffersJson: job.extraOffersJson ?? '[]',
        hasFuel: job.hasFuel ?? true,
        fuelLiters: job.fuelLiters ?? 0,
        hasSand: job.jobType === 1,
        sandFuelLiters: job.sandFuelLiters ?? 0,
        hasCash: job.hasCash ?? true,
        cashAmount: 0,
        loadingStartTime: job.loadingStartTime ?? '',
        loadingEndTime: job.loadingEndTime ?? '',
        isActive: job.isActive,
      });
      setFuelStock(currentStock + amount);
      setFuelModal(false);
      setFuelInput('');
      Alert.alert('Başarılı', `${amount} litre yakıt eklendi.`);
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.message || 'Yakıt eklenirken hata oluştu.');
    } finally {
      setFuelSaving(false);
    }
  };

  // ── İşi Sil (2 adımlı)
  const handleFinishJob = () => setDeleteStep1Visible(true);

  const handleConfirmDelete = async () => {
    if (!token || !job?.id) return;
    setDeleting(true);
    try {
      await forceDeleteJobSite(token, job.id);
      setDeleteStep2Visible(false);
      navigation.goBack();
    } catch (error: any) {
      setDeleteStep2Visible(false);
      Alert.alert('Hata', error?.response?.data?.message || 'İş silinirken bir sorun oluştu.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Header
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle} numberOfLines={1}>{job?.name || 'Şantiye'}</Text>
        <Text style={styles.headerSubtitle}>{job?.provinceName} • {job?.isActive ? 'Aktif' : 'Pasif'}</Text>
      </View>
      <TouchableOpacity style={styles.settingsBtn} onPress={handleSettingsPress} disabled={downloading}>
        {downloading
          ? <ActivityIndicator size="small" color="#444" />
          : <Text style={styles.settingsBtnText}>⚙ Ayarlar</Text>
        }
      </TouchableOpacity>
    </View>
  );

  const filteredHauls = plateFilter.trim()
    ? hauls.filter(h => {
      const q = plateFilter.replace(/\s/g, '').toLowerCase();
      const plate = h.plateNumber.replace(/\s/g, '').toLowerCase();
      const serial = autoSerial(h).replace(/\s/g, '').toLowerCase();
      return plate.includes(q) || serial.includes(q);
    })
    : hauls;

  // ── Özet çubuğu (compact tek satır)
  const renderSummaryCards = () => {
    const todayStr = new Date().toDateString();
    const todayCount = hauls.filter(h => new Date(h.timeOfHaul).toDateString() === todayStr).length
      + pendingForThisJob.filter(h => new Date(h.timeOfHaul).toDateString() === todayStr).length;
    const totalTonKg = hauls.reduce((a, h) => a + (h.tonage || 0), 0);
    const remainingFuel = fuelStock;
    const totalTonDisplay = isKum
      ? `${(totalTonKg / 1000).toFixed(1)}t`
      : `${remainingFuel.toFixed(0)}lt`;
    const totalTonLabel = isKum ? 'Toplam Ton' : 'Kalan Yakıt';

    return (
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#E65100' }]}>{todayCount}</Text>
          <Text style={styles.summaryLabel}>Bugün</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{hauls.length + pendingForThisJob.length}</Text>
          <Text style={styles.summaryLabel}>Toplam</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#1976D2' }]}>{totalTonDisplay}</Text>
          <Text style={styles.summaryLabel}>{totalTonLabel}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#E53935' }]}>{hauls.filter(h => !h.isPaid).length}</Text>
          <Text style={styles.summaryLabel}>Bekliyor</Text>
        </View>
      </View>
    );
  };

  // ── Bekleyen satır (offline)
  const renderPendingItem = (item: PendingHaul) => (
    <View key={item.localId} style={styles.pendingRow}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>⏳ Bekliyor</Text>
          </View>
          <Text style={styles.pendingPlate}>{item.plateNumber}</Text>
          <Text style={styles.pendingDate}>{new Date(item.timeOfHaul).toLocaleString('tr-TR')}</Text>
          <Text style={styles.pendingPayType}>
            {item.cashAmount > 0 ? `💵 ${item.cashAmount.toLocaleString('tr-TR')} TL` : ''}
            {item.cashAmount > 0 && item.fuelAmount > 0 ? '  ' : ''}
            {item.fuelAmount > 0 ? `⛽ ${item.fuelAmount.toLocaleString('tr-TR')} Lt` : ''}
            {item.tonage > 0 ? `  ${item.tonage} ton` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.eyeBtn} onPress={() => openPendingReceipt(item)}>
          <Text style={styles.eyeBtnText}>👁 Fiş</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const isWithinOneHour = (createdDate: string) => {
    const utc = createdDate.endsWith('Z') ? createdDate : createdDate + 'Z';
    return (Date.now() - new Date(utc).getTime()) < 3600000;
  };

  const handleDeleteHaul = (item: HaulApi) => {
    Alert.alert(
      'Seferi Sil',
      `${item.plateNumber} - ${item.dumpLocation || ''} seferini silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            try {
              await deleteHaul(item.id, token!);
              setHauls(prev => prev.filter(h => h.id !== item.id));
            } catch {
              Alert.alert('Hata', 'Sefer silinemedi.');
            }
          },
        },
      ],
    );
  };

  // ── Material lookup helper (Kum/Mıcır)
  const getMaterialFromDumpLocation = (dumpLocation: string): string => {
    if (!isKum || !dumpLocation) return '';
    const match = offers.find(o => o.name === dumpLocation);
    return match?.material || '';
  };

  // ── Sefer kartı
  const renderHaulItem = (item: HaulApi) => {
    const material = getMaterialFromDumpLocation(item.dumpLocation || '');
    return (
      <TouchableOpacity key={item.id} style={[styles.haulCard, item.isPaid ? styles.haulCardPaid : styles.haulCardUnpaid]} activeOpacity={0.85} onPress={() => { setSelectedHaul(normalizeHaul(item)); setReceiptVisible(true); }}>
        <View style={styles.haulCardTop}>
          <View style={styles.haulSerialRow}>
            <TouchableOpacity
              onPress={() => copyWithFeedback(autoSerial(item), `${item.id}-auto`)}
              activeOpacity={0.7}
            >
              <Text style={[styles.haulSerial, copiedKey === `${item.id}-auto` && styles.haulSerialCopied]}>
                {copiedKey === `${item.id}-auto` ? '✓ ' : ''}{autoSerial(item)}
              </Text>
            </TouchableOpacity>
          </View>
          {item.isPrintedReceipt && (
            <View style={styles.printedBadge}><Text style={styles.printedBadgeText}>🖨 Yazdırıldı</Text></View>
          )}
          {item.isPaid
            ? <View style={styles.statusPaid}><Text style={styles.statusPaidText}>✔ Ödendi</Text></View>
            : <View style={styles.statusPending}><Text style={styles.statusPendingText}>⏳ Bekliyor</Text></View>
          }
        </View>

        <View style={styles.haulCardMid}>
          <View>
            <Text style={styles.haulDate}>{formatDate(item.timeOfHaul)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.haulPlate}>{item.plateNumber}</Text>
              {!!material && (
                <View style={styles.materialBadge}><Text style={styles.materialBadgeText}>{material}</Text></View>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {item.tonage > 0 && (
              <Text style={styles.haulTonage}>
                {isKum ? `${item.tonage.toLocaleString('tr-TR')} kg` : `${(item.tonage / 1000).toFixed(2)} t`}
              </Text>
            )}
            {(item.paymentType === 0 || item.paymentType === 2) && item.cashAmount > 0 && (
              <View style={styles.cashBadge}><Text style={styles.cashBadgeText}>{item.cashAmount.toLocaleString('tr-TR')} ₺</Text></View>
            )}
            {(item.paymentType === 1 || item.paymentType === 2) && item.fuelAmount > 0 && (
              <View style={styles.fuelBadge}><Text style={styles.fuelBadgeText}>{item.fuelAmount.toLocaleString('tr-TR')} Lt</Text></View>
            )}
          </View>
        </View>

        {!!item.note && (
          <Text style={styles.haulNoteText} numberOfLines={2}>💬 {item.note}</Text>
        )}

        <View style={styles.haulCardBot}>
          <Text style={styles.haulDump} numberOfLines={1}>→ {item.dumpLocation || '-'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!item.isPaid && item.isPrintedReceipt && (
              <TouchableOpacity style={styles.approveBtn} onPress={() => openPaymentConfirm(item)}>
                <Text style={styles.approveBtnText}>✔ Onayla</Text>
              </TouchableOpacity>
            )}
            {console.log('[deleteBtn]', item.id.slice(0, 8), '| isPaid:', item.isPaid, '| canEdit:', job?.canEdit, '| createdDate:', item.createdDate, '| withinHour:', isWithinOneHour(item.createdDate)) as any}
            {!item.isPaid && job?.canEdit && isWithinOneHour(item.createdDate) && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteHaul(item)}>
                <Text style={styles.deleteBtnText}>🗑 Sil</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.eyeBtn} onPress={() => { setSelectedHaul(normalizeHaul(item)); setReceiptVisible(true); }}>
              <Text style={styles.eyeBtnText}>👁 Fiş</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {renderHeader()}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1976D2']}
            tintColor="#1976D2"
          />
        }
      >
        <View style={styles.content}>
          {renderSummaryCards()}

          {/* Offline sync banner */}
          {pendingQueue.length > 0 && (
            <TouchableOpacity style={styles.syncBanner} onPress={syncPending} disabled={syncing}>
              <Text style={styles.syncBannerText}>
                {syncing ? '🔄 Senkronize ediliyor...' : `📡 ${pendingQueue.length} sefer gönderilmeyi bekliyor. Senkronize et`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Liste başlığı + butonlar */}
          <View style={styles.listHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.listTitle}>Son Seferler</Text>
              <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh} disabled={refreshing}>
                <Text style={styles.refreshIconText}>{refreshing ? '⏳' : '🔄'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.manualBtn} onPress={() => setManualModal(true)}>
                <Text style={styles.manualBtnText}>Manuel Ekle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addHaulBtn} onPress={() => { loadRecentPlates(); setAddModal(true); }}>
                <Text style={styles.addHaulBtnText}>＋ Sefer Gir</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bekleyen (offline) seferler */}
          {pendingForThisJob.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.pendingTitle}>Çevrimdışı Kaydedilenler</Text>
              {pendingForThisJob.map(renderPendingItem)}
            </View>
          )}

          {/* Sunucudan gelen seferler */}
          {loading ? (
            <ActivityIndicator size="large" color={YELLOW} style={{ marginTop: 20 }} />
          ) : hauls.length === 0 && pendingForThisJob.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 36 }}>🚛</Text>
              <Text style={styles.emptyText}>Henüz sefer kaydı yok.</Text>
            </View>
          ) : (
            <>
              {hauls.length > 0 && (
                <View style={styles.searchBox}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Plaka veya seri no ara..."
                    placeholderTextColor="#aaa"
                    value={plateFilter}
                    onChangeText={setPlateFilter}
                    autoCapitalize="characters"
                  />
                  {plateFilter.length > 0 && (
                    <TouchableOpacity onPress={() => setPlateFilter('')}>
                      <Text style={styles.searchClear}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {filteredHauls.length === 0 && plateFilter.length > 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 32 }}>🔍</Text>
                  <Text style={styles.emptyText}>"{plateFilter}" için sonuç bulunamadı.</Text>
                </View>
              ) : (
                filteredHauls.map(renderHaulItem)
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ═══════════════ SEFER GİR MODAL (Teklifli) ═══════════════ */}
      <Modal visible={addModal} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center' }}>
                <View style={styles.addCard}>
                  {/* Header */}
                  <View style={styles.addCardHeader}>
                    <Text style={styles.addCardHeaderText}>🚛  Yeni Sefer Kaydı</Text>
                    <TouchableOpacity onPress={closeAddModal} style={styles.closeX}>
                      <Text style={styles.closeXText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.addCardBody}>
                    {/* Plaka */}
                    <Text style={styles.fieldLabel}>Plaka Numarası <Text style={styles.req}>*</Text></Text>
                    <TextInput
                      value={formPlate}
                      onChangeText={t => setFormPlate(t.toUpperCase())}
                      style={styles.plateInput}
                      placeholder="34 ABC 123"
                      autoCapitalize="characters"
                      maxLength={14}
                    />
                    {recentPlates.length > 0 && (() => {
                      const filtered = formPlate.trim()
                        ? recentPlates.filter(p => p.includes(formPlate.trim().toUpperCase()))
                        : recentPlates;
                      if (filtered.length === 0) return null;
                      return (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={{ marginTop: 10 }}
                          contentContainerStyle={styles.recentPlatesRow}
                          keyboardShouldPersistTaps="handled"
                        >
                          {filtered.map(plate => (
                            <TouchableOpacity
                              key={plate}
                              style={styles.recentPlateChip}
                              onPress={() => setFormPlate(plate)}
                            >
                              <Text style={styles.recentPlateText}>{plate}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      );
                    })()}

                    {/* Rota / Teklif Seçiniz */}
                    <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{isKum ? 'Rota Seçiniz' : 'Teklif Seçiniz'}</Text>
                    {offers.length === 0 ? (
                      <View style={styles.noOfferBox}>
                        <Text style={styles.noOfferText}>⚠ Bu şantiye için {isKum ? 'rota' : 'teklif'} tanımlanmamış.</Text>
                      </View>
                    ) : (
                      offers.map((offer, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.offerItem, selectedOfferIdx === idx && styles.offerItemSelected]}
                          onPress={() => { setSelectedOfferIdx(idx); Keyboard.dismiss(); }}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={[styles.offerName, { flex: 1 }]} numberOfLines={1}>{offer.name}</Text>
                            {isKum && !!offer.material && (
                              <View style={styles.materialBadge}>
                                <Text style={styles.materialBadgeText}>{offer.material}</Text>
                              </View>
                            )}
                            {offer.cash > 0 && (
                              <View style={styles.offerCashBadge}>
                                <Text style={styles.offerCashText}>
                                  {offer.cash.toLocaleString('tr-TR')} {isKum ? '₺/ton' : '₺'}
                                </Text>
                              </View>
                            )}
                            {!isKum && offer.fuel > 0 && (
                              <View style={styles.offerFuelBadge}>
                                <Text style={styles.offerFuelText}>{offer.fuel.toLocaleString('tr-TR')} Lt</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.radioCircle, selectedOfferIdx === idx && styles.radioCircleSelected]}>
                            {selectedOfferIdx === idx && <View style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      ))
                    )}

                    {/* Kum/Mıcır: Miktar (kg) */}
                    {isKum && (
                      <>
                        <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Miktar (kg) <Text style={styles.req}>*</Text></Text>
                        <TextInput
                          value={formTonage}
                          onChangeText={t => setFormTonage(t.replace(/[^0-9,]/g, ''))}
                          style={styles.textInput}
                          placeholder="Örn: 12000"
                          keyboardType="decimal-pad"
                        />
                        {selectedOfferIdx !== null && !!formTonage && (
                          <View style={styles.calcBox}>
                            <Text style={styles.calcBoxText}>
                              Hesaplanan Tutar: {(
                                (offers[selectedOfferIdx]?.cashPerTon ?? offers[selectedOfferIdx]?.cash ?? 0) *
                                (parseFloat(formTonage.replace(',', '.')) || 0) / 1000
                              ).toFixed(2)} ₺
                            </Text>
                          </View>
                        )}
                      </>
                    )}

                    {/* Not */}
                    <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Opsiyonel <Text style={styles.optional}>(Not)</Text></Text>
                    <TextInput
                      value={formNote}
                      onChangeText={setFormNote}
                      style={styles.noteInput}
                      placeholder="Örn: İrsaliye No, Açıklama"
                      maxLength={250}
                      multiline
                    />
                  </View>

                  {/* Footer butonları */}
                  <View style={styles.addCardFooter}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeAddModal}>
                      <Text style={styles.cancelBtnText}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sanalBtn, (!formPlate || selectedOfferIdx === null || (isKum && !formTonage) || formSaving) && { opacity: 0.4 }]}
                      onPress={() => handleAddHaul(false)}
                      disabled={!formPlate || selectedOfferIdx === null || (isKum && !formTonage) || formSaving}
                    >
                      <Text style={styles.sanalBtnText}>Sanal Fiş Kes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.printSubmitBtn, (!formPlate || selectedOfferIdx === null || (isKum && !formTonage) || formSaving) && { opacity: 0.4 }]}
                      onPress={() => handleAddHaul(true)}
                      disabled={!formPlate || selectedOfferIdx === null || (isKum && !formTonage) || formSaving}
                    >
                      <Text style={styles.printSubmitBtnText}>
                        {formSaving ? '...' : 'Fiş Kes ve Yazdır'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ═══════════════ MANUEL EKLE MODAL ═══════════════ */}
      <Modal visible={manualModal} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: 'center' }}>
                <View style={styles.addCard}>
                  {/* Header */}
                  <View style={[styles.addCardHeader, { backgroundColor: '#546E7A' }]}>
                    <Text style={styles.addCardHeaderText}>✏  Manuel Sefer Gir</Text>
                    <TouchableOpacity onPress={closeManualModal} style={styles.closeX}>
                      <Text style={styles.closeXText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.addCardBody}>
                    {/* Plaka */}
                    <Text style={styles.fieldLabel}>Plaka Numarası <Text style={styles.req}>*</Text></Text>
                    <TextInput
                      value={manualPlate}
                      onChangeText={t => setManualPlate(t.toUpperCase())}
                      style={styles.plateInput}
                      placeholder="34 ABC 123"
                      autoCapitalize="characters"
                      maxLength={14}
                    />

                    {isKum ? (
                      <>
                        {/* Yükleme Yeri */}
                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Yükleme Yeri <Text style={styles.req}>*</Text></Text>
                        <TextInput
                          value={manualLoading}
                          onChangeText={setManualLoading}
                          style={styles.textInput}
                          placeholder="Örn: Ocak Adı"
                        />

                        {/* Boşaltma Yeri */}
                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Boşaltma Yeri <Text style={styles.req}>*</Text></Text>
                        <TextInput
                          value={manualUnloading}
                          onChangeText={setManualUnloading}
                          style={styles.textInput}
                          placeholder="Örn: Şantiye Adı"
                        />

                        {/* Malzeme */}
                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Malzeme <Text style={styles.optional}>(Opsiyonel)</Text></Text>
                        <TextInput
                          value={manualMaterial}
                          onChangeText={setManualMaterial}
                          style={styles.textInput}
                          placeholder="Örn: Kum, Mıcır"
                        />

                        {/* Fiyat/ton + Miktar */}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLabel, { color: '#2E7D32' }]}>Fiyat (₺/ton) <Text style={styles.req}>*</Text></Text>
                            <TextInput
                              value={manualPricePerTon}
                              onChangeText={t => setManualPricePerTon(t.replace(/[^0-9,]/g, ''))}
                              style={styles.textInput}
                              placeholder="0"
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLabel, { color: '#E65100' }]}>Miktar (kg) <Text style={styles.req}>*</Text></Text>
                            <TextInput
                              value={manualTonage}
                              onChangeText={t => setManualTonage(t.replace(/[^0-9,]/g, ''))}
                              style={styles.textInput}
                              placeholder="0"
                              keyboardType="decimal-pad"
                            />
                          </View>
                        </View>

                        {/* Hesaplanan Tutar */}
                        {!!manualPricePerTon && !!manualTonage && (
                          <View style={styles.calcBox}>
                            <Text style={styles.calcBoxText}>
                              Hesaplanan Tutar: {(
                                (parseFloat(manualPricePerTon.replace(',', '.')) || 0) *
                                (parseFloat(manualTonage.replace(',', '.')) || 0) / 1000
                              ).toFixed(2)} ₺
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Döküm Yeri */}
                        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Döküm Yeri / Açıklama <Text style={styles.req}>*</Text></Text>
                        <TextInput
                          value={manualDump}
                          onChangeText={setManualDump}
                          style={styles.textInput}
                          placeholder="Örn: Serbest Döküm"
                        />

                        {/* Nakit + Mazot */}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLabel, { color: '#2E7D32' }]}>Nakit (TL)</Text>
                            <TextInput
                              value={manualCash}
                              onChangeText={t => setManualCash(t.replace(/[^0-9,]/g, ''))}
                              style={styles.textInput}
                              placeholder="0"
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLabel, { color: '#E65100' }]}>Mazot (Lt)</Text>
                            <TextInput
                              value={manualFuel}
                              onChangeText={t => setManualFuel(t.replace(/[^0-9,]/g, ''))}
                              style={styles.textInput}
                              placeholder="0"
                              keyboardType="decimal-pad"
                            />
                          </View>
                        </View>

                      </>
                    )}

                    {/* Not */}
                    <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Not <Text style={styles.optional}>(Opsiyonel)</Text></Text>
                    <TextInput
                      value={manualNote}
                      onChangeText={setManualNote}
                      style={styles.noteInput}
                      placeholder="Örn: İrsaliye No, Açıklama"
                      maxLength={250}
                      multiline
                    />
                  </View>

                  <View style={[styles.addCardFooter, { justifyContent: 'flex-end', gap: 8 }]}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeManualModal}>
                      <Text style={styles.cancelBtnText}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.manualReceiptBtn, (
                        !manualPlate ||
                        (isKum ? (!manualLoading || !manualUnloading || !manualPricePerTon || !manualTonage) : !manualDump) ||
                        manualSaving
                      ) && { opacity: 0.4 }]}
                      onPress={() => handleManualHaul(false)}
                      disabled={
                        !manualPlate ||
                        (isKum ? (!manualLoading || !manualUnloading || !manualPricePerTon || !manualTonage) : !manualDump) ||
                        manualSaving
                      }
                    >
                      <Text style={styles.manualReceiptBtnText}>
                        {manualSaving ? 'Kaydediliyor...' : 'Sanal Fiş Kes'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.manualSaveBtn, (
                        !manualPlate ||
                        (isKum ? (!manualLoading || !manualUnloading || !manualPricePerTon || !manualTonage) : !manualDump) ||
                        manualSaving
                      ) && { opacity: 0.4 }]}
                      onPress={() => handleManualHaul(true)}
                      disabled={
                        !manualPlate ||
                        (isKum ? (!manualLoading || !manualUnloading || !manualPricePerTon || !manualTonage) : !manualDump) ||
                        manualSaving
                      }
                    >
                      <Text style={styles.manualSaveBtnText}>
                        {manualSaving ? 'Kaydediliyor...' : 'Fiş Kes ve Yazdır'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ═══════════════ DÜZENLE MODAL ═══════════════ */}
      <Modal visible={editModal} animationType="slide">
        <NewJobModal
          initialJob={job}
          onClose={(refresh) => {
            setEditModal(false);
            if (refresh) fetchHauls();
          }}
        />
      </Modal>

      {/* ═══════════════ YAKIT EKLE MODAL ═══════════════ */}
      <Modal visible={fuelModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
              <View style={styles.fuelCard}>
                <View style={styles.fuelHeader}>
                  <Text style={styles.fuelHeaderText}>⛽ Yakıt Ekle</Text>
                  <TouchableOpacity onPress={() => setFuelModal(false)}>
                    <Text style={styles.closeXText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ padding: 20 }}>
                  <View style={styles.fuelInfoBox}>
                    <Text style={styles.fuelInfoLabel}>Mevcut Yakıt Stoku</Text>
                    <Text style={styles.fuelInfoValue}>{fuelStock} lt</Text>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Eklenecek Miktar (Litre) <Text style={styles.req}>*</Text></Text>
                  <TextInput
                    value={fuelInput}
                    onChangeText={t => setFuelInput(t.replace(/[^0-9]/g, ''))}
                    style={styles.textInput}
                    keyboardType="number-pad"
                    placeholder="Örn: 500"
                    autoFocus
                  />

                  {!!fuelInput && parseInt(fuelInput) > 0 && (
                    <View style={styles.fuelCalcBox}>
                      <Text style={styles.fuelCalcText}>
                        Yeni Stok: {fuelStock + parseInt(fuelInput)} lt
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.addCardFooter, { marginTop: 0 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setFuelModal(false)}>
                    <Text style={styles.cancelBtnText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.fuelSaveBtn, (!fuelInput || fuelSaving) && { opacity: 0.4 }]}
                    onPress={handleAddFuel}
                    disabled={!fuelInput || fuelSaving}
                  >
                    <Text style={styles.fuelSaveBtnText}>
                      {fuelSaving ? 'Ekleniyor...' : '⛽ Yakıt Ekle'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ═══════════════ ÖDEME ONAY MODAL ═══════════════ */}
      <Modal visible={paymentModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
              <View style={styles.paymentCard}>
                {/* Header */}
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentHeaderText}>💰 Ödeme Onayla</Text>
                  <TouchableOpacity onPress={closePaymentModal}>
                    <Text style={styles.closeXText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Haul Bilgisi */}
                {paymentHaul && (
                  <View style={styles.paymentInfoBox}>
                    <Text style={styles.paymentInfoPlate}>{paymentHaul.plateNumber}</Text>
                    <Text style={styles.paymentInfoDate}>{formatDate(paymentHaul.timeOfHaul)}</Text>
                    <Text style={styles.paymentInfoSite}>{paymentHaul.dumpLocation || '-'}</Text>
                  </View>
                )}

                {/* Ödeme Türü */}
                <Text style={[styles.fieldLabel, { marginHorizontal: 16 }]}>Ödeme Türü</Text>
                <View style={styles.payTypeRow}>
                  <TouchableOpacity
                    style={[styles.payTypeBtn, paymentType === 0 && styles.payTypeActive, !(paymentHaul?.cashAmount > 0) && { opacity: 0.35 }]}
                    onPress={() => setPaymentType(0)}
                    disabled={!(paymentHaul?.cashAmount > 0)}
                  >
                    <Text style={[styles.payTypeText, paymentType === 0 && styles.payTypeTextActive]}>💵 Nakit (₺)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.payTypeBtn, paymentType === 1 && styles.payTypeActive, !(paymentHaul?.fuelAmount > 0) && { opacity: 0.35 }]}
                    onPress={() => setPaymentType(1)}
                    disabled={!(paymentHaul?.fuelAmount > 0)}
                  >
                    <Text style={[styles.payTypeText, paymentType === 1 && styles.payTypeTextActive]}>⛽ Yakıt (Lt)</Text>
                  </TouchableOpacity>
                </View>

                {/* Tutar */}
                <View style={{ paddingHorizontal: 16 }}>
                  {paymentType === 0 ? (
                    <>
                      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Nakit Tutar (₺)</Text>
                      <TextInput
                        value={paymentCash}
                        editable={false}
                        style={[styles.textInput, styles.textInputReadonly]}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Yakıt Miktarı (Litre)</Text>
                      <TextInput
                        value={paymentFuel}
                        editable={false}
                        style={[styles.textInput, styles.textInputReadonly]}
                      />
                    </>
                  )}
                </View>

                {/* Butonlar */}
                <View style={[styles.addCardFooter, { marginTop: 16 }]}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closePaymentModal}>
                    <Text style={styles.cancelBtnText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approveConfirmBtn, paymentSaving && { opacity: 0.5 }]}
                    onPress={handleConfirmPayment}
                    disabled={paymentSaving}
                  >
                    <Text style={styles.approveConfirmBtnText}>
                      {paymentSaving ? 'Kaydediliyor...' : '✔ Ödemeyi Onayla'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ═══════════════ FİŞ DETAY MODAL ═══════════════ */}
      {selectedHaul && (
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
                      {selectedHaul.companyLogoPath ? (
                        <Image
                          source={{ uri: `https://api.hafriyapp.com${selectedHaul.companyLogoPath.startsWith('/') ? '' : '/'}${selectedHaul.companyLogoPath}` }}
                          style={styles.receiptLogoImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <Image
                          source={require('../../../assets/icons/truck.png')}
                          style={styles.receiptLogoImg}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                    <View style={styles.receiptCompanyBlock}>
                      <Text style={styles.receiptCompanyName}>
                        {(selectedHaul.companyName || user?.companyName || '').toUpperCase()}
                      </Text>
                      <Text style={styles.receiptJobSiteName}>
                        {(selectedHaul.jobSiteName || job?.name || '').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.receiptTimeText}>
                      {new Date(selectedHaul.timeOfHaul).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  {/* Gövde: Satırlar (sol) + QR (sağ) */}
                  <View style={styles.receiptBodyWrap}>
                    <View style={styles.receiptBody}>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Tarih :</Text>
                        <Text style={styles.receiptRowValue}>
                          {new Date(selectedHaul.timeOfHaul).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Seri No :</Text>
                        <Text style={styles.receiptRowValue}>{autoSerial(selectedHaul)}</Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Plaka :</Text>
                        <Text style={styles.receiptRowValue}>{selectedHaul.plateNumber}</Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Şoför :</Text>
                        <Text style={styles.receiptRowValue}>
                          {selectedHaul.driverName || selectedHaul.driverPhone || '-'}
                        </Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Döküm :</Text>
                        <Text style={styles.receiptRowValue}>{selectedHaul.dumpLocation || '-'}</Text>
                      </View>

                      {selectedHaul.tonage > 0 && (
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptRowLabel}>Tonaj :</Text>
                          <Text style={styles.receiptRowValue}>{selectedHaul.tonage.toFixed(2)} Ton</Text>
                        </View>
                      )}

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Ücret :</Text>
                        <Text style={[styles.receiptRowValue, { fontWeight: '800' }]}>
                          {[
                            selectedHaul.cashAmount > 0 ? `${selectedHaul.cashAmount.toLocaleString('tr-TR')}₺` : '',
                            selectedHaul.fuelAmount > 0 ? `${selectedHaul.fuelAmount.toLocaleString('tr-TR')}lt` : '',
                          ].filter(Boolean).join(' / ') || '-'}
                        </Text>
                      </View>

                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Durum :</Text>
                        <Text style={[styles.receiptRowValue, {
                          color: selectedHaul.isPaid ? '#2E7D32' : '#E65100',
                          fontWeight: '800',
                        }]}>
                          {selectedHaul.isPaid ? '✔ Ödendi' : '⏳ Bekliyor'}
                        </Text>
                      </View>

                      {!!selectedHaul.contactPhone && (
                        <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                          <Text style={styles.receiptRowLabel}>Yetkili :</Text>
                          <Text style={styles.receiptRowValue}>{selectedHaul.contactPhone}</Text>
                        </View>
                      )}
                    </View>

                    {/* QR Kod — sağ taraf */}
                    {selectedHaul.qrCodeBase64 && (
                      <View style={styles.receiptQRBox}>
                        <Image
                          source={{ uri: `data:image/png;base64,${selectedHaul.qrCodeBase64}` }}
                          style={styles.receiptQRImg}
                        />
                      </View>
                    )}
                  </View>

                </View>
              </View>

              {/* Footer butonlar */}
              <View style={styles.receiptFooterRow}>
                <TouchableOpacity
                  style={styles.receiptCloseBtnNew}
                  onPress={() => setReceiptVisible(false)}
                >
                  <Text style={styles.receiptCloseBtnNewText}>Kapat</Text>
                </TouchableOpacity>
                {!selectedHaul.isPaid && !selectedHaul.isPrintedReceipt ? (
                  <TouchableOpacity
                    style={styles.receiptApproveBtnNew}
                    onPress={() => { setReceiptVisible(false); openPaymentConfirm(selectedHaul); }}
                  >
                    <Text style={styles.receiptApproveBtnNewText}>Onayla</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.receiptPrintBtnNew}
                    onPress={() => triggerPrint(selectedHaul)}
                  >
                    <Text style={styles.receiptPrintBtnNewText}>Yazdır</Text>
                  </TouchableOpacity>
                )}
              </View>

            </View>
          </View>
        </Modal>
      )}

      {/* ═══════════════ GİZLİ PRINT VIEW (görünmez, 0,0 konumunda) ═══════════════ */}
      {printTargetHaul && (() => {
        const ph = printTargetHaul;
        const logoUri = ph.companyLogoPath
          ? `https://api.hafriyapp.com${ph.companyLogoPath.startsWith('/') ? '' : '/'}${ph.companyLogoPath}`
          : null;
        const timeStr = new Date(ph.timeOfHaul).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(ph.timeOfHaul).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const ucretStr = [
          ph.cashAmount > 0 ? `${ph.cashAmount.toLocaleString('tr-TR')}₺` : '',
          ph.fuelAmount > 0 ? `${ph.fuelAmount.toLocaleString('tr-TR')}lt` : '',
        ].filter(Boolean).join(' / ') || '-';
        const rows = [
          { label: 'Tarih :', value: dateStr },
          { label: 'Seri No :', value: autoSerial(ph) },
          { label: 'Plaka :', value: ph.plateNumber },
          { label: 'Şoför :', value: ph.driverName || ph.driverPhone || '-' },
          { label: 'Döküm :', value: ph.dumpLocation || '-' },
          { label: 'Ücret :', value: ucretStr },
          ...(ph.contactPhone ? [{ label: 'Yetkili :', value: ph.contactPhone }] : []),
        ];
        const OW = 384;
        const OH = 640;
        const CW = OH;
        const CH = OW;
        const tx = (OW - CW) / 2;
        const ty = (OH - CH) / 2;
        const FRAME = 10;
        const PRINT_RIGHT_GAP = 20;
        const FRAME_BOTTOM = Math.max(0, FRAME - PRINT_RIGHT_GAP);
        return (
          // opacity:0.001 → render edilir ama görünmez; pointerEvents→ dokunuşları engeller
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.01 }}>
            <View
              ref={printReceiptRef}
              collapsable={false}
              style={{ width: OW, height: OH, overflow: 'hidden', backgroundColor: '#fff' }}
            >
              {/* Landscape card, rotated 90° CW */}
              <View style={{
                width: CW, height: CH,
                transform: [{ translateX: tx }, { translateY: ty }, { rotate: '90deg' }],
                backgroundColor: '#ffffff',
                paddingTop: 27,
                paddingRight: 18,
                paddingBottom: 18,
                paddingLeft: 18,
              }}>
                <View style={{
                  position: 'absolute',
                  top: FRAME + PRINT_RIGHT_GAP,
                  right: FRAME,
                  bottom: FRAME_BOTTOM,
                  left: FRAME,
                  borderWidth: 3,
                  borderColor: '#000000',
                  borderRadius: 16,
                }} />
                {/* Sağ üst saat */}
                <Text style={{ position: 'absolute', top: 45, right: 26, fontSize: 24, fontWeight: '700', color: '#000' }}>
                  {timeStr}
                </Text>

                {/* Header: Logo + Firma + Şantiye */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 13, marginBottom: 14, paddingLeft: 12, paddingRight: 72 }}>
                  <View style={{
                    width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: '#000',
                    justifyContent: 'center', alignItems: 'center', marginRight: 14, overflow: 'hidden',
                  }}>
                    {logoUri
                      ? <Image source={{ uri: logoUri }} style={{ width: 70, height: 70, borderRadius: 35 }} />
                      : <Image source={require('../../../assets/icons/truck.png')} style={{ width: 54, height: 54 }} resizeMode="contain" />
                    }
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text numberOfLines={1} style={{ fontSize: 25, fontWeight: '800', letterSpacing: 0.3, color: '#000', textAlign: 'center' }}>
                      {(ph.companyName || user?.companyName || 'HAFRİYAT').toUpperCase()}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: '700', letterSpacing: 0.2, color: '#000', textAlign: 'center', marginTop: 3 }}>
                      {(ph.jobSiteName || job?.name || '-').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* İçerik: Dikey metin + Satırlar + QR */}
                <View style={{ flexDirection: 'row', alignItems: 'stretch', flex: 1, paddingLeft: 12, paddingRight: 12, paddingBottom: 12 }}>

                  {/* Dikey HAFRİYAPP */}
                  <View style={{ width: 34, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{
                      fontSize: 22, fontWeight: '900', letterSpacing: 4, color: '#000',
                      transform: [{ rotate: '-90deg' }],
                      width: 210, textAlign: 'center',
                    }}>HAFRİYAPP</Text>
                  </View>

                  {/* Form satırları */}
                  <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
                    {rows.map(({ label, value }) => (
                      <View key={label} style={{
                        minHeight: 36,
                        flexDirection: 'row', alignItems: 'flex-end',
                        borderBottomWidth: 1.2, borderStyle: 'dotted', borderColor: '#000', paddingBottom: 3,
                      }}>
                        <Text style={{ color: '#222', fontWeight: '700', width: 98, fontSize: 17 }}>{label}</Text>
                        <Text numberOfLines={1} style={{ fontWeight: '700', color: '#000', fontSize: 17, flex: 1 }}>{value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* QR Kod */}
                  <View style={{ width: 124, justifyContent: 'flex-end', alignItems: 'flex-end', marginLeft: 14, paddingBottom: 2 }}>
                    <View style={{ width: 112, height: 112, borderWidth: 2, borderColor: '#000', borderRadius: 8, padding: 5, backgroundColor: '#fff' }}>
                      <QRCode value={autoSerial(ph) || 'HAFRIYAPP'} size={98} color="#000" backgroundColor="#fff" />
                    </View>
                  </View>

                </View>
              </View>
            </View>
          </View>
        );
      })()}

      {/* ═══════════════ İŞİ SİL ADIM 1 ═══════════════ */}
      <Modal visible={deleteStep1Visible} transparent animationType="fade" onRequestClose={() => setDeleteStep1Visible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            {/* Başlık */}
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalHeaderText}>⚠️  İşi Silmek İstiyorsunuz</Text>
            </View>
            {/* Gövde */}
            <View style={styles.deleteModalBody}>
              <Text style={styles.deleteModalJobName}>{job?.name}</Text>
              {hauls.length > 0 ? (
                <View style={styles.deleteModalInfoBox}>
                  <Text style={styles.deleteModalInfoText}>
                    Bu işe ait <Text style={{ fontWeight: '700' }}>{hauls.length}</Text> sefer kaydı bulunuyor.
                  </Text>
                </View>
              ) : (
                <View style={styles.deleteModalInfoBox}>
                  <Text style={styles.deleteModalInfoText}>Bu işe ait sefer kaydı bulunmuyor.</Text>
                </View>
              )}
              <Text style={styles.deleteModalWarning}>
                Silmeden önce sefer verilerinizi Excel olarak indirmenizi öneriyoruz.{'\n'}
                <Text style={{ fontWeight: '700' }}>Silinen veriler geri alınamaz!</Text>
              </Text>
              {hauls.length > 0 && (
                <TouchableOpacity
                  style={styles.deleteExcelBtn}
                  onPress={downloadExcel}
                  disabled={downloading}
                >
                  <Text style={styles.deleteExcelBtnText}>
                    {downloading ? 'İndiriliyor...' : '📥  Excel İndir (Yedek Al)'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.deleteProceedBtn}
                onPress={() => { setDeleteStep1Visible(false); setDeleteStep2Visible(true); }}
              >
                <Text style={styles.deleteProceedBtnText}>Devam Et — İşi Sil</Text>
              </TouchableOpacity>
            </View>
            {/* Footer */}
            <TouchableOpacity style={styles.deleteModalCancelBtn} onPress={() => setDeleteStep1Visible(false)}>
              <Text style={styles.deleteModalCancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════════ İŞİ SİL ADIM 2 ═══════════════ */}
      <Modal visible={deleteStep2Visible} transparent animationType="fade" onRequestClose={() => setDeleteStep2Visible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            {/* Başlık */}
            <View style={[styles.deleteModalHeader, { backgroundColor: '#D32F2F' }]}>
              <Text style={styles.deleteModalHeaderText}>🚫  Son Onay — Geri Dönüş Yok!</Text>
            </View>
            {/* Gövde */}
            <View style={styles.deleteModalBody}>
              <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🗑️</Text>
              <Text style={[styles.deleteModalJobName, { fontSize: 15 }]}>
                <Text style={{ fontWeight: '700' }}>{job?.name}</Text> işi ve tüm sefer kayıtları kalıcı olarak silinecek.
              </Text>
              <Text style={[styles.deleteModalWarning, { color: '#D32F2F', fontWeight: '700', marginTop: 8 }]}>
                Bu işlem geri alınamaz!
              </Text>
              <TouchableOpacity
                style={[styles.deleteProceedBtn, { backgroundColor: '#D32F2F', marginTop: 16 }]}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteProceedBtnText}>
                  {deleting ? 'Siliniyor...' : 'Evet, İşi ve Tüm Seferleri Sil'}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Footer */}
            <TouchableOpacity style={styles.deleteModalCancelBtn} onPress={() => setDeleteStep2Visible(false)}>
              <Text style={styles.deleteModalCancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEA' },

  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { padding: 8 },
  backArrow: { fontSize: 24, color: '#333' },
  headerContent: { flex: 1, marginLeft: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  headerSubtitle: { fontSize: 12, color: '#777' },
  settingsBtn: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  settingsBtnText: { fontSize: 12, color: '#444', fontWeight: '700' },

  content: { padding: 16 },

  summaryBar: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 12,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: DARK },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#EEEEEE' },

  syncBanner: {
    backgroundColor: '#E3F2FD', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#90CAF9',
  },
  syncBannerText: { color: '#1565C0', fontWeight: '700', fontSize: 13, textAlign: 'center' },

  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 12,
  },
  listTitle: { fontSize: 15, fontWeight: '800', color: DARK },
  refreshIconBtn: { padding: 4 },
  refreshIconText: { fontSize: 16 },
  addHaulBtn: { backgroundColor: '#1976D2', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10 },
  addHaulBtnText: { fontWeight: '800', fontSize: 13, color: '#fff' },
  manualBtn: { backgroundColor: '#F5F5F5', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ccc' },
  manualBtnText: { fontWeight: '700', fontSize: 13, color: '#555' },

  pendingTitle: { fontSize: 12, fontWeight: '700', color: '#E65100', marginBottom: 6 },
  pendingRow: {
    backgroundColor: '#FFF8E1', borderLeftWidth: 4, borderLeftColor: '#FFA000',
    borderRadius: 10, padding: 12, marginBottom: 8,
  },
  pendingBadge: { backgroundColor: '#FFE0B2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#E65100' },
  pendingPlate: { fontSize: 16, fontWeight: '800', color: DARK },
  pendingDate: { fontSize: 11, color: '#888', marginTop: 2 },
  pendingPayType: { fontSize: 12, color: '#555', marginTop: 2 },

  haulCard: {
    borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  haulCardPaid: { backgroundColor: '#fff', borderLeftColor: '#4CAF50' },
  haulCardUnpaid: { backgroundColor: '#FFFDE7', borderLeftColor: '#FFC107' },

  haulCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 },
  haulSerialRow: { flexDirection: 'row', gap: 4, flex: 1 },
  haulSerial: { fontSize: 10, color: '#888', fontFamily: 'monospace', backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  haulSerialCopied: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  printedBadge: { backgroundColor: '#E3F2FD', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  printedBadgeText: { fontSize: 10, color: '#1565C0', fontWeight: '600' },
  statusPaid: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPaidText: { fontSize: 11, color: '#2E7D32', fontWeight: '700' },
  statusPending: { backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FFC107' },
  statusPendingText: { fontSize: 11, color: '#E65100', fontWeight: '700' },

  haulCardMid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  haulDate: { fontSize: 11, color: '#888', marginBottom: 2 },
  haulPlate: { fontSize: 17, fontWeight: '800', color: DARK, letterSpacing: 1 },
  haulTonage: { fontSize: 11, color: '#888' },
  cashBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#A5D6A7' },
  cashBadgeText: { fontSize: 12, color: '#2E7D32', fontWeight: '700' },
  fuelBadge: { backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FFD54F' },
  fuelBadgeText: { fontSize: 12, color: '#E65100', fontWeight: '700' },

  haulNoteText: { fontSize: 12, color: '#555', fontStyle: 'italic', paddingHorizontal: 12, paddingBottom: 6 },
  haulCardBot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8 },
  haulDump: { fontSize: 15, color: '#666', flex: 1 },
  eyeBtn: { borderWidth: 1.5, borderColor: '#1565C0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtn: { borderWidth: 1.5, borderColor: '#E53935', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtnText: { color: '#E53935', fontSize: 12, fontWeight: '700' },
  eyeBtnText: { color: '#1565C0', fontSize: 12, fontWeight: '700' },
  approveBtn: { backgroundColor: '#E8F5E9', borderWidth: 1.5, borderColor: '#2E7D32', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  approveBtnText: { color: '#2E7D32', fontSize: 12, fontWeight: '700' },

  printBtn: { borderWidth: 1.5, borderColor: '#546E7A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  printBtnText: { color: '#546E7A', fontSize: 12, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#888', fontSize: 14, marginTop: 8 },

  // ── Modal overlay
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },

  // ── Silme modalları
  deleteModal: { width: '88%', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  deleteModalHeader: { backgroundColor: '#F57F17', paddingVertical: 16, paddingHorizontal: 20 },
  deleteModalHeaderText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  deleteModalBody: { padding: 20 },
  deleteModalJobName: { fontSize: 17, fontWeight: '700', color: '#222', textAlign: 'center', marginBottom: 12 },
  deleteModalInfoBox: { backgroundColor: '#FFF8E1', borderRadius: 8, padding: 10, marginBottom: 12 },
  deleteModalInfoText: { color: '#555', fontSize: 13, textAlign: 'center' },
  deleteModalWarning: { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  deleteExcelBtn: { backgroundColor: '#2E7D32', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  deleteExcelBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  deleteProceedBtn: { backgroundColor: '#C62828', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  deleteProceedBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  deleteModalCancelBtn: { borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 14, alignItems: 'center', backgroundColor: '#F5F5F5' },
  deleteModalCancelText: { color: '#555', fontSize: 15, fontWeight: '600' },

  // ── Sefer Gir / Manuel Ekle card
  addCard: { width: '92%', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginVertical: 20 },
  addCardHeader: {
    backgroundColor: '#1976D2', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 20,
  },
  addCardHeaderText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  closeX: { padding: 4 },
  closeXText: { fontSize: 20, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  addCardBody: { padding: 20 },
  addCardFooter: {
    flexDirection: 'row', gap: 8, padding: 16, backgroundColor: '#F9F9F9',
    borderTopWidth: 1, borderTopColor: '#eee', flexWrap: 'wrap',
  },

  // Fields
  fieldLabel: { fontWeight: '700', color: '#444', marginBottom: 6 },
  req: { color: '#E53935' },
  optional: { fontWeight: '400', color: '#aaa' },
  plateInput: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 14,
    fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 1,
    backgroundColor: '#FAFAFA',
  },
  textInput: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, backgroundColor: '#FAFAFA',
  },
  textInputReadonly: {
    backgroundColor: '#F0F0F0', borderColor: '#e0e0e0', color: '#555',
  },
  noteInput: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 14,
    minHeight: 60, textAlignVertical: 'top',
  },

  // Material badge (Kum/Mıcır)
  materialBadge: { backgroundColor: '#E3F2FD', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#90CAF9' },
  materialBadgeText: { fontSize: 11, color: '#1565C0', fontWeight: '700' },

  // Hesaplanan tutar kutusu
  calcBox: { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#A5D6A7' },
  calcBoxText: { color: '#2E7D32', fontWeight: '700', fontSize: 14, textAlign: 'center' },

  // Offer items
  noOfferBox: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FFD54F' },
  noOfferText: { color: '#E65100', fontSize: 13, fontWeight: '600' },
  offerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  offerItemSelected: { borderColor: '#1976D2', backgroundColor: '#E3F2FD' },
  offerName: { fontSize: 15, fontWeight: '700', color: DARK },
  offerCashBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  offerCashText: { color: '#2E7D32', fontWeight: '700', fontSize: 13 },
  offerFuelBadge: { backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  offerFuelText: { color: '#E65100', fontWeight: '700', fontSize: 13 },
  recentPlatesRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  recentPlateChip: {
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#90CAF9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recentPlateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
    letterSpacing: 0.5,
  },

  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#BDBDBD', alignItems: 'center', justifyContent: 'center' },
  radioCircleSelected: { borderColor: '#1976D2' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1976D2' },

  // Footer buttons
  cancelBtn: { backgroundColor: '#455A64', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sanalBtn: { flex: 1, borderWidth: 2, borderColor: '#1976D2', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  sanalBtnText: { color: '#1976D2', fontWeight: '800', fontSize: 13 },
  printSubmitBtn: { flex: 1, backgroundColor: '#1976D2', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  printSubmitBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  manualReceiptBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#4CAF50' },
  manualReceiptBtnText: { color: '#4CAF50', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  manualSaveBtn: { flex: 1, backgroundColor: '#4CAF50', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  manualSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' },

  // ── Ödeme Onay Modal
  paymentCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    padding: 0,
  },
  paymentHeader: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  paymentHeaderText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  paymentInfoBox: {
    backgroundColor: '#F1F8E9',
    margin: 16,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C5E1A5',
  },
  paymentInfoPlate: { fontSize: 18, fontWeight: '800', color: DARK, marginBottom: 4 },
  paymentInfoDate: { fontSize: 12, color: '#666', marginBottom: 2 },
  paymentInfoSite: { fontSize: 13, color: '#444', fontWeight: '600' },
  payTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  payTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDD',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  payTypeActive: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  payTypeText: { fontSize: 14, fontWeight: '600', color: '#777' },
  payTypeTextActive: { color: '#2E7D32', fontWeight: '800' },
  approveConfirmBtn: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  approveConfirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // ── Yakıt Ekle Modal
  fuelCard: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  fuelHeader: {
    backgroundColor: '#E65100',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  fuelHeaderText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  fuelInfoBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFB74D',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fuelInfoLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  fuelInfoValue: { fontSize: 20, fontWeight: '800', color: '#E65100' },
  fuelCalcBox: {
    marginTop: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  fuelCalcText: { color: '#2E7D32', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  fuelSaveBtn: {
    flex: 1,
    backgroundColor: '#E65100',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  fuelSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // ── Fiş Detay Modal (yeni tasarım)
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

  // Sol dikey şerit
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

  // Ana içerik alanı
  receiptMain: {
    flex: 1,
  },

  // Başlık: Logo + Firma + Saat
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
  receiptCompanyName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 0.2,
  },
  receiptJobSiteName: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
    marginTop: 2,
  },
  receiptTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    marginLeft: 6,
  },

  // Gövde: satırlar + QR yan yana
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

  // QR sağ sütun
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

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  searchClear: {
    fontSize: 14,
    color: '#aaa',
    paddingHorizontal: 4,
  },
});
