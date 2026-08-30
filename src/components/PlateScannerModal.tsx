import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import TextRecognition from '@react-native-ml-kit/text-recognition';

interface PlateScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onPlateDetected: (plate: string) => void;
}

/**
 * Türkiye standart plaka formatlarını (01-81, 1-3 harf, 2-4 rakam) akıllıca süzer
 * Örn: "34 ABC 123", "06 ART 34", "11 ASD 1234", "TR 34 ABC 123", "34ABC123"
 */
export const extractTurkishPlate = (text: string): string | null => {
  if (!text) return null;

  const lines = text.split(/[\r\n]+/);

  // 1. Satır bazında incele
  for (const line of lines) {
    const cleanLine = line.toUpperCase().replace(/^TR\s*/i, '').replace(/[^A-Z0-9]/g, '');
    const match = cleanLine.match(/^(0[1-9]|[1-7][0-9]|8[01])([A-Z]{1,3})([0-9]{2,4})$/);
    if (match) {
      const [_, city, letters, numbers] = match;
      return `${city} ${letters} ${numbers}`;
    }
  }

  // 2. Satır içi kelime kombinasyonlarını tara (örn: "34" "ABC" "123")
  for (const line of lines) {
    const cleanLine = line.toUpperCase().replace(/[^A-Z0-9]/g, ' ');
    const tokens = cleanLine.split(/\s+/).filter(Boolean);

    for (let i = 0; i < tokens.length; i++) {
      // 3'lü kombinasyon: 34 + ABC + 123
      if (i + 2 < tokens.length) {
        const c3 = (tokens[i] + tokens[i + 1] + tokens[i + 2]).replace(/^TR/i, '');
        const m3 = c3.match(/^(0[1-9]|[1-7][0-9]|8[01])([A-Z]{1,3})([0-9]{2,4})$/);
        if (m3) {
          return `${m3[1]} ${m3[2]} ${m3[3]}`;
        }
      }

      // 2'li kombinasyon: 34 + ABC123 veya 34ABC + 123
      if (i + 1 < tokens.length) {
        const c2 = (tokens[i] + tokens[i + 1]).replace(/^TR/i, '');
        const m2 = c2.match(/^(0[1-9]|[1-7][0-9]|8[01])([A-Z]{1,3})([0-9]{2,4})$/);
        if (m2) {
          return `${m2[1]} ${m2[2]} ${m2[3]}`;
        }
      }

      // Tekli parça: 34ABC123
      const c1 = tokens[i].replace(/^TR/i, '');
      const m1 = c1.match(/^(0[1-9]|[1-7][0-9]|8[01])([A-Z]{1,3})([0-9]{2,4})$/);
      if (m1) {
        return `${m1[1]} ${m1[2]} ${m1[3]}`;
      }
    }
  }

  // 3. Tüm metin içinde regex ara
  const fullCleaned = text.toUpperCase().replace(/^TR/i, '').replace(/[^A-Z0-9]/g, '');
  const match = fullCleaned.match(/(0[1-9]|[1-7][0-9]|8[01])([A-Z]{1,3})([0-9]{2,4})/);
  if (match) {
    const [_, city, letters, numbers] = match;
    const totalLen = (city + letters + numbers).length;
    if (totalLen >= 7 && totalLen <= 9) {
      return `${city} ${letters} ${numbers}`;
    }
  }

  return null;
};

