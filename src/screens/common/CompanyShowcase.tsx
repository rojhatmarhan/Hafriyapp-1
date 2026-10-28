import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const SHOWCASE_URL = 'https://hafriyapp.com/firma-tanitimi';
const WebViewComponent = WebView as any;

// Dış site üst başlığını (header.block-header) ve alt bilgisini (section#zSiG-O) tamamen gizle,
// ayrıca Zyro'nun yatay/dikey boşluklarını (--c27f45b8:360px, --v66d5c4a6, --v1984096a, --m-block-padding) sıfırla
const INJECTED_CSS = [
  'header.block-header',
  'header[class*="block-header"]',
  '.block-header',
  '.block-header-layout-desktop',
  '.block-header-layout-mobile',
  'header[data-v-06cc56f8]',
  'div[data-qa="site-header"]',
  'section#zSiG-O',
  '#zSiG-O',
  'section.block[data-pagefind-ignore="all"]',
  'footer',
  '.whats-app-bubble',
].join(', ') +
  ' { display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0px !important; min-height: 0px !important; max-height: 0px !important; overflow: hidden !important; margin: 0px !important; padding: 0px !important; pointer-events: none !important; position: absolute !important; z-index: -9999 !important; }' +
  ' html, body, #app, .user-site, .page { margin: 0px !important; padding: 0px !important; width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; }' +
  ' section.block:not(#zSiG-O) { --m-block-padding: 0px !important; --block-padding: 0px !important; --block-padding-top: 0px !important; --block-padding-bottom: 0px !important; --block-padding-left: 0px !important; --block-padding-right: 0px !important; padding: 0px !important; margin: 0px !important; width: 100% !important; max-width: 100% !important; }' +
  ' .block-layout, .block-layout--layout, div[class*="block-layout"] { --c27f45b8: 100% !important; --v3f3138e2: 100% !important; --v66d5c4a6: 0px !important; --v1984096a: 0px !important; --m-grid-template-columns: 100% !important; --grid-template-columns: 100% !important; padding: 0px !important; padding-left: 0px !important; padding-right: 0px !important; margin: 0px !important; width: 100% !important; max-width: 100% !important; grid-template-columns: 100% !important; }' +
  ' .layout-element, .layout-element--layout, .grid-embed, .layout-element__component--GridEmbed, .grid-embed iframe { padding: 0px !important; margin: 0px !important; width: 100% !important; max-width: 100% !important; border: none !important; }';

