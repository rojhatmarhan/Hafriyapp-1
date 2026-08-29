import React, { useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Platform, ActionSheetIOS, Alert, Modal, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const IMAGE_BASE = 'https://api.hafriyapp.com';
const buildLogoUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
};
import { CITIES } from '../../constants/cities';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { setSelectedCity } from '../../store/slices/uiSlice';
import CityPickerModal from '../../components/CityPickerModal';
import { useActiveUserCount } from '../../hooks/useActiveUserCount';
import { launchImageLibrary } from 'react-native-image-picker';
import { getChatGroups, createChatGroup, uploadGroupImage } from '../../services/chatService';
import { getProfile } from '../../services/userService';
import { clearAuth } from '../../utils/secureStore';
import { logout, setUser } from '../../store/slices/authSlice';

export default function SupplierHome() {
  const navigation = useNavigation<any>();
  const activeUsers = useActiveUserCount();
  const [searchText, setSearchText] = useState('');
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
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
  const [citySearch, setCitySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupImage, setNewGroupImage] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('pinned_chat_groups').then(val => {
      if (val) setPinnedIds(JSON.parse(val));
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      AsyncStorage.setItem('pinned_chat_groups', JSON.stringify(next));
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const showLoader = chatGroups.length === 0;
      fetchGroups(showLoader);

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
    }, [selectedCity, chatGroups.length, token, dispatch])
  );

  const fetchGroups = async (showLoader: boolean = true) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      const res = await getChatGroups(token, selectedCity ?? undefined);
      if (res && res.data && res.data.groups) {
        setChatGroups(res.data.groups);
      }
    } catch (error) {
      console.log('Error fetching groups', error);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

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

  const toggleProvince = (code: number) => {
    if (selectedProvinces.includes(code)) {
      setSelectedProvinces(prev => prev.filter(c => c !== code));
    } else {
      setSelectedProvinces(prev => [...prev, code]);
    }
  };

  // 🔍 WHATSAPP STYLE SORTING & FILTERING
  const sortedAndFilteredGroups = useMemo(() => {
    let filtered = chatGroups;
    const q = searchText.trim().toLowerCase();

    if (q) {
      filtered = chatGroups.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.lastMessagePreview && item.lastMessagePreview.toLowerCase().includes(q))
      );
    }

    return [...filtered].sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Hem sabitlenenler hem sabitlenmeyenler en son mesaja göre sıralanır
      const aTime = new Date(a.lastMessageAt || a.createdDate || 0).getTime();
      const bTime = new Date(b.lastMessageAt || b.createdDate || 0).getTime();
      return bTime - aTime;
    });
  }, [searchText, chatGroups, pinnedIds]);

  const filteredCitiesForSelect = useMemo(() => {
    if (!citySearch.trim()) return CITIES;
    return CITIES.filter(c => c.label.toLowerCase().includes(citySearch.toLowerCase()));
  }, [citySearch]);

  const renderItem = ({ item }: { item: any }) => {
    const previewText = item.isMember
      ? (item.lastMessageSenderName ? `${item.lastMessageSenderName}: ` : '') + (item.lastMessagePreview || 'Henüz mesaj yok')
      : (item.description || item.lastMessagePreview || 'Henüz mesaj yok');

    const isPinned = pinnedIds.includes(item.id);

    return (
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('CompanyChat', { group: item })} activeOpacity={0.7}>
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
          <Text style={styles.time}>
            {item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleDateString("tr-TR", { day: '2-digit', month: '2-digit' }) : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.pinBtn, isPinned && styles.pinBtnActive]}
          onPress={() => togglePin(item.id)}
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

            {/* 📌 Seçili İller (En Üstte) */}
            {selectedProvinces.length > 0 && (
              <View style={styles.selectedProvincesContainer}>
                <View style={styles.selectedProvincesHeader}>
                  <Text style={styles.selectedProvincesTitle}>Seçili İller ({selectedProvinces.length})</Text>
                  <TouchableOpacity onPress={() => setSelectedProvinces([])}>
                    <Text style={styles.clearText}>Temizle</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.cityList}>
                  {selectedProvinces.map(code => {
                    const city = CITIES.find(c => c.value === code);
                    if (!city) return null;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[styles.cityChip, styles.cityChipSelected]}
                        onPress={() => toggleProvince(code)}
                      >
                        <Text style={[styles.cityChipText, styles.cityChipTextSelected]}>
                          {city.label} ✕
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 🔽 Dropdown Toggle */}
            <TouchableOpacity
              style={styles.dropdownToggle}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownToggleText}>
                {isDropdownOpen ? 'İl Seçimini Gizle' : 'İl Ekle / Seç'}
              </Text>
              <Image
                source={require('../../../assets/icons/down-arrow.png')}
                style={{ width: 14, height: 14, opacity: 0.6, transform: [{ rotate: isDropdownOpen ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {/* 📋 Dropdown İçeriği */}
            {isDropdownOpen && (
              <View style={styles.dropdownContent}>
                <TextInput
                  style={styles.input}
                  placeholder="İlleri arayın..."
                  value={citySearch}
                  onChangeText={setCitySearch}
                />
                <Text style={styles.helperText}>Arama yaparak istediğiniz ili seçebilirsiniz.</Text>

                <View style={styles.cityList}>
                  {filteredCitiesForSelect.slice(0, 50).map(city => {
                    const isSelected = selectedProvinces.includes(city.value);
                    if (isSelected) return null; // Seçili olanları gizle, üstte görünüyorlar zaten
                    return (
                      <TouchableOpacity
                        key={city.value}
                        style={styles.cityChip}
                        onPress={() => toggleProvince(city.value)}
                      >
                        <Text style={styles.cityChipText}>{city.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

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
    marginLeft: 8,
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
  helperText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginBottom: 10,
  },
  cityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    paddingBottom: 20,
  },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cityChipSelected: {
    backgroundColor: '#FFD500',
    borderColor: '#FFD500',
  },
  cityChipText: {
    fontSize: 13,
    color: '#333',
  },
  cityChipTextSelected: {
    fontWeight: '600',
    color: '#000',
  },
  selectedProvincesContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedProvincesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedProvincesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  clearText: {
    fontSize: 13,
    color: '#d32f2f',
    fontWeight: '600',
  },
  dropdownToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
  },
  dropdownToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dropdownContent: {
    backgroundColor: '#fafafa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 16,
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

