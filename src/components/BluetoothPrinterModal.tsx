import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import {
  getPairedAndScannedDevices,
  connectPrinter,
  savePrinter,
  BluetoothDevice,
  isBluetoothEnabled,
  enableBluetooth,
  verifyPrinterPermission,
} from '../services/printService';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Bağlantı başarılı olduğunda çağrılır */
  onConnected: (device: BluetoothDevice) => void;
}

type ScanState = 'idle' | 'scanning' | 'connecting';

export default function BluetoothPrinterModal({ visible, onClose, onConnected }: Props) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [foundDevices, setFoundDevices] = useState<BluetoothDevice[]>([]);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [hideUnnamed, setHideUnnamed] = useState<boolean>(true);

  const handleScan = useCallback(async () => {
    setScanState('scanning');

    try {
      // Bluetooth açık mı?
      const enabled = await isBluetoothEnabled();
      if (!enabled) {
        Alert.alert(
          'Bluetooth Kapalı',
          Platform.OS === 'ios'
            ? 'Bluetooth yazıcıya bağlanmak için iPhone Ayarlar > Bluetooth\'dan Bluetooth\'u açın.'
            : 'Bluetooth yazıcıya bağlanmak için Bluetooth\'u açmanız gerekmektedir.',
          [
            { text: 'Tamam', style: 'cancel' },
            ...(Platform.OS === 'android'
              ? [{ text: 'Aç', onPress: async () => { await enableBluetooth(); } }]
              : []),
          ],
        );
        setScanState('idle');
        return;
      }

      // Tarama işlemi arkada çalışırken mevcut eşleşmiş cihazlar hemen yüklenir
      const { paired, found } = await getPairedAndScannedDevices();
      setPairedDevices(paired);
      setFoundDevices(found);
    } catch (err: any) {
      Alert.alert('Tarama Hatası', err?.message || 'Cihazlar taranırken hata oluştu.');
    } finally {
      setScanState('idle');
    }
  }, []);

  const handleSelectDevice = useCallback(async (device: BluetoothDevice) => {
    setConnectingAddress(device.address);
    setScanState('connecting');

    // Android için önce API yetki kontrolü yap
    if (Platform.OS === 'android' && device.address) {
      const verification = await verifyPrinterPermission(device.address);
      if (!verification.isAllowed) {
        setScanState('idle');
        setConnectingAddress(null);
        Alert.alert(
          'Yetkisiz Yazıcı',
          'Bu yazıcı için fiş kesme yetkiniz bulunmamaktadır. Lütfen şirketiniz tarafından tanımlanmış yetkili yazıcıyı kullanınız.',
        );
        return;
      }
    }

    const success = await connectPrinter(device.address);

    if (success) {
      await savePrinter(device);
      setScanState('idle');
      setConnectingAddress(null);
      onConnected(device);
    } else {
      setScanState('idle');
      setConnectingAddress(null);
      Alert.alert(
        'Bağlantı Hatası',
        `"${device.name}" yazıcısına bağlanılamadı.\n\nYazıcınızın açık olduğundan ve Bluetooth eşleştirmesinin yapıldığından emin olun.`,
      );
    }
  }, [onConnected]);

  const renderDevice = ({ item }: { item: BluetoothDevice }) => {
    const isConnecting = connectingAddress === item.address;
    return (
      <TouchableOpacity
        style={styles.deviceRow}
        onPress={() => handleSelectDevice(item)}
        disabled={scanState === 'connecting'}
        activeOpacity={0.7}
      >
        <View style={styles.deviceIcon}>
          <Text style={styles.deviceIconText}>🖨</Text>
        </View>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name}</Text>
          <Text style={styles.deviceAddress}>
            {/* iOS UUID'leri çok uzun — son 12 karakteri göster */}
            {item.address.length > 17
              ? '…' + item.address.slice(-12)
              : item.address}
          </Text>
        </View>
        {isConnecting ? (
          <ActivityIndicator size="small" color="#FFD500" />
        ) : (
          <Text style={styles.connectArrow}>›</Text>
        )}
      </TouchableOpacity>
    );
  };

  const allDevices = [
    ...pairedDevices,
    ...foundDevices.filter(f => !pairedDevices.some(p => p.address === f.address)),
  ];

  // Adsız / Bilinmeyen Cihaz kontrolü
  const isUnnamedDevice = (d: BluetoothDevice): boolean => {
    const name = (d.name || '').trim().toLowerCase();
    return !name || name === 'bilinmeyen cihaz' || name === 'n/a' || name === d.address.toLowerCase();
  };

  const filteredDevices = allDevices.filter(d => !hideUnnamed || !isUnnamedDevice(d));

  useEffect(() => {
    if (!visible) {
      setScanState('idle');
      setPairedDevices([]);
      setFoundDevices([]);
      setConnectingAddress(null);
      return;
    }

    handleScan();
  }, [visible, handleScan]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Başlık */}
          <View style={styles.header}>
            <Text style={styles.title}>Bluetooth Yazıcı Seç</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Açıklama */}
          <Text style={styles.description}>
            {Platform.OS === 'ios'
              ? 'Yazıcınızı iPhone Ayarlar > Bluetooth\'dan eşleştirdikten sonra "Tara" butonuna basın.\n⚠️ Yazıcınızın BLE (Bluetooth 4.0+) desteklemesi gerekir.'
              : 'Yazıcınızın Bluetooth eşleştirmesini Android ayarlarından yaptıktan sonra aşağıdaki "Tara" butonuna basın.'}
          </Text>

          {/* Tara butonu */}
          <TouchableOpacity
            style={[styles.scanBtn, scanState !== 'idle' && styles.scanBtnDisabled]}
            onPress={handleScan}
            disabled={scanState !== 'idle'}
          >
            {scanState === 'scanning' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.scanBtnText}>Taranıyor...</Text>
              </View>
            ) : (
              <Text style={styles.scanBtnText}>🔍  Cihazları Tara</Text>
            )}
          </TouchableOpacity>

          {/* Adsız Cihazları Gizle Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setHideUnnamed(prev => !prev)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, hideUnnamed && styles.checkboxChecked]}>
              {hideUnnamed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Adsız Yazıcıları Gizle</Text>
          </TouchableOpacity>

          {/* Cihaz listesi */}
          {filteredDevices.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Bulunan Yazıcılar ({filteredDevices.length})</Text>
              <FlatList
                data={filteredDevices}
                keyExtractor={item => item.address}
                renderItem={renderDevice}
                style={styles.list}
                scrollEnabled
              />
            </>
          ) : scanState === 'idle' && (
            <Text style={styles.emptyText}>
              {allDevices.length > 0 && hideUnnamed
                ? 'Bulunan tüm cihazlar adsız olduğu için gizlendi. Görmek için yukarıdaki "Adsız Yazıcıları Gizle" kutucuğunun işaretini kaldırın.'
                : Platform.OS === 'ios'
                ? 'Cihaz bulunamadı.\n\nÖnemli: Yazıcı önce iPhone Ayarlar > Bluetooth menüsünden eşleştirilmeli ve yazıcının BLE (Bluetooth 4.0+) desteklemesi gerekir.'
                : 'Henüz cihaz bulunamadı. Taramak için butona basın.'}
            </Text>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 16,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  closeBtn: {
    padding: 4,
  },
  closeX: {
    fontSize: 18,
    color: '#888',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 14,
    lineHeight: 18,
  },
  scanBtn: {
    backgroundColor: '#FFD500',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanBtnDisabled: {
    opacity: 0.6,
  },
  scanBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#FFD500',
    borderColor: '#FFD500',
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  list: {
    flexGrow: 0,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
    gap: 12,
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconText: {
    fontSize: 18,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  connectArrow: {
    fontSize: 22,
    color: '#CCC',
    fontWeight: '300',
  },
  emptyText: {
    textAlign: 'center',
    color: '#AAA',
    fontSize: 14,
    marginTop: 16,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
});
