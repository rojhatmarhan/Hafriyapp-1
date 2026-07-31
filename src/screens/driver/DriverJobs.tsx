import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, ScrollView, Image, RefreshControl, TextInput,
  Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useAppSelector } from '../../hooks';
import { getHauls, getHaulsFiltered, updateHaulPayment, HaulApi } from '../../services/haulService';
import { getJobSites } from '../../services/jobSiteNewService';
import { getVehicles, driverAddVehicle, driverLeaveVehicle } from '../../services/vehicleService';

const YELLOW = '#FFD500';
const DARK = '#222';
const IMAGE_BASE = 'https://api.hafriyapp.com';

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

type FilterKey = 'all' | 'today' | 'week' | 'month';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
];

type VehicleItem = {
  id: string;
  plateNumber: string;
  isDriver: boolean;
  isCompanyVehicle: boolean;
  companyName?: string;
};

const toISO = (d: Date) => d.toISOString();

const getDateRange = (filter: FilterKey): { start: string; end: string } | null => {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000 - 1);
    return { start: toISO(start), end: toISO(end) };
  }
  if (filter === 'week') {
    const day = now.getDay() || 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    const end = new Date(start.getTime() + 7 * 86400000 - 1);
    return { start: toISO(start), end: toISO(end) };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: toISO(start), end: toISO(end) };
  }
  return null;
};

