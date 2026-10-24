import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import NewJobModal from '../../components/NewJobModal';
import {
  deleteJobSite,
  toggleJobSiteActive,
  getJobSites,
  toggleJobSitePin,
} from '../../services/jobSiteNewService';
import { useAppSelector } from '../../hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const YELLOW = '#FFD500';

type Job = {
  id: string;
  name: string;
  provinceCode: number;
  districtName: string;
  locationUrl: string;
  contactPhone: string;
  description: string;
  signDescription: string;
  jobType: number;
  offer1Name: string;
  offer1Cash: number;
  offer1Fuel: number;
  extraOffersJson: string;
  hasSand: boolean;
  fuelStock: number;
  loadingStartTime: string;
  loadingEndTime: string;
  canEdit: boolean;
  isActive: boolean;
  showHaulsToVehicleOwners: boolean;
  fuelLiters: number;
  sandFuelLiters: number;
};

type JobUI = {
  id: string;
  site: string;
  today: number;
  total: number;
  paid: number;
  unpaid: number;
  fuelLeft: string;
  fuelGiven: string;
  cashGiven: string;
  totalTonage: number;
  canEdit: boolean;
  isActive: boolean;
  // Başa tutturma (kullanıcıya özel). Eski API'de alan yok → undefined, pin özelliği gizlenir.
  isPinned?: boolean;
  raw: Job;
};

