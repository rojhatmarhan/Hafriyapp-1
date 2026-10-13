import React, { useState, useEffect, useRef } from 'react';
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
  inlineOverlay?: boolean;
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
  inlineOverlay = false,
}) => {
  const [torchOn, setTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const isScanningRef = useRef(true);

  const handleReadCode = (event: any) => {
    if (!isScanningRef.current || !isScanning) return;
    const code = event?.nativeEvent?.codeStringValue;
    if (!code) return;

    isScanningRef.current = false;
    setIsScanning(false);
    setTorchOn(false);
    const parsed = parseQRCode(code);
    onScan(parsed);
    onClose();
  };

  const handleShow = async () => {
    isScanningRef.current = true;
    setIsScanning(true);
    setTorchOn(false);
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

  useEffect(() => {
    if (visible) {
      handleShow();
    } else {
      isScanningRef.current = false;
      setIsScanning(false);
      setTorchOn(false);
    }
  }, [visible]);

  if (!visible) return null;

  const content = (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Üst Başlık Barı (Sade & Temiz) */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Kamera Vizörü */}
      <View style={styles.cameraContainer}>
        <Camera
          scanBarcode={true}
          onReadCode={handleReadCode}
          showFrame={false}
          torchMode={torchOn ? 'on' : 'off'}
          style={styles.camera}
        />
        {/* Görsel Nişangah / Çerçeve */}
        <View pointerEvents="none" style={styles.reticleOverlay}>
          <View style={styles.targetFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.laserLine} />
          </View>
          <Text style={styles.guideBadge}>Kodu veya fişi kameraya tutun</Text>
        </View>
      </View>

      {/* Alt Panel & Büyük Aksiyon Butonları */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Basılı fişin veya ekrandaki QR kodu çerçevenin içine hizalayın
        </Text>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.bottomCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.bottomCloseBtnText}>✕ Kapat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomTorchBtn, torchOn && styles.bottomTorchBtnActive]}
            onPress={() => setTorchOn(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.bottomTorchBtnText, torchOn && styles.bottomTorchBtnTextActive]}>
              {torchOn ? '🔦 Flaş Açık' : '💡 Flaş'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );

  if (inlineOverlay) {
    return <View style={styles.inlineOverlayContainer}>{content}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleShow}
      statusBarTranslucent
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  inlineOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 10,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  bottomCloseBtn: {
    flex: 1,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bottomCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomTorchBtn: {
    flex: 1,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bottomTorchBtnActive: {
    backgroundColor: '#FFB300',
    borderColor: '#FFA000',
  },
  bottomTorchBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomTorchBtnTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#4CAF50',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#4CAF50',
    opacity: 0.8,
  },
  guideBadge: {
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
