import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator, Alert, Platform, Linking, RefreshControl, Pressable, TextInput, ScrollView, KeyboardAvoidingView } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { useNavigation } from '@react-navigation/native';

import HaulSearchBar from '../../components/HaulSearchBar';
import DumpRecordDetail from '../../components/DumpRecordDetail';
import CebeciConnectionCard from '../../components/CebeciConnectionCard';
import { excelAc } from '../../utils/excelDownload';
import { QRScannerModal, ScannedQRData } from '../../components/QRScannerModal';
import { extractDumpTicketNo } from '../../components/DumpTicketInput';
import { useAppSelector } from '../../hooks';
import { useStickySearch } from '../../hooks/useStickySearch';
import { useDateRange, ddmmyyyyToYMD, todayDDMMYYYY } from '../../utils/dateRange';
import { DumpSource, dumpSourceTitle, formatTL, formatKg, formatTonnes, formatFee, formatDumpDateTime, getDumpMatchStatus, dumpStatusColor, DumpQueryParams, dumpSourceLabel, parseTurkishAmount, isValidDDMMYYYY, depositDateToIso, formatBalanceSubtext, DumpBalance, DumpStatusFilter, dumpFilterTitle, formatSinceNote } from '../../utils/dumpFormat';
import { getDumpSummary, getDumpRecords, buildDumpExportUrl, isEndpointMissing, DumpSummary, DumpRecord, getDeposits, addDeposit, deleteDeposit, DumpDeposit, uploadDumpExcel, formatImportResult, syncIstac, formatIstacSyncSummary, isIstacNotConfigured, isForbidden, isAutoSyncAllowed, deleteDumpRecord, deleteDumpImport, DumpImportResult } from '../../services/dumpService';

// ── İşlerim → Döküm: döküm sahası (Cebeci/KİG, İSTAÇ) Excel verilerinin özeti ve listesi.
// Ekran Modal içinde değil; kaynak/iş seçimi ve QR tarama ekran seviyesinde Modal kullanır.
// Eski API'de uçlar yok (404) → "sunucu güncellemesi gerekiyor" mesajı, ekran çökmez.
// Hesapta Kalan: para yatırma paneli tek Modal; içinde başka Modal (CalendarDateButton) açılmaz (iOS üst üste Modal göstermez)
// → tarih düz "GG.AA.YYYY" metin kutusu.
// Kullanıcıya görünen bağlanma/çekme metinlerinde "İSTAÇ" geçmez ("Verileri Çek", "Hesap Bağlantısı"); saha adı olarak kalabilir.
// Otomatik veri çekme izni yoksa (Integrations/istac allowed=false ya da 403) çekme düğmeleri hiç gösterilmez.

type JobOption = { id: string; name: string };
// topHeader: üst sayfanın kendi başlığı (İşlerim | Döküm sekmesi) — listenin en üstünde, içerikle birlikte kayar.
type Props = { jobSites: JobOption[]; topHeader?: React.ReactElement | null };

// Liste satırları: arama (sabit/sticky) ve filtre satırı veri dizisinin başına eklenen işaret satırlarıdır.
// FlatList'te sadece tek bir satır sabitlenebildiği için (stickyHeaderIndices) başlığın geri kalanı kayar.
const SEARCH_ROW = { id: '__dump_search__' } as const;
const FILTER_ROW = { id: '__dump_filter__' } as const;
type ListRow = DumpRecord | typeof SEARCH_ROW | typeof FILTER_ROW;
// ListHeaderComponent 0. sırada → veri dizisinin ilk elemanı (arama) 1. sırada
const STICKY_SEARCH_INDEX = [1];

const PAGE_SIZE = 30;
const DUMP_WEB_URL = 'https://hafriyapp.com/Dump/Index';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SOURCES: DumpSource[] = ['', 'Kig', 'Istac'];

