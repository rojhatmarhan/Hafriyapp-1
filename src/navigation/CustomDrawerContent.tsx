import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
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
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* 🟡 HEADER */}
      <View style={styles.header}>
        <Image source={require('../../assets/logoNew.png')} style={styles.logo} />
        <View style={{ marginLeft: '-2%', flex: 1 }}>
          <Text style={styles.title}>HAFRİYAPP</Text>
          <Text style={styles.subtitle}>HAFRİYAT VE YIKINTI ATIĞI TAŞIMA UYGULAMASI</Text>
        </View>
      </View>

      {/* 📜 KAYDIRILABİLİR MENÜ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}>
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
          label="PAZAR"
          focused={isActive('MarketAds')}
          onPress={() => {
            navigation.closeDrawer();
            navigation.navigate('HomeTabs', { screen: 'MarketAds' });
          }}
          style={[styles.item, isActive('MarketAds') && styles.activeItem]}
          labelStyle={[styles.label, isActive('MarketAds') && styles.activeLabel]}
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
      </ScrollView>

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
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 65,
    height: 65,
    resizeMode: 'contain',
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
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 12,
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
    fontWeight: '700',
    color: '#000',
  },
  logoutBtn: {
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFD500',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 2.68,
    elevation: 4,
  },
  logoutText: {
    fontWeight: '700',
    fontSize: 15,
    color: '#000',
  },
});