export const PlateScannerModal: React.FC<PlateScannerModalProps> = ({
  visible,
  onClose,
  onPlateDetected,
}) => {
  const cameraRef = useRef<any>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);

  const isDetectedRef = useRef(false);

  const formatUri = useCallback((rawUri: string): string => {
    let formatted = rawUri;
    if (!formatted.startsWith('file://') && !formatted.startsWith('content://')) {
      formatted = `file://${formatted}`;
    }
    return formatted;
  }, []);

  const handleSuccess = useCallback((plate: string) => {
    if (isDetectedRef.current) return;
    isDetectedRef.current = true;
    setDetectedPlate(plate);
    setProcessing(false);

    setTimeout(() => {
      onPlateDetected(plate);
      onClose();
    }, 450);
  }, [onPlateDetected, onClose]);

  useEffect(() => {
    if (visible) {
      isDetectedRef.current = false;
      setDetectedPlate(null);
      setProcessing(false);
    }
  }, [visible]);

  const handleShow = async () => {
    setProcessing(false);
    setDetectedPlate(null);

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Kamera İzni Gerekli',
            message: 'Plakayı otomatik okumak için kamera izni gerekiyor.',
            buttonPositive: 'İzin Ver',
            buttonNegative: 'İptal',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('İzin Reddedildi', 'Plaka okumak için kamera izni vermelisiniz.');
          onClose();
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const handleManualCapture = async () => {
    if (processing || isDetectedRef.current || !cameraRef.current) return;

    try {
      setProcessing(true);
      const photo = await cameraRef.current.capture();
      const rawUri = photo?.uri || photo?.path;

      if (!rawUri) {
        setProcessing(false);
        Alert.alert('Hata', 'Fotoğraf yakalanamadı. Lütfen tekrar deneyin.');
        return;
      }

      const formattedUri = formatUri(rawUri);
      const result = await TextRecognition.recognize(formattedUri);

      let plate = extractTurkishPlate(result?.text || '');
      if (!plate && result?.blocks) {
        for (const block of result.blocks) {
          plate = extractTurkishPlate(block.text);
          if (plate) break;
        }
      }

      if (plate) {
        handleSuccess(plate);
      } else {
        setProcessing(false);
        const readSnippet = result?.text?.trim() ? `\n\nOkunan metin: "${result.text.trim().substring(0, 30)}"` : '';
        Alert.alert(
          'Plaka Algılanamadı',
          `Kamerayı plakanın tam karşısına tutup çerçeveye ortalayarak tekrar "Plakayı Oku" butonuna basınız.${readSnippet}`,
        );
      }
    } catch (err) {
      console.warn('[PlateScanner] OCR failed:', err);
      setProcessing(false);
      Alert.alert('Hata', 'Plaka tanınırken bir sorun oluştu. Lütfen tekrar deneyin.');
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Üst Başlık Barı (Sade & Temiz) */}
        <View style={styles.header}>
          <Text style={styles.title}>Plaka Tara (Canlı)</Text>
        </View>

        {/* Kamera & Plaka Çerçevesi */}
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            cameraType={CameraType.Back}
            torchMode={torchOn ? 'on' : 'off'}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Plaka Hizalama Vizörü */}
          <View style={styles.overlay}>
            <View style={[styles.plateFrame, detectedPlate ? styles.plateFrameSuccess : null]}>
              <View style={styles.plateFrameHeader}>
                <View style={styles.trBadge}>
                  <Text style={styles.trText}>TR</Text>
                </View>
                <Text style={[styles.plateHint, detectedPlate ? styles.plateDetectedText : null]}>
                  {detectedPlate || '34 ABC 123'}
                </Text>
              </View>
            </View>

            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, detectedPlate && styles.statusDotSuccess]} />
              <Text style={styles.guideText}>
                {detectedPlate
                  ? `✓ Algılandı: ${detectedPlate}`
                  : 'Plakayı çerçeveye ortalayıp butona basınız'}
              </Text>
            </View>
          </View>
        </View>

        {/* Alt Panel & Büyük Aksiyon Butonları */}
        <View style={styles.footer}>
          <View style={styles.actionButtonsRow}>
            {/* Kapat Butonu */}
            <TouchableOpacity style={styles.bottomCloseBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.bottomCloseBtnText}>✕ Kapat</Text>
            </TouchableOpacity>

            {/* Manuel Oku Ana Buton */}
            <TouchableOpacity
              style={[
                styles.bottomCaptureBtn,
                detectedPlate ? styles.bottomCaptureBtnSuccess : null,
                (processing || !!detectedPlate) && styles.captureBtnDisabled,
              ]}
              onPress={handleManualCapture}
              disabled={processing || !!detectedPlate}
              activeOpacity={0.85}
            >
              {processing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.captureIcon}>📸</Text>
                  <Text style={styles.captureText} numberOfLines={1}>
                    {detectedPlate ? `✓ ${detectedPlate}` : 'Plakayı Oku'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Flaş Butonu */}
            <TouchableOpacity
              style={[styles.bottomTorchBtn, torchOn && styles.bottomTorchBtnActive]}
              onPress={() => setTorchOn(v => !v)}
              activeOpacity={0.8}
            >
              <Text style={[styles.bottomTorchBtnText, torchOn && styles.bottomTorchBtnTextActive]}>
                {torchOn ? '🔦 Açık' : '💡 Flaş'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
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
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  plateFrame: {
    width: '82%',
    height: 90,
    borderWidth: 3,
    borderColor: '#FFD500',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 8,
    justifyContent: 'center',
  },
  plateFrameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trBadge: {
    backgroundColor: '#003DA5',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  trText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  plateHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  plateFrameSuccess: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.25)',
    borderWidth: 4,
  },
  plateDetectedText: {
    color: '#00E676',
    fontWeight: '900',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 18,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD500',
    marginRight: 8,
  },
  statusDotSuccess: {
    backgroundColor: '#00E676',
  },
  guideText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
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
    fontSize: 15,
    fontWeight: '800',
  },
  bottomCaptureBtn: {
    flex: 2,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomCaptureBtnSuccess: {
    backgroundColor: '#00C853',
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  captureText: {
    color: '#fff',
    fontSize: 15,
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
    fontSize: 15,
    fontWeight: '800',
  },
  bottomTorchBtnTextActive: {
    color: '#000',
    fontWeight: '900',
  },
});
