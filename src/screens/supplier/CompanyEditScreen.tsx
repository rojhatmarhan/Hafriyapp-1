import React, { useEffect, useState } from 'react';
import { UPLOADS_HOST } from '../../services/api';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '../../hooks';
import { getCompanyById, updateCompanyDetails } from '../../services/userService';
import { launchImageLibrary } from 'react-native-image-picker';

const CompanyEditScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { companyId } = route.params || {};

  const token = useAppSelector(state => state.auth.token);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxNumber, setTaxNumber] = useState('');

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    if (companyId && token) {
      fetchCompany();
    } else {
      Alert.alert('Hata', 'Firma bilgisi bulunamadı.');
      navigation.goBack();
    }
  }, [companyId, token]);

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const res = await getCompanyById(companyId, token!);
      const data = res?.isSuccess ? res.data : (res?.data || res);

      if (data) {
        setName(data.name || '');
        setPhone(data.phoneNumber || '');
        setAddress(data.address || '');
        setTaxNumber(data.taxNumber || '');

        if (data.logoPath) {
          const fullLogoPath = data.logoPath.startsWith('/')
            ? `${UPLOADS_HOST}/api${data.logoPath}`
            : data.logoPath;
          setPhotoUri(fullLogoPath);
        }
      }
    } catch (e) {
      Alert.alert('Hata', 'Firma bilgileri alınamadı.');
      console.log('Fetch company error', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      quality: 0.5,
      selectionLimit: 1,
    });

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      // Simple format/size validation simulation if needed
      if (asset.fileSize && asset.fileSize > 1024 * 500) {
        Alert.alert('Uyarı', 'Dosya boyutu çok büyük. Maksimum 500KB olmalıdır.');
        // For development we might still let it pass, but let's encourage small size
      }

      if (asset.base64) {
        setPhotoBase64(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
        setRemoveLogo(false);
      }
      if (asset.uri) setPhotoUri(asset.uri);
    }
  };

  const handleRemoveLogo = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setRemoveLogo(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Uyarı', 'Firma Adı zorunludur.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name,
        phoneNumber: phone,
        address,
        taxNumber,
        logoPath: removeLogo ? "" : (photoBase64 || undefined), // "" signals backend to delete
      };

      const res = await updateCompanyDetails(companyId, payload, token!);

      if (res?.isSuccess || res) {
        Alert.alert('Başarılı', 'Firma bilgileriniz güncellendi.');
        // Instead of goBack, properly navigate back to profile to trigger refreshes
        navigation.navigate('Profile');
      }
    } catch (e: any) {
      Alert.alert('Hata', e?.response?.data?.errorMessage || 'Firma güncellenirken bir sorun oluştu.');
      console.log('Update company error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={{ marginTop: 12, color: '#666' }}>Bilgiler Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>✏️ Firma Düzenle</Text>
        <Text style={styles.topBarSubtitle}>Firma bilgilerini güncelleyin</Text>

        <View style={{ marginTop: 10 }}>
          <TouchableOpacity style={styles.btnActionOutline} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.btnActionOutlineText}>← Geri</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardTitleInfo}>🏢 Firma Bilgileri</Text>
          </View>

          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.squareIconBlock}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.squareAvatar} />
              ) : (
                <Text style={{ fontSize: 50, color: '#AAA' }}>🏢</Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <TouchableOpacity style={styles.btnLogoUpload} onPress={handlePickImage}>
                <Text style={styles.btnLogoUploadText}>↑ Logo Seç</Text>
              </TouchableOpacity>
              
              {photoUri && (
                <TouchableOpacity style={styles.btnLogoRemove} onPress={handleRemoveLogo}>
                  <Text style={styles.btnLogoRemoveText}>✕ Kaldır</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.logoHint}>Maksimum 500KB, PNG/JPG formatında</Text>
          </View>

          <View style={styles.formSeparator} />

          {/* Inputs */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Firma Adı <Text style={styles.requiredStar}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Firma adını giriniz..."
              placeholderTextColor="#AAA"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefon Numarası</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="05XX XXX XXXX"
              placeholderTextColor="#AAA"
              keyboardType="phone-pad"
            />
            <Text style={styles.inputHint}>Format: 05XX XXX XXXX</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adres</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Firma adresi"
              placeholderTextColor="#AAA"
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vergi Numarası</Text>
            <TextInput
              style={styles.input}
              value={taxNumber}
              onChangeText={setTaxNumber}
              placeholder="VKN"
              placeholderTextColor="#AAA"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.btnSave, submitting && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnSaveText}>✓ Kaydet</Text>
            )}
          </TouchableOpacity>

        </View>

      </ScrollView>
    </View>
  );
};

export default CompanyEditScreen;

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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  topBarTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#333',
  },
  topBarSubtitle: {
    fontSize: 15,
    color: '#777',
    marginTop: 4,
    marginBottom: 8,
  },
  btnActionOutline: {
    borderWidth: 1,
    borderColor: '#CCC',
    backgroundColor: '#FAF9F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  btnActionOutlineText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  cardHeaderInfo: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 15,
  },
  cardTitleInfo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  logoSection: {
    alignItems: 'center',
    marginVertical: 25,
  },
  squareIconBlock: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  squareAvatar: {
    width: 120,
    height: 120,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  btnLogoUpload: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  btnLogoUploadText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  btnLogoRemove: {
    borderWidth: 1,
    borderColor: '#E11D48',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
  },
  btnLogoRemoveText: {
    color: '#E11D48',
    fontSize: 14,
    fontWeight: '600',
  },
  logoHint: {
    fontSize: 13,
    color: '#999',
  },
  formSeparator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  requiredStar: {
    color: '#E11D48',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FFF',
    color: '#333',
  },
  textArea: {
    minHeight: 100,
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  btnSave: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSaveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
