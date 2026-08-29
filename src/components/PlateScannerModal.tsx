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
import { Camera } from 'react-native-camera-kit';
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

  const isScanningRef = useRef(false);
  const isDetectedRef = useRef(false);
  const isMountedRef = useRef(false);
  const autoScanTimerRef = useRef<any>(null);

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
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    setDetectedPlate(plate);

    setTimeout(() => {
      onPlateDetected(plate);
      onClose();
    }, 350);
  }, [onPlateDetected, onClose]);

  const runAutoScan = useCallback(async () => {
    if (!isMountedRef.current || isDetectedRef.current || !cameraRef.current) {
      return;
    }

    try {
      isScanningRef.current = true;
      const photo = await cameraRef.current.capture();
      const rawUri = photo?.uri || photo?.path;

      if (rawUri && isMountedRef.current && !isDetectedRef.current) {
        const formattedUri = formatUri(rawUri);
        const result = await TextRecognition.recognize(formattedUri);

        let plate = extractTurkishPlate(result?.text || '');
        if (!plate && result?.blocks) {
          for (const block of result.blocks) {
            plate = extractTurkishPlate(block.text);
            if (plate) break;
            if (block.lines) {
              for (const line of block.lines) {
                plate = extractTurkishPlate(line.text);
                if (plate) break;
              }
            }
            if (plate) break;
          }
        }

        if (plate && isMountedRef.current && !isDetectedRef.current) {
          handleSuccess(plate);
          return;
        }
      }
    } catch {
      // sessizce devam et
    } finally {
      isScanningRef.current = false;
      if (isMountedRef.current && !isDetectedRef.current) {
        autoScanTimerRef.current = setTimeout(runAutoScan, 350);
      }
    }
  }, [formatUri, handleSuccess]);

  useEffect(() => {
    if (visible) {
      isMountedRef.current = true;
      isDetectedRef.current = false;
      setDetectedPlate(null);
      setProcessing(false);

      autoScanTimerRef.current = setTimeout(runAutoScan, 600);

      return () => {
        isMountedRef.current = false;
        isDetectedRef.current = true;
        if (autoScanTimerRef.current) {
          clearTimeout(autoScanTimerRef.current);
          autoScanTimerRef.current = null;
        }
      };
    } else {
      isMountedRef.current = false;
      isDetectedRef.current = true;
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    }
  }, [visible, runAutoScan]);

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
          <Text style={styles.title}>Plaka Tara (Canlı)</Text>
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
            onPress={() => setTorchOn(v => !v)}
          >
            <Text style={styles.torchBtnText}>{torchOn ? '🔦 Açık' : '💡 Flaş'}</Text>
          </TouchableOpacity>
        </View>

        {/* Kamera & Plaka Çerçevesi */}
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            torchMode={torchOn ? 'on' : 'off'}
            style={styles.camera}
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
                  : 'Canlı Taranıyor... Plakayı çerçeveye hizalayın'}
              </Text>
            </View>
          </View>
        </View>

        {/* Alt Aksiyon Butonu */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.captureBtn, (processing || !!detectedPlate) && styles.captureBtnDisabled]}
            onPress={handleManualCapture}
            disabled={processing || !!detectedPlate}
            activeOpacity={0.85}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.captureIcon}>📸</Text>
                <Text style={styles.captureText}>
                  {detectedPlate ? `✓ ${detectedPlate}` : 'Plakayı Oku (Manuel)'}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    paddingHorizontal: 36,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  captureText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