const INJECTED_JS = `
(function() {
  var cssText = ${JSON.stringify(INJECTED_CSS)};

  function injectStyle() {
    var root = document.head || document.documentElement;
    if (!root) return;
    var style = document.getElementById('hafriyapp-hide-hf-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'hafriyapp-hide-hf-style';
      style.type = 'text/css';
      style.appendChild(document.createTextNode(cssText));
      root.appendChild(style);
    }
  }

  function hideAndRemove(el) {
    if (!el) return;
    try {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('height', '0px', 'important');
      el.style.setProperty('min-height', '0px', 'important');
      el.style.setProperty('max-height', '0px', 'important');
      el.style.setProperty('margin', '0px', 'important');
      el.style.setProperty('padding', '0px', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
      el.remove();
    } catch (e) {}
  }

  function cleanLayoutAndRemoveHeaderFooter() {
    injectStyle();

    var selectors = [
      'header.block-header',
      'header[class*="block-header"]',
      '.block-header',
      'header[data-v-06cc56f8]',
      'div[data-qa="site-header"]',
      'section#zSiG-O',
      '#zSiG-O',
      'section.block[data-pagefind-ignore="all"]',
      'footer',
      '.whats-app-bubble'
    ];

    var nodes = document.querySelectorAll(selectors.join(','));
    for (var i = 0; i < nodes.length; i++) {
      hideAndRemove(nodes[i]);
    }

    var sections = document.querySelectorAll('section.block');
    for (var j = 0; j < sections.length; j++) {
      var sec = sections[j];
      if (
        sec.id === 'zSiG-O' ||
        sec.getAttribute('data-pagefind-ignore') === 'all' ||
        sec.querySelector('#ai-A1ppsj, #ai-3PpAD6, #zo-hud, a[href*="kvkk-aydinlatma-metni"]')
      ) {
        hideAndRemove(sec);
      } else {
        sec.style.setProperty('--m-block-padding', '0px', 'important');
        sec.style.setProperty('--block-padding', '0px', 'important');
        sec.style.setProperty('padding', '0px', 'important');
        sec.style.setProperty('margin', '0px', 'important');
        sec.style.setProperty('width', '100%', 'important');
        sec.style.setProperty('max-width', '100%', 'important');
      }
    }

    var layouts = document.querySelectorAll('.block-layout, .block-layout--layout, div[class*="block-layout"]');
    for (var k = 0; k < layouts.length; k++) {
      var lay = layouts[k];
      lay.style.setProperty('--c27f45b8', '100%', 'important');
      lay.style.setProperty('--v3f3138e2', '100%', 'important');
      lay.style.setProperty('--v66d5c4a6', '0px', 'important');
      lay.style.setProperty('--v1984096a', '0px', 'important');
      lay.style.setProperty('--m-grid-template-columns', '100%', 'important');
      lay.style.setProperty('--grid-template-columns', '100%', 'important');
      lay.style.setProperty('padding', '0px', 'important');
      lay.style.setProperty('margin', '0px', 'important');
      lay.style.setProperty('width', '100%', 'important');
      lay.style.setProperty('max-width', '100%', 'important');
      lay.style.setProperty('grid-template-columns', '100%', 'important');
    }

    var embeds = document.querySelectorAll('.layout-element, .grid-embed, .layout-element__component--GridEmbed, .grid-embed iframe');
    for (var m = 0; m < embeds.length; m++) {
      var emb = embeds[m];
      emb.style.setProperty('padding', '0px', 'important');
      emb.style.setProperty('margin', '0px', 'important');
      emb.style.setProperty('width', '100%', 'important');
      emb.style.setProperty('max-width', '100%', 'important');
    }
  }

  cleanLayoutAndRemoveHeaderFooter();

  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function() {
      cleanLayoutAndRemoveHeaderFooter();
    });
    var target = document.documentElement || document.body;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        cleanLayoutAndRemoveHeaderFooter();
        if (document.documentElement) {
          observer.observe(document.documentElement, { childList: true, subtree: true });
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', cleanLayoutAndRemoveHeaderFooter);
  window.addEventListener('load', cleanLayoutAndRemoveHeaderFooter);
  setInterval(cleanLayoutAndRemoveHeaderFooter, 200);
})();
true;
`;

export default function CompanyShowcase() {
  const navigation = useNavigation<any>();
  const webViewRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFC20E" translucent={true} />

      {/* ── Kompakt Tam Satır Üst Bar (Sadece Buton Yüksekliğinde: Geri & Yenile) ── */}
      <View style={styles.topBarWrapper}>
        <View style={styles.topBarRow}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.navBtnArrow}>‹</Text>
            <Text style={styles.navBtnText}>Geri</Text>
          </TouchableOpacity>

          <Text style={styles.topBarTitle} numberOfLines={1}>
            FİRMA TANITIMLARI
          </Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => webViewRef.current?.reload()}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFD500" style={{ marginRight: 4 }} />
            ) : (
              <Text style={styles.refreshIcon}>↻</Text>
            )}
            <Text style={styles.navBtnText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tam Genişlik & Yükseklik WebView (Üst Bardaki Satırın Hemen Altından Başlar) ── */}
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
          automaticallyAdjustContentInsets={false}
          contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          injectedJavaScript={INJECTED_JS}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
          injectedJavaScriptForMainFrameOnly={false}
          onLoadStart={() => {
            setLoading(true);
            webViewRef.current?.injectJavaScript(INJECTED_JS);
          }}
          onLoadProgress={() => {
            webViewRef.current?.injectJavaScript(INJECTED_JS);
          }}
          onLoadEnd={() => {
            setLoading(false);
            webViewRef.current?.injectJavaScript(INJECTED_JS);
          }}
          onNavigationStateChange={() => {
            webViewRef.current?.injectJavaScript(INJECTED_JS);
          }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFC20E" />
              <Text style={styles.loadingText}>Sektör Firmaları Yükleniyor...</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBarWrapper: {
    backgroundColor: '#161616',
    borderBottomWidth: 1.5,
    borderBottomColor: '#FFD500',
    width: '100%',
    zIndex: 20,
  },
  topBarRow: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#383838',
    minWidth: 68,
    justifyContent: 'center',
  },
  navBtnArrow: {
    color: '#FFD500',
    fontSize: 19,
    fontWeight: '900',
    marginRight: 4,
    lineHeight: 20,
  },
  refreshIcon: {
    color: '#FFD500',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 5,
    lineHeight: 18,
  },
  navBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFD500',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginHorizontal: 8,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    margin: 0,
    padding: 0,
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    margin: 0,
    padding: 0,
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
});
