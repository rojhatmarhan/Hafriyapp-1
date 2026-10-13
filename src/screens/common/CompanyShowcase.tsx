import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const SHOWCASE_URL = 'https://hafriyapp.com/firma-tanitimi';
const WebViewComponent = WebView as any;

const INJECTED_CSS = `
  header.block-header,
  .block-header,
  div[data-qa="site-header"],
  #zSiG-O,
  section#zSiG-O,
  footer,
  .whats-app-bubble {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body, html {
    padding-top: 0 !important;
    margin-top: 0 !important;
  }
`;

const INJECTED_JS = `
(function() {
  function removeHeaderFooter() {
    var style = document.getElementById('hafriyapp-custom-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'hafriyapp-custom-style';
      style.innerHTML = \`${INJECTED_CSS}\`;
      if (document.head) {
        document.head.appendChild(style);
      }
    }
    var h = document.querySelector('header.block-header, .block-header');
    if (h) {
      h.style.setProperty('display', 'none', 'important');
      h.style.setProperty('height', '0px', 'important');
    }
    var f = document.querySelector('#zSiG-O, section#zSiG-O, footer');
    if (f) {
      f.style.setProperty('display', 'none', 'important');
      f.style.setProperty('height', '0px', 'important');
    }
  }
  removeHeaderFooter();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeHeaderFooter);
  }
  window.addEventListener('load', removeHeaderFooter);
  setInterval(removeHeaderFooter, 250);
})();
true;
`;

export default function CompanyShowcase() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  const handleShare = async () => {
    try {
      await Share.share({
        title: 'HafriyApp Firma Tanıtımları',
        message: 'HafriyApp Firma Tanıtımlarını inceleyin: ' + SHOWCASE_URL,
        url: SHOWCASE_URL,
      });
    } catch {}
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 12 : 8);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFC20E" translucent={false} />

      {/* ── Üst Başlık Çubuğu ── */}
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backBtnText}>‹ Geri</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>🏢 FİRMALAR</Text>
          <Text style={styles.subTitleText}>Firma Tanıtımı & Rehber</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => webViewRef.current?.reload()}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <Text style={styles.iconBtnText}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleShare}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <Text style={styles.iconBtnText}>↗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── WebView İçeriği ── */}
      <View style={styles.webViewContainer}>
        <WebViewComponent
          ref={webViewRef}
          source={{ uri: SHOWCASE_URL }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowFileAccess={true}
          scalesPageToFit={true}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          injectedJavaScript={INJECTED_JS}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFC20E" />
              <Text style={styles.loadingText}>Firma Tanıtımları Yükleniyor...</Text>
            </View>
          )}
          onShouldStartLoadWithRequest={(request: any) => {
            const { url } = request;
            // WhatsApp, telefon ve mail bağlantılarını yerel uygulamaya devret
            if (
              url.startsWith('tel:') ||
              url.startsWith('mailto:') ||
              url.startsWith('whatsapp:') ||
              url.includes('wa.me') ||
              url.includes('api.whatsapp.com')
            ) {
              Linking.openURL(url).catch(() => {});
              return false;
            }
            return true;
          }}
        />

        {loading && (
          <View style={styles.topProgressBar}>
            <ActivityIndicator size="small" color="#FFC20E" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFC20E', // HafriyApp Sarı Üst Bant
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFC20E',
    borderBottomWidth: 2,
    borderBottomColor: '#1E1E1C',
  },
  backBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#1E1E1C',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  backBtnText: {
    color: '#FFC20E',
    fontWeight: '800',
    fontSize: 14,
  },
  titleContainer: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E1E1C',
    letterSpacing: 0.5,
  },
  subTitleText: {
    fontSize: 11,
    color: '#4A3800',
    fontWeight: '700',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E1E1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    color: '#FFC20E',
    fontSize: 16,
    fontWeight: '800',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#F3F2EF',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F3F2EF',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F2EF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B6A66',
    fontWeight: '600',
  },
  topProgressBar: {
    position: 'absolute',
    top: 6,
    right: 12,
    zIndex: 20,
  },
});
