import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Platform, ActionSheetIOS, Alert, Modal, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { BASE_HOST } from '../../services/api';

const IMAGE_BASE = BASE_HOST;
const buildLogoUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};
import { CITIES } from '../../constants/cities';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { setSelectedCity } from '../../store/slices/uiSlice';
import CityPickerModal from '../../components/CityPickerModal';
import ProvinceMultiSelect from '../../components/ProvinceMultiSelect';
import { useActiveUserCount } from '../../hooks/useActiveUserCount';
import { launchImageLibrary } from 'react-native-image-picker';
import { getChatGroups, createChatGroup, uploadGroupImage, toggleChatGroupPin, getGroupDetail } from '../../services/chatService';
import { getProfile } from '../../services/userService';
import { clearAuth } from '../../utils/secureStore';
import { trIncludes } from '../../utils/trSearch';
import { logout, setUser } from '../../store/slices/authSlice';

const GROUP_PAGE_SIZE = 20;
// Eski (yerel) sabitleme kaydı: grup id dizisi. Sunucuya taşındıktan sonra da SİLİNMEZ (uyumluluk kuralı).
const PINNED_KEY = 'pinned_chat_groups';
const PINNED_MIGRATED_KEY = 'pinned_chat_groups_migrated';

export default function SupplierHome() {
  const navigation = useNavigation<any>();
  const activeUsers = useActiveUserCount();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadedSearch, setLoadedSearch] = useState<string | null>(null); // listedeki ilk sayfanın hangi sunucu aramasına ait olduğu
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  /* SAYFALAMA (sonsuz kaydırma) */
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const requestIdRef = useRef(0); // il/arama/yenileme değişince eski cevapları yok saymak için
  const firstPageLoadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const hasGroupsRef = useRef(false);
  const [cityPickerModalVisible, setCityPickerModalVisible] = useState(false);
  const selectedCity = useAppSelector(state => state.ui.selectedCity);
  const dispatch = useAppDispatch();
  const token = useAppSelector(state => state.auth.token);
  const user = useAppSelector(state => state.auth.user);

  /* CREATE MODAL STATES */
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedProvinces, setSelectedProvinces] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [newGroupImage, setNewGroupImage] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PINNED_KEY).then(val => {
      if (!val) return;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) setPinnedIds(parsed);
      } catch { }
    }).catch(() => { });
  }, []);

  // API listede boolean isPinned dönüyorsa sabitleme sunucuda; dönmüyorsa (eski API) eski yerel davranış sürer
  const serverPinSupported = useMemo(() => chatGroups.some(g => typeof g?.isPinned === 'boolean'), [chatGroups]);
  const isGroupPinned = useCallback((g: any) => (serverPinSupported ? g.isPinned === true : pinnedIds.includes(g.id)), [serverPinSupported, pinnedIds]);
  const pinInFlightRef = useRef<Set<string>>(new Set());
  const chatGroupsRef = useRef<any[]>([]);
  const pinMigrationStartedRef = useRef(false);

  const applyServerPin = useCallback((id: string, pinned: boolean) => {
    // Sunucu üye olmayanı sabitlerken üye yapar → listede de üye olarak göster
    setChatGroups(prev => prev.map(g => (g.id === id ? { ...g, isPinned: pinned, ...(pinned && !g.isMember ? { isMember: true } : null) } : g)));
  }, []);

  const togglePin = useCallback(async (item: any) => {
    const id = item.id;
    if (!serverPinSupported) {
      // Eski API: sabitleme sadece telefonda
      setPinnedIds(prev => {
        const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
        AsyncStorage.setItem(PINNED_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    if (!token || pinInFlightRef.current.has(id)) return;
    const prevPinned = item.isPinned === true;
    const nextPinned = !prevPinned;
    pinInFlightRef.current.add(id);
    // İyimser güncelleme
    setChatGroups(prev => prev.map(g => (g.id === id ? { ...g, isPinned: nextPinned } : g)));
    let serverMsg = '';
    try {
      const res = await toggleChatGroupPin(token, id);
      if (res && res.isSuccess === false) {
        serverMsg = res.errors?.[0] || '';
        throw new Error(serverMsg);
      }
      applyServerPin(id, typeof res?.data === 'boolean' ? res.data : nextPinned);
    } catch (e: any) {
      // Geri al
      setChatGroups(prev => prev.map(g => (g.id === id ? { ...g, isPinned: prevPinned } : g)));
      const msg = e?.response?.data?.errors?.[0] || serverMsg || (nextPinned ? 'Grup sabitlenemedi. Lütfen tekrar deneyin.' : 'Sabitleme kaldırılamadı. Lütfen tekrar deneyin.');
      Alert.alert('Hata', msg);
    } finally {
      pinInFlightRef.current.delete(id);
    }
  }, [token, serverPinSupported, applyServerPin]);

  useEffect(() => {
    hasGroupsRef.current = chatGroups.length > 0;
    chatGroupsRef.current = chatGroups;
  }, [chatGroups]);

  // Tek seferlik taşıma: telefonda sabitli olup sunucuda sabitli olmayan grupları sunucuda sabitler.
  // Arka planda çalışır, hatalar sessizdir. İlk deneme bitince (kısmi hata olsa da) bayrak yazılır; böylece kullanıcının
  // sonradan kaldırdığı sabitleme bir sonraki açılışta geri gelmez.
  // Uç durumu tersine çevirdiği ve üye olmayanı üye yaptığı için SADECE üyesi olunan ve sunucuda sabitli olmadığı bilinen gruplar için çağrılır.
  useEffect(() => {
    if (!token || !serverPinSupported || pinMigrationStartedRef.current) return;
    pinMigrationStartedRef.current = true;
    (async () => {
      try {
        if ((await AsyncStorage.getItem(PINNED_MIGRATED_KEY)) === '1') return;
        const raw = await AsyncStorage.getItem(PINNED_KEY);
        let localIds: string[] = [];
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) localIds = Array.from(new Set<string>(parsed.filter((x: any) => typeof x === 'string' && x)));
        } catch { }
        for (const id of localIds) {
          try {
            const loaded = chatGroupsRef.current.find(g => g.id === id);
            let shouldPin = false;
            if (loaded && typeof loaded.isPinned === 'boolean') {
              // Üye değilse dokunma (uç, üye olmayanı sessizce gruba katar)
              shouldPin = loaded.isMember === true && loaded.isPinned === false;
            } else {
              // Yüklenmemiş grup: detaydan durumu öğren
              let detailRes: any;
              try {
                detailRes = await getGroupDetail(token, id);
              } catch (e: any) {
                const status = e?.response?.status;
                if (status === 404 || status === 403) continue; // grup silinmiş / erişim yok: taşınacak bir şey yok
                throw e;
              }
              const d = detailRes?.data ?? detailRes;
              // Üye değil veya sabitleme durumu bilinmiyor: dokunma
              shouldPin = d?.isMember === true && d?.isPinned === false;
            }
            if (!shouldPin) continue;
            const res = await toggleChatGroupPin(token, id);
            if (res && res.isSuccess === false) continue;
            applyServerPin(id, typeof res?.data === 'boolean' ? res.data : true);
          } catch { }
        }
        await AsyncStorage.setItem(PINNED_MIGRATED_KEY, '1');
      } catch { }
    })();
  }, [token, serverPinSupported, applyServerPin]);

  // Arama sunucuda yapılır (ilk 20 grubun dışındakiler de bulunsun); her tuşta istek atmamak için beklenir
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText.trim()), 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const dedupeById = (list: any[]) => {
    const seen = new Set<string>();
    return list.filter(g => {
      if (!g || g.id == null || seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  };

  // İlk sayfayı (yeniden) yükler: yenileme, odaklanma, il değişimi ve aramada çağrılır
  const fetchGroups = useCallback(async (showLoader: boolean = true) => {
    if (!token) return;
    const requestId = ++requestIdRef.current;
    firstPageLoadingRef.current = true;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (showLoader) setLoading(true);
    try {
      const res = await getChatGroups(token, selectedCity ?? undefined, 1, GROUP_PAGE_SIZE, debouncedSearch || undefined);
      if (requestId !== requestIdRef.current) return; // eski istek (il/arama değişti)
      if (res && res.data && res.data.groups) {
        setChatGroups(dedupeById(res.data.groups));
        setLoadedSearch(debouncedSearch);
        pageRef.current = 1;
        totalPagesRef.current = typeof res.data.totalPages === 'number' ? res.data.totalPages : 1;
      }
    } catch (error) {
      console.log('Error fetching groups', error);
    } finally {
      if (requestId === requestIdRef.current) {
        firstPageLoadingRef.current = false;
        setLoading(false);
      }
    }
  }, [token, selectedCity, debouncedSearch]);

  // Liste sonuna gelince sonraki sayfayı getirir
  const loadMoreGroups = useCallback(async () => {
    if (!token) return;
    if (firstPageLoadingRef.current || loadingMoreRef.current) return;
    if (pageRef.current >= totalPagesRef.current) return;
    const requestId = requestIdRef.current;
    const nextPage = pageRef.current + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await getChatGroups(token, selectedCity ?? undefined, nextPage, GROUP_PAGE_SIZE, debouncedSearch || undefined);
      if (requestId !== requestIdRef.current) return; // bu arada ilk sayfa yeniden yüklendi
      if (res && res.data && Array.isArray(res.data.groups)) {
        const incoming = res.data.groups;
        setChatGroups(prev => dedupeById([...prev, ...incoming]));
        pageRef.current = nextPage;
        if (typeof res.data.totalPages === 'number') totalPagesRef.current = res.data.totalPages;
        if (incoming.length === 0) totalPagesRef.current = nextPage; // boş sayfa: daha fazla isteme
      }
    } catch (error) {
      console.log('Error fetching more groups', error);
    } finally {
      if (requestId === requestIdRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [token, selectedCity, debouncedSearch]);

  // Odaklanınca / il veya arama değişince ilk sayfadan yükle
  useFocusEffect(
    useCallback(() => {
      fetchGroups(!hasGroupsRef.current);
    }, [fetchGroups])
  );

  useFocusEffect(
    useCallback(() => {
      if (token) {
        getProfile(token).then(profileRes => {
          if (profileRes?.isSuccess) {
            dispatch(setUser(profileRes.data));
            if (profileRes.data?.accessMode === 1) {
              console.log('👤 User is blocked (focus). Logging out...');
              clearAuth().then(() => {
                dispatch(logout());
              });
            }
          }
        }).catch(err => {
          console.log('Error updating profile on focus:', err);
        });
      }
    }, [token, dispatch])
  );

  const pickGroupImage = () => {
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 800, maxHeight: 800 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.base64) return;
        setNewGroupImage(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
      },
    );
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Hata', 'Lütfen grup adı giriniz.');
      return;
    }
    if (!token) {
      Alert.alert('Hata', 'Oturum açık değil.');
      return;
    }
    if (selectedProvinces.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir il seçiniz.');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: newGroupName,
        description: newGroupDesc,
        provinceCode: selectedProvinces[0], // İlk seçileni ana il yapalım
        provinceCodes: selectedProvinces,
        isPublic: true,
        allowMemberMessages: true,
      };

      const result = await createChatGroup(token, payload);
      const createdId = result?.id || result?.data?.id;
      if (newGroupImage && createdId) {
        try {
          await uploadGroupImage(token, createdId, newGroupImage);
        } catch (imgErr) {
          console.warn('Logo yüklenemedi:', imgErr);
        }
      }
      Alert.alert('Başarılı', 'Grup oluşturuldu!');
      setCreateModalVisible(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupImage(null);
      setSelectedProvinces([]);
      fetchGroups();
    } catch (error) {
      Alert.alert('Hata', 'Grup oluşturulurken bir hata oluştu.');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const openCityPicker = () => {
    setCityPickerModalVisible(true);
  };

  // 🔍 WHATSAPP STYLE SORTING & FILTERING
  const sortedAndFilteredGroups = useMemo(() => {
    let filtered = chatGroups;
    const q = searchText.trim();

    // Sunucu ad + açıklamada arar; yazarken (bekleme süresinde) yüklü liste de anında süzülür.
    // Bu metnin sunucu sonucu geldiyse istemci süzmesi yapılmaz (sunucunun bulduğu gruplar gizlenmesin).
    if (q && loadedSearch !== q) {
      filtered = chatGroups.filter(item =>
        trIncludes(item.name, q) ||
        trIncludes(item.description, q) ||
        trIncludes(item.lastMessagePreview, q)
      );
    }

    return [...filtered].sort((a, b) => {
      const aPinned = isGroupPinned(a);
      const bPinned = isGroupPinned(b);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Hem sabitlenenler hem sabitlenmeyenler en son mesaja göre sıralanır
      const aTime = new Date(a.lastMessageAt || a.createdDate || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.createdDate || 0).getTime();
      return bTime - aTime;
    });
  }, [searchText, chatGroups, isGroupPinned, loadedSearch]);

  const renderItem = ({ item }: { item: any }) => {
    const previewText = item.isMember
      ? (item.lastMessageSenderName ? `${item.lastMessageSenderName}: ` : '') + (item.lastMessagePreview || 'Henüz mesaj yok')
      : (item.description || item.lastMessagePreview || 'Henüz mesaj yok');

    const isPinned = isGroupPinned(item);
    const hasUnread = typeof item.unreadCount === 'number' && item.unreadCount > 0;

    return (
      <TouchableOpacity 
        style={styles.row} 
        onPress={() => {
          if (hasUnread) {
            setChatGroups(prev => prev.map(g => g.id === item.id ? { ...g, unreadCount: 0 } : g));
          }
          navigation.navigate('CompanyChat', { group: item });
        }} 
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          {buildLogoUrl(item.imageUrl) ? (
            <Image
              source={{ uri: buildLogoUrl(item.imageUrl) }}
              style={styles.logoImage}
              defaultSource={require('../../../assets/icons/city.png')}
            />
          ) : (
            <Image source={require('../../../assets/icons/city.png')} style={styles.icon} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {isPinned && <Text style={styles.pinnedIndicator}>📌</Text>}
          </View>
          <Text style={styles.message} numberOfLines={1}>{previewText}</Text>
        </View>

        <View style={styles.rightContent}>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.pinBtn, isPinned && styles.pinBtnActive]}
          onPress={() => togglePin(item)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={styles.pinIcon}>📌</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.title}>FİRMA SAYFALARI</Text>
          <View style={styles.activeBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.activeBadgeText}>{activeUsers} kişi aktif</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, loading && styles.refreshBtnLoading]}
          onPress={() => fetchGroups(true)}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={styles.refreshBtnText}>↻</Text>
          }
        </TouchableOpacity>
      </View>

      {/* 🏢 Firma Tanıtımları & Rehber Kartı */}
      <TouchableOpacity
        style={styles.showcaseBanner}
        onPress={() => navigation.navigate('CompanyShowcase')}
        activeOpacity={0.85}>
        <View style={styles.showcaseIconBox}>
          <Text style={styles.showcaseIconText}>🏢</Text>
        </View>
        <View style={{ flex: 1, paddingVertical: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.showcaseTitle}>Firma Tanıtımları</Text>
            <View style={styles.showcaseBadge}>
              <Text style={styles.showcaseBadgeText}>YENİ</Text>
            </View>
          </View>
          <Text style={styles.showcaseSub}>Sektör firmalarını ve profillerini inceleyin</Text>
        </View>
        <View style={styles.showcaseActionBtn}>
          <Text style={styles.showcaseActionText}>İncele ›</Text>
        </View>
      </TouchableOpacity>

      {user?.warningMessage && (!user.warningExpireDate || new Date(user.warningExpireDate) > new Date()) ? (
        <View style={{
          backgroundColor: '#FFF9DB',
          borderColor: '#FFD500',
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8
        }}>
          <Text style={{ fontSize: 18 }}>⚠️</Text>
          <Text style={{ flex: 1, color: '#000', fontWeight: '700', fontSize: 13, lineHeight: 18 }}>
            {user.warningMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        {/* 🔍 ARAMA */}
        <TextInput
          placeholder="Ara"
          value={searchText}
          onChangeText={setSearchText}
          style={styles.search}
          placeholderTextColor="#888"
          clearButtonMode="while-editing"
        />

        {/* 🌍 İL SEÇİMİ */}
        <TouchableOpacity style={styles.cityBtn} onPress={openCityPicker}>
          <Text style={styles.cityText}>
            {selectedCity != null
              ? CITIES.find(c => c.value === selectedCity)?.label ?? 'İl Seç'
              : 'Tüm Türkiye'}
          </Text>
          <Image
            source={require('../../../assets/icons/down-arrow.png')}
            style={{ width: 12, height: 12, marginLeft: 6, opacity: 0.6 }}
          />
        </TouchableOpacity>
        {/* GRUP OLUŞTUR BUTONU */}
        <TouchableOpacity style={styles.createGroupBtn} onPress={() => setCreateModalVisible(true)}>
          <Text style={styles.createGroupText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedAndFilteredGroups}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>Bu ilde grup bulunamadı</Text> : null
        }
        refreshing={loading}
        onRefresh={() => fetchGroups(true)}
        onEndReached={loadMoreGroups}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#000" style={styles.listFooterLoader} /> : null}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* CREATE GROUP MODAL */}
      <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Grup Oluştur</Text>
            <TouchableOpacity onPress={() => { setCreateModalVisible(false); setNewGroupImage(null); }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Grup Logosu</Text>
            <View style={styles.logoSection}>
              <View style={styles.logoCircle}>
                {newGroupImage ? (
                  <Image source={{ uri: newGroupImage }} style={styles.logoImg} />
                ) : (
                  <Text style={{ fontSize: 36 }}>🏢</Text>
                )}
              </View>
              <TouchableOpacity style={styles.pickImageBtn} onPress={pickGroupImage}>
                <Text style={styles.pickImageText}>⊙ Resim Seç</Text>
              </TouchableOpacity>
              {newGroupImage && (
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setNewGroupImage(null)}>
                  <Text style={styles.removeImageText}>✕ Kaldır</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Grup Adı *</Text>
            <TextInput
              style={styles.input}
              placeholder="BURAK HAFRİYAT TAŞIMA NAKLİYE"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              style={[styles.input, { height: 80, paddingTop: 10 }]}
              placeholder="Grup hakkında kısa bir açıklama..."
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
              multiline
            />

            <Text style={styles.label}>Görünmek İstediğiniz İlleri Seçin *</Text>

            <ProvinceMultiSelect selected={selectedProvinces} onChange={setSelectedProvinces} />

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateGroup} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>✓ Grubu Oluştur</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreateModalVisible(false); setNewGroupImage(null); }} disabled={creating}>
              <Text style={styles.cancelBtnText}>← Vazgeç</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* CITY PICKER MODAL */}
      <CityPickerModal
        visible={cityPickerModalVisible}
        onClose={() => setCityPickerModalVisible(false)}
        onSelectCity={(val) => dispatch(setSelectedCity(val))}
        selectedCity={selectedCity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  activeBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111',
  },
  showcaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    gap: 10,
  },
  showcaseIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF9DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showcaseIconText: {
    fontSize: 20,
  },
  showcaseTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1E1C',
  },
  showcaseBadge: {
    backgroundColor: '#FFD500',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  showcaseBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1E1E1C',
  },
  showcaseSub: {
    fontSize: 11.5,
    color: '#777',
    marginTop: 1,
  },
  showcaseActionBtn: {
    backgroundColor: '#1E1E1C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  showcaseActionText: {
    color: '#FFD500',
    fontSize: 11.5,
    fontWeight: '800',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnLoading: {
    opacity: 0.6,
  },
  refreshBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  logoImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    resizeMode: 'cover',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  search: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  cityBtn: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 100,
  },
  cityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  createGroupBtn: {
    backgroundColor: '#FFD500',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
  },
  createGroupText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  sectionHeader: {
    backgroundColor: '#F9F9F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#FFD500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: '#000',
    resizeMode: 'contain',
  },
  content: {
    flex: 1,
  },
  name: {
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#666',
  },
  rightContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadBadge: {
    backgroundColor: '#27AE60',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  memberBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  memberBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  memberCountText: {
    color: '#888',
    fontSize: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  pinnedIndicator: {
    fontSize: 11,
  },
  pinBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 6,
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
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 62,
  },
  listFooterLoader: {
    marginVertical: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#888',
    fontSize: 13,
  },
  /* MODAL STYLES */
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFBE6', // Arkaplan rengi screenshot'a benzer
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#FFD500',
    alignItems: 'center',
    flexDirection: 'row',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#FFA500', // Turuncu
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelBtnText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 16,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  logoImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  pickImageBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFD500',
  },
  pickImageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  removeImageBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eee',
  },
  removeImageText: {
    fontSize: 13,
    color: '#C62828',
    fontWeight: '600',
  },
});