export default function MyJobs() {
  const navigation = useNavigation<any>();
  const token = useAppSelector(state => state.auth.token);
  const [jobs, setJobs] = useState<JobUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'HAFRIYAT' | 'KUM'>('ALL');
  const insets = useSafeAreaInsets();

  const fetchJobs = async (isRefresh = false) => {
    if (!token) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await getJobSites(token);

      const mapped: JobUI[] = (data || []).map((item: any) => {
        const today = item.todayHauls ?? 0;
        const total = item.totalHauls ?? 0;
        const paid = item.paidHauls ?? 0;
        const unpaid = item.unpaidHauls ?? 0;
        const fuelGiven = `${(item.fuelGiven ?? 0).toFixed(0)} lt`;
        const cashGiven = `${(item.cashGiven ?? 0).toFixed(0)}₺`;
        const totalTonage = parseFloat(((item.totalTonage ?? 0) / 1000).toFixed(1));

        return {
          id: item.id,
          site: item.name,
          today,
          total,
          paid,
          unpaid,
          fuelLeft: `${item.fuelStock ?? 0} lt`,
          fuelGiven,
          cashGiven,
          totalTonage,
          canEdit: item.canEdit,
          isActive: item.isActive,
          isPinned: typeof item.isPinned === 'boolean' ? item.isPinned : undefined,
          raw: item,
        };
      });

      setJobs(mapped);
    } catch (err) {
      console.log('JobSite fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [token]),
  );

  const handleEdit = (job: Job) => {
    setSelectedJob(job);
    setShowModal(true);
  };

  const handleNewJob = () => {
    setSelectedJob(undefined);
    setShowModal(true);
  };

  const handleCloseModal = (refresh?: boolean) => {
    setShowModal(false);
    setSelectedJob(undefined);
    if (refresh) {
      fetchJobs();
    }
  };

  const handleToggleActive = (job: JobUI) => {
    const nextActive = !job.isActive;
    const msg = nextActive
      ? 'Bu işi tekrar yayına almak istiyor musunuz?'
      : 'Bu işi yayından kaldırmak istiyor musunuz?';

    Alert.alert(nextActive ? 'Yayına Al' : 'Yayından Kaldır', msg, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Evet',
        onPress: async () => {
          if (!token) return;
          try {
            await toggleJobSiteActive(token, job.id, nextActive);
            fetchJobs();
          } catch {
            Alert.alert('Hata', 'İşlem sırasında bir sorun oluştu.');
          }
        },
      },
    ]);
  };

  const downloadExcel = async (jobId: string, jobName: string) => {
    if (!token) return;
    setDownloading(true);
    try {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `Seferler_${jobName}_${date}.xlsx`;
      const res = await RNBlobUtil.config({ fileCache: true, appendExt: 'xlsx' })
        .fetch('GET', `https://api.hafriyapp.com/api/Haul/jobsite/${jobId}/export`, {
          Authorization: `Bearer ${token}`,
        });
      const path = res.path();
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

  const downloadAllExcel = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const res = await RNBlobUtil.config({ fileCache: true, appendExt: 'xlsx' })
        .fetch('GET', 'https://api.hafriyapp.com/api/Haul/all-jobsites/export', {
          Authorization: `Bearer ${token}`,
        });
      const path = res.path();
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

  const handleDownloadPress = () => {
    if (jobs.length === 0) { Alert.alert('Uyarı', 'İndirilecek iş bulunamadı.'); return; }
    if (jobs.length === 1) { downloadExcel(jobs[0].id, jobs[0].site); return; }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Hangi işin seferlerini indirmek istersiniz?',
          options: ['İptal', 'Tüm İşleri İndir', ...jobs.map(j => j.site)],
          cancelButtonIndex: 0,
        },
        idx => {
          if (idx === 1) downloadAllExcel();
          else if (idx > 1) downloadExcel(jobs[idx - 2].id, jobs[idx - 2].site);
        },
      );
    } else {
      Alert.alert('İş Seç', '', [
        { text: '⬇ Tüm İşleri İndir', onPress: downloadAllExcel },
        ...jobs.map(j => ({ text: j.site, onPress: () => downloadExcel(j.id, j.site) })),
        { text: 'İptal', style: 'cancel' },
      ]);
    }
  };

  const handleFinishJob = (jobId: string) => {
    Alert.alert(
      'İşi Bitir',
      'İşi bitirmek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            if (token) {
              try {
                await deleteJobSite(token, jobId);
                fetchJobs();
                Alert.alert('Başarılı', 'İş başarıyla sonlandırıldı.');
              } catch {
                Alert.alert('Hata', 'İş sonlandırılırken bir sorun oluştu.');
              }
            }
          },
        },
      ],
    );
  };

  // API pin desteği: en az bir işte boolean isPinned geldiyse pin butonları gösterilir
  const pinSupported = useMemo(() => jobs.some(j => typeof j.isPinned === 'boolean'), [jobs]);
  const pinInFlightRef = useRef<Set<string>>(new Set());

  const handleTogglePin = async (job: JobUI) => {
    if (!token || pinInFlightRef.current.has(job.id)) return;
    const prevPinned = job.isPinned === true;
    const nextPinned = !prevPinned;
    pinInFlightRef.current.add(job.id);
    // İyimser güncelleme
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, isPinned: nextPinned } : j)));
    try {
      const res = await toggleJobSitePin(token, job.id);
      // Sunucu durumu her zaman uygulanır (aynı işe art arda dokunulursa listedeki değer bayat kalmasın)
      if (typeof res?.isPinned === 'boolean') {
        const serverPinned = res.isPinned;
        setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, isPinned: serverPinned } : j)));
      }
    } catch (e: any) {
      // Geri al
      setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, isPinned: prevPinned } : j)));
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.[0] || (nextPinned ? 'İş başa tutturulamadı. Lütfen tekrar deneyin.' : 'İşin tutturması kaldırılamadı. Lütfen tekrar deneyin.');
      Alert.alert('Hata', msg);
    } finally {
      pinInFlightRef.current.delete(job.id);
    }
  };

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = jobs.filter(item => {
      const matchesType =
        filterType === 'ALL' ||
        (filterType === 'KUM' && item.raw.jobType === 1) ||
        (filterType === 'HAFRIYAT' && item.raw.jobType !== 1);
      const matchesSearch = !q || item.site.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
    if (!pinSupported) return list;
    // Başa tutturulanlar üstte; kendi aralarında sunucunun sırası (CreatedDate desc) korunur
    return list
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const ap = a.item.isPinned === true ? 1 : 0;
        const bp = b.item.isPinned === true ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return a.index - b.index;
      })
      .map(x => x.item);
  }, [jobs, search, filterType, pinSupported]);

  const renderItem = ({ item }: { item: JobUI }) => {
    const isKum = item.raw.jobType === 1;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('JobDetails', { job: item.raw })}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          {pinSupported ? (
            <View style={styles.siteRow}>
              <Text style={[styles.site, styles.siteInRow]}>{item.site}</Text>
              {item.isPinned === true && <Text style={styles.pinnedIndicator}>📌</Text>}
              <TouchableOpacity
                style={[styles.pinBtn, item.isPinned === true && styles.pinBtnActive]}
                onPress={() => handleTogglePin(item)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityLabel={item.isPinned === true ? 'Tutturmayı kaldır' : 'Başa tuttur'}
              >
                <Text style={styles.pinIcon}>📌</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.site}>{item.site}</Text>
          )}
          {/* <Text style={styles.jobType}>
            {isKum ? 'Kum & Mıcır' : 'Hafriyat Döküm'}
          </Text> */}

          <View style={{ marginTop: '2%' }}>
            <Text style={styles.info}>Bugün atılan seferler: <Text style={styles.infoBold}>{item.today}</Text></Text>
            <Text style={styles.info}>Toplam atılan seferler: <Text style={styles.infoBold}>{item.total}</Text></Text>
            <Text style={styles.info}>Ödemesi yapılan: <Text style={[styles.infoBold, { color: '#2E7D32' }]}>{item.paid}</Text></Text>
            <Text style={styles.info}>Ödemesi yapılmayan: <Text style={[styles.infoBold, { color: '#E53935' }]}>{item.unpaid}</Text></Text>
          </View>
        </View>

        <View style={styles.right}>
          {/* Hafriyat: yakıt + nakit kutusu */}
          {!isKum && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Kaynak Durumu</Text>
              <Text style={[styles.infoBoxRow, { color: '#E53935' }]}>Nakit: {parseFloat(item.cashGiven) !== 0 ? `-${item.cashGiven}` : item.cashGiven}</Text>
              <Text style={[styles.infoBoxRow, { color: '#E53935' }]}>Yakıt: {parseFloat(item.fuelGiven) !== 0 ? `-${item.fuelGiven}` : item.fuelGiven}</Text>
              <Text style={[styles.infoBoxRow, { color: '#1565C0' }]}>Kalan: {item.fuelLeft}</Text>
            </View>
          )}

          {/* Kum/Mıcır: tonaj + nakit kutusu */}
          {isKum && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Malzeme</Text>
              <Text style={styles.infoBoxValue}>{item.totalTonage} Ton</Text>
              <View style={styles.infoBoxCashRow}>
                <Text style={styles.infoBoxCash}>{item.cashGiven}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleToggleActive(item)}
          >
            <Text style={styles.actionBtnText}>
              {item.isActive ? 'Yayından Kaldır' : 'Yayına Al'}
            </Text>
          </TouchableOpacity>
          {item.canEdit && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item.raw)}>
              <Text style={styles.actionBtnText}>Düzenle</Text>
            </TouchableOpacity>
          )}

        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={YELLOW} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[
        styles.content,
        { marginTop: -insets.top + 15 },
      ]}>
        <Text style={styles.title}>FİRMANIZA AİT İŞLER</Text>

        {/* ARAMA */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="İş adına göre ara..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchJobs(true)}
            activeOpacity={0.7}
            disabled={refreshing}
          >
            <Text style={[styles.refreshIcon, refreshing && { opacity: 0.4 }]}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={handleDownloadPress}
            activeOpacity={0.7}
            disabled={downloading}
          >
            {downloading
              ? <ActivityIndicator size="small" color="#111" />
              : <Text style={styles.downloadIcon}>⬇</Text>
            }
          </TouchableOpacity>
        </View>

        {/* FİLTRE */}
        {/* <View style={styles.filterRow}>
          {(['ALL', 'HAFRIYAT', 'KUM'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, filterType === type && styles.filterChipActive]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.filterChipText, filterType === type && styles.filterChipTextActive]}>
                {type === 'ALL' ? 'Tümü' : type === 'HAFRIYAT' ? 'Hafriyat' : 'Kum & Mıcır'}
              </Text>
            </TouchableOpacity>
          ))}
        </View> */}

        <FlatList
          data={filteredJobs}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          style={{ marginTop: '2%' }}
          refreshing={refreshing}
          onRefresh={() => fetchJobs(true)}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={
            search.trim() ? (
              <Text style={styles.emptyText}>Arama kriterine uygun iş bulunamadı</Text>
            ) : (
              <View style={styles.guideCard}>
                <Text style={styles.guideCardEmoji}>🏗️</Text>
                <Text style={styles.guideCardTitle}>Nasıl Yeni İş Kurulur? (Adım Adım Rehber)</Text>
                <View style={styles.guideStepRow}>
                  <View style={styles.guideStepNumberBadge}><Text style={styles.guideStepNumber}>1</Text></View>
                  <Text style={styles.guideStepText}>Sağ alttaki sarı <Text style={{ fontWeight: '700' }}>"＋ Yeni İş Kur"</Text> butonuna dokunun.</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <View style={styles.guideStepNumberBadge}><Text style={styles.guideStepNumber}>2</Text></View>
                  <Text style={styles.guideStepText}>İş türünüzü seçin (<Text style={{ fontWeight: '700' }}>Hafriyat / Döküm</Text> veya <Text style={{ fontWeight: '700' }}>Kum-Mıcır</Text>).</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <View style={styles.guideStepNumberBadge}><Text style={styles.guideStepNumber}>3</Text></View>
                  <Text style={styles.guideStepText}>Şantiye adını, konumunu ve döküm yeri tekliflerini (Nakit ₺ ve Yakıt Lt) belirleyin.</Text>
                </View>
                <View style={styles.guideStepRow}>
                  <View style={styles.guideStepNumberBadge}><Text style={styles.guideStepNumber}>4</Text></View>
                  <Text style={styles.guideStepText}>İşinizi kurduktan sonra araç plakalarını tarayarak sefer girin, fiş yazdırın ve dilediğiniz zaman Excel raporu alın.</Text>
                </View>
                <TouchableOpacity style={styles.guideActionBtn} onPress={handleNewJob} activeOpacity={0.85}>
                  <Text style={styles.guideActionBtnText}>＋ Hemen İlk İşini Kur</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      </View>

      {/* ➕ YENİ İŞ KUR */}
      <TouchableOpacity style={styles.fab} onPress={handleNewJob}>
        <Text style={styles.plus}>＋</Text>
        <Text style={styles.fabText}>Yeni İş Kur</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide">
        <NewJobModal onClose={handleCloseModal} initialJob={selectedJob} />
      </Modal>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },

  title: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
    marginTop: 4,
    marginBottom: 6,
    color: '#111',
  },

  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fff',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 4,
  },

  site: {
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
    color: '#111',
  },

  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },

  siteInRow: {
    flexShrink: 1,
    marginBottom: 0,
  },

  pinnedIndicator: {
    fontSize: 11,
  },

  pinBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 'auto',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
  },

  pinBtnActive: {
    backgroundColor: '#FFF3C4',
  },

  pinIcon: {
    fontSize: 15,
  },

  jobType: {
    fontSize: 12,
    color: '#F5A623',
    fontWeight: '700',
    marginBottom: 4,
  },

  info: {
    fontSize: 12,
    color: '#666',
    marginVertical: '1%',
  },

  infoBold: {
    fontWeight: '700',
    color: '#111',
  },

  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 10,
  },

  infoBox: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    width: 110,
    alignItems: 'center',
    elevation: 2,
  },

  infoBoxTitle: {
    fontSize: 11,
    color: '#555',
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },

  infoBoxLabel: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },

  infoBoxValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
  },

  infoBoxCashRow: {
    marginTop: 4,
    backgroundColor: '#EFEFEF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  infoBoxCash: {
    fontSize: 10,
    color: '#444',
    fontWeight: '600',
    textAlign: 'center',
  },

  infoBoxRow: {
    fontSize: 11,
    color: '#2E6B1F',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 1,
  },

  actionBtn: {
    backgroundColor: '#F1F1F1',
    borderRadius: 12,
    marginTop: 6,
    width: 110,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 1,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 2.84,

    elevation: 4,
  },

  actionBtnText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },

  actionBtnDanger: {
    backgroundColor: '#FFF0EE',
    borderWidth: 1,
    borderColor: '#E53935',
  },

  actionBtnDangerText: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '700',
    textAlign: 'center',
  },

  actionBtnSuccess: {
    backgroundColor: '#EDFBF0',
    borderWidth: 1,
    borderColor: '#2E7D32',
  },

  actionBtnSuccessText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '700',
    textAlign: 'center',
  },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    backgroundColor: YELLOW,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    elevation: 6,
  },

  plus: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    lineHeight: 26,
  },

  fabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingTop: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 120,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 42,
    fontSize: 14,
    color: '#111',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: YELLOW,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  refreshIcon: {
    fontSize: 22,
    color: '#111',
    fontWeight: '700',
    lineHeight: 26,
  },

  downloadBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  downloadIcon: {
    fontSize: 18,
    color: '#2E7D32',
    fontWeight: '700',
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 4,
  },

  filterChip: {
    flex: 1,
    backgroundColor: '#EFEFEF',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },

  filterChipActive: {
    backgroundColor: YELLOW,
  },

  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },

  filterChipTextActive: {
    color: '#111',
    fontWeight: '800',
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 14,
  },

  guideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#FFE082',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  guideCardEmoji: {
    fontSize: 44,
    textAlign: 'center',
    marginBottom: 10,
  },
  guideCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  guideStepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD500',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  guideStepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
  guideStepText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    flex: 1,
  },
  guideActionBtn: {
    backgroundColor: '#FFD500',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  guideActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
});
