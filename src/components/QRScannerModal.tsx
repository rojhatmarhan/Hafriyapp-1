import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';

export interface ScannedQRData {
  raw: string;
  type: string;
  haulId?: string;
  vehicleId?: string;
  jobSiteId?: string;
  plateNumber?: string;
  time?: string;
  serialNumber?: string;
}

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: ScannedQRData) => void;
  title?: string;
}

export const parseQRCode = (codeString: string): ScannedQRData => {
  const trimmed = codeString.trim();
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    const type = parts[0]?.toUpperCase() || 'UNKNOWN';
    if (type === 'HAUL') {
      return {
        raw: trimmed,
        type: 'HAUL',
        haulId: parts[1] || undefined,
        vehicleId: parts[2] || undefined,
        jobSiteId: parts[3] || undefined,
        plateNumber: parts[4]?.replace(' ', '')?.toUpperCase() || undefined,
        time: parts[5] || undefined,
      };
    } else if (type === 'INFOSLIP') {
      return {
        raw: trimmed,
        type: 'INFOSLIP',
        haulId: parts[1] || undefined,
        vehicleId: parts[2] || undefined,
        plateNumber: parts[3]?.replace(' ', '')?.toUpperCase() || undefined,
        time: parts[4] || undefined,
      };
    }
  }

  // Seri No veya Düz Kod
  return {
    raw: trimmed,
    type: 'SERIAL_OR_RAW',
    serialNumber: trimmed,
  };
};

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Sefer QR Kodunu Okutun',
}) => {
  const [torchOn, setTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(true);

  const handleReadCode = (event: any) => {
    if (!isScanning) return;
    const code = event?.nativeEvent?.codeStringValue;
    if (!code) return;

    setIsScanning(false);
    const parsed = parseQRCode(code);
    onScan(parsed);
    onClose();
  };

  const handleShow = async () => {
    setIsScanning(true);
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Kamera İzni Gerekli',
            message: 'Fiş üzerindeki QR kodu okumak için kamera izni gerekiyor.',
            buttonPositive: 'İzin Ver',
            buttonNegative: 'İptal',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('İzin Reddedildi', 'QR kod okumak için kamera izni vermelisiniz.');
          onClose();
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleShow}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Üst Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕ Kapat</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
            onPress={() => setTorchOn(v => !v)}
          >
            <Text style={styles.torchBtnText}>{torchOn ? '🔦 Açık' : '💡 Flaş'}</Text>
          </TouchableOpacity>
        </View>

        {/* Kamera Vizörü */}
        <View style={styles.cameraContainer}>
          <Camera
            scanBarcode={true}
            onReadCode={handleReadCode}
            showFrame={true}
            laserColor="#2E7D32"
            frameColor="#fff"
            torchMode={torchOn ? 'on' : 'off'}
            style={styles.camera}
          />
        </View>

        {/* Alt Bilgi */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Basılı fişin veya ekrandaki QR kodu çerçevenin içine hizalayın
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 10,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  torchBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  torchBtnActive: {
    backgroundColor: '#FFB300',
  },
  torchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  footer: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
});
