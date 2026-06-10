import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useAppDispatch, useAppSelector } from '../hooks';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView } from 'react-native-gesture-handler';
import { launchImageLibrary } from 'react-native-image-picker';
import { updateUserProfile, deactivateAccount, deleteAccount, getMyCompanies, getCompanyById } from '../services/userService';
import { logout, setUser } from '../store/slices/authSlice';

const ProfileScreen = () => {
  const user = useAppSelector(state => state.auth.user);
  const token = useAppSelector(state => state.auth.token);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();

  // 📝 LOG: Redux'taki mevcut kullanıcı objesini konsola basıyoruz
  console.log('\n--- PROFILE SCREEN DATA (REDUX) ---');
  console.log('User Object:', JSON.stringify(user, null, 2));
  console.log('Token Exists:', !!token);

  if (!user || !token) {
    return (
      <View style={styles.center}>
        <Text>Kullanıcı bilgileri yükleniyor...</Text>
      </View>
    );
  }

  const isDriver = user.userType === 0;

  /* ---------------- STATES ---------------- */
  const firstName = user.firstName;
  const lastName = user.lastName;
  const phoneNumber = user.phoneNumber;
  const companyName = user.companyName;

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyTaxNumber, setCompanyTaxNumber] = useState('');
  const [companyLogoUri, setCompanyLogoUri] = useState<string | null>(null);
  const [companyUserRole, setCompanyUserRole] = useState<number>(0); // 0=Owner, 1=Yetkili(Admin)

  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');

  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [authChanged, setAuthChanged] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<{ id: string; name: string }[]>([]);

  const fetchBlockedUsers = async () => {
    try {
      const val = await AsyncStorage.getItem('blocked_users');
      if (val) {
        setBlockedUsers(JSON.parse(val));
      } else {
        setBlockedUsers([]);
      }
    } catch {}
  };

  const handleUnblockUser = (userId: string, name: string) => {
    Alert.alert(
      'Engeli Kaldır',
      `"${name}" kullanıcısının engelini kaldırmak istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Kaldır',
          onPress: async () => {
            try {
              const updated = blockedUsers.filter(u => u.id !== userId);
              setBlockedUsers(updated);
              await AsyncStorage.setItem('blocked_users', JSON.stringify(updated));
              Alert.alert('Başarılı', 'Kullanıcının engeli kaldırıldı.');
            } catch {
              Alert.alert('Hata', 'Engeli kaldırırken bir sorun oluştu.');
            }
          },
        },
      ],
    );
  };

  /* ---------------- FETCH DATA ---------------- */
  const fetchCompanyData = async () => {
    if (!isDriver && token) {
      try {
        const res = await getMyCompanies(token);
        const companyData = res?.data;

        if (companyData) {
          const myCompany = Array.isArray(companyData)
            ? (companyData.find((c: any) => c.isOwner) || companyData[0])
            : companyData;

          if (myCompany && myCompany.id) {
            setCompanyId(myCompany.id);
            setCompanyUserRole(myCompany.userRole ?? 0);

            // Fetch detail to get Logo, Address, TaxNumber
            const detailRes = await getCompanyById(myCompany.id, token);
            const detailData = detailRes?.isSuccess ? detailRes.data : (detailRes?.data || detailRes);

            if (detailData) {
              console.log('\n--- 🏢 COMPANY DETAIL DATA (LOGO DEBUG) ---');
              console.log('logoPath:', detailData.logoPath);
              console.log('address:', detailData.address);
              console.log('taxNumber:', detailData.taxNumber);
              console.log('Tüm detailData:', JSON.stringify(detailData, null, 2));
              console.log('-------------------------------------------\n');

              setCompanyPhone(detailData.phoneNumber || '');
              setCompanyAddress(detailData.address || '');
              setCompanyTaxNumber(detailData.taxNumber || '');

              if (detailData.logoPath) {
                const fullLogoPath = detailData.logoPath.startsWith('/')
                  ? `https://api.hafriyapp.com${detailData.logoPath}?t=${new Date().getTime()}`
                  : `${detailData.logoPath}?t=${new Date().getTime()}`;
                setCompanyLogoUri(fullLogoPath);
              } else {
                setCompanyLogoUri(null);
              }
            }

            if (user.companyName !== myCompany.name) {
              dispatch(setUser({ ...user, companyName: myCompany.name }));
            }
          }
        }
      } catch (error) {
        console.log('Error fetching companies:', error);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCompanyData();
      fetchBlockedUsers();
    }, [token, isDriver])
  );

  /* ---------------- ACTIONS ---------------- */
  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.5,
    });
    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.base64) setPhotoBase64(asset.base64);
      if (asset.uri) setPhotoUri(asset.uri);
    }
  };

  const handleUpdateCompany = async () => {
    try {
      setLoading(true);
      const res = await updateUserProfile({
        companyName,
        profilePhotoBase64: photoBase64 || undefined
      }, token);
      if (res) {
        Alert.alert('Başarılı', 'Firma bilgileriniz güncellendi.');
        dispatch(setUser({
          ...user,
          companyName: companyName || user.companyName
        }));

      }
    } catch (e) {
      Alert.alert('Hata', 'Firma güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = () => {
    Alert.alert('Hesabı Pasife Al', 'Hesabınız pasife alınacak. Emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Pasife Al', style: 'destructive', onPress: async () => {
          try {
            setActionLoading(true);
            await deactivateAccount(token);
            Alert.alert('Başarılı', 'Hesabınız pasife alındı.');
            dispatch(logout());
          } catch (e) {
            Alert.alert('Hata', 'İşlem başarısız');
          } finally {
            setActionLoading(false);
          }
        }
      }
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Hesabı Kalıcı Olarak Sil', 'Tüm verileriniz silinecek ve bu işlem geri alınamaz!', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            setActionLoading(true);
            await deleteAccount(token);
            Alert.alert('Başarılı', 'Hesabınız başarıyla silindi.');
            dispatch(logout());
          } catch (e) {
            Alert.alert('Hata', 'İşlem başarısız');
          } finally {
            setActionLoading(false);
          }
        }
      }
    ]);
  };

  useEffect(() => {
    if (authName || authPhone) {
      setAuthChanged(true);
    } else {
      setAuthChanged(false);
    }
  }, [authName, authPhone]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* SAYFA BAŞLIĞI */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>👤 Hesap</Text>
        <Text style={styles.pageSubtitle}>Hesap bilgilerinizi görüntüleyin ve düzenleyin</Text>
      </View>

      {/* 👤 KULLANICI KARTI */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>👤 Profil Bilgileri</Text>
          <TouchableOpacity style={styles.btnOrange} onPress={() => navigation.navigate('ProfileEdit')}>
            <Text style={styles.btnOrangeText}>✎ Düzenle</Text>
          </TouchableOpacity>
        </View>

        <View>
          <View style={styles.iconContainer}>
            <View style={styles.circleAvatar}>
              <Text style={{ fontSize: 48, color: 'white' }}>👤</Text>
            </View>
            <Text style={styles.displayNameText}>
              {firstName || lastName ? `${firstName} ${lastName}` : 'İsim belirtilmemiş'}
            </Text>
            <View style={styles.badgeOrange}>
              <Text style={styles.badgeOrangeText}>{isDriver ? '🚚 Şoför' : '🏢 Firma/Araç Sahibi'}</Text>
            </View>
          </View>

          <InfoRow icon="📱" label="Telefon" value={user.phoneNumber} valueColor="#007BFF" />
          <InfoRow icon="👤" label="Ad Soyad" value={(firstName || lastName) ? `${firstName} ${lastName}` : '-'} />

          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '35%' }}>
              <Text style={styles.infoIcon}>☑️</Text>
              <Text style={styles.label}>Doğrulama</Text>
            </View>
            <View style={{ width: '65%', alignItems: 'flex-start' }}>
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>✅ Doğrulanmış</Text>
              </View>
            </View>
          </View>

          <InfoRow icon="📅" label="Kayıt" value={user.createdDate ? new Date(user.createdDate).toLocaleDateString('tr-TR') : '-'} />
        </View>
      </View>

      {/* 🏢 FİRMA KARTI (SADECE SUPPLIER İÇİN) */}
      {!isDriver && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🏢 Firma Bilgileri</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.btnOrange} onPress={() => {
                if (companyId) {
                  navigation.navigate('CompanyDetails', { companyId });
                } else {
                  Alert.alert('Bilgi', 'Firma bilgisi henüz yüklenmedi.');
                }
              }}>
                <Text style={styles.btnOrangeText}>Detay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOrange} onPress={() => {
                if (companyId) {
                  navigation.navigate('CompanyEdit', { companyId });
                } else {
                  Alert.alert('Bilgi', 'Firma bilgisi henüz yüklenmedi.');
                }
              }}>
                <Text style={styles.btnOrangeText}>✎ Düzenle</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <View style={styles.iconContainer}>
              {companyLogoUri ? (
                <Image source={{ uri: companyLogoUri }} style={styles.squareAvatar} />
              ) : (
                <View style={styles.squareIconBlock}>
                  <Text style={{ fontSize: 40, color: 'white' }}>🏢</Text>
                </View>
              )}
              <Text style={styles.displayNameText}>{companyName || 'Belirtilmemiş'}</Text>
            </View>

            <InfoRow icon="📱" label="Telefon" value={companyPhone || '-'} />
            <InfoRow icon="📍" label="Adres" value={companyAddress || '-'} />
            {/* <InfoRow icon="🔖" label="Vergi No" value={companyTaxNumber || '-'} /> */}
          </View>
        </View>
      )}

      {/* 🛡️ ENGELLENEN KULLANICILAR KARTI */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🛡️ Engellenen Kullanıcılar</Text>
        </View>

        <View>
          {blockedUsers.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', paddingVertical: 10 }}>
              Engellenmiş kullanıcı bulunmuyor.
            </Text>
          ) : (
            blockedUsers.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '500', flex: 1, marginRight: 10 }} numberOfLines={1}>
                  👤 {item.name}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#FFF0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#FFCDCD' }}
                  onPress={() => handleUnblockUser(item.id, item.name)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#D32F2F' }}>Engeli Kaldır</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      {/* 🛑 TEHLİKELİ BÖLGE — Yetkili (role=1) kullanıcılara gösterilmez */}
      {companyUserRole !== 1 && (
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.dangerTitle}>Hesabımı Sil</Text>
          {isDriver ? (
            <>
              <Text style={styles.dangerText}>Hesabınız pasife alınacak, şoför atamalarınız ve firma üyelikleriniz kaldırılacaktır.</Text>
              <TouchableOpacity style={styles.dangerButtonOutline} onPress={handleDeactivate}>
                {actionLoading ? <ActivityIndicator color="red" /> : <Text style={styles.dangerButtonOutlineText}>🗑️ Hesabımı Pasife Al</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.dangerText}>Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz.</Text>
              <TouchableOpacity style={styles.dangerButtonOutline} onPress={handleDelete}>
                {actionLoading ? <ActivityIndicator color="red" /> : <Text style={styles.dangerButtonOutlineText}>🗑️ Hesabımı Sil</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default ProfileScreen;

const InfoRow = ({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) => {
  return (
    <View style={styles.infoRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '35%' }}>
        <Text style={styles.infoIcon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={{ width: '65%' }}>
        <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
    </View>
  );
};
const EditableRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={label} />
    </View>
  );
};
const SaveButton = ({ visible, title, onPress, loading = false }: { visible: boolean; title: string; onPress: () => void; loading?: boolean }) => {
  if (!visible) return null;

  return (
    <TouchableOpacity style={styles.saveButton} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>{title}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Lighter yellowish-creamy background to match web
    paddingTop: 40,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 80,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageHeader: {
    width: '90%',
    marginBottom: 10,
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#333',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#888',
  },

  /* AVATAR */
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#DDD',
  },
  addPhotoButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD500',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  addPhotoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },

  /* NOTE */
  photoNote: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  /* CARD */
  card: {
    marginTop: 15,
    width: '90%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  btnOrange: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,

    elevation: 5,
  },
  btnOrangeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  circleAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  displayNameText: {
    fontSize: 20,
    color: '#555',
    marginBottom: 10,
  },
  badgeOrange: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeOrangeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  squareIconBlock: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#4B5563', // Dark Gray
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  squareAvatar: {
    width: 90,
    height: 90,
    borderRadius: 16,
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 6,
    color: '#888',
  },
  successBadge: {
    backgroundColor: '#22c55e', // Green
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 14,
  },
  successBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    color: '#666',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    fontSize: 16,
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: '#FFD500',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  dangerCard: {
    borderColor: 'transparent',
    borderWidth: 0,
    backgroundColor: '#FFF1F2', // Light Rose Red background
    marginTop: 20, // push it slightly further to act as the last sect
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E11D48',
    marginBottom: 8,
  },
  dangerText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
    lineHeight: 20,
  },
  dangerButtonOutline: {
    borderWidth: 1,
    borderColor: '#E11D48',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonOutlineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E11D48',
  },
});
