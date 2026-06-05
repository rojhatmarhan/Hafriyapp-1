import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking } from 'react-native';
import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { clearAuth } from '../utils/secureStore';
import { DrawerItem } from '@react-navigation/drawer';

const YELLOW = '#FFD500';

export default function CustomDrawerContent(props: any) {
  const dispatch = useDispatch();
  const { state, navigation } = props;

  const handleLogout = async () => {
    await clearAuth();
    dispatch(logout());
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
        <DrawerItem 
          label="ANASAYFA" 
          focused={isActive('HomeTabs')} 
          onPress={() => navigation.navigate('HomeTabs')} 
          style={[styles.item, isActive('HomeTabs') && styles.activeItem]} 
          labelStyle={[styles.label, isActive('HomeTabs') && styles.activeLabel]} 
        />

        <DrawerItem 
          label="PROFİLİM" 
          focused={isActive('Profile')} 
          onPress={() => navigation.navigate('Profile')} 
          style={[styles.item, isActive('Profile') && styles.activeItem]} 
          labelStyle={[styles.label, isActive('Profile') && styles.activeLabel]} 
        />

        <DrawerItem 
          label="İLANLAR" 
          focused={isActive('MyAds')} 
          onPress={() => navigation.navigate('MyAds')} 
          style={[styles.item, isActive('MyAds') && styles.activeItem]} 
          labelStyle={[styles.label, isActive('MyAds') && styles.activeLabel]} 
        />

        <DrawerItem 
          label="YAZICI VE KAĞIT SİPARİŞİ" 
          focused={false} 
          onPress={async () => {
            navigation.closeDrawer();
            try {
              await Linking.openURL('https://hafriyapp.com/yazici-ve-kagit-siparisi');
            } catch {
              // Fail silently
            }
          }} 
          style={styles.item} 
          labelStyle={styles.label} 
        />

        <DrawerItem 
          label="UYGULAMA KULLANIM VİDEOLARI" 
          focused={false} 
          onPress={async () => {
            navigation.closeDrawer();
            try {
              await Linking.openURL('https://www.youtube.com/@hafriyapp?si=s7Ri_jShVZEqyA6P');
            } catch {
              // Fail silently
            }
          }} 
          style={styles.item} 
          labelStyle={styles.label} 
        />

        <DrawerItem 
          label="CANLI DESTEK" 
          focused={false} 
          onPress={async () => {
            navigation.closeDrawer();
            const adminPhone = '+905383573913';
            const messageTemplate = `Merhaba, Canlı Destek almak istiyorum.`;
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
          }} 
          style={styles.item} 
          labelStyle={styles.label} 
        />
      </View>

      {/* 🚪 ÇIKIŞ */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
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
});
