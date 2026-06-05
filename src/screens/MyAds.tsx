import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, RefreshControl, Image, Linking, Dimensions, Share,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getListings, getMyListings, getListingById, createListing, updateListing, deleteListing,
  PROVINCES, getProvinceName,
  Listing, CreateListingParams, UpdateListingParams,
} from '../services/listingService';
import { DISTRICTS } from '../constants/districts';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = (SW - 48) / 2;

const CATEGORIES = [
  { type: 0, label: 'Araç Kiralama',  icon: '🚛', iconBg: '#DBEAFE', sectionTitle: 'ARAÇ KİRALAMA' },
  { type: 1, label: 'Al-Sat',         icon: '🏬', iconBg: '#DCFCE7', sectionTitle: 'SATILIK ARAÇLAR' },
  { type: 2, label: 'Şoför İlanları', icon: '👤', iconBg: '#FFEDD5', sectionTitle: 'İŞ VE ŞOFÖR İLANLARI' },
];

const timeDisplay = (iso: string): string => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} gün önce`;
  return d.toLocaleDateString('tr-TR');
};

const formatPrice = (price?: number): string => {
  if (!price) return '';
  return `${price.toLocaleString('tr-TR')} ₺`;
};

// ─── Input formatters (görsel, backend'e ham değer gider)
const fmtPhone = (raw: string): string => {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
};
const parsePhone = (text: string): string => text.replace(/\D/g, '').slice(0, 11);

const fmtPriceInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  return isNaN(n) ? '' : n.toLocaleString('tr-TR');
};
const parsePriceInput = (text: string): string => text.replace(/\D/g, '');

const IMAGE_BASE = 'https://api.hafriyapp.com';
const buildImageUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const btoa = (input: string = ''): string => {
  let str = input;
  let output = '';
  for (
    let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || (map = '=', i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4));
    if (charCode > 0xff) {
      throw new Error(
        "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
      );
    }
    block = (block << 8) | charCode;
  }
  return output;
};

const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const mime = res.headers.get('content-type') || 'image/jpeg';
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
    }
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return '';
  }
};

export default function MyAds() {
  const insets = useSafeAreaInsets();
  const token = useAppSelector(s => s.auth.token);
  const currentUserId = useAppSelector(s => s.auth.user?.id ?? '');

  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('blocked_user_ids')
      .then(val => {
        if (val) setBlockedUserIds(JSON.parse(val));
      })
      .catch(() => {});
  }, []);

  const handleBlockUser = (userId: string, userName?: string | null) => {
    Alert.alert(
      'Kullanıcıyı Engelle',
      'Bu kullanıcıyı engellemek istediğinize emin misiniz? Engellediğinizde, bu kullanıcının hiçbir ilanı listenizde gösterilmeyecektir. Ayrıca kullanıcı yetkililere WhatsApp üzerinden bildirilecektir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Engelle ve Bildir',
          onPress: async () => {
            try {
              // 1. Block locally (filters feed immediately)
              const updated = [...blockedUserIds, userId];
              setBlockedUserIds(updated);
              await AsyncStorage.setItem('blocked_user_ids', JSON.stringify(updated));
              setDetailModal(false);
              
              // 2. Redirect to WhatsApp to report to admin
              const phone = '+905383573913';
              const message = `Merhaba, Hafriyapp uygulamasında şu kullanıcıyı engelledim ve bildirmek istiyorum:\nKullanıcı ID: ${userId}\nKullanıcı Adı: ${userName || 'Belirtilmemiş'}`;
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

  const handleReportListing = (listing: Listing) => {
    Alert.alert(
      'İlanı Bildir',
      'Bu ilanda uygunsuz, sakıncalı veya aldatıcı içerik olduğunu düşünüyor musunuz? Şikayetinizi yetkililere WhatsApp üzerinden bildirebilirsiniz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, WhatsApp ile Bildir',
          onPress: async () => {
            const phone = '+905383573913';
            const message = `Merhaba, Hafriyapp uygulamasında şu ilanı şikayet etmek istiyorum:\nİlan ID: ${listing.id}\nİlan Başlığı: ${listing.title}\nİlan Sahibi: ${listing.userName || 'Belirtilmemiş'}`;
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

  // Navigation
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const cat = CATEGORIES.find(c => c.type === selectedType);

  // Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  // Data
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);

  // Filters
  const [filterProvince, setFilterProvince] = useState<number | null>(null);
  const [filterProvincePicker, setFilterProvincePicker] = useState(false);
  const [filterProvinceSearch, setFilterProvinceSearch] = useState('');

  // Detail
  const [detailModal, setDetailModal] = useState(false);
  const [detailListing, setDetailListing] = useState<Listing | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPhotoIdx, setDetailPhotoIdx] = useState(0);

  // Create form
  const [createModal, setCreateModal] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formProvince, setFormProvince] = useState<number | null>(null);
  const [formDistrict, setFormDistrict] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formProvincePicker, setFormProvincePicker] = useState(false);
  const [formProvinceSearch, setFormProvinceSearch] = useState('');
  const [formDistrictPicker, setFormDistrictPicker] = useState(false);
  const [formDistrictSearch, setFormDistrictSearch] = useState('');

  // Edit form
  const [editModal, setEditModal] = useState(false);
  const [editListing, setEditListing] = useState<Listing | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProvince, setEditProvince] = useState<number | null>(null);
  const [editDistrict, setEditDistrict] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editProvincePicker, setEditProvincePicker] = useState(false);
  const [editProvinceSearch, setEditProvinceSearch] = useState('');
  const [editDistrictPicker, setEditDistrictPicker] = useState(false);
  const [editDistrictSearch, setEditDistrictSearch] = useState('');
  const [editNewImages, setEditNewImages] = useState<string[]>([]);
  const [editRemainingImages, setEditRemainingImages] = useState<import('../services/listingService').ListingImage[]>([]);

  /* ─── Fetch ─── */
  const fetchListings = useCallback(async (reset = false) => {
    if (!token || selectedType === null) return;
    const nextPage = reset ? 1 : pageRef.current + 1;
    if (!reset && !hasMoreRef.current) return;
    try {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      const result = await getListings({
        type: selectedType,
        provinceCode: filterProvince ?? undefined,
        page: nextPage,
        pageSize: 20,
      });
      const items = result.items ?? [];
      if (items.length > 0) {
        console.log('[MyAds] İlk ilan thumbnailUrl:', items[0].thumbnailUrl, '| images:', items[0].images?.length ?? 0);
      }
      setListings(prev => reset ? items : [...prev, ...items]);
      hasMoreRef.current = nextPage < (result.totalPages ?? 1);
      pageRef.current = nextPage;
    } catch {
      Alert.alert('Hata', 'İlanlar yüklenemedi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, selectedType, filterProvince]);

  const fetchMyListings = useCallback(async () => {
    if (!token || selectedType === null) return;
    try {
      setLoading(true);
      const data = await getMyListings();
      const filtered = (data ?? []).filter(l => l.listingType === selectedType);
      if (filtered.length > 0) {
        console.log('[MyAds] İlanlarım ilk thumbnailUrl:', filtered[0].thumbnailUrl, '| images:', filtered[0].images?.length ?? 0);
      }
      setMyListings(filtered);
    } catch {
      Alert.alert('Hata', 'İlanlarınız yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedType]);

  useEffect(() => {
    if (selectedType === null) return;
    pageRef.current = 1;
    hasMoreRef.current = true;
    setListings([]);
    setMyListings([]);
    if (activeTab === 'all') fetchListings(true);
    else fetchMyListings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, activeTab, filterProvince]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    pageRef.current = 1;
    hasMoreRef.current = true;
    if (activeTab === 'all') await fetchListings(true);
    else await fetchMyListings();
    setRefreshing(false);
  }, [activeTab, fetchListings, fetchMyListings]);

  const onEndReached = () => {
    if (activeTab === 'all' && hasMoreRef.current && !loadingMore) fetchListings(false);
  };

  /* ─── Detail ─── */
  const openDetail = async (item: Listing) => {
    setDetailListing(item);
    setDetailModal(true);
    setDetailLoading(true);
    try {
      const full = await getListingById(item.id);
      setDetailListing(full);
    } catch {}
    finally { setDetailLoading(false); }
  };

  /* ─── Create ─── */
  const openCreate = () => {
    setFormTitle(''); setFormDesc(''); setFormPhone('');
    setFormDisplayName('');
    setFormProvince(null); setFormDistrict(''); setFormPrice('');
    setFormImages([]);
    setCreateModal(true);
  };

  const pickImages = () => {
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, selectionLimit: 10, quality: 0.8 },
      response => {
        if (response.assets) {
          const picked = response.assets
            .filter(a => a.base64 && a.type)
            .map(a => `data:${a.type};base64,${a.base64}`);
          setFormImages(prev => [...prev, ...picked].slice(0, 10));
        }
      },
    );
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) { Alert.alert('Eksik', 'İlan başlığı zorunludur.'); return; }
    if (!formPhone.trim()) { Alert.alert('Eksik', 'İletişim telefonu zorunludur.'); return; }
    if (!formProvince) { Alert.alert('Eksik', 'İl seçimi zorunludur.'); return; }
    if (selectedType === null) return;
    const params: CreateListingParams = {
      listingType: selectedType,
      title: formTitle.trim(),
      description: formDesc.trim() || undefined,
      contactPhone: formPhone.trim(),
      provinceCode: formProvince,
      districtName: formDistrict.trim() || undefined,
      price: selectedType !== 2 && formPrice ? parseInt(formPrice, 10) || undefined : undefined,
      images: formImages.length > 0 ? formImages : undefined,
    };
    try {
      setCreateSaving(true);
      await createListing(params);
      setCreateModal(false);
      Alert.alert('Başarılı', 'İlanınız yayınlandı!');
      if (activeTab === 'my') fetchMyListings(); else fetchListings(true);
    } catch (e: any) {
      Alert.alert('Hata', e?.response?.data?.errors?.[0] ?? 'İlan oluşturulamadı.');
    } finally { setCreateSaving(false); }
  };

  /* ─── Edit ─── */
  const openEdit = (item: Listing) => {
    setEditListing(item);
    setEditTitle(item.title);
    setEditDesc(item.description ?? '');
    setEditPhone(item.contactPhone);
    setEditProvince(item.provinceCode);
    setEditDistrict(item.districtName ?? '');
    setEditPrice(item.price ? String(item.price) : '');
    setEditIsActive(item.isActive);
    setEditNewImages([]);
    setEditRemainingImages(item.images ?? []);
    setDetailModal(false);
    setEditModal(true);
  };

  const pickEditImages = () => {
    const totalExisting = editRemainingImages.length + editNewImages.length;
    const remaining = 5 - totalExisting;
    if (remaining <= 0) {
      Alert.alert('Limit', 'En fazla 5 fotoğraf ekleyebilirsiniz.');
      return;
    }
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, selectionLimit: remaining, quality: 0.8 },
      response => {
        if (response.assets) {
          const picked = response.assets
            .filter(a => a.base64 && a.type)
            .map(a => `data:${a.type};base64,${a.base64}`);
          setEditNewImages(prev => [...prev, ...picked].slice(0, remaining));
        }
      },
    );
  };

  const handleEdit = async () => {
    if (!editListing) return;
    if (!editTitle.trim()) { Alert.alert('Eksik', 'İlan başlığı zorunludur.'); return; }
    if (!editPhone.trim()) { Alert.alert('Eksik', 'İletişim telefonu zorunludur.'); return; }

    try {
      setEditSaving(true);

      // Fotoğraf değiştiyse mevcut URL'leri base64'e çevir
      const imagesChanged =
        editNewImages.length > 0 ||
        editRemainingImages.length !== (editListing.images?.length ?? 0);

      let imagesToSend: string[] | undefined;
      if (imagesChanged) {
        const existingBase64 = await Promise.all(
          editRemainingImages.map(img => urlToBase64(buildImageUrl(img.imagePath))),
        );
        imagesToSend = [...existingBase64.filter(Boolean), ...editNewImages];
      }

      const params: UpdateListingParams = {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        contactPhone: editPhone.trim(),
        provinceCode: editProvince ?? editListing.provinceCode,
        districtName: editDistrict.trim() || undefined,
        price: editListing.listingType !== 2 && editPrice ? parseInt(editPrice, 10) || undefined : undefined,
        isActive: editIsActive,
        images: imagesToSend,
      };

      await updateListing(editListing.id, params);
      setEditModal(false);
      Alert.alert('Başarılı', 'İlan güncellendi.');
      if (activeTab === 'my') fetchMyListings(); else fetchListings(true);
    } catch (e: any) {
      Alert.alert('Hata', e?.response?.data?.errors?.[0] ?? 'İlan güncellenemedi.');
    } finally { setEditSaving(false); }
  };

  /* ─── Delete ─── */
  const handleDelete = (id: string) => {
    Alert.alert('İlanı Sil', 'Bu ilanı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await deleteListing(id);
            setDetailModal(false);
            Alert.alert('Silindi', 'İlan başarıyla silindi.');
            if (activeTab === 'my') fetchMyListings(); else fetchListings(true);
          } catch { Alert.alert('Hata', 'İlan silinemedi.'); }
        },
      },
    ]);
  };

  /* ─── Toggle active ─── */
  const handleToggleActive = async (item: Listing) => {
    try {
      await updateListing(item.id, { isActive: !item.isActive });
      if (detailListing?.id === item.id) setDetailListing(p => p ? { ...p, isActive: !p.isActive } : null);
      if (activeTab === 'my') fetchMyListings(); else fetchListings(true);
    } catch { Alert.alert('Hata', 'Durum güncellenemedi.'); }
  };

  /* ─── Province picker ─── */
  const filteredProvs = (s: string) => PROVINCES.filter(p => p.name.toLowerCase().includes(s.toLowerCase()));

  const ProvincePicker = ({
    visible, onClose, onSelect, search, setSearch,
  }: {
    visible: boolean; onClose: () => void; onSelect: (c: number) => void;
    search: string; setSearch: (s: string) => void;
  }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.pickerSheet}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerHeaderText}>İl Seçin</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.pickerClose}>✕</Text></TouchableOpacity>
        </View>
        <TextInput style={styles.pickerSearch} placeholder="İl ara..." value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
        <FlatList
          data={filteredProvs(search)}
          keyExtractor={p => String(p.code)}
          renderItem={({ item: p }) => (
            <TouchableOpacity style={styles.pickerItem} onPress={() => { onSelect(p.code); onClose(); setSearch(''); }}>
              <Text style={styles.pickerItemText}>{p.name}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.pickerSep} />}
        />
      </View>
    </Modal>
  );

  const DistrictPicker = ({
    visible, onClose, onSelect, search, setSearch, provinceCode
  }: {
    visible: boolean; onClose: () => void; onSelect: (d: string) => void;
    search: string; setSearch: (s: string) => void; provinceCode: number | null;
  }) => {
    const districts = provinceCode ? (DISTRICTS[provinceCode] || []) : [];
    const filtered = districts.filter(d => d.label.toLowerCase().includes(search.toLowerCase()));
    
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerHeaderText}>İlçe Seçin</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.pickerClose}>✕</Text></TouchableOpacity>
          </View>
          <TextInput style={styles.pickerSearch} placeholder="İlçe ara..." value={search} onChangeText={setSearch} placeholderTextColor="#aaa" />
          <FlatList
            data={filtered}
            keyExtractor={d => d.value}
            renderItem={({ item: d }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => { onSelect(d.value); onClose(); setSearch(''); }}>
                <Text style={styles.pickerItemText}>{d.label}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.pickerSep} />}
          />
        </View>
      </Modal>
    );
  };

  /* ─── Create form (web tasarımı) ─── */
  const renderCreateForm = () => {
    const type = selectedType ?? 0;
    const titlePlaceholder =
      type === 0 ? 'Örn: Kepçe Kiralık — Günlük' :
      type === 1 ? 'Örn: 2018 Ford Cargo Satılık' :
      'Örn: Deneyimli Damperci Şoför';
    const descPlaceholder =
      type === 0 ? 'Araç türü, çalışma saatleri, fiyat bilgisi...' :
      type === 1 ? 'Model, km, motor, hasar durumu...' :
      'Deneyim, ehliyet türü, çalışma tercihi...';

    return (
      <>
        {/* İlan Başlığı */}
        <View style={cf.section}>
          <Text style={cf.label}>İLAN BAŞLIĞI</Text>
          <TextInput
            style={cf.input}
            value={formTitle}
            onChangeText={setFormTitle}
            placeholder={titlePlaceholder}
            placeholderTextColor="#bbb"
          />
        </View>

        {/* Ad Soyad + Telefon */}
        <View style={cf.row}>
          <View style={cf.halfSection}>
            <Text style={cf.label}>AD SOYAD</Text>
            <TextInput
              style={cf.input}
              value={formDisplayName}
              onChangeText={setFormDisplayName}
              placeholder="Adınız soyadınız"
              placeholderTextColor="#bbb"
            />
          </View>
          <View style={cf.halfSection}>
            <Text style={cf.label}>TELEFON</Text>
            <TextInput
              style={cf.input}
              value={fmtPhone(formPhone)}
              onChangeText={t => setFormPhone(parsePhone(t))}
              placeholder="05xx xxx xx xx"
              placeholderTextColor="#bbb"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Şehir */}
        <View style={cf.section}>
          <Text style={cf.label}>ŞEHİR</Text>
          <TouchableOpacity
            style={cf.select}
            onPress={() => setFormProvincePicker(true)}
          >
            <Text style={[cf.selectText, !formProvince && cf.placeholderText]}>
              {formProvince ? getProvinceName(formProvince) : 'Şehir seçiniz...'}
            </Text>
            <Text style={cf.arrow}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* İlçe */}
        <View style={cf.section}>
          <Text style={cf.label}>İLÇE (OPSİYONEL)</Text>
          <TouchableOpacity
            style={cf.select}
            onPress={() => {
              if (!formProvince) { Alert.alert('Uyarı', 'Lütfen önce şehir seçiniz.'); return; }
              setFormDistrictPicker(true);
            }}
          >
            <Text style={[cf.selectText, !formDistrict && cf.placeholderText]}>
              {formDistrict || 'İlçe adı'}
            </Text>
            <Text style={cf.arrow}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* Açıklama */}
        <View style={cf.section}>
          <Text style={cf.label}>AÇIKLAMA</Text>
          <TextInput
            style={[cf.input, cf.textarea]}
            value={formDesc}
            onChangeText={setFormDesc}
            placeholder={descPlaceholder}
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Fiyat */}
        {type !== 2 && (
          <View style={cf.section}>
            <Text style={cf.label}>FİYAT (₺)</Text>
            <TextInput
              style={cf.input}
              value={fmtPriceInput(formPrice)}
              onChangeText={t => setFormPrice(parsePriceInput(t))}
              placeholder="Fiyat girin (opsiyonel)"
              placeholderTextColor="#bbb"
              keyboardType="number-pad"
            />
          </View>
        )}

        {/* Fotoğraf */}
        <View style={cf.section}>
          <Text style={cf.label}>FOTOĞRAF</Text>
          <TouchableOpacity style={cf.photoBox} onPress={pickImages} activeOpacity={0.75}>
            <Text style={cf.photoIcon}>📷</Text>
            <Text style={cf.photoTitle}>Fotoğraf ekle</Text>
            <Text style={cf.photoSub}>JPG, PNG, WEBP</Text>
          </TouchableOpacity>
          {formImages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10 }}
              keyboardShouldPersistTaps="handled"
            >
              {formImages.map((img, i) => (
                <View key={i} style={cf.thumbWrapper}>
                  <Image source={{ uri: img }} style={cf.thumb} />
                  <TouchableOpacity
                    style={cf.thumbRemove}
                    onPress={() => setFormImages(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <Text style={cf.thumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ height: 8 }} />
      </>
    );
  };

  /* ─── Form fields ─── */
  const renderFormFields = (mode: 'create' | 'edit') => {
    const type = mode === 'create' ? (selectedType ?? 0) : (editListing?.listingType ?? 0);
    const title    = mode === 'create' ? formTitle    : editTitle;
    const desc     = mode === 'create' ? formDesc     : editDesc;
    const phone    = mode === 'create' ? formPhone    : editPhone;
    const province = mode === 'create' ? formProvince : editProvince;
    const district = mode === 'create' ? formDistrict : editDistrict;
    const price    = mode === 'create' ? formPrice    : editPrice;
    const setTitle    = mode === 'create' ? setFormTitle    : setEditTitle;
    const setDesc     = mode === 'create' ? setFormDesc     : setEditDesc;
    const setPhone    = mode === 'create' ? setFormPhone    : setEditPhone;
    const setDistrict = mode === 'create' ? setFormDistrict : setEditDistrict;
    const setPrice    = mode === 'create' ? setFormPrice    : setEditPrice;
    const openProv = mode === 'create' ? () => setFormProvincePicker(true) : () => setEditProvincePicker(true);
    return (
      <>
        <Text style={styles.formLabel}>Başlık *</Text>
        <TextInput style={styles.formInput} value={title} onChangeText={setTitle} placeholder="İlan başlığı" placeholderTextColor="#aaa" />

        <Text style={styles.formLabel}>Açıklama</Text>
        <TextInput style={[styles.formInput, styles.formTextArea]} value={desc} onChangeText={setDesc} placeholder="Açıklama..." placeholderTextColor="#aaa" multiline numberOfLines={3} textAlignVertical="top" />

        <Text style={styles.formLabel}>İletişim Tel *</Text>
        <TextInput style={styles.formInput} value={fmtPhone(phone)} onChangeText={t => setPhone(parsePhone(t))} placeholder="05xx xxx xx xx" placeholderTextColor="#aaa" keyboardType="phone-pad" />

        <Text style={styles.formLabel}>İl *</Text>
        <TouchableOpacity style={styles.formSelect} onPress={openProv}>
          <Text style={[styles.formSelectText, !province && { color: '#aaa' }]}>
            {province ? getProvinceName(province) : 'İl seçin...'}
          </Text>
          <Text style={styles.formSelectArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.formLabel}>İlçe</Text>
        <TouchableOpacity style={styles.formSelect} onPress={() => {
          if (!province) { Alert.alert('Uyarı', 'Lütfen önce il seçiniz.'); return; }
          if (mode === 'create') setFormDistrictPicker(true);
          else setEditDistrictPicker(true);
        }}>
          <Text style={[styles.formSelectText, !district && { color: '#aaa' }]}>
            {district || 'İlçe seçin...'}
          </Text>
          <Text style={styles.formSelectArrow}>▼</Text>
        </TouchableOpacity>

        {type !== 2 && (
          <>
            <Text style={styles.formLabel}>Fiyat (₺)</Text>
            <TextInput style={styles.formInput} value={fmtPriceInput(price)} onChangeText={t => setPrice(parsePriceInput(t))} placeholder="Fiyat giriniz" placeholderTextColor="#aaa" keyboardType="number-pad" />
          </>
        )}

        {mode === 'edit' && (
          <>
            {/* Fotoğraflar */}
            {(() => {
              const totalCount = editRemainingImages.length + editNewImages.length;
              return (
                <>
                  <View style={ef.photoHeader}>
                    <Text style={styles.formLabel}>FOTOĞRAFLAR</Text>
                    <Text style={ef.photoCount}>{totalCount} / 5</Text>
                  </View>

                  {/* Mevcut + yeni fotoğraflar grid */}
                  {(editRemainingImages.length > 0 || editNewImages.length > 0) && (
                    <View style={ef.thumbGrid}>
                      {/* Mevcut fotoğraflar — silinebilir */}
                      {editRemainingImages.map((img, i) => (
                        <View key={img.id ?? `e${i}`} style={ef.thumbWrap}>
                          <Image
                            source={{ uri: buildImageUrl(img.imagePath) }}
                            style={ef.thumb}
                          />
                          <TouchableOpacity
                            style={ef.thumbRemove}
                            onPress={() =>
                              setEditRemainingImages(prev => prev.filter((_, idx) => idx !== i))
                            }
                          >
                            <Text style={ef.thumbRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}

                      {/* Yeni eklenen fotoğraflar — silinebilir */}
                      {editNewImages.map((uri, i) => (
                        <View key={`n${i}`} style={ef.thumbWrap}>
                          <Image source={{ uri }} style={ef.thumb} />
                          <View style={ef.thumbNewBadge}><Text style={ef.thumbNewBadgeText}>YENİ</Text></View>
                          <TouchableOpacity
                            style={ef.thumbRemove}
                            onPress={() =>
                              setEditNewImages(prev => prev.filter((_, idx) => idx !== i))
                            }
                          >
                            <Text style={ef.thumbRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Ekleme butonu — max 5'e ulaşılmadıysa göster */}
                  {totalCount < 5 && (
                    <TouchableOpacity style={ef.uploadBox} onPress={pickEditImages} activeOpacity={0.75}>
                      <Text style={ef.uploadIcon}>📷</Text>
                      <Text style={ef.uploadText}>Fotoğraf ekle ({5 - totalCount} kaldı)</Text>
                    </TouchableOpacity>
                  )}

                  {totalCount >= 5 && (
                    <Text style={ef.limitText}>Maksimum 5 fotoğrafa ulaşıldı.</Text>
                  )}
                </>
              );
            })()}

            {/* Durum */}
            <Text style={[styles.formLabel, { marginTop: 16 }]}>Durum</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggleBtn, editIsActive && styles.toggleBtnActive]} onPress={() => setEditIsActive(true)}>
                <Text style={[styles.toggleBtnText, editIsActive && styles.toggleBtnTextActive]}>Aktif</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, !editIsActive && styles.toggleBtnPassive]} onPress={() => setEditIsActive(false)}>
                <Text style={[styles.toggleBtnText, !editIsActive && styles.toggleBtnTextPassive]}>Pasif</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        <View style={{ height: 24 }} />
      </>
    );
  };

  /* ─── Card ─── */
  const renderCard = ({ item }: { item: Listing }) => {
    const isOwner = item.userId === currentUserId;
    const locText = [getProvinceName(item.provinceCode), item.districtName].filter(Boolean).join(' (') + (item.districtName ? ')' : '');

    if (item.listingType === 2) {
      return (
        <TouchableOpacity style={styles.cardDriverWrap} onPress={() => openDetail(item)} activeOpacity={0.85}>
          <View style={styles.cardDriverAvatar}><Text style={styles.cardDriverAvatarText}>👤</Text></View>
          <View style={styles.cardDriverBody}>
            <View style={styles.cardDriverRow}>
              {item.userName ? <Text style={styles.cardDriverName}>{item.userName}</Text> : null}
              <Text style={styles.cardDriverTitle}>{item.title}</Text>
            </View>
            {item.description ? <Text style={styles.cardDriverDesc} numberOfLines={2}>{item.description}</Text> : null}
            <View style={styles.cardDriverFooter}>
              <Text style={styles.cardDriverTime}>{timeDisplay(item.createdDate)}</Text>
              <View style={styles.cardActions}>
                {isOwner && !item.isActive && <View style={styles.passiveBadge}><Text style={styles.passiveBadgeText}>Pasif</Text></View>}
                {!isOwner && (
                  <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${item.contactPhone}`)}>
                    <Text style={styles.callBtnText}>📞 Ara</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const cardImgUri =
      buildImageUrl(item.thumbnailUrl) ||
      (item.images && item.images.length > 0 ? buildImageUrl(item.images[0].imagePath) : '');

    return (
      <TouchableOpacity style={styles.cardWrap} onPress={() => openDetail(item)} activeOpacity={0.85}>
        {cardImgUri
          ? <Image source={{ uri: cardImgUri }} style={styles.cardImage} />
          : <View style={styles.cardImagePlaceholder}><Text style={styles.cardImageIcon}>{item.listingType === 0 ? '🚛' : '🏬'}</Text></View>
        }
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {locText ? <Text style={styles.cardLoc} numberOfLines={1}>📍 {locText}</Text> : null}
          {item.userName ? <Text style={styles.cardOwner}>{item.userName}</Text> : null}
          <View style={styles.cardFooter}>
            {item.price
              ? <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
              : <View />
            }
            <View style={styles.cardActions}>
              {isOwner && !item.isActive && <View style={styles.passiveBadge}><Text style={styles.passiveBadgeText}>Pasif</Text></View>}
              {!isOwner && (
                <TouchableOpacity style={styles.callBtn} onPress={e => { e.stopPropagation?.(); Linking.openURL(`tel:${item.contactPhone}`); }}>
                  <Text style={styles.callBtnText}>📞 Ara</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /* ─── LANDING ─── */
  if (selectedType === null) {
    return (
      <SafeAreaView style={styles.landingContainer} edges={['bottom']}>
        <View style={styles.landingHeader}>
          <Text style={styles.landingIcon}>📢</Text>
          <Text style={styles.landingTitle}>İlanlar</Text>
          <Text style={styles.landingSubtitle}>Kategoriye tıklayarak ilanları görüntüleyin</Text>
        </View>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.type}
              style={styles.categoryCard}
              onPress={() => { setSelectedType(c.type); setActiveTab('all'); setFilterProvince(null); }}
              activeOpacity={0.8}
            >
              <View style={[styles.categoryIconWrap, { backgroundColor: c.iconBg }]}>
                <Text style={styles.categoryEmoji}>{c.icon}</Text>
              </View>
              <Text style={styles.categoryLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  /* ─── LIST VIEW ─── */
  const displayList = (activeTab === 'all' ? listings : myListings).filter(
    l => !blockedUserIds.includes(l.userId)
  );

  return (
    <SafeAreaView style={styles.listContainer} edges={['bottom']}>
      {/* Header */}
      <View style={styles.listHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedType(null)}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.listHeaderTitle}>{cat?.sectionTitle}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ İlan Ver</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['all', 'my'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'all' ? 'Tüm İlanlar' : 'İlanlarım'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Province filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.provinceBtn} onPress={() => setFilterProvincePicker(true)}>
          <Text style={styles.provinceBtnText} numberOfLines={1}>
            {filterProvince ? `📍 ${getProvinceName(filterProvince)}` : '🏙 Tüm Şehirler'}
          </Text>
          <Text style={styles.provinceBtnArrow}>▼</Text>
        </TouchableOpacity>
        {filterProvince != null && (
          <TouchableOpacity style={styles.clearFilter} onPress={() => setFilterProvince(null)}>
            <Text style={styles.clearFilterText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading && displayList.length === 0
        ? <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={displayList}
            keyExtractor={i => i.id}
            renderItem={renderCard}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>
                  {activeTab === 'my' ? 'Henüz ilanınız bulunmuyor.' : 'İlan bulunamadı.'}
                </Text>
              </View>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color="#000" style={{ margin: 16 }} /> : null}
          />
        )
      }

      {/* Scope Province picker */}
      <ProvincePicker
        visible={filterProvincePicker} onClose={() => setFilterProvincePicker(false)}
        onSelect={c => setFilterProvince(c)} search={filterProvinceSearch} setSearch={setFilterProvinceSearch}
      />

      {/* Create modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <ProvincePicker
          visible={formProvincePicker} onClose={() => setFormProvincePicker(false)}
          onSelect={c => { setFormProvince(c); setFormDistrict(''); }} search={formProvinceSearch} setSearch={setFormProvinceSearch}
        />
        <DistrictPicker
          visible={formDistrictPicker} onClose={() => setFormDistrictPicker(false)}
          onSelect={d => setFormDistrict(d)} search={formDistrictSearch} setSearch={setFormDistrictSearch} provinceCode={formProvince}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCreateModal(false)} />
          <View style={cf.sheet}>
            {/* Başlık */}
            <View style={cf.sheetHeader}>
              <Text style={cf.sheetTitle}>Yeni İlan</Text>
              <TouchableOpacity style={cf.closeBtn} onPress={() => setCreateModal(false)}>
                <Text style={cf.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={cf.scroll}
              contentContainerStyle={cf.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderCreateForm()}
            </ScrollView>
            <View style={cf.footer}>
              <TouchableOpacity
                style={[cf.publishBtn, createSaving && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={createSaving}
                activeOpacity={0.85}
              >
                {createSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={cf.publishBtnText}>İlanı Yayınla</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <ProvincePicker
          visible={editProvincePicker} onClose={() => setEditProvincePicker(false)}
          onSelect={c => { setEditProvince(c); setEditDistrict(''); }} search={editProvinceSearch} setSearch={setEditProvinceSearch}
        />
        <DistrictPicker
          visible={editDistrictPicker} onClose={() => setEditDistrictPicker(false)}
          onSelect={d => setEditDistrict(d)} search={editDistrictSearch} setSearch={setEditDistrictSearch} provinceCode={editProvince}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModal(false)} />
          <View style={styles.formSheet}>
            <View style={styles.formSheetHandle} />
            <View style={styles.formSheetHeader}>
              <View>
                <Text style={styles.formSheetTitle}>İlanı Düzenle</Text>
                <Text style={styles.formSheetSub}>{CATEGORIES.find(c => c.type === editListing?.listingType)?.label}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModal(false)}><Text style={styles.formSheetClose}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
              {renderFormFields('edit')}
            </ScrollView>
            <TouchableOpacity style={[styles.formSaveBtn, editSaving && { opacity: 0.6 }]} onPress={handleEdit} disabled={editSaving}>
              {editSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.formSaveBtnText}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail modal */}
      {detailListing && (
        <Modal visible={detailModal} animationType="slide" onRequestClose={() => setDetailModal(false)}>
          <SafeAreaView style={ds.container} edges={['bottom']}>
            {/* Header */}
            <View style={[ds.header, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity style={ds.headerClose} onPress={() => setDetailModal(false)}>
                <Text style={ds.headerCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={ds.headerTitle}>İlan Detayı</Text>
              <View style={{ width: 36 }} />
            </View>

            {detailLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#F5A623" />
              </View>
            ) : (
              <>
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: detailListing.userId === currentUserId ? 140 : 150 }}
                >
                  {/* Fotoğraf karusel */}
                  {(() => {
                    const imgs: string[] =
                      detailListing.images && detailListing.images.length > 0
                        ? detailListing.images.map(i => buildImageUrl(i.imagePath)).filter(Boolean)
                        : buildImageUrl(detailListing.thumbnailUrl)
                        ? [buildImageUrl(detailListing.thumbnailUrl)]
                        : [];
                    if (imgs.length > 0) {
                      return (
                        <View style={ds.photoWrap}>
                          <ScrollView
                            horizontal pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={e => setDetailPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
                            scrollEventThrottle={16}
                          >
                            {imgs.map((uri, i) => (
                              <Image key={i} source={{ uri }} style={[ds.photo, { width: SW }]} resizeMode="cover" />
                            ))}
                          </ScrollView>
                          {imgs.length > 1 && (
                            <View style={ds.dots}>
                              {imgs.map((_, i) => (
                                <View key={i} style={[ds.dot, detailPhotoIdx === i && ds.dotActive]} />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    }
                    if (detailListing.listingType !== 2) {
                      return (
                        <View style={ds.photoPlaceholder}>
                          <Text style={{ fontSize: 64 }}>{detailListing.listingType === 0 ? '🚛' : '🏬'}</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  <View style={ds.content}>
                    {/* Konum */}
                    {(detailListing.provinceCode > 0 || detailListing.districtName) && (
                      <Text style={ds.location}>
                        📍 {getProvinceName(detailListing.provinceCode)}
                        {detailListing.districtName ? ` (${detailListing.districtName})` : ''}
                      </Text>
                    )}

                    {/* Başlık */}
                    <Text style={ds.title}>{detailListing.title}</Text>

                    {/* Pasif badge */}
                    {!detailListing.isActive && (
                      <View style={ds.passiveBadge}>
                        <Text style={ds.passiveBadgeText}>Yayından kaldırılmış</Text>
                      </View>
                    )}

                    {/* Fiyat */}
                    {detailListing.listingType !== 2 && detailListing.price ? (
                      <Text style={ds.price}>{formatPrice(detailListing.price)}</Text>
                    ) : null}

                    {/* İlan Sahibi */}
                    <View style={ds.ownerCard}>
                      <View>
                        <Text style={ds.ownerLabel}>İLAN SAHİBİ</Text>
                        <Text style={ds.ownerName}>{detailListing.userName ?? 'İlan sahibi'}</Text>
                      </View>
                      <TouchableOpacity
                        style={ds.araSmall}
                        onPress={() => Linking.openURL(`tel:${detailListing.contactPhone}`)}
                      >
                        <Text style={ds.araSmallText}>📞  Ara</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Açıklama */}
                    {detailListing.description ? (
                      <>
                        <Text style={ds.sectionLabel}>AÇIKLAMA</Text>
                        <Text style={ds.descText}>{detailListing.description}</Text>
                      </>
                    ) : null}

                    {/* Meta */}
                    <View style={ds.metaRow}>
                      <Text style={ds.metaItem}>🕐 {timeDisplay(detailListing.createdDate)}</Text>
                      <Text style={ds.metaItem}>📞 {detailListing.contactPhone}</Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Sabit alt bar */}
                <View style={[ds.bottomBar, detailListing.userId === currentUserId && { paddingBottom: 4 }]}>
                  <View style={ds.bottomRow}>
                    <TouchableOpacity
                      style={ds.btnAra}
                      onPress={() => Linking.openURL(`tel:${detailListing.contactPhone}`)}
                      activeOpacity={0.85}
                    >
                      <Text style={ds.btnAraText}>📞  Ara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={ds.btnPaylas}
                      onPress={() =>
                        Share.share({
                          message: `${detailListing.title}\n${getProvinceName(detailListing.provinceCode)}${detailListing.districtName ? ` (${detailListing.districtName})` : ''}\n${detailListing.price ? formatPrice(detailListing.price) : ''}\nİletişim: ${detailListing.contactPhone}`,
                          title: detailListing.title,
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <Text style={ds.btnPaylasText}>↗  Paylaş</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Diğer kullanıcı ilanları için Şikayet / Engelleme */}
                  {detailListing.userId !== currentUserId && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#FFF0F0', paddingVertical: 11, borderRadius: 10, alignItems: 'center' }}
                        onPress={() => handleReportListing(detailListing)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#D32F2F' }}>⚠️ Şikayet Et</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#FFF0F0', paddingVertical: 11, borderRadius: 10, alignItems: 'center' }}
                        onPress={() => handleBlockUser(detailListing.userId, detailListing.userName)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#D32F2F' }}>🚫 Kullanıcıyı Engelle</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Sahip butonları */}
                  {detailListing.userId === currentUserId && (
                    <View style={ds.ownerRow}>
                      <TouchableOpacity style={ds.ownerBtnEdit} onPress={() => openEdit(detailListing)}>
                        <Text style={ds.ownerBtnEditText}>✏️ Düzenle</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={ds.ownerBtnToggle} onPress={() => handleToggleActive(detailListing)}>
                        <Text style={ds.ownerBtnToggleText}>
                          {detailListing.isActive ? '🔴 Yayından Kaldır' : '🟢 Yayınla'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={ds.ownerBtnDel} onPress={() => handleDelete(detailListing.id)}>
                        <Text style={ds.ownerBtnDelText}>🗑 Sil</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </>
            )}
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/* ─── Edit photo styles ─── */
const ef = StyleSheet.create({
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 10,
  },
  photoCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F5A623',
  },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  thumbRemove: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  thumbRemoveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  thumbNewBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#F5A623',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbNewBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#fafafa',
    marginBottom: 4,
  },
  uploadIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  limitText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
});

/* ─── Detail styles ─── */
const ds = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#fff' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle:      { fontSize: 16, fontWeight: '700', color: '#111' },
  headerClose:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  headerCloseText:  { fontSize: 14, color: '#757575', fontWeight: '600' },

  photoWrap:        { backgroundColor: '#111' },
  photo:            { height: 260 },
  photoPlaceholder: { height: 200, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  dots:             { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive:        { backgroundColor: '#F5A623', width: 18 },

  content:          { padding: 20 },
  location:         { fontSize: 13, color: '#555', marginBottom: 6, fontWeight: '500' },
  title:            { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 6, lineHeight: 28 },
  price:            { fontSize: 26, fontWeight: '900', color: '#111', marginBottom: 14 },
  passiveBadge:     { alignSelf: 'flex-start', backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  passiveBadgeText: { fontSize: 12, color: '#E65100', fontWeight: '700' },

  ownerCard:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F8F8', borderRadius: 14, padding: 14, marginBottom: 18 },
  ownerLabel:       { fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  ownerName:        { fontSize: 16, fontWeight: '700', color: '#111' },
  araSmall:         { backgroundColor: '#2E7D32', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, flexDirection: 'row', alignItems: 'center' },
  araSmallText:     { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionLabel:     { fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  descText:         { fontSize: 15, color: '#333', lineHeight: 23, marginBottom: 18 },

  metaRow:          { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginTop: 4 },
  metaItem:         { fontSize: 13, color: '#888', fontWeight: '500' },

  bottomBar:        { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  bottomRow:        { flexDirection: 'row', gap: 10, marginBottom: 0 },
  btnAra:           { flex: 1, backgroundColor: '#2E7D32', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnAraText:       { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnPaylas:        { flex: 1, backgroundColor: '#F5F5F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPaylasText:    { color: '#333', fontSize: 15, fontWeight: '700' },

  ownerRow:         { flexDirection: 'row', gap: 8, marginTop: 8 },
  ownerBtnEdit:     { flex: 1, backgroundColor: '#F5F5F5', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  ownerBtnEditText: { fontSize: 13, fontWeight: '700', color: '#333' },
  ownerBtnToggle:   { flex: 1, backgroundColor: '#FFF8E1', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  ownerBtnToggleText: { fontSize: 13, fontWeight: '700', color: '#E65100' },
  ownerBtnDel:      { flex: 1, backgroundColor: '#FFF0F0', paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  ownerBtnDelText:  { fontSize: 13, fontWeight: '700', color: '#D32F2F' },
});

/* ─── Create form styles (web design) ─── */
const cf = StyleSheet.create({
  sheet: {
    height: SH * 0.88,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#212121',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  section: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  halfSection: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#757575',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    backgroundColor: '#fafafa',
  },
  textarea: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#fafafa',
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  placeholderText: {
    color: '#bbb',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 6,
  },
  photoBox: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  photoIcon: {
    fontSize: 30,
    marginBottom: 6,
    color: '#bbb',
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 2,
  },
  photoSub: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  thumbWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#eee',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  publishBtn: {
    backgroundColor: '#F5A623',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  publishBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});

const styles = StyleSheet.create({
  // ── Landing
  landingContainer:  { flex: 1, backgroundColor: '#FFFBF0' },
  landingHeader:     { alignItems: 'center', paddingTop: 40, paddingBottom: 28, paddingHorizontal: 24 },
  landingIcon:       { fontSize: 40, marginBottom: 8 },
  landingTitle:      { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 8 },
  landingSubtitle:   { fontSize: 14, color: '#666', textAlign: 'center' },
  categoryGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 16 },
  categoryCard:      {
    width: CARD_W, backgroundColor: '#fff', borderRadius: 18,
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  categoryIconWrap:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  categoryEmoji:     { fontSize: 32 },
  categoryLabel:     { fontSize: 15, fontWeight: '700', color: '#111', textAlign: 'center' },

  // ── List
  listContainer:     { flex: 1, backgroundColor: '#F5F5F5' },
  listHeader:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', gap: 10 },
  backBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  backBtnText:       { fontSize: 24, color: '#333', lineHeight: 28, fontWeight: '600' },
  listHeaderTitle:   { flex: 1, fontSize: 15, fontWeight: '800', color: '#111' },
  addBtn:            { backgroundColor: '#2E7D32', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText:        { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── Tabs
  tabRow:            { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab:               { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:         { borderBottomColor: '#FFD500' },
  tabText:           { fontSize: 14, fontWeight: '600', color: '#aaa' },
  tabTextActive:     { color: '#111' },

  // ── Filter
  filterRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', gap: 8 },
  provinceBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  provinceBtnText:   { flex: 1, fontSize: 14, color: '#333', fontWeight: '500' },
  provinceBtnArrow:  { color: '#888', fontSize: 11, marginLeft: 6 },
  clearFilter:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  clearFilterText:   { color: '#555', fontSize: 14 },

  listContent:       { padding: 12, paddingBottom: 40 },

  // ── Card type 0/1
  cardWrap:          {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  cardImage:         { width: 110, height: 110, backgroundColor: '#eee' },
  cardImagePlaceholder: { width: 110, height: 110, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  cardImageIcon:     { fontSize: 34 },
  cardBody:          { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitle:         { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
  cardLoc:           { fontSize: 12, color: '#E65100', marginBottom: 4 },
  cardOwner:         { fontSize: 12, color: '#888' },
  cardFooter:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardPrice:         { fontSize: 15, fontWeight: '800', color: '#111' },
  cardActions:       { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // ── Card type 2 (driver)
  cardDriverWrap:       {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  cardDriverAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardDriverAvatarText: { fontSize: 22 },
  cardDriverBody:       { flex: 1 },
  cardDriverRow:        { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  cardDriverName:       { fontSize: 14, fontWeight: '700', color: '#111' },
  cardDriverTitle:      { fontSize: 12, fontWeight: '600', color: '#444', backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  cardDriverDesc:       { fontSize: 12, color: '#666', marginBottom: 6, lineHeight: 18 },
  cardDriverFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDriverTime:       { fontSize: 11, color: '#bbb' },

  // ── Call button
  callBtn:           { backgroundColor: '#2E7D32', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  callBtnText:       { color: '#fff', fontSize: 12, fontWeight: '700' },
  callBtnLg:         { backgroundColor: '#2E7D32', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  callBtnLgText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Passive badge
  passiveBadge:      { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  passiveBadgeText:  { fontSize: 11, color: '#E65100', fontWeight: '600' },
  passiveBadgeLg:    { backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  passiveBadgeLgText:{ fontSize: 12, color: '#E65100', fontWeight: '600' },

  // ── Empty
  emptyWrap:         { alignItems: 'center', paddingTop: 60 },
  emptyIcon:         { fontSize: 48, marginBottom: 16 },
  emptyText:         { fontSize: 15, color: '#888', fontWeight: '500' },

  // ── Province picker
  pickerOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  pickerHeader:      { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerHeaderText:  { flex: 1, fontSize: 16, fontWeight: '700', color: '#111' },
  pickerClose:       { fontSize: 18, color: '#777', padding: 4 },
  pickerSearch:      { margin: 12, backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111' },
  pickerItem:        { paddingHorizontal: 16, paddingVertical: 13 },
  pickerItemText:    { fontSize: 15, color: '#222' },
  pickerSep:         { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 16 },

  // ── Modal overlay
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },

  // ── Detail sheet
  detailSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  detailHandle:      { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  detailImage:       { width: '100%', height: 200, backgroundColor: '#eee' },
  detailImagePlaceholder: { width: '100%', height: 160, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  detailContent:     { padding: 20 },
  detailBadgeRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBadge:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText:     { fontSize: 12, fontWeight: '600', color: '#333' },
  detailTitle:       { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 6 },
  detailPrice:       { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 8 },
  detailLoc:         { fontSize: 14, color: '#E65100', marginBottom: 12 },
  detailDesc:        { fontSize: 14, color: '#444', lineHeight: 22, marginBottom: 16 },
  detailOwnerBox:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12, marginBottom: 6 },
  detailOwnerName:   { fontSize: 14, fontWeight: '600', color: '#333' },
  detailOwnerTime:   { fontSize: 12, color: '#aaa' },
  ownerActions:      { marginTop: 16, gap: 10 },
  ownerEditBtn:      { backgroundColor: '#F5F5F5', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  ownerEditBtnText:  { fontSize: 14, fontWeight: '600', color: '#333' },
  ownerToggleBtn:    { backgroundColor: '#F5F5F5', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  ownerToggleBtnText:{ fontSize: 14, fontWeight: '600', color: '#333' },
  ownerDeleteBtn:    { backgroundColor: '#FFF0F0', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  ownerDeleteBtnText:{ fontSize: 14, fontWeight: '600', color: '#D32F2F' },

  // ── Form sheet
  formSheet:         { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  formSheetHandle:   { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  formSheetHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  formSheetTitle:    { fontSize: 18, fontWeight: '800', color: '#111' },
  formSheetSub:      { fontSize: 13, color: '#888', marginTop: 2 },
  formSheetClose:    { fontSize: 20, color: '#888', padding: 4, marginTop: -4 },
  formScroll:        { paddingHorizontal: 20, paddingTop: 4 },
  formLabel:         { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 16 },
  formInput:         { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111' },
  formTextArea:      { height: 80, paddingTop: 10 },
  formSelect:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13 },
  formSelectText:    { flex: 1, fontSize: 15, color: '#111' },
  formSelectArrow:   { color: '#888', fontSize: 12 },
  toggleRow:         { flexDirection: 'row', gap: 10 },
  toggleBtn:         { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center', backgroundColor: '#F5F5F5' },
  toggleBtnActive:   { backgroundColor: '#E8F5E9' },
  toggleBtnPassive:  { backgroundColor: '#FFF3E0' },
  toggleBtnText:     { fontSize: 14, fontWeight: '600', color: '#aaa' },
  toggleBtnTextActive:  { color: '#2E7D32' },
  toggleBtnTextPassive: { color: '#E65100' },
  formSaveBtn:       { margin: 16, backgroundColor: '#FFD500', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  formSaveBtnText:   { fontSize: 16, fontWeight: '800', color: '#000' },
});