export default function DumpOverview({ jobSites, topHeader = null }: Props) {
  // Alçak pencerede (yatay telefon) arama satırı da sabitlenmez
  const stickySearch = useStickySearch();
  const navigation = useNavigation<any>();
  const token = useAppSelector(state => state.auth.token);
  const companyId = useAppSelector(state => state.auth.companyId || state.auth.user?.companyId || null);

  const [source, setSource] = useState<DumpSource>('');
  const [jobSiteId, setJobSiteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Eşleşme filtresi ('' = tümü; "İşe Göre Filtrele" menüsünün üstündeki sabit seçenekler) ve açık satır (tıklayınca detay)
  const [status, setStatus] = useState<DumpStatusFilter>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Sekmeler (Web /Dump/Index ile aynı): Fişler varsayılan; Hesap = Hesapta Kalan; Yükle / İndir = İSTAÇ, Excel
  const [tab, setTab] = useState<'fisler' | 'hesap' | 'aktar'>('fisler');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { rangeStart, rangeEnd, isDefaultRange, changeStart, changeEnd, resetRange } = useDateRange();

  const [summary, setSummary] = useState<DumpSummary | null>(null);
  const [records, setRecords] = useState<DumpRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notSupported, setNotSupported] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncingIstac, setSyncingIstac] = useState(false);
  // Otomatik veri çekme izni: null = henüz bilinmiyor (düğme gizli), false = izin yok
  const [autoSyncAllowed, setAutoSyncAllowed] = useState<boolean | null>(null);
  // Döküm fişi / yükleme silme
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<DumpImportResult | null>(null);
  const [deletingImport, setDeletingImport] = useState(false);
  // Cebeci kartını aşağı çekip yenileyince tazele
  const [reloadKey, setReloadKey] = useState(0);

  const [sourceModal, setSourceModal] = useState(false);
  const [jobModal, setJobModal] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  // Hesapta Kalan / para yatırma paneli
  const [depositsVisible, setDepositsVisible] = useState(false);
  const [deposits, setDeposits] = useState<DumpDeposit[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositsError, setDepositsError] = useState<string | null>(null);
  const [depositsNotSupported, setDepositsNotSupported] = useState(false);
  const [formSource, setFormSource] = useState<DumpSource>('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(todayDDMMYYYY);
  const [formNote, setFormNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Eski cevaplar yeni filtrenin sonucunu ezmesin
  const requestIdRef = useRef(0);
  const depositReqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const baseParams = useCallback(
    (): DumpQueryParams => ({
      companyId: companyId || '',
      source,
      startDate: ddmmyyyyToYMD(rangeStart),
      endDate: ddmmyyyyToYMD(rangeEnd),
      jobSiteId,
      search: debouncedSearch,
      status: status || undefined,
    }),
    [companyId, source, rangeStart, rangeEnd, jobSiteId, debouncedSearch, status],
  );

  const errorMessage = (e: any): string => e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Döküm verileri yüklenemedi. Lütfen tekrar deneyin.';

  const loadAll = useCallback(
    async (isRefresh = false) => {
      if (!companyId) return;
      const reqId = ++requestIdRef.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorText(null);
      try {
        const params = baseParams();
        const [sum, pageRes] = await Promise.all([getDumpSummary(params), getDumpRecords({ ...params, page: 1, pageSize: PAGE_SIZE })]);
        if (reqId !== requestIdRef.current) return;
        setNotSupported(false);
        setSummary(sum);
        setRecords(pageRes.records);
        setPage(1);
        setTotalPages(pageRes.totalPages);
      } catch (e: any) {
        if (reqId !== requestIdRef.current) return;
        if (isEndpointMissing(e)) setNotSupported(true);
        else setErrorText(errorMessage(e));
        setSummary(null);
        setRecords([]);
        setTotalPages(0);
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [companyId, baseParams],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadAutoSyncAllowed = useCallback(async () => {
    if (!companyId) return;
    setAutoSyncAllowed(await isAutoSyncAllowed(companyId));
  }, [companyId]);

  useEffect(() => {
    loadAutoSyncAllowed();
  }, [loadAutoSyncAllowed]);

  const onPullRefresh = () => {
    loadAll(true);
    loadAutoSyncAllowed();
    setReloadKey(k => k + 1);
  };

  // ── Hesapta Kalan: özet kartını (bakiye) ve para yatırma listesini tazele
  const refreshSummary = useCallback(async () => {
    if (!companyId) return;
    const reqId = requestIdRef.current;
    try {
      const sum = await getDumpSummary(baseParams());
      if (reqId === requestIdRef.current) setSummary(sum);
    } catch {
      // Sessiz: liste yenilemesinde tekrar gelir
    }
  }, [companyId, baseParams]);

  const loadDeposits = useCallback(async () => {
    if (!companyId) return;
    const reqId = ++depositReqRef.current;
    setDepositsLoading(true);
    setDepositsError(null);
    try {
      const list = await getDeposits(companyId, source);
      if (reqId !== depositReqRef.current) return;
      setDepositsNotSupported(false);
      setDeposits(list);
    } catch (e: any) {
      if (reqId !== depositReqRef.current) return;
      if (isEndpointMissing(e)) setDepositsNotSupported(true);
      else setDepositsError(e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Para yatırma kayıtları yüklenemedi.');
      setDeposits([]);
    } finally {
      if (reqId === depositReqRef.current) setDepositsLoading(false);
    }
  }, [companyId, source]);

  const openDeposits = (preset?: 'Kig' | 'Istac') => {
    setFormSource(preset ?? source);
    setFormAmount('');
    setFormDate(todayDDMMYYYY());
    setFormNote('');
    setFormError(null);
    setDepositsVisible(true);
    loadDeposits();
  };

  const submitDeposit = async () => {
    if (!companyId || saving) return;
    if (formSource !== 'Kig' && formSource !== 'Istac') {
      setFormError('Döküm sahası seçin (Cebeci veya İSTAÇ).');
      return;
    }
    const amount = parseTurkishAmount(formAmount);
    if (amount === null || amount <= 0) {
      setFormError('Geçerli bir tutar girin (ör. 150.000,50).');
      return;
    }
    const dateText = formDate.trim();
    if (dateText && !isValidDDMMYYYY(dateText)) {
      setFormError('Tarihi GG.AA.YYYY biçiminde girin (ör. 24.10.2026).');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const note = formNote.trim();
      await addDeposit({ companyId, source: formSource, amount, depositDate: dateText ? depositDateToIso(dateText) : undefined, note: note || undefined });
      setFormAmount('');
      setFormNote('');
      setFormDate(todayDDMMYYYY());
      await Promise.all([loadDeposits(), refreshSummary()]);
    } catch (e: any) {
      if (isEndpointMissing(e)) setFormError('Bu özellik için sunucu güncellemesi gerekiyor.');
      else setFormError(e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Para yatırma kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteDeposit = (d: DumpDeposit) => {
    Alert.alert('Kaydı Sil', `${formatTL(d.amount)} tutarındaki para yatırma kaydı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(d.id);
          try {
            await deleteDeposit(d.id);
            await Promise.all([loadDeposits(), refreshSummary()]);
          } catch (e: any) {
            Alert.alert('Hata', e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Kayıt silinemedi.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  // ── Döküm fişi silme (satır detayındaki "Fişi Sil"); eşleşen sefer silinmez
  const confirmDeleteRecord = (item: DumpRecord) => {
    const label = item.etiketNo || item.kartKodu || item.fisNo || item.plateNumber || '';
    Alert.alert('Fişi Sil', `${label ? `${label} numaralı d` : 'D'}öküm fişi silinsin mi? Eşleşen sefer silinmez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setDeletingRecordId(item.id);
          try {
            await deleteDumpRecord(item.id);
            setExpandedId(null);
            loadAll();
          } catch (e: any) {
            if (isEndpointMissing(e) && !e?.response?.data?.errors?.[0]) Alert.alert('Bilgi', 'Bu özellik için sunucu güncellemesi gerekiyor.');
            else Alert.alert('Hata', e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Fiş silinemedi.');
          } finally {
            setDeletingRecordId(null);
          }
        },
      },
    ]);
  };

  // ── Son yüklenen dosyanın tamamını silme (yanlış dosya yüklendiyse)
  const confirmDeleteImport = () => {
    if (!lastUpload?.id || deletingImport) return;
    Alert.alert('Yüklemeyi sil', `${lastUpload.fileName} dosyasıyla eklenen tüm döküm fişleri silinsin mi? Eşleşen seferler silinmez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          setDeletingImport(true);
          try {
            const r = await deleteDumpImport(lastUpload.id);
            setLastUpload(null);
            Alert.alert('Silindi', `${r.deletedRecords} döküm fişi silindi.`);
            loadAll();
          } catch (e: any) {
            if (isEndpointMissing(e) && !e?.response?.data?.errors?.[0]) Alert.alert('Bilgi', 'Bu özellik için sunucu güncellemesi gerekiyor.');
            else Alert.alert('Hata', e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Yükleme silinemedi.');
          } finally {
            setDeletingImport(false);
          }
        },
      },
    ]);
  };

  const loadMore = async () => {
    if (!companyId || loading || loadingMore || refreshing || page >= totalPages) return;
    const reqId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await getDumpRecords({ ...baseParams(), page: next, pageSize: PAGE_SIZE });
      if (reqId !== requestIdRef.current) return;
      setRecords(prev => {
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...res.records.filter(r => !seen.has(r.id))];
      });
      setPage(next);
      setTotalPages(res.totalPages);
    } catch {
      // Sessiz: bir sonraki kaydırmada tekrar denenir
    } finally {
      setLoadingMore(false);
    }
  };

  const handleQrScan = (scanned: ScannedQRData) => {
    const code = scanned.type === 'SERIAL_OR_RAW' ? extractDumpTicketNo(scanned.raw) : scanned.plateNumber || scanned.raw;
    setSearch(code || '');
  };

  // ── Verileri Çek: döküm sahası hesabından otomatik çekme (güvenlik kodu sunucuda çözülür, en fazla 5 deneme)
  const goToAccountLink = () => navigation.navigate('Integrations', { companyId, from: 'Dump' });

  const pullFromIstac = async () => {
    if (!companyId || syncingIstac) return;
    setSyncingIstac(true);
    try {
      const res = await syncIstac({
        companyId,
        startDate: ddmmyyyyToYMD(rangeStart),
        endDate: ddmmyyyyToYMD(rangeEnd),
      });
      Alert.alert(res.plateMismatchRows > 0 ? '⚠️ Veriler Güncellendi' : '✅ Veriler Güncellendi', formatIstacSyncSummary(res));
      loadAll();
    } catch (e: any) {
      // İzin yok: API 403 + Türkçe mesaj → düğmeler gizlenir
      if (isForbidden(e)) {
        setAutoSyncAllowed(false);
        Alert.alert('Bilgi', e?.response?.data?.errors?.[0] || 'Otomatik veri çekme firmanız için açık değil. Döküm dosyasını elle yükleyebilirsiniz.');
        return;
      }
      // Hesap bilgileri kayıtlı değil: API mesajlı 404 döner (uç yoksa gövdesiz 404 → aşağıdaki eski mesaj)
      if (isIstacNotConfigured(e)) {
        Alert.alert('Hesap Bilgileri Gerekli', 'Döküm sahası kullanıcı adı ve şifrenizi kaydettikten sonra verileriniz otomatik çekilir.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Bilgileri Gir', onPress: goToAccountLink },
        ]);
        return;
      }
      if (isEndpointMissing(e)) {
        Alert.alert('Bilgi', 'Bu özellik için sunucu güncellemesi gerekiyor.');
        return;
      }
      const msg = e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Veriler çekilemedi.';
      if (/tanımlı değil|entegrasyon/i.test(String(msg))) {
        Alert.alert('Hesap Bağlantısı', msg, [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Hesap Bağlantısına Git', onPress: goToAccountLink },
        ]);
      } else {
        Alert.alert('Hata', msg);
      }
    } finally {
      setSyncingIstac(false);
    }
  };

  // ── Excel indir: seçilen döküm sahasının kendi biçiminde (yüklenen dosyanın aynısı), ekrandaki tarih aralığıyla (varsayılan bu ay)
  const downloadExcel = async (dumpSource: 'Kig' | 'Istac') => {
    if (!token || !companyId || downloading) return;
    setDownloading(true);
    try {
      const name = `${dumpSource === 'Istac' ? 'ISTAC' : 'Cebeci'}_Dokum_${rangeStart}-${rangeEnd}.xlsx`;
      const url = buildDumpExportUrl({ companyId, source: dumpSource, startDate: ddmmyyyyToYMD(rangeStart), endDate: ddmmyyyyToYMD(rangeEnd) });
      const res = await RNBlobUtil.config({ path: `${RNBlobUtil.fs.dirs.CacheDir}/${name}` }).fetch('GET', url, { Authorization: `Bearer ${token}` });
      const status = res.info()?.status;
      if (status === 404) {
        Alert.alert('Bilgi', 'Bu özellik için sunucu güncellemesi gerekiyor.');
        return;
      }
      if (status && status >= 400) {
        Alert.alert('Hata', 'Excel dosyası indirilemedi.');
        return;
      }
      await excelAc(res.path());
    } catch {
      Alert.alert('Hata', 'Excel dosyası indirilemedi.');
    } finally {
      setDownloading(false);
    }
  };

  // Dosya seçici yoksa (native modül bu derlemede yok) web sayfasına yönlendir
  const openUploadOnWeb = () => {
    Alert.alert('Döküm dosyasını yükle', 'Bu uygulama sürümünde dosya seçici yok. Excel yükleme hafriyapp.com → İşlerim → Döküm Verileri sayfasından yapılabilir.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: "Web'de Aç",
        onPress: () => {
          try {
            navigation.navigate('WebToolScreen', { url: DUMP_WEB_URL, title: 'DÖKÜM VERİLERİ' });
          } catch {
            Linking.openURL(DUMP_WEB_URL).catch(() => {});
          }
        },
      },
    ]);
  };

  // ── Excel yükle: telefondan .xlsx seç → base64 → POST api/DumpImport (format başlıktan otomatik tanınır: İSTAÇ / Cebeci)
  const uploadExcel = async () => {
    if (!companyId || uploading) return;
    let picker: typeof import('@react-native-documents/picker');
    try {
      picker = require('@react-native-documents/picker');
    } catch {
      openUploadOnWeb();
      return;
    }
    try {
      const [file] = await picker.pick({ type: [picker.types.xlsx], allowMultiSelection: false });
      const fileName = file.name || 'dokum.xlsx';
      if (!fileName.toLowerCase().endsWith('.xlsx')) {
        Alert.alert('Döküm dosyasını yükle', 'Sadece .xlsx dosyası yüklenebilir. (Eski .xls dosyasını Excel\'de .xlsx olarak kaydedin.)');
        return;
      }
      if (file.size && file.size > MAX_UPLOAD_BYTES) {
        Alert.alert('Döküm dosyasını yükle', 'Dosya en fazla 10 MB olabilir.');
        return;
      }
      setUploading(true);
      const [copy] = await picker.keepLocalCopy({ files: [{ uri: file.uri, fileName }], destination: 'cachesDirectory' });
      if (copy.status !== 'success') throw new Error('copy');
      const localPath = decodeURIComponent(copy.localUri.replace(/^file:\/\//, ''));
      const base64 = await RNBlobUtil.fs.readFile(localPath, 'base64');
      RNBlobUtil.fs.unlink(localPath).catch(() => {});
      const result = await uploadDumpExcel(companyId, fileName, base64);
      Alert.alert(result.plateMismatchRows > 0 ? '⚠️ Döküm dosyası yüklendi' : '✅ Döküm dosyası yüklendi', `${fileName}: ${formatImportResult(result)}`);
      // "Yüklemeyi sil" için son yükleme (yeni kayıt eklendiyse)
      setLastUpload(result.id && result.insertedRows > 0 ? result : null);
      loadAll();
    } catch (e: any) {
      if (picker.isErrorWithCode?.(e) && e.code === picker.errorCodes.OPERATION_CANCELED) return;
      if (/NativeDocumentPicker|TurboModule|could not be found/i.test(String(e?.message))) {
        openUploadOnWeb();
        return;
      }
      if (isEndpointMissing(e)) Alert.alert('Bilgi', 'Bu özellik için sunucu güncellemesi gerekiyor.');
      else Alert.alert('Hata', e?.response?.data?.errors?.[0] || e?.response?.data?.message || 'Döküm dosyası yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const selectedJobName = jobSiteId ? jobSites.find(j => j.id === jobSiteId)?.name || 'Seçili iş' : null;

  if (!companyId) {
    return (
      <View style={styles.container}>
        {topHeader}
        <View style={styles.centerBox}>
          <Text style={styles.centerText}>Döküm verileri için bir firmaya bağlı olmalısınız.</Text>
        </View>
      </View>
    );
  }

  const renderRecord = (item: DumpRecord) => {
    const status = getDumpMatchStatus(item.matchStatus);
    const dt = formatDumpDateTime(item.islemTarihi);
    const ticket = item.etiketNo || item.kartKodu || item.fisNo || '';
    const expanded = expandedId === item.id;
    // Ton sütunu: dolu (brüt) ağırlık, yoksa (eski API) net
    const listKg = item.brutKg ?? item.netKg;
    return (
      <Pressable onPress={() => setExpandedId(expanded ? null : item.id)} style={({ pressed }) => [styles.rowWrap, expanded && styles.rowWrapOpen, pressed && styles.rowWrapPressed]} accessibilityRole="button" accessibilityLabel="Fiş detayını aç/kapat">
      <View style={styles.row}>
        <View style={[styles.strip, { backgroundColor: dumpStatusColor(status) }]} />
        <View style={[styles.cell, styles.colPlate]}>
          <Text style={styles.plateText} numberOfLines={1}>
            {item.plateNumber || '-'}
          </Text>
          {!!ticket && (
            <Text style={styles.subText} numberOfLines={1}>
              {ticket}
            </Text>
          )}
        </View>
        <View style={[styles.cell, styles.colDate]}>
          <Text style={styles.cellText}>{dt.date}</Text>
          {!!dt.time && <Text style={styles.subText}>{dt.time}</Text>}
        </View>
        <View style={[styles.cell, styles.colJob]}>
          {status === 'unmatched' || !item.jobSiteName ? (
            <Text style={styles.unmatchedText}>Bulunamadı</Text>
          ) : (
            <>
              <Text style={[styles.cellText, status === 'plateMismatch' && styles.mismatchText]} numberOfLines={2}>
                {status === 'plateMismatch' ? `Farklı plaka${item.haulPlateNumber ? `: ${item.haulPlateNumber}` : ''}` : item.jobSiteName}
              </Text>
              <Text style={styles.subText} numberOfLines={1}>
                {status === 'plateMismatch' ? item.jobSiteName : item.haulSerialNumber ? `Seri ${item.haulSerialNumber}` : ''}
              </Text>
            </>
          )}
        </View>
        <View style={[styles.cell, styles.colAmount]}>
          <Text style={styles.tonText}>{formatTonnes(listKg)} Ton</Text>
          <Text style={styles.subText}>{formatFee(item.fisBedeli)} ₺</Text>
        </View>
      </View>
      {expanded && <DumpRecordDetail item={item} onDelete={confirmDeleteRecord} deleting={deletingRecordId === item.id} />}
      </Pressable>
    );
  };

  // Arama + tarih aralığı — listede sabit kalan tek satır (eleman olarak; yazarken odak kaybolmaz)
  const searchEl = (
    <View style={styles.stickySearch}>
      <HaulSearchBar query={search} onQueryChange={setSearch} onQrPress={() => setQrVisible(true)} placeholder="Etiket no, plaka, tarih…" rangeStart={rangeStart} rangeEnd={rangeEnd} onRangeStartChange={changeStart} onRangeEndChange={changeEnd} isDefaultRange={isDefaultRange} onResetRange={resetRange} />
    </View>
  );

  // İş / eşleşme filtresi + Verileri Çek (izin varsa) + sütun başlıkları — aramanın altında, listeyle birlikte kayar
  const filterActive = !!jobSiteId || !!status;
  const filtersEl = (
    <View>
      <View style={styles.jobFilterRow}>
        <TouchableOpacity style={[styles.jobFilterBtn, filterActive && styles.jobFilterBtnActive]} onPress={() => setJobModal(true)} activeOpacity={0.8}>
          <Text style={styles.jobFilterText} numberOfLines={1}>
            {dumpFilterTitle(status, selectedJobName)} ▾
          </Text>
        </TouchableOpacity>
        {filterActive && (
          <TouchableOpacity
            onPress={() => {
              setJobSiteId(null);
              setStatus('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Filtreyi kaldır">
            <Text style={styles.jobFilterClear}>✕</Text>
          </TouchableOpacity>
        )}
        {autoSyncAllowed === true && (
          <TouchableOpacity style={[styles.istacPullBtn, syncingIstac && styles.istacPullBtnDisabled]} onPress={pullFromIstac} disabled={syncingIstac || downloading || uploading} activeOpacity={0.85} accessibilityLabel="Döküm verilerini otomatik çek">
            {syncingIstac ? <ActivityIndicator size="small" color="#1B5E20" /> : <Text style={styles.istacPullBtnText}>🔄 Verileri Çek</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Sütun başlıkları */}
      <View style={styles.tableHead}>
        <View style={styles.stripSpace} />
        <Text style={[styles.headText, styles.colPlate]}>Plaka/Fiş</Text>
        <Text style={[styles.headText, styles.colDate]}>Tarih/Saat</Text>
        <Text style={[styles.headText, styles.colJob]}>Yükleme</Text>
        <Text style={[styles.headText, styles.colAmount, { textAlign: 'right' }]}>Ton/(₺)</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: ListRow }) => {
    if (item === SEARCH_ROW) return searchEl;
    if (item === FILTER_ROW) return filtersEl;
    return renderRecord(item as DumpRecord);
  };

  const onFisler = tab === 'fisler';
  const listData: ListRow[] = notSupported || !onFisler ? [] : [SEARCH_ROW, FILTER_ROW, ...records];
  const showEmpty = onFisler && !loading && !notSupported && records.length === 0;
  const busy = downloading || uploading || syncingIstac;

  // Hesapta Kalan kartı (Hesap sekmesi; eski API alanları döndürmezse gizli)
  // Yeni API: saha bazında (Cebeci, İSTAÇ) ayrı kartlar; kaynak seçiliyse sadece o saha. Eski API (balances yok): tek kart.
  const balanceCards: DumpBalance[] | null = summary?.balances?.length ? summary.balances.filter(b => !source || b.source === source) : null;

  const renderBalanceCard = (b: DumpBalance) => {
    const since = formatSinceNote(b.since);
    return (
      <TouchableOpacity key={b.source} style={styles.balanceCard} onPress={() => openDeposits(b.source)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${b.sourceName} hesapta kalan, para yatırma kayıtlarını aç`}>
        <View style={styles.balanceHead}>
          <Text style={styles.balanceLabel}>Hesapta Kalan · {b.sourceName}</Text>
          <Text style={styles.balanceChevron}>›</Text>
        </View>
        {b.hasDeposits ? (
          <>
            <Text style={[styles.balanceValue, b.balance < 0 && styles.balanceNegative]} numberOfLines={1} adjustsFontSizeToFit>
              {formatTL(b.balance)}
            </Text>
            <View style={styles.balanceRows}>
              {(
                [
                  ['Yatırılan', b.totalDeposits],
                  ['Harcanan', b.totalFees],
                  ['Kalan', b.balance],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={styles.balanceRow}>
                  <Text style={styles.balanceRowLabel}>{label}</Text>
                  <Text style={[styles.balanceRowValue, label === 'Kalan' && value < 0 && styles.balanceNegative]} numberOfLines={1}>
                    {formatTL(value)}
                  </Text>
                </View>
              ))}
            </View>
            {!!since && <Text style={styles.balanceSince}>{since}</Text>}
          </>
        ) : (
          <Text style={styles.balanceCta}>+ Yatırım ekle</Text>
        )}
      </TouchableOpacity>
    );
  };

  const balanceEl = balanceCards ? (
    <>{balanceCards.map(renderBalanceCard)}</>
  ) : summary?.balanceSupported ? (
    <TouchableOpacity style={styles.balanceCard} onPress={() => openDeposits()} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Hesapta kalan, para yatırma kayıtlarını aç">
      <View style={styles.balanceHead}>
        <Text style={styles.balanceLabel}>Hesapta Kalan{source ? ` · ${dumpSourceLabel(source)}` : ''}</Text>
        <Text style={styles.balanceChevron}>›</Text>
      </View>
      {summary.hasDeposits ? (
        <>
          <Text style={[styles.balanceValue, summary.balance < 0 && styles.balanceNegative]} numberOfLines={1} adjustsFontSizeToFit>
            {formatTL(summary.balance)}
          </Text>
          <Text style={styles.balanceSub} numberOfLines={1} adjustsFontSizeToFit>
            {formatBalanceSubtext(summary.totalDeposits, summary.totalFeesAllTime)}
          </Text>
        </>
      ) : (
        <Text style={styles.balanceCta}>+ Yatırım ekle</Text>
      )}
    </TouchableOpacity>
  ) : null;

  // Yükle / İndir sekmesi: Cebeci bağlantısı, Otomatik Veri Çekme (izin varsa), döküm Excel'i indir, döküm dosyasını yükle
  const aktarEl = (
    <View>
      <CebeciConnectionCard companyId={companyId} reloadKey={reloadKey} />
      <View style={styles.aktarCard}>
        <Text style={styles.aktarHint}>
          Tarih aralığı: {rangeStart || rangeEnd ? `${rangeStart || '…'} – ${rangeEnd || '…'}` : 'Tüm zamanlar'} (Fişler sekmesindeki tarih)
        </Text>
        {autoSyncAllowed === true && (
          <>
            <Text style={styles.aktarSection}>Otomatik Veri Çekme</Text>
            <TouchableOpacity style={[styles.aktarBtn, styles.aktarBtnPrimary, busy && styles.istacPullBtnDisabled]} onPress={pullFromIstac} disabled={busy} activeOpacity={0.85}>
              <Text style={[styles.aktarBtnText, styles.aktarBtnTextPrimary]}>🔄 Verileri Çek</Text>
            </TouchableOpacity>
          </>
        )}
        {(
          [
            ['📥 İSTAÇ Dökümleri indir', () => downloadExcel('Istac')],
            ['📥 Cebeci Dökümü indir', () => downloadExcel('Kig')],
          ] as const
        ).map(([label, onPress]) => (
          <TouchableOpacity key={label} style={[styles.aktarBtn, busy && styles.istacPullBtnDisabled]} onPress={onPress} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.aktarBtnText}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.aktarBtn, busy && styles.istacPullBtnDisabled]} onPress={uploadExcel} disabled={busy} activeOpacity={0.85}>
          <Text style={styles.aktarBtnText}>📤 Döküm dosyasını yükle</Text>
          <Text style={styles.aktarBtnSub}>(Seferleriniz sahada girdiklerinizle otomatik eşleşir. Not: Tekrarlanan seferler kendiliğinden bir kere sayılır.)</Text>
        </TouchableOpacity>
        {!!lastUpload && (
          <View style={styles.lastUploadRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.lastUploadName} numberOfLines={1}>
                Son yükleme: {lastUpload.fileName}
              </Text>
              <Text style={styles.lastUploadSub}>{lastUpload.insertedRows} yeni fiş eklendi</Text>
            </View>
            <TouchableOpacity style={[styles.lastUploadDelete, deletingImport && styles.istacPullBtnDisabled]} onPress={confirmDeleteImport} disabled={deletingImport} activeOpacity={0.8} accessibilityLabel="Son yüklemeyi sil">
              {deletingImport ? <ActivityIndicator size="small" color="#C62828" /> : <Text style={styles.lastUploadDeleteText}>Yüklemeyi sil</Text>}
            </TouchableOpacity>
          </View>
        )}
        {busy && <ActivityIndicator size="small" color="#111" style={{ marginTop: 8 }} />}
      </View>
    </View>
  );

  const header = (
    <View>
      {/* Üst sayfanın sekmesi (tam genişlik: listenin 12 px yan boşluğu geri alınır) */}
      {topHeader && <View style={styles.topHeader}>{topHeader}</View>}

      {/* Sekmeler */}
      <View style={styles.tabRow}>
        {(
          [
            ['fisler', 'Fişler'],
            ['hesap', 'Hesap'],
            ['aktar', 'Yükle / İndir'],
          ] as const
        ).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tabBtn, tab === key && styles.tabBtnActive]} onPress={() => setTab(key)} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.tabBtnText, tab === key && styles.tabBtnTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Kaynak seçici (Tümü / Cebeci / İSTAÇ) — her sekmede geçerli */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.sourceBtn} onPress={() => setSourceModal(true)} activeOpacity={0.8} accessibilityLabel="Döküm kaynağı seç">
          <Text style={styles.sourceBtnText} numberOfLines={1}>
            {dumpSourceTitle(source)} ▾
          </Text>
        </TouchableOpacity>
      </View>

      {notSupported ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardText}>Bu özellik için sunucu güncellemesi gerekiyor.</Text>
        </View>
      ) : tab === 'hesap' ? (
        balanceEl ?? (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>Hesapta Kalan için sunucu güncellemesi gerekiyor.</Text>
          </View>
        )
      ) : tab === 'aktar' ? (
        aktarEl
      ) : (
        <>
          {/* KPI kartları */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Toplam Sefer</Text>
              <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                {(summary?.recordCount ?? 0).toLocaleString('tr-TR')} Adet
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Top. Gider</Text>
              <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatTL(summary?.totalFee ?? 0)}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ortalama Tonaj</Text>
              <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatKg(summary?.averageBrutKg || summary?.averageNetKg || 0)}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Son Giriş Yapan Araçlar</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        stickyHeaderIndices={notSupported || !stickySearch || !onFisler ? undefined : STICKY_SEARCH_INDEX}
        // Veri dizisinde arama/filtre satırları olduğu için ListEmptyComponent çalışmaz → boş durum altbilgide
        ListFooterComponent={
          <>
            {loading && !refreshing && !notSupported && <ActivityIndicator size="large" color="#FFD500" style={{ marginTop: 16 }} />}
            {showEmpty && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>{errorText || 'Bu filtreye uygun döküm kaydı yok.'}</Text>
                {!errorText && <Text style={styles.emptyHint}>{autoSyncAllowed === true ? '"Yükle / İndir" sekmesinden verileri otomatik çekebilir veya döküm dosyanızı yükleyebilirsiniz.' : '"Yükle / İndir" sekmesinden döküm dosyanızı yükleyebilirsiniz.'}</Text>}
              </View>
            )}
            {loadingMore && <ActivityIndicator size="small" color="#FFD500" style={{ marginVertical: 14 }} />}
          </>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} />}
        extraData={`${tab}|${expandedId}|${status}|${deletingRecordId}|${autoSyncAllowed}`}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        // Android'de satır boyu değişince (detay açılınca) kırpılan satırlar boş çiziliyordu
        removeClippedSubviews={false}
        windowSize={7}
      />

      {/* Kaynak seçimi */}
      <Modal visible={sourceModal} transparent animationType="fade" onRequestClose={() => setSourceModal(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSourceModal(false)} accessibilityLabel="Kapat" />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Döküm Kaynağı</Text>
            {SOURCES.map(s => (
              <TouchableOpacity
                key={s || 'all'}
                style={[styles.sheetItem, source === s && styles.sheetItemActive]}
                onPress={() => {
                  setSource(s);
                  setSourceModal(false);
                }}>
                <Text style={styles.sheetItemText}>{dumpSourceTitle(s)}</Text>
                {source === s && <Text style={styles.sheetCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* İş / eşleşme filtresi: "Eşleşmeyen" ve "Farklı plaka" listenin dışında, hep en üstte (iş sayısı artsa da) */}
      <Modal visible={jobModal} transparent animationType="fade" onRequestClose={() => setJobModal(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setJobModal(false)} accessibilityLabel="Kapat" />
          <View style={[styles.sheet, styles.jobSheet]}>
            <Text style={styles.sheetTitle}>İşe Göre Filtrele</Text>
            {(
              [
                ['unmatched', 'Eşleşmeyen'],
                ['plateMismatch', 'Farklı plaka'],
              ] as const
            ).map(([key, label]) => {
              const active = status === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.sheetItem, styles.sheetItemPinned, active && styles.sheetItemActive]}
                  onPress={() => {
                    setStatus(active ? '' : key);
                    setJobSiteId(null);
                    setJobModal(false);
                  }}>
                  <Text style={[styles.sheetItemText, key === 'plateMismatch' && styles.sheetItemTextWarn]}>{label}</Text>
                  {active && <Text style={styles.sheetCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <FlatList
              style={styles.jobList}
              data={[{ id: '', name: 'Tüm İşler' }, ...jobSites]}
              keyExtractor={j => j.id || 'all'}
              renderItem={({ item: j }) => {
                const active = !status && (jobSiteId || '') === j.id;
                return (
                  <TouchableOpacity
                    style={[styles.sheetItem, active && styles.sheetItemActive]}
                    onPress={() => {
                      setJobSiteId(j.id || null);
                      setStatus('');
                      setJobModal(false);
                    }}>
                    <Text style={styles.sheetItemText} numberOfLines={2}>
                      {j.name}
                    </Text>
                    {active && <Text style={styles.sheetCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Para yatırma paneli (Hesapta Kalan) — içinde başka Modal yok */}
      <Modal visible={depositsVisible} transparent animationType="slide" onRequestClose={() => setDepositsVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.depOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDepositsVisible(false)} accessibilityLabel="Kapat" />
          <View style={styles.depSheet}>
            <View style={styles.depHeader}>
              <Text style={styles.depTitle}>Para Yatırma{source ? ` · ${dumpSourceLabel(source)}` : ''}</Text>
              <TouchableOpacity onPress={() => setDepositsVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Kapat">
                <Text style={styles.depClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {depositsNotSupported ? (
              <View style={[styles.infoCard, styles.depInfo]}>
                <Text style={styles.infoCardText}>Bu özellik için sunucu güncellemesi gerekiyor.</Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.depBody}>
                {/* + Para Yatırma Ekle */}
                <Text style={styles.depSection}>+ Para Yatırma Ekle</Text>
                <View style={styles.depSegment}>
                  {(['Kig', 'Istac'] as const).map(s => (
                    <TouchableOpacity key={s} style={[styles.depSegItem, formSource === s && styles.depSegItemActive]} onPress={() => setFormSource(s)} activeOpacity={0.8} accessibilityState={{ selected: formSource === s }}>
                      <Text style={[styles.depSegText, formSource === s && styles.depSegTextActive]}>{dumpSourceLabel(s)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.depFieldRow}>
                  <View style={styles.depFieldAmount}>
                    <Text style={styles.depFieldLabel}>Tutar (₺)</Text>
                    <TextInput style={styles.depInput} value={formAmount} onChangeText={setFormAmount} placeholder="150.000,00" placeholderTextColor="#AAA" keyboardType="decimal-pad" returnKeyType="done" />
                  </View>
                  <View style={styles.depFieldDate}>
                    <Text style={styles.depFieldLabel}>Tarih</Text>
                    <TextInput style={styles.depInput} value={formDate} onChangeText={setFormDate} placeholder="GG.AA.YYYY" placeholderTextColor="#AAA" keyboardType="numbers-and-punctuation" maxLength={10} />
                  </View>
                </View>
                <Text style={styles.depFieldLabel}>Not (isteğe bağlı)</Text>
                <TextInput style={styles.depInput} value={formNote} onChangeText={setFormNote} placeholder="Ör. havale, dekont no…" placeholderTextColor="#AAA" maxLength={500} />
                {!!formError && <Text style={styles.depError}>{formError}</Text>}
                <TouchableOpacity style={[styles.depSaveBtn, saving && styles.depSaveBtnDisabled]} onPress={submitDeposit} disabled={saving} activeOpacity={0.85}>
                  {saving ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.depSaveText}>Kaydet</Text>}
                </TouchableOpacity>

                {/* Liste */}
                <Text style={[styles.depSection, styles.depListTitle]}>Yatırılanlar</Text>
                {depositsLoading && deposits.length === 0 ? (
                  <ActivityIndicator size="small" color="#FFD500" style={styles.depSpinner} />
                ) : depositsError ? (
                  <Text style={styles.depEmpty}>{depositsError}</Text>
                ) : deposits.length === 0 ? (
                  <Text style={styles.depEmpty}>Henüz para yatırma kaydı yok.</Text>
                ) : (
                  deposits.map(d => (
                    <View key={d.id} style={styles.depRow}>
                      <View style={styles.depRowMain}>
                        <View style={styles.depRowTop}>
                          <Text style={styles.depRowDate}>{formatDumpDateTime(d.depositDate).date}</Text>
                          <Text style={styles.depRowSource}>{d.sourceName || dumpSourceLabel(d.sourceFormat) || '-'}</Text>
                          <Text style={styles.depRowAmount} numberOfLines={1}>
                            {formatTL(d.amount)}
                          </Text>
                        </View>
                        {!!d.note && (
                          <Text style={styles.depRowNote} numberOfLines={2}>
                            {d.note}
                          </Text>
                        )}
                        {!!d.createdByName && <Text style={styles.depRowBy}>{d.createdByName}</Text>}
                      </View>
                      {deletingId === d.id ? (
                        <ActivityIndicator size="small" color="#C62828" style={styles.depDelete} />
                      ) : (
                        <TouchableOpacity style={styles.depDelete} onPress={() => confirmDeleteDeposit(d)} disabled={!!deletingId} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Para yatırma kaydını sil">
                          <Text style={styles.depDeleteText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <QRScannerModal visible={qrVisible} onClose={() => setQrVisible(false)} onScan={handleQrScan} title="Döküm Fişi Barkod/QR Okutun" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingBottom: 120 },
  topHeader: { marginHorizontal: -12 },
  // Sabit arama satırı: opak arka plan (altından kayan satırlar görünmesin), tam genişlik
  stickySearch: { marginHorizontal: -12, paddingHorizontal: 12, paddingTop: 4, backgroundColor: '#F6F6F6' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { fontSize: 15, color: '#555', fontWeight: '600', textAlign: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: '#222', backgroundColor: '#fff', alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#222' },
  tabBtnText: { fontSize: 13, fontWeight: '800', color: '#222' },
  tabBtnTextActive: { color: '#fff' },
  aktarCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  aktarHint: { fontSize: 12, color: '#666', marginBottom: 2 },
  aktarBtn: { borderRadius: 12, borderWidth: 1.5, borderColor: '#CFCFCF', paddingVertical: 13, paddingHorizontal: 14, backgroundColor: '#fff' },
  aktarBtnPrimary: { backgroundColor: '#E8F5E9', borderColor: '#43A047' },
  aktarBtnText: { fontSize: 14, fontWeight: '700', color: '#222' },
  aktarBtnTextPrimary: { color: '#1B5E20', fontWeight: '800' },
  aktarBtnSub: { fontSize: 11.5, color: '#777', marginTop: 4, lineHeight: 16 },
  aktarSection: { fontSize: 13, fontWeight: '800', color: '#111', marginTop: 2 },
  lastUploadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F6F5F2', borderRadius: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  lastUploadName: { fontSize: 12.5, fontWeight: '700', color: '#222' },
  lastUploadSub: { fontSize: 11.5, color: '#777', marginTop: 2 },
  lastUploadDelete: { borderRadius: 10, borderWidth: 1.5, borderColor: '#EF9A9A', backgroundColor: '#FFF5F5', paddingVertical: 7, paddingHorizontal: 10, minWidth: 104, alignItems: 'center' },
  lastUploadDeleteText: { fontSize: 12.5, fontWeight: '800', color: '#C62828' },
  sourceBtn: { flex: 1, minWidth: 0, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#CFCFCF', paddingVertical: 12, paddingHorizontal: 14, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  sourceBtnText: { fontSize: 16, fontWeight: '800', color: '#111' },
  actionsBtn: { backgroundColor: '#FFD500', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, minWidth: 104, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  actionsBtnText: { fontSize: 14, fontWeight: '800', color: '#111' },

  infoCard: { backgroundColor: '#FFF8E1', borderRadius: 14, borderWidth: 1, borderColor: '#FFE082', padding: 18, marginTop: 6 },
  infoCardText: { fontSize: 15, fontWeight: '700', color: '#6D4C00', textAlign: 'center' },

  balanceCard: { backgroundColor: '#fff', borderRadius: 16, borderLeftWidth: 6, borderLeftColor: '#FFD500', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  balanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontSize: 13, color: '#666', fontWeight: '800' },
  balanceChevron: { fontSize: 22, color: '#AAA', fontWeight: '700', lineHeight: 22 },
  balanceValue: { fontSize: 28, color: '#111', fontWeight: '900', marginTop: 2 },
  balanceNegative: { color: '#C62828' },
  balanceSub: { fontSize: 12.5, color: '#777', fontWeight: '600', marginTop: 2 },
  balanceCta: { fontSize: 18, color: '#B38F00', fontWeight: '800', marginTop: 6 },
  balanceRows: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E0E0', paddingTop: 6 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  balanceRowLabel: { fontSize: 13, color: '#666', fontWeight: '700' },
  balanceRowValue: { fontSize: 13.5, color: '#111', fontWeight: '800' },
  balanceSince: { fontSize: 11.5, color: '#888', fontWeight: '600', marginTop: 6 },

  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: { flex: 1, minWidth: 0, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  kpiLabel: { fontSize: 12, color: '#666', fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  kpiValue: { fontSize: 16, color: '#111', fontWeight: '800', textAlign: 'center' },
  kpiSub: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111', marginTop: 16, marginBottom: 8 },

  jobFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  jobFilterBtn: { flexShrink: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#CFCFCF', paddingVertical: 10, paddingHorizontal: 14 },
  jobFilterBtnActive: { backgroundColor: '#FFF3B0', borderColor: '#F2DC6B' },
  jobFilterText: { fontSize: 14, fontWeight: '700', color: '#222' },
  jobFilterClear: { fontSize: 15, color: '#1976D2', fontWeight: '800' },
  istacPullBtn: { marginLeft: 'auto', backgroundColor: '#E8F5E9', borderRadius: 12, borderWidth: 1, borderColor: '#A5D6A7', paddingVertical: 10, paddingHorizontal: 12, minWidth: 124, alignItems: 'center', justifyContent: 'center' },
  istacPullBtnDisabled: { opacity: 0.6 },
  istacPullBtnText: { fontSize: 13.5, fontWeight: '800', color: '#1B5E20' },

  tableHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', marginBottom: 6 },
  headText: { fontSize: 12, fontWeight: '800', color: '#555', paddingHorizontal: 4 },
  stripSpace: { width: 6 },

  // Android: satır açılıp kapanınca yazılar kayboluyordu. Sebep: overflow:'hidden' + gölge (elevation) olan kutuda kenarlık
  // kalınlığının değişmesi. Kenarlık hep aynı kalınlıkta (kapalıyken şeffaf), overflow yok; şeridin köşeleri ayrıca yuvarlak.
  rowWrap: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  rowWrapOpen: { borderColor: '#222' },
  rowWrapPressed: { backgroundColor: '#F6F5F2' },
  row: { flexDirection: 'row', alignItems: 'stretch', paddingRight: 10 },
  strip: { width: 6, borderTopLeftRadius: 9, borderBottomLeftRadius: 9 },
  cell: { paddingVertical: 9, paddingHorizontal: 4, justifyContent: 'center' },
  colPlate: { flex: 1.3 },
  colDate: { flex: 1 },
  colJob: { flex: 1.2 },
  colAmount: { flex: 1, alignItems: 'flex-end' },
  plateText: { fontSize: 14, fontWeight: '800', color: '#111' },
  cellText: { fontSize: 12.5, fontWeight: '600', color: '#222' },
  subText: { fontSize: 11.5, color: '#777', marginTop: 2 },
  mismatchText: { fontSize: 11, color: '#C62828', fontWeight: '700', marginTop: 2 },
  unmatchedText: { fontSize: 12.5, color: '#C62828', fontWeight: '800' },
  tonText: { fontSize: 13.5, fontWeight: '800', color: '#111' },

  emptyBox: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 14, color: '#666', fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 18 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 10 },
  jobSheet: { maxHeight: '75%' },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#111', paddingHorizontal: 18, paddingVertical: 10 },
  sheetSubtitle: { fontSize: 12.5, fontWeight: '600', color: '#666', paddingHorizontal: 18, paddingBottom: 8 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  sheetItemActive: { backgroundColor: '#FFF8D6' },
  sheetItemPinned: { backgroundColor: '#FAFAFA' },
  sheetItemTextWarn: { color: '#C62828' },
  jobList: { flexGrow: 0, flexShrink: 1 },
  sheetItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#222' },
  sheetCheck: { fontSize: 16, fontWeight: '800', color: '#2E7D32', marginLeft: 8 },

  depOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  depSheet: { backgroundColor: '#F3F2F3', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%', paddingBottom: 24 },
  depHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  depTitle: { fontSize: 17, fontWeight: '900', color: '#111', flex: 1 },
  depClose: { fontSize: 18, fontWeight: '800', color: '#555' },
  depInfo: { marginHorizontal: 16, marginBottom: 12 },
  depBody: { paddingHorizontal: 16, paddingBottom: 12 },
  depSection: { fontSize: 15, fontWeight: '800', color: '#111', marginTop: 6, marginBottom: 8 },
  depListTitle: { marginTop: 18 },
  depSpinner: { marginVertical: 14 },
  depSegment: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#CFCFCF', padding: 3, marginBottom: 10 },
  depSegItem: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  depSegItemActive: { backgroundColor: '#FFD500' },
  depSegText: { fontSize: 15, fontWeight: '700', color: '#555' },
  depSegTextActive: { color: '#111', fontWeight: '900' },
  depFieldRow: { flexDirection: 'row', gap: 8 },
  depFieldAmount: { flex: 1.3 },
  depFieldDate: { flex: 1 },
  depFieldLabel: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 4 },
  depInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#CFCFCF', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 15, color: '#111', marginBottom: 10 },
  depError: { fontSize: 13, color: '#C62828', fontWeight: '700', marginBottom: 8 },
  depSaveBtn: { backgroundColor: '#FFD500', borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  depSaveBtnDisabled: { opacity: 0.6 },
  depSaveText: { fontSize: 15, fontWeight: '900', color: '#111' },
  depEmpty: { fontSize: 13.5, color: '#777', fontWeight: '600', textAlign: 'center', paddingVertical: 14 },
  depRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 6, marginBottom: 6 },
  depRowMain: { flex: 1, minWidth: 0 },
  depRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  depRowDate: { fontSize: 13, fontWeight: '700', color: '#222' },
  depRowSource: { fontSize: 12, fontWeight: '800', color: '#6D4C00', backgroundColor: '#FFF3B0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  depRowAmount: { flex: 1, fontSize: 15, fontWeight: '900', color: '#111', textAlign: 'right' },
  depRowNote: { fontSize: 12.5, color: '#555', marginTop: 4 },
  depRowBy: { fontSize: 11.5, color: '#999', marginTop: 2 },
  depDelete: { width: 34, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  depDeleteText: { fontSize: 16, fontWeight: '800', color: '#C62828' },
});
