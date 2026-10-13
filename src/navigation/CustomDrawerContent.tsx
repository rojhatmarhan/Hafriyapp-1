import React, { useState } from 'react';
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

const EXTRA_APPS = [
  {
    id: 'dokum-fisi',
    title: 'Döküm Fişi Takip Aracı- Yapay Zeka Destekli',
    headerTitle: 'DÖKÜM FİŞİ TAKİP ARACI',
    headerSubtitle: 'Yapay Zeka Destekli Kontrol',
    url: 'https://hafriyapp.com/dokum-fisi-takip-araci-yapay-zeka-destekli',
  },
  {
    id: 'is-teklifi',
    title: 'Otomatik İş Teklifi Hazırlama Formu',
    headerTitle: 'İŞ TEKLİFİ HAZIRLAMA',
    headerSubtitle: 'Otomatik Teklif Formu',
    url: 'https://hafriyapp.com/is-teklifi-hazirla',
  },
  {
    id: 'nakliye-kayit',
    title: 'Nakliye İş Kaydı Tutma Aracı',
    headerTitle: 'NAKLİYE İŞ KAYDI',
    headerSubtitle: 'Kayıt Tutma Aracı',
    url: 'https://hafriyapp.com/nakliye-kayde-tutma-araci',
  },
  {
    id: 'foto-pdf',
    title: 'Fotoğrafları PDF Dosyasına Çevir',
    headerTitle: 'FOTOĞRAFLARI PDF YAP',
    headerSubtitle: 'Belge & Resim Dönüştürücü',
    url: 'https://hafriyapp.com/fotgraflari-pdf-dosyasina-cevir',
  },
  {
    id: 'notlar',
    title: 'Hafriyat İşleri İçin Özel Not Uygulaması',
    headerTitle: 'HAFRİYAT NOTLARI',
    headerSubtitle: 'Özel Not Uygulaması',
    url: 'https://hafriyapp.com/notlar',
  },
];

export default function CustomDrawerContent(props: any) {
  const dispatch = useDispatch();
  const { state, navigation } = props;
  const [extraAppsOpen, setExtraAppsOpen] = useState(false);

  const handleLogout = async () => {
    await clearAuth();
    dispatch(logout());
  };

  const isActive = (routeName: string) => state.routeNames[state.index] === routeName;
  const isWebToolActive = state.routeNames[state.index] === 'WebToolScreen';

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

        {/* 🛠️ EK UYGULAMALAR MENÜSÜ */}
        <TouchableOpacity
          style={[
            styles.extraAppsToggle,
            (extraAppsOpen || isWebToolActive) && styles.extraAppsToggleActive,
          ]}
          onPress={() => setExtraAppsOpen(!extraAppsOpen)}
          activeOpacity={0.75}>
          <View style={styles.toggleLeft}>
            <Text
              style={[
                styles.label,
                (extraAppsOpen || isWebToolActive) && styles.activeLabel,
              ]}>
              EK UYGULAMALAR
            </Text>
            <View style={styles.appCountBadge}>
              <Text style={styles.appCountText}>5</Text>
            </View>
          </View>
          <Text style={styles.chevronText}>{extraAppsOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {extraAppsOpen && (
          <View style={styles.subListContainer}>
            {EXTRA_APPS.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.subItem,
                  idx === EXTRA_APPS.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => {
                  navigation.closeDrawer();
                  navigation.navigate('WebToolScreen', {
                    url: item.url,
                    title: item.headerTitle,
                    subTitle: item.headerSubtitle,
                  });
                }}
                activeOpacity={0.7}>
                <View style={styles.subIndexBadge}>
                  <Text style={styles.subIndexText}>{idx + 1}</Text>
                </View>
                <Text style={styles.subItemText} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.subArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
  extraAppsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 8,
  },
  extraAppsToggleActive: {
    backgroundColor: '#FFF8D6',
    borderWidth: 1,
    borderColor: '#FFD500',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appCountBadge: {
    backgroundColor: '#FFD500',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E1E1C',
  },
  chevronText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#555',
  },
  subListContainer: {
    backgroundColor: '#FAFAFA',
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECEAE2',
    overflow: 'hidden',
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EFEA',
  },
  subIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFD500',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  subIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E1E1C',
  },
  subItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#2A2925',
    lineHeight: 18,
  },
  subArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#999',
    marginLeft: 6,
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
