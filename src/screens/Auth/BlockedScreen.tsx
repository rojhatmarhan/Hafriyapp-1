import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, StatusBar, Linking, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { clearAuth } from '../../utils/secureStore';

export default function BlockedScreen() {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.auth.user);

  const handleLogout = async () => {
    try {
      await clearAuth();
      dispatch(logout());
    } catch (e) {
      console.error('Logout error on BlockedScreen', e);
    }
  };

  const handleGetSupport = async () => {
    const adminPhone = '+905383573913';
    const messageTemplate = `Merhaba, hesabım kısıtlandı. Destek almak istiyorum. (Kullanıcı: ${user?.firstName} ${user?.lastName || ''}, Tel: ${user?.phoneNumber || ''})`;
    const appUrl = `whatsapp://send?phone=${adminPhone}&text=${encodeURIComponent(messageTemplate)}`;
    const webUrl = `https://wa.me/${adminPhone.replace(/[+\s]/g, '')}?text=${encodeURIComponent(messageTemplate)}`;
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F2F3" />
      <View style={styles.content}>
        
        {/* Header Warning Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <Text style={styles.warningSymbol}>⚠️</Text>
          </View>
        </View>

        <Text style={styles.title}>Erişiminiz Kısıtlandı</Text>
        <Text style={styles.description}>
          Hesabınız veya üyesi olduğunuz firma yönetici tarafından kısıtlanmıştır. 
          Sistem işlemlerine devam edebilmek için lütfen destek ekibiyle iletişime geçin.
        </Text>

        {/* Restriction Note Card */}
        {user?.accessRestrictionNote ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteHeader}>Yönetici Açıklaması:</Text>
            <Text style={styles.noteText}>{user.accessRestrictionNote}</Text>
          </View>
        ) : (
          <View style={styles.noteCard}>
            <Text style={styles.noteHeader}>Yönetici Açıklaması:</Text>
            <Text style={styles.noteText}>Yetkili tarafından kısıtlandınız. Lütfen yetkili ile iletişime geçin.</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {/* WhatsApp Support Button */}
          <TouchableOpacity style={styles.supportButton} onPress={handleGetSupport} activeOpacity={0.8}>
            <Text style={styles.supportButtonText}>💬 Destek Al</Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F2F3',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 24,
    shadowColor: '#E63946',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  iconBackground: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFE3E5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E63946',
  },
  warningSymbol: {
    fontSize: 42,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1D1B20',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#605C64',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 28,
  },
  noteCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#E63946',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  noteHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A858F',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  noteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2B282F',
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  supportButton: {
    backgroundColor: '#25D366',
    width: '100%',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  supportButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#1D1B20',
    width: '100%',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
