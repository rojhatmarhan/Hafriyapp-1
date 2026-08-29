import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Image, TouchableOpacity, Platform, Alert, ActionSheetIOS, ScrollView, Modal, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CITIES } from '../../constants/cities';
import { DISTRICTS } from '../../constants/districts';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { setSelectedCity } from '../../store/slices/uiSlice';
import CityPickerModal from '../../components/CityPickerModal';
import { getMarketJobs } from '../../services/jobSiteService';
import { mapJobFromApi } from '../../utils/jobMapper';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const YELLOW = '#FFD500';
const LIGHT_YELLOW = '#FFF2B3';
const GRAY = '#F4F4F4';
const DARK = '#222';

const DEFAULT_LOGO = require('../../../assets/logokarakalem.png');

const LogoImage = ({ source, style }: { source: any; style: any }) => {
  const [errored, setErrored] = React.useState(false);
  const src = errored ? DEFAULT_LOGO : source;
  return (
    <Image
      source={src}
      style={style}
      onError={() => setErrored(true)}
    />
  );
};

const ActionItem = ({ icon, label, onPress }: { icon: any; label: string; onPress?: () => void; }) => (
  <TouchableOpacity style={styles.actionItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.actionIconCircle}>
      <Image style={{ width: 20, height: 20 }} source={icon} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const JobDetailModal = ({
  visible,
  job,
  onClose,
  currentUserId,
  onReport,
  onBlock,
}: {
  visible: boolean;
  job: any;
  onClose: () => void;
  currentUserId?: string | null;
  onReport?: (job: any) => void;
  onBlock?: (userId: string, name: string) => void;
}) => {
  if (!job) return null;

  const phones: string[] = job.phone
    ? job.phone.split(/[,;]/).map((p: string) => p.trim()).filter(Boolean)
    : [];

  const handleCallPress = () => {
    if (phones.length === 0) return;
    if (phones.length === 1) {
      Linking.openURL(`tel:${phones[0]}`);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Numara Seç', options: ['İptal', ...phones], cancelButtonIndex: 0 },
        i => { if (i > 0) Linking.openURL(`tel:${phones[i - 1]}`); },
      );
    } else {
      Alert.alert(
        'Numara Seç', '',
        phones.map(p => ({ text: p, onPress: () => Linking.openURL(`tel:${p}`) })),
        { cancelable: true },
      );
    }
  };

  const provinceLabel =
    job.provinceName || CITIES.find(c => c.value === job.provinceCode)?.label || '-';
  const locationLabel = job.districtName
    ? `${provinceLabel} / ${job.districtName}`
    : provinceLabel;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* HEADER */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>İş Detayları</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* CONTENT — web ile aynı sırada */}
          <ScrollView style={modalStyles.contentScroll} contentContainerStyle={modalStyles.content}>

            {/* 1. Firma / Şantiye */}
            <Text style={modalStyles.label}>FİRMA / ŞANTİYE</Text>
            <Text style={modalStyles.value}>
              {job.company ? `${job.company} / ` : ''}{job.site}
            </Text>

            {/* 2. Bölge + Saatler */}
            <View style={modalStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.label}>BÖLGE</Text>
                <Text style={modalStyles.value}>{locationLabel}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.label}>SAATLER</Text>
                <Text style={modalStyles.value}>
                  {job.loadingStartTime || '--'} - {job.loadingEndTime || '--'}
                </Text>
              </View>
            </View>

            {/* 3. Rotalar (Kum/Mıcır) */}
            {job.jobType === 1 && job.routes?.length > 0 && (
              <>
                <Text style={modalStyles.label}>ROTALAR</Text>
                <View style={modalStyles.offersBox}>
                  {job.routes.map((r: any, i: number) => (
                    <View key={i} style={[modalStyles.routeRow, i === job.routes.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={modalStyles.routePath}>
                          {r.loading}  →  {r.unloading}
                        </Text>
                        {r.material !== '-' && (
                          <Text style={modalStyles.routeMaterial}>{r.material}</Text>
                        )}
                      </View>
                      <Text style={modalStyles.routePrice}>{r.cash}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* 3. Teklifler (Hafriyat) */}
            {job.jobType !== 1 && job.dumps?.length > 0 && (
              <>
                <Text style={modalStyles.label}>TEKLİFLER</Text>
                <View style={modalStyles.offersBox}>
                  <View style={modalStyles.offersTableHeader}>
                    <Text style={[modalStyles.offersThLeft]}>DÖKÜM BÖLGESİ</Text>
                    <Text style={modalStyles.offersTh}>NAKİT</Text>
                    <Text style={modalStyles.offersTh}>MAZOT</Text>
                  </View>
                  {job.dumps.map((d: any, i: number) => (
                    <View key={i} style={modalStyles.offersTdRow}>
                      <Text style={[modalStyles.offersTdLeft]}>{d.place}</Text>
                      <Text style={[modalStyles.offersTd, { color: '#2E7D32' }]}>{d.cash}</Text>
                      <Text style={[modalStyles.offersTd, { color: '#1565C0' }]}>{d.fuel}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* 4. Tabela Açıklaması */}
            {!!job.signDescription && (
              <>
                <Text style={modalStyles.label}>TABELA AÇIKLAMASI</Text>
                <Text style={modalStyles.value}>{job.signDescription}</Text>
              </>
            )}

            {/* 5. Açıklama */}
            {!!job.description && (
              <>
                <Text style={modalStyles.label}>AÇIKLAMA</Text>
                <View style={modalStyles.descBox}>
                  <Text style={modalStyles.descText}>{job.description}</Text>
                </View>
              </>
            )}

            {/* 6. İletişim */}
            {phones.length > 0 && (
              <>
                <Text style={[modalStyles.label, { marginTop: 8 }]}>İLETİŞİM</Text>
                <View style={modalStyles.phoneList}>
                  {phones.map((p, i) => (
                    <TouchableOpacity
                      key={i}
                      style={modalStyles.phonePill}
                      onPress={() => Linking.openURL(`tel:${p}`)}
                    >
                      <Text style={modalStyles.phonePillText}>📞 {p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {job.ownerUserId && currentUserId && job.ownerUserId !== currentUserId && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, paddingHorizontal: 16, marginBottom: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#FFF0F0', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FFCDCD' }}
                  onPress={() => onReport?.(job)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#D32F2F' }}>⚠️ Şikayet Et</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#FFF0F0', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FFCDCD' }}
                  onPress={() => onBlock?.(job.ownerUserId, job.company || 'Belirtilmemiş')}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#D32F2F' }}>🚫 Kullanıcı Engelle</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>

          {/* FOOTER: Kapat | Konum | Şimdi Ara */}
          <View style={modalStyles.footer}>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
              <Text style={modalStyles.closeBtnText}>Kapat</Text>
            </TouchableOpacity>

            {!!job.locationUrl && (
              <TouchableOpacity
                style={modalStyles.locationBtn}
                onPress={() => Linking.openURL(job.locationUrl)}
              >
                <Text style={modalStyles.locationBtnText}>📍 Konum</Text>
              </TouchableOpacity>
            )}

            {phones.length > 0 && (
              <TouchableOpacity style={modalStyles.callBtn} onPress={handleCallPress}>
                <Text style={modalStyles.callText}>📞 Şimdi Ara</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};



const AllJobs = () => {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const bottomPadding = tabBarHeight + insets.bottom;
  const selectedCity = useAppSelector(state => state.ui.selectedCity);
  const dispatch = useAppDispatch();
  const [cityOpen, setCityOpen] = useState(false);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const token = useAppSelector(state => state.auth.token);
  const currentUserId = useAppSelector(state => state.auth.user?.id);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; name: string }[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('blocked_users')
        .then(val => {
          if (val) setBlockedUsers(JSON.parse(val));
          else setBlockedUsers([]);
        })
        .catch(() => {});
    }, [])
  );

  const handleReportJob = (job: any) => {
    Alert.alert(
      'İş İlanını Bildir',
      'Bu ilanda uygunsuz, sakıncalı veya aldatıcı içerik olduğunu düşünüyor musunuz? Şikayetinizi yetkililere WhatsApp üzerinden bildirebilirsiniz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, WhatsApp ile Bildir',
          onPress: async () => {
            const phone = '+905383573913';
            const message = `Merhaba, Hafriyapp uygulamasında şu iş ilanını şikayet etmek istiyorum:\nİş ID: ${job.id}\nFirma/Şantiye: ${job.company || ''} - ${job.site || ''}\nİlan Sahibi: ${job.contactPhone || 'Belirtilmemiş'}`;
            const appUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
            const webUrl = `https://wa.me/${phone.replace(/[+\s]/g, '')}?text=${encodeURIComponent(message)}`;
            
            try {
              const supported = await Linking.canOpenURL(appUrl);
              if (supported) {
                await Linking.openURL(appUrl);
              } else {
                await Linking.openURL(webUrl);
              }
            } catch {
              await Linking.openURL(webUrl);
            }
          },
        },
      ],
    );
  };

  const handleBlockUser = (userId: string, name?: string | null) => {
    Alert.alert(
      'Kullanıcıyı Engelle',
      'Bu kullanıcıyı engellemek istediğinize emin misiniz? Engellediğinizde, bu kullanıcının hiçbir ilanı veya mesajı listenizde gösterilmeyecektir. Ayrıca kullanıcı yetkililere WhatsApp üzerinden bildirilecektir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Engelle ve Bildir',
          onPress: async () => {
            try {
              const userName = name || 'Belirtilmemiş';
              const updated = [...blockedUsers, { id: userId, name: userName }];
              setBlockedUsers(updated);
              await AsyncStorage.setItem('blocked_users', JSON.stringify(updated));
              setDetailVisible(false);
              
              const phone = '+905383573913';
              const message = `Merhaba, Hafriyapp uygulamasında şu kullanıcıyı engelledim ve bildirmek istiyorum:\nKullanıcı ID: ${userId}\nKullanıcı Adı: ${userName}`;
              const appUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
              const webUrl = `https://wa.me/${phone.replace(/[+\s]/g, '')}?text=${encodeURIComponent(message)}`;
              
              try {
                const supported = await Linking.canOpenURL(appUrl);
                if (supported) {
                  await Linking.openURL(appUrl);
                } else {
                  await Linking.openURL(webUrl);
                }
              } catch {
                await Linking.openURL(webUrl);
              }
            } catch {
              Alert.alert('Hata', 'Kullanıcı engellenirken bir sorun oluştu.');
            }
          },
        },
      ],
    );
  };

  // İl değişince ilçe seçimlerini sıfırla
  useEffect(() => {
    setSelectedDistricts([]);
  }, [selectedCity]);

  // Seçili ile ait ilçeler
  const availableDistricts = useMemo(
    () => (selectedCity != null ? DISTRICTS[selectedCity] ?? [] : []),
    [selectedCity],
  );

  const toggleDistrict = (value: string) => {
    setSelectedDistricts(prev =>
      prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value],
    );
  };

  /** 🔍 Firma + Şantiye + İlçe Araması ve Engelleme Filtresi */
  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter(item => {
      const matchesSearch =
        !q ||
        item.company?.toLowerCase().includes(q) ||
        item.site?.toLowerCase().includes(q);
      const matchesDistrict =
        selectedDistricts.length === 0 ||
        selectedDistricts.includes(item.districtName);
      const isNotBlocked = !blockedUsers.some(u => u.id === item.ownerUserId);
      return matchesSearch && matchesDistrict && isNotBlocked;
    });
  }, [search, jobs, selectedDistricts, blockedUsers]);

  useEffect(() => {
    fetchJobs();
  }, [selectedCity]);

  const [cityPickerModalVisible, setCityPickerModalVisible] = useState(false);

  const openCityPicker = () => {
    setCityPickerModalVisible(true);
  };
  const handleCallPress1 = (phone?: string) => {
    if (!phone) return;
    const phones = phone
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    if (phones.length === 0) return;

    if (phones.length === 1) {
      Linking.openURL(`tel:${phones[0]}`);
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Numara Seç',
          options: ['İptal', ...phones],
          cancelButtonIndex: 0,
        },
        index => {
          if (index > 0) {
            Linking.openURL(`tel:${phones[index - 1]}`);
          }
        },
      );
    } else {
      Alert.alert(
        'Numara Seç',
        '',
        phones.map(p => ({
          text: p,
          onPress: () => Linking.openURL(`tel:${p}`),
        })),
        { cancelable: true },
      );
    }
  };

  const handleSharePress = (item: any) => {
    const text = `${item.company ? item.company + ' - ' : ''}${item.site}`;
    Share.share({ message: text });
  };

  const handleLocationPress = (url?: string) => {
    if (!url) {
      Alert.alert('Hata', 'Konum bilgisi bulunamadı.');
      return;
    }
    Linking.openURL(url).catch(err => {
      console.error('An error occurred', err);
      Alert.alert('Hata', 'Harita açılamadı.');
    });
  };

  const fetchJobs = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await getMarketJobs(token, selectedCity ?? undefined);
      const mapped = response.map(mapJobFromApi).filter((j: any) => j.isActive === true);
      setJobs(mapped);
    } catch (e) {
      console.log('Market jobs error', e);
    } finally {
      setLoading(false);
    }
  };
  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.92}
      onPress={() => { setSelectedJob(item); setDetailVisible(true); }}
    >
      {/* HEADER */}
      <View style={styles.cardHeader}>
        <LogoImage source={item.logo} style={styles.logo} />

        <View style={styles.titleArea}>
          <View style={{ flexDirection: 'column' }}>
            {/* <View style={{ backgroundColor: '#F7B500', borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1, width: '55%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={styles.jopType}>{item.jobType === 1 ? 'Kum & Mıcır' : 'Hafriyat Döküm'}</Text>
            </View> */}
            <Text style={styles.company}>{item.company}</Text>
          </View>
          <Text style={styles.site}>{item.site}</Text>
          {/* Bölge: il / ilçe */}
          {(item.provinceName || item.districtName) ? (
            <Text style={styles.locationText}>
              📍{item.provinceName}{item.districtName ? ` / ${item.districtName}` : ''}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.moreBtn} onPress={() => {
          setSelectedJob(item);
          setDetailVisible(true);
        }}>
          <Image style={{ width: 20, height: 20 }} source={require('../../../assets/icons/dots.png')} />
          <Text style={styles.moreText}>Ayrıntılar</Text>
        </TouchableOpacity>
      </View>

      {/* ACTIONS */}
      <View style={styles.actionRow}>
        <ActionItem
          icon={require('../../../assets/icons/location.png')}
          label="Konum"
          onPress={() => handleLocationPress(item.locationUrl)}
        />
        <ActionItem
          icon={require('../../../assets/icons/phone-call.png')}
          label="Arama"
          onPress={() => handleCallPress1(item.phone)}
        />
        <ActionItem
          icon={require('../../../assets/icons/send.png')}
          label="Paylaş"
          onPress={() => handleSharePress(item)}
        />
      </View>

      {/* TABLE */}
      {item.jobType === 1 ? (
        <>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>Rota</Text>
            <Text style={styles.th}>₺/Ton</Text>
          </View>
          {item.routes.map((r: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
                {r.loading} → {r.unloading}
              </Text>
              <Text style={styles.td}>{r.cash}</Text>
            </View>
          ))}
        </>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={styles.th}>Döküm</Text>
            <Text style={styles.th}>Nakit</Text>
            <Text style={styles.th}>Mazot</Text>
          </View>
          {item.dumps.map((d: any, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.td}>{d.place}</Text>
              <Text style={styles.td}>{d.cash}</Text>
              <Text style={styles.td}>{d.fuel}</Text>
            </View>
          ))}
        </>
      )}

      {/* TABELA AÇIKLAMASI (aktifse göster) */}
      {item.isActive && !!item.signDescription && (
        <View style={[styles.signDescBox, { borderColor: item.statusColor, backgroundColor: item.statusColor }]}>
          <Text style={styles.signDescText} numberOfLines={4}>{item.signDescription}</Text>
        </View>
      )}

      {/* STATUS */}
      {/* <View style={[styles.statusBar, { backgroundColor: item.statusColor }]}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View> */}
    </TouchableOpacity>
  );

  return (

    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <JobDetailModal
        visible={detailVisible}
        job={selectedJob}
        onClose={() => setDetailVisible(false)}
        currentUserId={currentUserId}
        onReport={handleReportJob}
        onBlock={handleBlockUser}
      />
      <FlatList
        style={{ flex: 1 }}
        data={filteredJobs}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={fetchJobs}
        showsVerticalScrollIndicator={false}
        // 🔥 iOS otomatik inset kapat
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              Bu il için aktif iş bulunamadı
            </Text>
          ) : null
        }
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: bottomPadding,
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.searchRow}>
              {/* SEARCH */}
              <TextInput
                placeholder="Firma veya şantiye ara"
                placeholderTextColor="#999"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />

              {/* CITY DROPDOWN + REFRESH */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View>
                  <TouchableOpacity
                    style={styles.citySelect}
                    onPress={openCityPicker}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cityText}>
                      {selectedCity != null
                        ? CITIES.find(c => c.value === selectedCity)?.label ?? 'İl'
                        : 'Tüm Türkiye'}
                    </Text>
                    <Image
                      source={require('../../../assets/icons/down-arrow.png')}
                      style={{ width: 14, height: 14 }}
                    />
                  </TouchableOpacity>

                  {cityOpen && (
                    <View style={styles.cityDropdown}>
                      <FlatList
                        data={CITIES}
                        keyExtractor={item => item.value.toString()}
                        style={{ maxHeight: 260 }}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={styles.cityItem}
                            onPress={() => {
                              dispatch(setSelectedCity(item.value));
                              setCityOpen(false);
                            }}
                          >
                            <Text style={styles.cityItemText}>{item.label}</Text>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  )}
                </View>

                {/* YENİLE BUTONU */}
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={fetchJobs}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Text style={[styles.refreshIcon, loading && { opacity: 0.4 }]}>↻</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* İLÇE FİLTRESİ */}
            {availableDistricts.length > 0 && (
              <View style={styles.districtWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.districtScroll}
                >
                  {availableDistricts.map(d => {
                    const active = selectedDistricts.includes(d.value);
                    return (
                      <TouchableOpacity
                        key={d.value}
                        style={[styles.districtChip, active && styles.districtChipActive]}
                        onPress={() => toggleDistrict(d.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.districtChipText, active && styles.districtChipTextActive]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {selectedDistricts.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearDistricts}
                    onPress={() => setSelectedDistricts([])}
                  >
                    <Text style={styles.clearDistrictsText}>Temizle</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        }

      />

      <CityPickerModal
        visible={cityPickerModalVisible}
        onClose={() => setCityPickerModalVisible(false)}
        onSelectCity={(val) => dispatch(setSelectedCity(val))}
        selectedCity={selectedCity}
      />
    </SafeAreaView>
  );
};

export default AllJobs;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GRAY,
  },

  /* SEARCH */
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    flex: 1,
    fontSize: 14,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  /* CARD */
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 22,
    padding: 16,
    // 🔥 GÜÇLÜ SHADOW
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 1, height: 3 },
    elevation: 8,
  },

  /* HEADER */
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: YELLOW,
    marginRight: 12,
  },
  titleArea: {
    flex: 1,
  },
  company: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK,
  },
  jopType: {
    fontSize: 13,
    fontWeight: '400',
    color: DARK,
  },
  site: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontWeight: '500',
  },
  signDescBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  signDescText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  moreBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 12,
  },

  /* ACTIONS */
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 38,
    marginVertical: 14,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#FFD500',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.20,
    shadowRadius: 6,
    shadowOffset: { width: 1, height: 3 },
    elevation: 4,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginTop: 3,
  },

  /* TABLE */
  tableHeader: {
    flexDirection: 'row',
    marginBottom: '2%',
    marginLeft: '10%',
  },
  th: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#595959ff',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: '1%',
    marginLeft: '10%',
  },
  td: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: DARK,
  },

  /* STATUS */
  statusBar: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
  listWrapper: {
    flex: 1, // 🔥 ekranın geri kalanını kaplar
  },
  searchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  citySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
    width: 120,
    shadowOffset: { width: 1, height: 3 },
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },

  cityText: {
    fontSize: 13,
    fontWeight: '500',
    color: DARK,
  },

  cityDropdown: {
    position: 'absolute',
    top: 52,
    right: 0,
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 14,
    zIndex: 100,
    paddingVertical: 6,

    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },

  cityItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  cityItemText: {
    fontSize: 14,
    color: DARK,
  },

  districtWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    paddingHorizontal: 16,
  },

  districtScroll: {
    gap: 8,
    paddingRight: 8,
  },

  districtChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDD',
  },

  districtChipActive: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },

  districtChipText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },

  districtChipTextActive: {
    color: '#111',
    fontWeight: '800',
  },

  clearDistricts: {
    marginLeft: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFE0E0',
    borderRadius: 20,
  },

  clearDistrictsText: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: '700',
  },

  refreshBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: YELLOW,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  refreshIcon: {
    fontSize: 24,
    color: DARK,
    fontWeight: '700',
    lineHeight: 28,
  },

});
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    width: '88%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
  },

  contentScroll: {
    flexShrink: 1,
  },

  header: {
    backgroundColor: '#FFF7E0',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
  },

  close: {
    fontSize: 18,
    color: '#555',
  },

  content: {
    padding: 16,
  },

  label: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },

  value: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
    marginBottom: 14,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },

  /* Teklifler / Rotalar kutusu */
  offersBox: {
    backgroundColor: '#FCFCFC',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  offersTableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 4,
  },
  offersThLeft: {
    flex: 2,
    fontSize: 10,
    fontWeight: '700',
    color: '#bbb',
    textTransform: 'uppercase',
  },
  offersTh: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#bbb',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  offersTdRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#F9F9F9',
  },
  offersTdLeft: {
    flex: 2,
    fontSize: 13,
    fontWeight: '700',
    color: DARK,
  },
  offersTd: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    color: '#444',
  },

  /* Kum/Mıcır rota satırı */
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  routePath: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
  },
  routeMaterial: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginTop: 2,
  },
  routePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2ecc71',
  },

  /* Açıklama kutusu */
  descBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  descText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },

  /* İletişim pill'ları */
  phoneList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  phonePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  phonePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },

  footer: {
    flexDirection: 'row',
    padding: 14,
    gap: 8,
  },

  closeBtn: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },

  locationBtn: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  locationBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565C0',
  },

  callBtn: {
    flex: 1,
    backgroundColor: '#FFA500',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  callText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

