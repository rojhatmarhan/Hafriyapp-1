import React, { useEffect, useState } from 'react';
import { UPLOADS_HOST } from '../../services/api';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '../../hooks';
import { getCompanyById, addAuthorizedUser, removeAuthorizedUser } from '../../services/userService';

const CompanyDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { companyId } = route.params || {};

  const token = useAppSelector(state => state.auth.token);

  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authSurname, setAuthSurname] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (companyId && token) {
      fetchCompany();
    } else {
      Alert.alert('Hata', 'Firma ID bulunamadı.');
      navigation.goBack();
    }
  }, [companyId, token]);

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const res = await getCompanyById(companyId, token!);
      console.log('\n--- 🏢 COMPANY DETAY KULLANICI LISTESI (LOG START) ---');
      console.log('Gelen Tümü:', JSON.stringify(res, null, 2));
      console.log('-----------------------------------------------------\n');

      if (res?.isSuccess) {
        setCompany(res.data);
      } else {
        setCompany(res?.data || res); // Fallback to raw response if not structured as isSuccess
      }
    } catch (e) {
      Alert.alert('Hata', 'Firma detayları alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+90')) return cleaned;
    if (cleaned.startsWith('90')) return '+' + cleaned;
    if (cleaned.startsWith('0')) return '+9' + cleaned;
    return '+90' + cleaned;
  };

  const handleAddUser = async () => {
    if (!authPhone) {
      Alert.alert('Uyarı', 'Telefon numarası zorunludur.');
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        phoneNumber: normalizePhone(authPhone),
        firstName: authName,
        lastName: authSurname,
      };

      const res = await addAuthorizedUser(companyId, payload, token!);
      // Even if our code throws or handles differently, let's treat it as generic try/catch logic
      if (res) {
        Alert.alert('Başarılı', 'Yetkili başarıyla eklendi.');
        setModalVisible(false);
        setAuthName('');
        setAuthSurname('');
        setAuthPhone('');
        fetchCompany(); // Refresh list
      }
    } catch (e: any) {
      console.log('E', e);
      Alert.alert('Hata', e?.response?.data?.errorMessage || 'Yetkili eklenemedi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveUser = (userId: string, userName: string) => {
    Alert.alert(
      'Yetkiliyi Sil',
      `${userName} isimli kullanıcıyı firmadan çıkartmak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkart', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const res = await removeAuthorizedUser(companyId, userId, token!);
              if (res) {
                Alert.alert('Başarılı', 'Kullanıcı başarıyla firmadan çıkartıldı.');
                fetchCompany();
              }
            } catch (e: any) {
              Alert.alert('Hata', e?.response?.data?.errorMessage || 'Kullanıcı çıkartılamadı.');
              setLoading(false);
            }
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F7A028" />
        <Text style={{ marginTop: 10, color: '#666' }}>Detaylar Yükleniyor...</Text>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.center}>
        <Text>Firma detayı bulunamadı.</Text>
        <TouchableOpacity style={styles.btnActionOutline} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.btnActionOutlineText}>← Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, marginRight: 8, color: '#F7A028' }}>🏢</Text>
          <Text style={styles.topBarTitle}>{company?.name || 'Belirtilmemiş'}</Text>
          <View style={styles.topBarBadge}>
            <Text style={styles.topBarBadgeText}>Sahip</Text>
          </View>
        </View>
        <Text style={styles.topBarSubtitle}>Firma detayları ve kullanıcı yönetimi</Text>

        <View style={styles.topButtonsContainer}>
          <TouchableOpacity style={styles.btnActionOutline} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.btnActionOutlineText}>← Geri</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnActionFilled}>
            <Text style={styles.btnActionFilledText}>✎ Düzenle</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Firma Bilgileri Kartı */}
        <View style={styles.card}>
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardTitleInfo}>ℹ️ Firma Bilgileri</Text>
          </View>

          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <View style={styles.squareIconBlock}>
              {company?.logoPath ? (
                 <Image 
                   source={{ uri: (company?.logoPath.startsWith('/') ? `${UPLOADS_HOST}${company.logoPath}` : company.logoPath) + `?t=${new Date().getTime()}` }} 
                   style={styles.squareAvatar} 
                 />
              ) : (
                 <Text style={{ fontSize: 50, color: 'white' }}>🏢</Text>
              )}
            </View>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Firma Adı</Text>
            <Text style={styles.tableValueBold}>{company?.name}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Telefon</Text>
            <Text style={styles.tableValue}>{company?.phoneNumber || '-'}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Adres</Text>
            <Text style={styles.tableValue}>{company?.address || '-'}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Vergi Numarası</Text>
            <Text style={styles.tableValue}>{company?.taxNumber || '-'}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Kayıt Tarihi</Text>
            <Text style={styles.tableValue}>{company?.createdDate ? new Date(company.createdDate).toLocaleDateString('tr-TR') : '-'}</Text>
          </View>
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.tableLabel}>Durum</Text>
            <View style={styles.statusBadgeGreen}>
              <Text style={styles.statusBadgeGreenText}>{company?.isActive !== false ? 'Aktif' : 'Pasif'}</Text>
            </View>
          </View>
        </View>

        {/* Kullanıcılar Kartı */}
        <View style={styles.card}>
          <View style={styles.cardHeaderUsers}>
            <Text style={styles.cardTitleInfo}>👥 Kullanıcılar ({company?.users?.length || 1})</Text>
            <TouchableOpacity style={styles.btnActionFilled} onPress={() => setModalVisible(true)}>
              <Text style={styles.btnActionFilledText}>+ Firma Yetkili Atama</Text>
            </TouchableOpacity>
          </View>

          {/* Table Wrapped in Horizontal ScrollView */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 10 }}>
            <View>
              {/* Table Header */}
              <View style={styles.tableHead}>
                <Text style={[styles.tableHeadText, { width: 140 }]}>KULLANICI</Text>
                <Text style={[styles.tableHeadText, { width: 130 }]}>TELEFON</Text>
                <Text style={[styles.tableHeadText, { width: 100 }]}>ROL</Text>
                <Text style={[styles.tableHeadText, { width: 90, textAlign: 'right' }]}>İŞLEMLER</Text>
              </View>

              {/* Table Rows */}
              {company?.users && company.users.length > 0 ? (
                company.users.map((u: any, index: number) => (
                  <View key={u.id || index} style={styles.tableDataRow}>
                    <Text style={[styles.tableDataBold, { width: 140 }]} numberOfLines={1}>{u.userName || '-'}</Text>
                    <Text style={[styles.tableDataText, { width: 130 }]} numberOfLines={1}>{u.userPhone || '-'}</Text>
                    <View style={{ width: 100, alignItems: 'flex-start' }}>
                      <View style={u.roleDisplayName === 'Sahip' ? styles.roleBadgeOrange : styles.roleBadgeGreen}>
                        <Text style={u.roleDisplayName === 'Sahip' ? styles.roleBadgeOrangeText : styles.roleBadgeGreenText}>
                          {u.roleDisplayName || 'Tanımsız'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ width: 90, alignItems: 'flex-end' }}>
                      {u.roleDisplayName === 'Sahip' ? (
                        <Text style={styles.tableDataSub}>Sahip</Text>
                      ) : (
                        <TouchableOpacity style={styles.btnRemoveOutline} onPress={() => handleRemoveUser(u.userId, u.userName || 'Kullanıcı')}>
                          <Text style={styles.btnRemoveOutlineText}>Çıkart</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.tableDataRow}>
                  <Text style={[styles.tableDataBold, { width: 140 }]} numberOfLines={1}>{company?.name}</Text>
                  <Text style={[styles.tableDataText, { width: 130 }]} numberOfLines={1}>{company?.phoneNumber || '-'}</Text>
                  <View style={{ width: 100, alignItems: 'flex-start' }}>
                    <View style={styles.roleBadgeOrange}>
                      <Text style={styles.roleBadgeOrangeText}>Sahip</Text>
                    </View>
                  </View>
                  <Text style={[styles.tableDataSub, { width: 90, textAlign: 'right' }]}>Sahip</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

      </ScrollView>

      {/* Yetkili Ekleme Modalı */}
      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👤+ Firma Yetkili Atama</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ fontSize: 24, color: '#666' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalInfoBox}>
              <Text style={styles.modalInfoTitle}>ℹ️ Bilgi:</Text>
              <Text style={styles.modalInfoText}>
                Yetkili atamak için girdiğiniz telefon numarasının sistemde <Text style={{ fontWeight: '700' }}>kayıtlı olmaması</Text> gerekmektedir. Atanan yetkili, sizinle aynı yetkilere sahip olacaktır (firma silme hariç).
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Ad</Text>
              <TextInput style={styles.input} value={authName} onChangeText={setAuthName} placeholder="Adı" />

              <Text style={styles.inputLabel}>Soyad</Text>
              <TextInput style={styles.input} value={authSurname} onChangeText={setAuthSurname} placeholder="Soyadı" />

              <Text style={styles.inputLabel}>Telefon Numarası <Text style={{ color: 'red' }}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={authPhone}
                onChangeText={setAuthPhone}
                placeholder="05__ ___ __ __"
                keyboardType="phone-pad"
              />
              <Text style={styles.inputHelperText}>
                Bu telefon numarasıyla yeni bir hesap oluşturulacak ve firmaya yetkili olarak atanacaktır.
              </Text>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity style={styles.btnModalCancel} onPress={() => setModalVisible(false)}>
                  <Text style={styles.btnModalCancelText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnModalSave} onPress={handleAddUser} disabled={actionLoading}>
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnModalSaveText}>👤+ Yetkili Ata</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

export default CompanyDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  topBar: {
    backgroundColor: '#FAF9F6',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
  },
  topBarBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 12,
  },
  topBarBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topBarSubtitle: {
    fontSize: 14,
    color: '#777',
    marginTop: 6,
    marginBottom: 16,
  },
  topButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  btnActionOutline: {
    borderWidth: 1,
    borderColor: '#CCC',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnActionOutlineText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '600',
  },
  btnActionFilled: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnActionFilledText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnRemoveOutline: {
    borderWidth: 1,
    borderColor: '#E11D48', // Red
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FFF1F2',
  },
  btnRemoveOutlineText: {
    color: '#E11D48',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 3,
  },
  cardHeaderInfo: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 15,
  },
  cardHeaderUsers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleInfo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  squareIconBlock: {
    width: 110,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#4B5563',
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareAvatar: {
    width: 110,
    height: 110,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    alignItems: 'center',
  },
  tableLabel: {
    fontSize: 14,
    color: '#888',
  },
  tableValue: {
    fontSize: 14,
    color: '#444',
  },
  tableValueBold: {
    fontSize: 14,
    color: '#000',
    fontWeight: '700',
  },
  statusBadgeGreen: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeGreenText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#444',
    paddingBottom: 8,
    marginBottom: 10,
  },
  tableHeadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tableDataText: {
    fontSize: 13,
    color: '#444',
  },
  tableDataBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  tableDataSub: {
    fontSize: 13,
    color: '#999',
  },
  roleBadgeOrange: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeOrangeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  roleBadgeGreen: {
    backgroundColor: '#22c55e', // Green
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeGreenText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalInfoBox: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  modalInfoTitle: {
    color: '#1D4ED8',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 15,
  },
  modalInfoText: {
    color: '#1E3A8A',
    fontSize: 14,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FFF',
  },
  inputHelperText: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  btnModalCancel: {
    backgroundColor: '#777',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  btnModalCancelText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnModalSave: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1.5,
    alignItems: 'center',
  },
  btnModalSaveText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
