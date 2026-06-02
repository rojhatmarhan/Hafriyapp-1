import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal, TextInput, Linking, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { clearAuth } from '../utils/secureStore';
import { DrawerItem } from '@react-navigation/drawer';
import { useAppSelector } from '../hooks';

const YELLOW = '#FFD500';

export default function CustomDrawerContent(props: any) {
  const dispatch = useDispatch();
  const { state, navigation } = props;

  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const user = useAppSelector(state => state.auth.user);

  const handleLogout = async () => {
    await clearAuth();
    dispatch(logout());
  };

  const handleSendFeedback = async () => {
    const text = feedbackText.trim();
    if (!text) {
      Alert.alert('Uyarı', 'Lütfen öneri veya şikayetinizi yazın.');
      return;
    }

    const adminPhone = '+905322959413';
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Bilinmeyen Kullanıcı';
    const userPhone = user?.phoneNumber || 'Belirtilmemiş';

    const messageTemplate = `Merhaba, Hafriyapp uygulamasından öneri/şikayet göndermek istiyorum:\n\n` +
      `Gönderen: ${userName}\n` +
      `Telefon: ${userPhone}\n\n` +
      `Öneri/Şikayet:\n${text}`;

    const appUrl = `whatsapp://send?phone=${adminPhone}&text=${encodeURIComponent(messageTemplate)}`;
    const webUrl = `https://wa.me/${adminPhone.replace(/[+\s]/g, '')}?text=${encodeURIComponent(messageTemplate)}`;

    setFeedbackModalVisible(false);
    setFeedbackText('');

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
  };

  const isActive = (routeName: string) => state.routeNames[state.index] === routeName;

  return (
    <View style={{ flex: 1 }}>
      {/* 🟡 HEADER */}
      <View style={styles.header}>
        <Image source={require('../../assets/logoNew.png')} style={styles.logo} />
        <View style={{ marginLeft: '-2%' }}>
          <Text style={styles.title}>HAFRİYAPP</Text>
          <Text style={styles.subtitle}>HAFRİYAT VE YIKINTI ATIĞI TAŞIMA UYGULAMASI</Text>
        </View>
      </View>

      {/* 📜 MENU */}
      <View style={{ paddingTop: 16 }}>
        <DrawerItem label="ANASAYFA" focused={isActive('HomeTabs')} onPress={() => navigation.navigate('HomeTabs')} style={[styles.item, isActive('HomeTabs') && styles.activeItem]} labelStyle={[styles.label, isActive('HomeTabs') && styles.activeLabel]} />

        <DrawerItem label="PROFİLİM" focused={isActive('Profile')} onPress={() => navigation.navigate('Profile')} style={[styles.item, isActive('Profile') && styles.activeItem]} labelStyle={[styles.label, isActive('Profile') && styles.activeLabel]} />

        <DrawerItem label="İLANLARIM" focused={isActive('MyAds')} onPress={() => navigation.navigate('MyAds')} style={[styles.item, isActive('MyAds') && styles.activeItem]} labelStyle={[styles.label, isActive('MyAds') && styles.activeLabel]} />

        <DrawerItem label="ÖNERİ VE ŞİKAYET" focused={feedbackModalVisible} onPress={() => { navigation.closeDrawer(); setFeedbackModalVisible(true); }} style={styles.item} labelStyle={styles.label} />
      </View>

      {/* 🚪 ÇIKIŞ */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      {/* ÖNERİ VE ŞİKAYET MODALI */}
      <Modal
        visible={feedbackModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <Pressable 
              style={StyleSheet.absoluteFillObject} 
              onPress={() => setFeedbackModalVisible(false)} 
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Öneri ve Şikayet</Text>
              <Text style={styles.modalSubtitle}>
                Görüş, öneri veya şikayetinizi aşağıdaki alana yazabilirsiniz. Mesajınız WhatsApp üzerinden yetkililere iletilecektir.
              </Text>
              
              <TextInput
                style={styles.feedbackInput}
                placeholder="Buraya yazın..."
                placeholderTextColor="#999"
                value={feedbackText}
                onChangeText={setFeedbackText}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.cancelBtn]} 
                  onPress={() => setFeedbackModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.submitBtn]} 
                  onPress={handleSendFeedback}
                >
                  <Text style={styles.submitBtnText}>Gönder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFD500',
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 70,
    height: 70,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  subtitle: {
    fontSize: 10,
    color: '#333',
  },

  item: {
    borderRadius: 1,
    // marginHorizontal: 12,
    marginVertical: 6,
  },
  activeItem: {
    backgroundColor: '#FFD500', // 🔥 FULL SARI
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  activeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },

  logoutBtn: {
    margin: 16,
    marginTop: 'auto',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFD500',
    alignItems: 'center',
    marginBottom: '15%',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.36,
    shadowRadius: 2.68,
    elevation: 8,
  },
  logoutText: {
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  feedbackInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    height: 120,
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#eee',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  submitBtn: {
    backgroundColor: '#FFD500',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});
