import React, { useState, useCallback } from 'react';
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

  const handleScan = useCallback(async () => {
    setScanState('scanning');
    setPairedDevices([]);
    setFoundDevices([]);

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
          <Text style={styles.deviceAddress}>{item.address}</Text>
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
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.scanBtnText}>🔍  Cihazları Tara</Text>
            )}
          </TouchableOpacity>

          {/* Cihaz listesi */}
          {allDevices.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Bulunan Yazıcılar</Text>
              <FlatList
                data={allDevices}
                keyExtractor={item => item.address}
                renderItem={renderDevice}
                style={styles.list}
                scrollEnabled
              />
            </>
          ) : scanState === 'idle' && (
            <Text style={styles.emptyText}>
              Henüz cihaz bulunamadı. Taramak için butona basın.
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
    maxHeight: '70%',
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
    marginBottom: 16,
  },
  scanBtnDisabled: {
    opacity: 0.6,
  },
  scanBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
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
    marginTop: 20,
    paddingHorizontal: 10,
  },
});
