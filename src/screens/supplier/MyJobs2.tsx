import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  getJobHauls,
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
      console.log('[MyJobs] job list from API:', JSON.stringify(data.map((item: any) => ({ id: item.id, name: item.name, isHaulVisibleToVehicleOwners: item.isHaulVisibleToVehicleOwners })), null, 2));

      const mapped: JobUI[] = await Promise.all(
        data.map(async (item: any) => {
          let today = 0, total = 0, paid = 0, unpaid = 0;
          let fuelGiven = '0 lt', cashGiven = '0₺', totalTonage = 0;
          let paidFuelTotal = 0;

          try {
            const hauls = await getJobHauls(token, item.id);
            const todayStr = new Date().toDateString();

            total = hauls.length;
            paid = hauls.filter((h: any) => h.isPaid).length;
            unpaid = hauls.filter((h: any) => !h.isPaid).length;
            today = hauls.filter((h: any) =>
              new Date(h.timeOfHaul).toDateString() === todayStr
            ).length;

            const paidHauls = hauls.filter((h: any) => h.isPaid);
            paidFuelTotal = paidHauls
              .filter((h: any) => h.paymentType === 1 || h.paymentType === 2)
              .reduce((s: number, h: any) => s + (h.fuelAmount ?? 0), 0);
            const totalCash = paidHauls
              .filter((h: any) => h.paymentType === 0 || h.paymentType === 2)
              .reduce((s: number, h: any) => s + (h.cashAmount ?? 0), 0);
            const totalTon = hauls.reduce((s: number, h: any) => s + (h.tonage ?? 0), 0) / 1000;

            fuelGiven = `${paidFuelTotal.toFixed(0)} lt`;
            cashGiven = `${totalCash.toFixed(0)}₺`;
            totalTonage = parseFloat(totalTon.toFixed(1));
          } catch {
            // haul fetch failed — leave defaults (0)
          }

          return {
            id: item.id,
            site: item.name,
            today,
            total,
            paid,
            unpaid,
            fuelLeft: `${(item.fuelStock ?? 0)} lt`,
            fuelGiven,
            cashGiven,
            totalTonage,
            canEdit: item.canEdit,
            isActive: item.isActive,
            raw: item,
          };
        }),
      );

      setJobs(mapped);
    } catch (err) {
      console.log('JobSite fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [token]);

  useFocusEffect(useCallback(() => {
    fetchJobs();
  }, [token]));

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

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter(item => {
      const matchesType =
        filterType === 'ALL' ||
        (filterType === 'KUM' && item.raw.jobType === 1) ||
        (filterType === 'HAFRIYAT' && item.raw.jobType !== 1);
      const matchesSearch = !q || item.site.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [jobs, search, filterType]);

  const renderItem = ({ item }: { item: JobUI }) => {
    const isKum = item.raw.jobType === 1;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('JobDetails', { job: item.raw })}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.site}>{item.site}</Text>
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
          ListEmptyComponent={
            <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
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
});