export default function DriverJobs() {
  const token = useAppSelector(s => s.auth.token) ?? '';

  const [hauls, setHauls] = useState<HaulApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const [selectedTrip, setSelectedTrip] = useState<HaulApi | null>(null);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [driverVehicle, setDriverVehicle] = useState<VehicleItem | null | undefined>(undefined);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [addVehicleVisible, setAddVehicleVisible] = useState(false);
  const [addVehiclePlate, setAddVehiclePlate] = useState('');
  const [addVehicleLoading, setAddVehicleLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Ödeme Onay Modal
  const [confirmPaymentModal, setConfirmPaymentModal] = useState(false);
  const [paymentHaul, setPaymentHaul] = useState<HaulApi | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentType, setPaymentType] = useState<0 | 1>(0); // 0=Nakit, 1=Yakıt
  const [paymentCash, setPaymentCash] = useState('');
  const [paymentFuel, setPaymentFuel] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchVehicle();
      fetchData(filter);
    }, [filter]),
  );

  const fetchVehicle = async () => {
    if (!token) return;
    setVehicleLoading(true);
    try {
      const data = await getVehicles(token);
      const vehicles: VehicleItem[] = Array.isArray(data) ? data : [];
      setDriverVehicle(vehicles.find(v => v.isDriver) ?? null);
    } catch {
      setDriverVehicle(null);
    } finally {
      setVehicleLoading(false);
    }
  };

  const fetchData = async (f: FilterKey, silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const range = getDateRange(f);
      const [data, jobs] = await Promise.all([
        range ? getHaulsFiltered(token, range.start, range.end) : getHauls(token),
        getJobSites(token).catch(() => []),
      ]);
      const hiddenIds = new Set(
        jobs.filter((j: any) => j.isHaulVisibleToVehicleOwners === false).map((j: any) => j.id)
      );
      const filtered = [...data].filter(h => !hiddenIds.has(h.jobSiteId));
      if (filtered.length > 0) {
        const sample = filtered[0] as any;
        console.log('[DriverJobs] Haul sample keys:', Object.keys(sample));
        console.log('[DriverJobs] driverName:', sample.driverName, '| DriverName:', sample.DriverName);
        console.log('[DriverJobs] driverPhone:', sample.driverPhone, '| DriverPhone:', sample.DriverPhone);
      }
      setHauls(
        filtered.sort((a, b) => new Date(b.timeOfHaul).getTime() - new Date(a.timeOfHaul).getTime())
      );
    } catch {
      Alert.alert('Hata', 'Seferler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async () => {
    const plate = addVehiclePlate.trim();
    if (!plate) { Alert.alert('Uyarı', 'Lütfen plaka numarasını girin.'); return; }
    setAddVehicleLoading(true);
    try {
      await driverAddVehicle(plate);
      setAddVehicleVisible(false);
      setAddVehiclePlate('');
      await fetchVehicle();
      Alert.alert('Başarılı', 'Araç başarıyla eklendi ve şoför olarak atandınız.');
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.message ?? 'Araç eklenemedi.');
    } finally {
      setAddVehicleLoading(false);
    }
  };

  const handleLeaveVehicle = (vehicleId: string) => {
    Alert.alert('Araçtan Ayrıl', 'Bu araçtan ayrılmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Ayrıl', style: 'destructive',
        onPress: async () => {
          setLeaveLoading(true);
          try {
            await driverLeaveVehicle(vehicleId);
            setDriverVehicle(null);
            Alert.alert('Başarılı', 'Araçtan başarıyla ayrıldınız.');
          } catch {
            Alert.alert('Hata', 'Araçtan ayrılırken bir hata oluştu.');
          } finally {
            setLeaveLoading(false);
          }
        },
      },
    ]);
  };

  const openPaymentConfirm = (item: HaulApi) => {
    setPaymentHaul(item);
    const hasCash = (item.cashAmount ?? 0) > 0;
    const hasFuel = (item.fuelAmount ?? 0) > 0;
    setPaymentType(!hasCash && hasFuel ? 1 : 0);
    setPaymentCash(hasCash ? String(item.cashAmount) : '');
    setPaymentFuel(hasFuel ? String(item.fuelAmount) : '');
    setConfirmPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!token || !paymentHaul) return;
    setPaymentSaving(true);
    try {
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
      setHauls(prev => prev.map(h => h.id === paymentHaul.id ? { ...h, isPaid: true } : h));
      if (selectedTrip?.id === paymentHaul.id) setSelectedTrip({ ...paymentHaul, isPaid: true });
      setConfirmPaymentModal(false);
      setPaymentHaul(null);
      setPaymentCash('');
      setPaymentFuel('');
      Alert.alert('Başarılı', 'Ödeme onaylandı.');
    } catch (error: any) {
      console.log('[ÖDEME HATA] status:', error?.response?.status);
      console.log('[ÖDEME HATA] data:', JSON.stringify(error?.response?.data));
      console.log('[ÖDEME HATA] haulId gönderilen:', paymentHaul?.id);
      console.log('[ÖDEME HATA] paymentType:', paymentType, '| cash:', paymentType === 0 ? parseFloat(paymentCash) || 0 : 0, '| fuel:', paymentType === 1 ? parseFloat(paymentFuel) || 0 : 0);
      const msg = error?.response?.data?.message || error?.response?.data?.title || error?.message || 'Ödeme onaylanırken hata oluştu.';
      Alert.alert('Hata', msg);
    } finally {
      setPaymentSaving(false);
    }
  };

  // Eski handleApprove — artık openPaymentConfirm kullanılıyor
  const handleApprove = (item: HaulApi) => openPaymentConfirm(item);

  const openReceipt = (item: HaulApi) => {
    console.log('[FİŞ] Ham API verisi:', JSON.stringify(item, null, 2));
    setSelectedTrip({
      ...item,
      driverName: item.driverName || (item as any).DriverName || undefined,
      driverPhone: item.driverPhone || (item as any).DriverPhone || undefined,
      companyName: item.companyName || (item as any).CompanyName || undefined,
      companyLogoPath: item.companyLogoPath || (item as any).CompanyLogoPath || undefined,
      contactPhone: item.contactPhone || (item as any).ContactPhone || undefined,
    });
    setReceiptVisible(true);
  };

  /* ─── HELPERS ─── */
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

  const autoSerial = (haul: HaulApi) => {
    if (haul.serialNumber) return haul.serialNumber;
    const d = new Date(haul.createdDate);
    const datePart = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const idPart = haul.id.substring(0, 4).toUpperCase();
    return `${datePart}${idPart}`;
  };

  const isToday = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    return d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
  };

  const copyWithFeedback = (value: string, key: string) => {
    Clipboard.setString(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  /* ─── STATS ─── */
  const total = hauls.length;
  const paid = hauls.filter(h => h.isPaid).length;
  const pending = total - paid;

  /* ─── ARAÇ BANNER ─── */
  const renderVehicleBanner = () => {
    if (vehicleLoading || driverVehicle === undefined) {
      return (
        <View style={vs.loadingWrap}>
          <ActivityIndicator size="small" color={YELLOW} />
          <Text style={vs.loadingText}>Araç bilgisi yükleniyor...</Text>
        </View>
      );
    }
    if (driverVehicle) {
      return (
        <View style={vs.assignedCard}>
          <View style={vs.assignedLeft}>
            <View style={vs.carIconWrap}><Text style={vs.carEmoji}>🚛</Text></View>
            <View>
              <Text style={vs.assignedLabel}>Kullandığım Araç</Text>
              <Text style={vs.plateText}>{driverVehicle.plateNumber}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[vs.leaveBtn, leaveLoading && { opacity: 0.5 }]}
            onPress={() => handleLeaveVehicle(driverVehicle.id)}
            disabled={leaveLoading}
          >
            {leaveLoading
              ? <ActivityIndicator size="small" color="#c62828" />
              : <Text style={vs.leaveBtnText}>Araçtan Ayrıl</Text>}
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={vs.noVehicleCard}>
        <View style={vs.noVehicleLeft}>
          <Text style={vs.warnEmoji}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={vs.noVehicleTitle}>Araç Atanmadı</Text>
            <Text style={vs.noVehicleDesc}>Sefer kaydedilebilmesi için araç atamanız gerekir.</Text>
          </View>
        </View>
        <TouchableOpacity style={vs.addVehicleBtn} onPress={() => setAddVehicleVisible(true)}>
          <Text style={vs.addVehicleBtnText}>+ Araç Ekle</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /* ─── SEFER KARTI ─── */
  const renderItem = ({ item }: { item: HaulApi }) => {
    const today = isToday(item.timeOfHaul);
    const isPaid = item.isPaid;

    return (
      <View style={[
        styles.haulCard,
        isPaid ? styles.haulCardPaid : styles.haulCardUnpaid,
        today && styles.haulCardToday,
      ]}>
        {/* Üst: Seri No + Durum */}
        <View style={styles.haulCardTopRow}>
          <TouchableOpacity
            style={styles.serialBox}
            onPress={() => copyWithFeedback(autoSerial(item), `${item.id}-sn`)}
            activeOpacity={0.7}
          >
            <Text style={[styles.serialAuto, copiedKey === `${item.id}-sn` && styles.serialCopied]}>
              {copiedKey === `${item.id}-sn` ? '✓ ' : ''}{autoSerial(item)}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {today && (
              <View style={styles.todayBadge}><Text style={styles.todayText}>Bugün</Text></View>
            )}
            {isPaid ? (
              <View style={styles.statusPaid}><Text style={styles.statusPaidText}>✔ Ödendi</Text></View>
            ) : (
              <View style={styles.statusPending}><Text style={styles.statusPendingText}>⏳ Bekliyor</Text></View>
            )}
          </View>
        </View>

        {/* Tarih + Plaka + Ücret */}
        <View style={styles.haulCardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.haulDateText}>{formatHaulDate(item.timeOfHaul)}</Text>
            <Text style={styles.haulPlateText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{item.plateNumber}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {item.tonage > 0 && (
              <Text style={styles.tonageText}>{item.tonage} kg</Text>
            )}
            {item.cashAmount > 0 && (
              <View style={styles.cashBadge}>
                <Text style={styles.cashBadgeText}>{item.cashAmount.toLocaleString('tr-TR')} ₺</Text>
              </View>
            )}
            {item.fuelAmount > 0 && (
              <View style={styles.fuelBadge}>
                <Text style={styles.fuelBadgeText}>{item.fuelAmount.toLocaleString('tr-TR')} Lt</Text>
              </View>
            )}
          </View>
        </View>

        {/* Şantiye → Döküm */}
        <View style={styles.haulCardRow}>
          <Text style={styles.haulSiteLabel} numberOfLines={1}>
            📍 {item.jobSiteName || item.companyName || '-'}
          </Text>
          {!!item.dumpLocation && (
            <Text style={styles.haulDumpText} numberOfLines={1}>→ {item.dumpLocation}</Text>
          )}
        </View>

        {/* Butonlar */}
        <View style={styles.haulCardActions}>
          <TouchableOpacity style={styles.haulFisBtn} onPress={() => openReceipt(item)}>
            <Text style={styles.haulFisBtnText}>👁 Fiş</Text>
          </TouchableOpacity>
          {!isPaid && !item.isPrintedReceipt ? (
            <TouchableOpacity
              style={styles.haulApproveBtn}
              onPress={() => handleApprove(item)}
              disabled={approvingId === item.id}
            >
              {approvingId === item.id
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.haulApproveBtnText}>✔ Onayla</Text>}
            </TouchableOpacity>
          ) : isPaid ? (
            <View style={styles.haulApprovedTag}>
              <Text style={styles.haulApprovedTagText}>✔ Onaylı</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  /* ─── FİŞ MODAL ─── */
  const renderReceipt = () => {
    if (!selectedTrip) return null;
    const item = selectedTrip;
    return (
      <Modal visible={receiptVisible} transparent animationType="fade" onRequestClose={() => setReceiptVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.receiptWrapper}>

            {/* Fiş Kart */}
            <View style={styles.receiptCard}>
              {/* Sol dikey şerit */}
              <View style={styles.receiptStrip}>
                <Text style={styles.receiptStripText}>HAFRİYAPP</Text>
              </View>

              {/* Ana içerik */}
              <View style={styles.receiptMain}>
                {/* Başlık */}
                <View style={styles.receiptHead}>
                  <View style={styles.receiptLogoBox}>
                    <Image
                      source={resolveReceiptLogo(item.companyLogoPath)}
                      style={styles.receiptLogoImg}
                      resizeMode={item.companyLogoPath ? "cover" : "contain"}
                    />
                  </View>
                  <View style={styles.receiptCompanyBlock}>
                    <Text style={styles.receiptCompany} numberOfLines={1}>
                      {(item.companyName || '').toUpperCase()}
                    </Text>
                    <Text style={styles.receiptJobsite} numberOfLines={1}>
                      {(item.jobSiteName || '').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.receiptBigTime}>
                    {new Date(item.timeOfHaul).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {/* Gövde: Satırlar + QR */}
                <View style={styles.receiptBodyWrap}>
                  <View style={styles.receiptBody}>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>Tarih :</Text>
                      <Text style={styles.receiptRowValue}>
                        {new Date(item.timeOfHaul).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>Seri No :</Text>
                      <Text style={styles.receiptRowValue}>{autoSerial(item)}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>Plaka :</Text>
                      <Text style={styles.receiptRowValue}>{item.plateNumber}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>Şoför :</Text>
                      <Text style={styles.receiptRowValue}>{item.driverName && item.driverPhone && item.driverName !== item.driverPhone ? `${item.driverName} - ${item.driverPhone}` : item.driverName || item.driverPhone || '-'}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>Döküm :</Text>
                      <Text style={styles.receiptRowValue}>{item.dumpLocation || '-'}</Text>
                    </View>
                    {item.tonage > 0 && (
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptRowLabel}>Tonaj :</Text>
                        <Text style={styles.receiptRowValue}>{item.tonage.toFixed(2)} Ton</Text>
                      </View>
                    )}
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>Ücret :</Text>
                      <Text style={[styles.receiptRowValue, { fontWeight: '800' }]}>
                        {[
                          item.cashAmount > 0 ? `${item.cashAmount.toLocaleString('tr-TR')}₺` : '',
                          item.fuelAmount > 0 ? `${item.fuelAmount.toLocaleString('tr-TR')}lt` : '',
                        ].filter(Boolean).join(' / ') || '-'}
                      </Text>
                    </View>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptRowLabel}>Durum :</Text>
                      <Text style={[styles.receiptRowValue, {
                        color: item.isPaid ? '#2E7D32' : '#E65100', fontWeight: '800',
                      }]}>
                        {item.isPaid ? '✔ Ödendi' : '⏳ Bekliyor'}
                      </Text>
                    </View>
                    {!!item.contactPhone && (
                      <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.receiptRowLabel}>Yetkili :</Text>
                        <Text style={styles.receiptRowValue}>{item.contactPhone}</Text>
                      </View>
                    )}
                  </View>

                  {/* QR */}
                  {!!item.qrCodeBase64 && (
                    <View style={styles.receiptQRBox}>
                      <Image
                        source={{ uri: `data:image/png;base64,${item.qrCodeBase64}` }}
                        style={styles.receiptQRImg}
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.receiptFooterRow}>
              <TouchableOpacity style={styles.receiptCloseBtn} onPress={() => setReceiptVisible(false)}>
                <Text style={styles.receiptCloseBtnText}>Kapat</Text>
              </TouchableOpacity>
              {!item.isPaid && !item.isPrintedReceipt && (
                <TouchableOpacity
                  style={styles.receiptApproveBtn}
                  onPress={() => { setReceiptVisible(false); setTimeout(() => openPaymentConfirm(item), 300); }}
                  disabled={paymentSaving}
                >
                  {paymentSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.receiptApproveBtnText}>Onayla</Text>}
                </TouchableOpacity>
              )}
            </View>

          </View>
        </View>
      </Modal>
    );
  };

  /* ─── ÖDEME ONAY MODAL ─── */
  const renderConfirmPaymentModal = () => (
    <Modal visible={confirmPaymentModal} transparent animationType="fade" onRequestClose={() => setConfirmPaymentModal(false)}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.paymentCard}>
              <View style={styles.paymentCardHeader}>
                <Text style={styles.paymentCardTitle}>💰 Ödeme Onayla</Text>
                <Pressable onPress={() => setConfirmPaymentModal(false)}>
                  <Text style={styles.paymentCardClose}>✕</Text>
                </Pressable>
              </View>

              {paymentHaul && (
                <>
                  <View style={styles.paymentInfoBox}>
                    <Text style={styles.paymentInfoPlate}>{paymentHaul.plateNumber}</Text>
                    <Text style={styles.paymentInfoDate}>{formatHaulDate(paymentHaul.timeOfHaul)}</Text>
                    <Text style={styles.paymentInfoSite}>{paymentHaul.jobSiteName}</Text>
                  </View>

                  <Text style={styles.paymentLabel}>Ödeme Türü</Text>
                  <View style={styles.payTypeRow}>
                    <TouchableOpacity
                      style={[styles.payTypeBtn, paymentType === 0 && styles.payTypeActive, !((paymentHaul.cashAmount ?? 0) > 0) && { opacity: 0.35 }]}
                      onPress={() => setPaymentType(0)}
                      disabled={!((paymentHaul.cashAmount ?? 0) > 0)}
                    >
                      <Text style={[styles.payTypeText, paymentType === 0 && styles.payTypeTextActive]}>💵 Nakit (₺)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.payTypeBtn, paymentType === 1 && styles.payTypeActive, !((paymentHaul.fuelAmount ?? 0) > 0) && { opacity: 0.35 }]}
                      onPress={() => setPaymentType(1)}
                      disabled={!((paymentHaul.fuelAmount ?? 0) > 0)}
                    >
                      <Text style={[styles.payTypeText, paymentType === 1 && styles.payTypeTextActive]}>⛽ Yakıt (Lt)</Text>
                    </TouchableOpacity>
                  </View>

                  {paymentType === 0 ? (
                    <>
                      <Text style={styles.paymentLabel}>Nakit Tutar (₺)</Text>
                      <View style={styles.paymentAmountChip}>
                        <Text style={styles.paymentAmountChipText}>💵 {paymentHaul.cashAmount.toLocaleString('tr-TR')} ₺</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.paymentLabel}>Yakıt Miktarı (Litre)</Text>
                      <View style={styles.paymentAmountChip}>
                        <Text style={styles.paymentAmountChipText}>⛽ {paymentHaul.fuelAmount.toLocaleString('tr-TR')} Lt</Text>
                      </View>
                    </>
                  )}
                </>
              )}

              <TouchableOpacity
                style={[styles.paymentConfirmBtn, paymentSaving && { opacity: 0.6 }]}
                onPress={handleConfirmPayment}
                disabled={paymentSaving}
              >
                <Text style={styles.paymentConfirmBtnText}>{paymentSaving ? 'Kaydediliyor...' : '✔ Ödemeyi Onayla'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setConfirmPaymentModal(false)}>
                <Text style={styles.paymentCancelText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  /* ─── ARAÇ EKLEME MODAL ─── */
  const renderAddVehicleModal = () => (
    <Modal
      visible={addVehicleVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setAddVehicleVisible(false)}
    >
      <SafeAreaView style={avm.container} edges={['top']}>
        <View style={avm.header}>
          <Text style={avm.title}>Kullandığım Aracı Ekle</Text>
          <TouchableOpacity onPress={() => setAddVehicleVisible(false)}>
            <Text style={avm.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={avm.body}>
          <Text style={avm.info}>
            Kullandığınız aracın plaka numarasını girin. Plaka sistemde kayıtlı değilse yeni araç oluşturulur ve size atanır.
          </Text>
          <Text style={avm.inputLabel}>Plaka No</Text>
          <TextInput
            style={avm.input}
            value={addVehiclePlate}
            onChangeText={v => setAddVehiclePlate(v.toUpperCase())}
            placeholder="Örn: 34ABC123"
            placeholderTextColor="#aaa"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[avm.saveBtn, addVehicleLoading && { opacity: 0.6 }]}
            onPress={handleAddVehicle}
            disabled={addVehicleLoading}
          >
            {addVehicleLoading
              ? <ActivityIndicator color="#222" />
              : <Text style={avm.saveBtnText}>Aracı Ekle</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Başlık */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>SEFERLERİM</Text>
        <TouchableOpacity
          style={[styles.refreshBtn, loading && { opacity: 0.5 }]}
          onPress={() => { fetchVehicle(); fetchData(filter); }}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#333" /> : <Text style={styles.refreshIcon}>↻</Text>}
        </TouchableOpacity>
      </View>

      {/* Araç Durumu */}
      <View style={styles.vehicleSection}>{renderVehicleBanner()}</View>

      {/* Filtre */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* İstatistik */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{total}</Text>
          <Text style={styles.statLabel}>Toplam</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#2E7D32' }]}>{paid}</Text>
          <Text style={styles.statLabel}>Ödendi</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#E65100' }]}>{pending}</Text>
          <Text style={styles.statLabel}>Bekliyor</Text>
        </View>
      </View>

      {/* Liste */}
      {loading && hauls.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      ) : (
        <FlatList
          data={hauls}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => { fetchVehicle(); fetchData(filter); }}
              tintColor={YELLOW}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Bu dönemde sefer kaydı bulunamadı.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {renderReceipt()}
      {renderConfirmPaymentModal()}
      {renderAddVehicleModal()}
    </SafeAreaView>
  );
}

/* ─────────── STILLER ─────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F4', paddingTop: 8 },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: DARK },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center',
  },
  refreshIcon: { fontSize: 20, fontWeight: '700', color: '#333' },

  vehicleSection: { paddingHorizontal: 16, marginBottom: 8 },

  filterBar: { height: 52, marginBottom: 4 },
  filterTab: {
    paddingHorizontal: 16,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#ddd',
  },
  filterTabActive: { backgroundColor: YELLOW, borderColor: YELLOW },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTabTextActive: { color: DARK },

  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '800', color: DARK },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#eee', marginVertical: 4 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 14 },

  /* Sefer Kartı */
  haulCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
    borderLeftWidth: 4, borderLeftColor: 'transparent',
  },
  haulCardPaid: { backgroundColor: '#fff', borderLeftColor: '#4CAF50' },
  haulCardUnpaid: { backgroundColor: '#FFFDE7', borderLeftColor: '#FFC107' },
  haulCardToday: { borderLeftColor: '#1565C0' },

  haulCardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  serialBox: { flexDirection: 'row', alignItems: 'center' },
  serialAuto: {
    fontSize: 11, fontFamily: 'monospace', color: '#555', fontWeight: '600',
    backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  serialCopied: { backgroundColor: '#E8F5E9', color: '#2E7D32' },

  todayBadge: { backgroundColor: '#E3F2FD', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  todayText: { fontSize: 10, color: '#1565C0', fontWeight: '700' },
  statusPaid: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPaidText: { fontSize: 11, color: '#2E7D32', fontWeight: '700' },
  statusPending: {
    backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FFC107',
  },
  statusPendingText: { fontSize: 11, color: '#E65100', fontWeight: '700' },

  haulCardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6,
  },
  haulDateText: { fontSize: 12, color: '#888', marginBottom: 2 },
  haulPlateText: { fontSize: 17, fontWeight: '800', color: DARK, letterSpacing: 1 },
  tonageText: { fontSize: 11, color: '#888', textAlign: 'right' },
  cashBadge: {
    backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#A5D6A7',
  },
  cashBadgeText: { fontSize: 12, color: '#2E7D32', fontWeight: '700' },
  fuelBadge: {
    backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FFD54F',
  },
  fuelBadgeText: { fontSize: 12, color: '#E65100', fontWeight: '700' },
  haulSiteLabel: { fontSize: 12, color: '#555', fontWeight: '600', flex: 1 },
  haulDumpText: { fontSize: 12, color: '#888', flex: 1, textAlign: 'right' },

  haulCardActions: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    gap: 8, marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  haulFisBtn: {
    borderWidth: 1.5, borderColor: '#1565C0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
  },
  haulFisBtnText: { color: '#1565C0', fontSize: 12, fontWeight: '700' },
  haulApproveBtn: {
    backgroundColor: '#4CAF50', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7,
  },
  haulApproveBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  haulApprovedTag: {
    backgroundColor: '#E8F5E9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
  },
  haulApprovedTagText: { color: '#2E7D32', fontSize: 12, fontWeight: '700' },

  /* Fiş Modal */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  receiptWrapper: {
    width: '92%', backgroundColor: '#fff', borderRadius: 20, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 12,
  },
  receiptCard: {
    width: '100%', flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#e0e0e0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 8,
  },
  receiptStrip: {
    width: 38, backgroundColor: '#2c2c2c',
    justifyContent: 'center', alignItems: 'center',
  },
  receiptStripText: {
    color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 3,
    transform: [{ rotate: '-90deg' }], width: 140, textAlign: 'center',
  },
  receiptMain: { flex: 1 },
  receiptHead: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#ebebeb',
  },
  receiptLogoBox: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  receiptLogoImg: { width: 44, height: 44 },
  receiptCompanyBlock: { flex: 1, marginLeft: 10 },
  receiptCompany: { fontSize: 14, fontWeight: '800', color: '#111', letterSpacing: 0.2 },
  receiptJobsite: { fontSize: 12, color: '#555', fontWeight: '600', marginTop: 2 },
  receiptBigTime: { fontSize: 13, fontWeight: '700', color: '#111', marginLeft: 6 },

  receiptBodyWrap: {
    flexDirection: 'row', paddingLeft: 14, paddingRight: 12,
    paddingTop: 6, paddingBottom: 12, overflow: 'hidden',
  },
  receiptBody: { flex: 1, minWidth: 0 },
  receiptRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.07)', borderStyle: 'dashed',
  },
  receiptRowLabel: { fontSize: 12, color: '#999', fontWeight: '500', width: 68 },
  receiptRowValue: { fontSize: 13, color: '#111', fontWeight: '700', flex: 1, flexShrink: 1 },
  receiptQRBox: { width: 82, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 4, paddingLeft: 6 },
  receiptQRImg: { width: 76, height: 76, borderRadius: 6, borderWidth: 1, borderColor: '#e0e0e0' },

  receiptFooterRow: { flexDirection: 'row', gap: 10, paddingTop: 12 },
  receiptCloseBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#bbb',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff',
  },
  receiptCloseBtnText: { color: '#333', fontWeight: '700', fontSize: 15 },
  receiptApproveBtn: {
    flex: 1, backgroundColor: '#2E7D32',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  receiptApproveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Ödeme Onay Modal
  paymentCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginHorizontal: 20,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  paymentCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  paymentCardTitle: { fontSize: 17, fontWeight: '800', color: '#222' },
  paymentCardClose: { fontSize: 20, color: '#888', paddingHorizontal: 4 },
  paymentInfoBox: {
    backgroundColor: '#FFF9E6', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FFD500',
  },
  paymentInfoPlate: { fontSize: 18, fontWeight: '800', color: '#222', marginBottom: 2 },
  paymentInfoDate: { fontSize: 13, color: '#666', marginBottom: 2 },
  paymentInfoSite: { fontSize: 13, color: '#444' },
  paymentAmountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  paymentAmountChip: {
    backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#C8E6C9', marginBottom: 16,
  },
  paymentAmountChipText: { fontSize: 15, fontWeight: '700', color: '#2E7D32' },
  paymentLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  payTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  payTypeBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#f7f7f7',
  },
  payTypeActive: { borderColor: '#FFD500', backgroundColor: '#FFF9E0' },
  payTypeText: { fontSize: 14, fontWeight: '600', color: '#888' },
  payTypeTextActive: { color: '#222', fontWeight: '800' },
  paymentConfirmBtn: {
    backgroundColor: '#222', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  paymentConfirmBtnText: { color: '#FFD500', fontWeight: '800', fontSize: 16 },
  paymentCancelText: { textAlign: 'center', color: '#888', fontSize: 14, paddingVertical: 8 },
});

/* ─── ARAÇ BANNER STİLLERİ ─── */
const vs = StyleSheet.create({
  loadingWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eee',
  },
  loadingText: { fontSize: 13, color: '#888' },
  assignedCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#C8E6C9',
  },
  assignedLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  carIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  carEmoji: { fontSize: 20 },
  assignedLabel: { fontSize: 11, color: '#4CAF50', fontWeight: '600' },
  plateText: { fontSize: 16, fontWeight: '800', color: '#1B5E20', letterSpacing: 1 },
  leaveBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2',
  },
  leaveBtnText: { fontSize: 12, fontWeight: '700', color: '#c62828' },
  noVehicleCard: {
    backgroundColor: '#FFFDE7', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FFF176',
  },
  noVehicleLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  warnEmoji: { fontSize: 20, marginTop: 1 },
  noVehicleTitle: { fontSize: 13, fontWeight: '700', color: '#333' },
  noVehicleDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  addVehicleBtn: { backgroundColor: YELLOW, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addVehicleBtnText: { fontSize: 14, fontWeight: '700', color: DARK },
});

/* ─── ARAÇ EKLEME MODAL STİLLERİ ─── */
const avm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  title: { fontSize: 17, fontWeight: '800', color: DARK },
  closeIcon: { fontSize: 18, color: '#888', padding: 4 },
  body: { padding: 20 },
  info: {
    fontSize: 13, color: '#666', lineHeight: 20,
    backgroundColor: '#F9F9F9', borderRadius: 10, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#eee',
  },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 18, fontWeight: '700', color: DARK, letterSpacing: 2, marginBottom: 20,
  },
  saveBtn: { backgroundColor: YELLOW, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: DARK },
});
