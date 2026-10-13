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

// Dış site üst başlığını (header) ve alt bilgisini (footer) tamamen gizle
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
    if (!style && document.head) {
      style = document.createElement('style');
      style.id = 'hafriyapp-custom-style';
      style.innerHTML = \`${INJECTED_CSS}\`;
      document.head.appendChild(style);
    }
    var h = document.querySelector('header.block-header, .block-header, div[data-qa="site-header"]');
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

  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 14 : 10);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFC20E" translucent={true} />

      {/* ── Tam Ekran WebView ── */}
      <View style={styles.webViewContainer}>
        <WebViewComponent
          ref={webViewRef}
          source={{ uri: SHOWCASE_URL }}
          style={styles.webView}
          containerStyle={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          scalesPageToFit={Platform.OS === 'android'}
          injectedJavaScript={INJECTED_JS}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          showsVerticalScrollIndicator={false}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFC20E" />
              <Text style={styles.loadingText}>Firma Tanıtımları Yükleniyor...</Text>
            </View>
          )}
          onShouldStartLoadWithRequest={(request: any) => {
            const { url } = request;
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
          <View style={[styles.topProgressBar, { top: topInset + 6 }]}>
            <ActivityIndicator size="small" color="#FFC20E" />
          </View>
        )}
      </View>

      {/* ── Yüzen (Floating) Minimal Geri & Paylaş Barı ── */}
      <View style={[styles.floatingBar, { top: topInset + 6 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.floatingBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.floatingBtnArrow}>‹</Text>
          <Text style={styles.floatingBtnText}>Geri</Text>
        </TouchableOpacity>

        <View style={styles.floatingRightGroup} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.floatingCircleBtn}
            onPress={() => webViewRef.current?.reload()}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.floatingIcon}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingCircleBtn}
            onPress={handleShare}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.floatingIcon}>↗</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
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
    right: 20,
    zIndex: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  floatingBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 25, 25, 0.88)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  floatingBtnArrow: {
    color: '#FFD500',
    fontSize: 20,
    fontWeight: '900',
    marginRight: 4,
    lineHeight: 22,
  },
  floatingBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  floatingRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(25, 25, 25, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  floatingIcon: {
    color: '#FFD500',
    fontSize: 16,
    fontWeight: '800',
  },
});
