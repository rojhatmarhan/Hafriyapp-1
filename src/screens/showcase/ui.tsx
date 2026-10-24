// Firma tanıtımı ortak arayüz parçaları: yazı, düğme, logo, yıldız, üst çubuk, giriş kutusu, seçim kutusu, bildirim (toast).
// Görünüm deneme sürümünün CSS'iyle birebir (bkz. backend docs/FIRMA-TANITIMI-SPEC.md bölüm 4).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, ImageStyle, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C, F, ODAK_HALKA, PENCERE_GOLGE } from './theme';
import { basHarf } from '../../utils/showcaseFormat';

// ─────────────── Yazı

/** Varsayılan: Barlow 400, asfalt. Aile her zaman fontFamily ile seçilir (fontWeight yok). */
export const T: React.FC<TextProps> = ({ style, ...p }) => <Text maxFontSizeMultiplier={1.4} {...p} style={[st.t, style]} />;

// ─────────────── İkonlar (deneme sürümündeki SVG'ler)

type IkonP = { size?: number; color?: string };
export const ArtiIkon = ({ size = 16, color = C.sari }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M8 2v12M2 8h12" stroke={color} strokeWidth={2.4} />
  </Svg>
);
export const GeriIkon = ({ size = 20, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 20 20">
    <Path d="M12.5 4l-6 6 6 6" fill="none" stroke={color} strokeWidth={2.2} />
  </Svg>
);
export const AraIkon = ({ size = 18, color = C.gri }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Circle cx={7.5} cy={7.5} r={5.5} fill="none" stroke={color} strokeWidth={2} />
    <Path d="M11.5 11.5 16 16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);
export const HaritaIkon = ({ size = 16, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M1.5 3.5 5.5 2l5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5z M5.5 2v10.5 M10.5 3.5V14" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
  </Svg>
);
export const KalemIkon = ({ size = 15, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);
export const PinIkon = ({ size = 16, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={(size * 18) / 16} viewBox="0 0 16 18">
    <Path d="M8 1a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6z" fill="none" stroke={color} strokeWidth={1.8} />
    <Circle cx={8} cy={7} r={2} fill={color} />
  </Svg>
);
export const TelIkon = ({ size = 16, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M3.5 1.5h3l1.2 3.2-1.8 1.2a8 8 0 0 0 4.2 4.2l1.2-1.8 3.2 1.2v3c0 .6-.5 1-1 1A12.5 12.5 0 0 1 2.5 2.5c0-.5.4-1 1-1z" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);
export const WaIkon = ({ size = 16, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M8 1.5a6.5 6.5 0 0 0-5.6 9.8L1.5 14.5l3.3-.9A6.5 6.5 0 1 0 8 1.5z" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);
export const PostaIkon = ({ size = 16, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Rect x={1.5} y={3} width={13} height={10} rx={1} fill="none" stroke={color} strokeWidth={1.6} />
    <Path d="M2 3.5l6 5 6-5" fill="none" stroke={color} strokeWidth={1.6} />
  </Svg>
);
export const ListeIkon = ({ size = 16, color = C.sari }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Path d="M5.5 4h9M5.5 8h9M5.5 12h9" stroke={color} strokeWidth={1.8} />
    <Circle cx={2.3} cy={4} r={1.2} fill={color} />
    <Circle cx={2.3} cy={8} r={1.2} fill={color} />
    <Circle cx={2.3} cy={12} r={1.2} fill={color} />
  </Svg>
);
/** Seçim kutusunun oku (tarayıcıdaki select okunun yerine) */
export const OkIkon = ({ size = 12, color = C.asfalt }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 12 12">
    <Path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke={color} strokeWidth={1.8} />
  </Svg>
);
const TikIkon = ({ size = 14, color = C.beyaz }: IkonP) => (
  <Svg width={size} height={size} viewBox="0 0 14 14">
    <Path d="M3 7.2 5.8 10 11 4" fill="none" stroke={color} strokeWidth={2} />
  </Svg>
);

// ─────────────── Düğmeler

type BtnP = {
  baslik: string;
  tur?: 'koyu' | 'cizgi';
  ikon?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  yaziStil?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
};
/** .btn-koyu (asfalt zemin, sarı yazı) / .btn-cizgi (beyaz, 1.5px asfalt çizgi) */
export const Btn = ({ baslik, tur = 'koyu', ikon, onPress, disabled, style, yaziStil, accessibilityLabel, testID }: BtnP) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || baslik}
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [st.btn, tur === 'koyu' ? st.btnKoyu : st.btnCizgi, pressed && !disabled && st.basili, disabled && st.pasif, style]}>
    {ikon}
    <T style={[st.btnYazi, { color: tur === 'koyu' ? C.sari : C.asfalt }, yaziStil]}>{baslik}</T>
  </Pressable>
);

/** .link-btn: gri, 600 14px, altı çizili */
export const LinkBtn = ({ baslik, onPress, style, yaziStil, testID }: { baslik: string; onPress?: () => void; style?: StyleProp<ViewStyle>; yaziStil?: StyleProp<TextStyle>; testID?: string }) => (
  <Pressable testID={testID} accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [st.link, pressed && st.basili, style]}>
    <T style={[st.linkYazi, yaziStil]}>{baslik}</T>
  </Pressable>
);

// ─────────────── Üst çubuk

/** Sarı, yapışkan üst çubuk. Geri düğmesi varsa solda "‹ ..." ve sağda marka; yoksa solda marka, sağda `sag` */
/**
 * Sarı üst çubuk. Deneme sürümündeki "HafriyApp" yazısı yerine (kullanıcı isteği) doğrudan ana sayfaya dönüş:
 * firmalar listesinde solda "‹ Geri dön", diğer ekranlarda sağda "Ana sayfa".
 */
/** Firma tanıtımı ekranları ana sayfanın yığınında: en başa dön (yığın yoksa geri) */
export const anaSayfayaDon = (navigation: any) => {
  if (typeof navigation?.popToTop === 'function' && navigation.canGoBack?.()) navigation.popToTop();
  else if (navigation?.canGoBack?.()) navigation.goBack();
};

export const UstCubuk = ({ geri, sag, anaSayfa }: { geri?: { baslik: string; onPress: () => void }; sag?: React.ReactNode; anaSayfa?: () => void }) => {
  return (
    <View style={st.bar}>
      {geri ? (
        <>
          <Pressable accessibilityRole="button" onPress={geri.onPress} hitSlop={8} style={({ pressed }) => [st.geri, pressed && st.basili]}>
            <GeriIkon />
            <T style={st.geriYazi}>{geri.baslik}</T>
          </Pressable>
          <Pressable testID="ana-sayfa" accessibilityRole="button" accessibilityLabel="Ana sayfaya dön" onPress={anaSayfa} hitSlop={8} style={({ pressed }) => [st.anaSayfa, pressed && st.basili]}>
            <T style={st.anaSayfaYazi}>Ana sayfa</T>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable testID="geri-don" accessibilityRole="button" accessibilityLabel="Ana sayfaya dön" onPress={anaSayfa} hitSlop={8} style={({ pressed }) => [st.geri, pressed && st.basili]}>
            <GeriIkon />
            <T style={st.geriYazi}>Geri dön</T>
          </Pressable>
          {sag}
        </>
      )}
    </View>
  );
};

// ─────────────── Logo

type LogoP = { uri?: string | null; ad: string; boy: number; yazi: number; tip?: 'kart' | 'ust' };
/**
 * Yuvarlak logo. kart: sarı zemin + 2px beyaz kenar + 1px çizgi halkası (.logo).
 * ust: firma sayfasının sarı başlığında beyaz zemin + 2px asfalt halka (.detay-ust .halka.yok .logo).
 */
export const Logo = ({ uri, ad, boy, yazi, tip = 'kart' }: LogoP) => {
  const [bozuk, setBozuk] = useState(false);
  useEffect(() => setBozuk(false), [uri]);
  const ust = tip === 'ust';
  const kenar = ust ? 2.5 : 2;
  const ic = boy - kenar * 2;
  const icerik = uri && !bozuk ? (
    <Image source={{ uri }} style={{ width: ic, height: ic, borderRadius: ic / 2, backgroundColor: C.beyaz } as ImageStyle} resizeMode="cover" onError={() => setBozuk(true)} />
  ) : (
    <T style={{ fontFamily: F.c7, fontSize: yazi, color: C.asfalt }}>{basHarf(ad)}</T>
  );
  const disHalka = ust ? 2 : 1;
  return (
    <View style={[st.merkez, { width: boy + disHalka * 2, height: boy + disHalka * 2, borderRadius: boy / 2 + disHalka, backgroundColor: ust ? C.asfalt : C.cizgi }]}>
      <View style={[st.merkez, { width: boy, height: boy, borderRadius: boy / 2, backgroundColor: ust ? C.banner : C.beyaz }]}>
        <View style={[st.merkez, { width: ic, height: ic, borderRadius: ic / 2, overflow: 'hidden', backgroundColor: ust || (uri && !bozuk) ? C.beyaz : C.sari }]}>{icerik}</View>
      </View>
    </View>
  );
};

// ─────────────── Yıldızlar

/** Ortalama puan: gri ★★★★★ üstüne puan/5 genişliğinde dolu yıldızlar */
export const Yildizlar = ({ puan, size = 15, dolu = C.sari, bos = C.bosYildiz }: { puan: number; size?: number; dolu?: string; bos?: string }) => {
  const [gen, setGen] = useState(0);
  const yuzde = Math.max(0, Math.min(100, (puan / 5) * 100));
  const yazi = { fontSize: size, letterSpacing: 1, lineHeight: size * 1.15 };
  return (
    <View accessible accessibilityLabel={`5 üzerinden ${puanYaz(puan)} puan`} onLayout={e => setGen(e.nativeEvent.layout.width)}>
      <T style={[yazi, { color: bos }]}>★★★★★</T>
      <View style={[StyleSheet.absoluteFill, { width: `${yuzde}%`, overflow: 'hidden' }]}>
        <T numberOfLines={1} style={[yazi, { color: dolu, width: gen || undefined }]}>
          ★★★★★
        </T>
      </View>
    </View>
  );
};
/** 4.8 → "4,8" */
export const puanYaz = (p: number): string => (Math.round(p * 10) / 10).toFixed(1).replace('.', ',');

// ─────────────── Giriş kutusu

type GirisP = TextInputProps & { hatali?: boolean; kutuStil?: StyleProp<TextStyle> };
/** Çerçeveli giriş kutusu: odakta asfalt çizgi + 3px sarı halka, hatada kırmızı çizgi */
export const Giris = React.forwardRef<TextInput, GirisP>(({ hatali, style, onFocus, onBlur, multiline, ...p }, ref) => {
  const [odak, setOdak] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={C.yerTutucu}
      maxFontSizeMultiplier={1.4}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      underlineColorAndroid="transparent"
      {...p}
      onFocus={e => {
        setOdak(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setOdak(false);
        onBlur?.(e);
      }}
      style={[st.giris, odak && st.girisOdak, hatali && st.girisHata, style]}
    />
  );
});

// ─────────────── Onay kutusu

export const OnayKutusu = ({ secili, onChange, baslik }: { secili: boolean; onChange: (v: boolean) => void; baslik: string }) => (
  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: secili }} onPress={() => onChange(!secili)} style={st.onay} hitSlop={6}>
    <View style={[st.onayKutu, secili && st.onayKutuSecili]}>{secili ? <TikIkon /> : null}</View>
    <T style={st.onayYazi}>{baslik}</T>
  </Pressable>
);

// ─────────────── Seçim kutusu (select)

export type Secenek = { value: string; label: string };
type SecimP = { value: string; secenekler: Secenek[]; onChange: (v: string) => void; baslik: string; style?: StyleProp<ViewStyle>; yaziStil?: StyleProp<TextStyle>; accessibilityLabel?: string; testID?: string };
/** Tarayıcıdaki <select> yerine: kutuya dokununca seçenekler pencerede açılır */
export const SecimKutusu = ({ value, secenekler, onChange, baslik, style, yaziStil, accessibilityLabel, testID }: SecimP) => {
  const [acik, setAcik] = useState(false);
  const secili = secenekler.find(s => s.value === value) || secenekler[0];
  return (
    <>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || baslik} onPress={() => setAcik(true)} style={[st.giris, st.secim, acik && st.girisOdak, style]}>
        <T numberOfLines={1} style={[st.secimYazi, yaziStil]}>
          {secili?.label ?? ''}
        </T>
        <OkIkon />
      </Pressable>
      <Modal visible={acik} transparent animationType="fade" onRequestClose={() => setAcik(false)} statusBarTranslucent>
        <Pressable style={st.perde} onPress={() => setAcik(false)}>
          <Pressable style={[st.pencere, { maxHeight: '70%' }]} onPress={() => {}}>
            <View style={st.pencereUst}>
              <T style={st.pencereBaslik}>{baslik}</T>
              <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => setAcik(false)} style={st.kapat} hitSlop={6}>
                <T style={st.kapatYazi}>×</T>
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 6 }}>
              {secenekler.map(s => (
                <Pressable
                  key={s.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: s.value === value }}
                  onPress={() => {
                    setAcik(false);
                    if (s.value !== value) onChange(s.value);
                  }}
                  style={({ pressed }) => [st.secenek, s.value === value && st.secenekSecili, pressed && { backgroundColor: C.soluk }]}>
                  <T style={[st.secenekYazi, s.value === value && { fontFamily: F.sb }]}>{s.label}</T>
                  {s.value === value ? <TikIkon color={C.asfalt} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

// ─────────────── Pencere kabuğu (.md-kutu)

/** Ortak pencere: başlık + gri alt satır, ×, 3px sarı alt çizgi; gövde kayar; altta düğme satırı */
export const Pencere = ({ gorunur, onKapat, baslik, alt, children, altDugmeler, altBosluk = 0 }: { gorunur: boolean; onKapat: () => void; baslik: string; alt?: string; children: React.ReactNode; altDugmeler?: React.ReactNode; altBosluk?: number }) => {
  const olcek = useRef(new Animated.Value(0.96)).current;
  useEffect(() => {
    if (gorunur) {
      olcek.setValue(0.96);
      Animated.timing(olcek, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }
  }, [gorunur, olcek]);
  return (
    <Modal visible={gorunur} transparent animationType="fade" onRequestClose={onKapat} statusBarTranslucent>
      <Pressable style={st.perde} onPress={onKapat} accessibilityLabel="Kapat">
        <Animated.View style={[st.pencere, { transform: [{ scale: olcek }] }]}>
          <Pressable onPress={() => {}} style={{ flexShrink: 1 }}>
            <View style={st.pencereUst}>
              <View style={{ flex: 1 }}>
                <T style={st.pencereBaslik} accessibilityRole="header">
                  {baslik}
                </T>
                {alt ? <T style={st.pencereAlt}>{alt}</T> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={onKapat} style={st.kapat} hitSlop={6}>
                <T style={st.kapatYazi}>×</T>
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={st.pencereGovde}>
              {children}
            </ScrollView>
            {altDugmeler ? <View style={[st.pencereAltSatir, { paddingBottom: 12 + altBosluk }]}>{altDugmeler}</View> : null}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// ─────────────── Bildirim (toast)

/** Alttan kayan koyu bildirim (90px yukarıda, 3,2 sn) */
export const useToast = () => {
  const [mesaj, setMesaj] = useState('');
  const gor = useRef(new Animated.Value(0)).current;
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goster = useCallback(
    (m: string, sure = 3200) => {
      setMesaj(m);
      if (zaman.current) clearTimeout(zaman.current);
      Animated.timing(gor, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      zaman.current = setTimeout(() => {
        Animated.timing(gor, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }, sure);
    },
    [gor],
  );
  useEffect(
    () => () => {
      if (zaman.current) clearTimeout(zaman.current);
    },
    [],
  );
  const el = mesaj ? (
    <View pointerEvents="none" style={st.toastKap}>
      <Animated.View accessibilityLiveRegion="polite" style={[st.toast, { opacity: gor, transform: [{ translateY: gor.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <T style={st.toastYazi}>{mesaj}</T>
      </Animated.View>
    </View>
  ) : null;
  return { toast: el, goster };
};

// ─────────────── Oranını kendisi bulan görsel

/** Tam genişlikte görsel; yüksekliği görselin kendi oranından (yüklenince) hesaplanır */
export const OranliGorsel = ({ uri, oran, style }: { uri: string; oran?: number | null; style?: StyleProp<ImageStyle> }) => {
  const [r, setR] = useState<number | null>(oran || null);
  useEffect(() => {
    if (oran) setR(oran);
  }, [oran]);
  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      onLoad={e => {
        const s: any = e?.nativeEvent?.source;
        if (s?.width && s?.height) setR(s.width / s.height);
      }}
      style={[{ width: '100%', aspectRatio: r || 4 / 3, backgroundColor: '#ddd' }, style]}
    />
  );
};

const st = StyleSheet.create({
  t: { fontFamily: F.r, color: C.asfalt, includeFontPadding: false },
  merkez: { alignItems: 'center', justifyContent: 'center' },
  basili: { opacity: 0.75 },
  pasif: { opacity: 0.6 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 14 },
  btnKoyu: { backgroundColor: C.asfalt },
  btnCizgi: { backgroundColor: C.beyaz, borderWidth: 1.5, borderColor: C.asfalt },
  btnYazi: { fontFamily: F.sb, fontSize: 15, lineHeight: 19 },
  link: { paddingVertical: 4, alignSelf: 'flex-start' },
  linkYazi: { fontFamily: F.sb, fontSize: 14, color: C.gri, textDecorationLine: 'underline' },
  bar: { backgroundColor: C.sari, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 3, borderBottomColor: C.asfalt, minHeight: 60, zIndex: 20 },
  marka: { fontFamily: F.c7, fontSize: 22 },
  anaSayfa: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1.5, borderColor: C.asfalt },
  anaSayfaYazi: { fontFamily: F.sb, fontSize: 14 },
  geri: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, flexShrink: 1 },
  geriYazi: { fontFamily: F.sb, fontSize: 16 },
  giris: { fontFamily: F.r, fontSize: 16, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1.5, borderColor: C.cizgi, borderRadius: 4, backgroundColor: C.beyaz, color: C.asfalt },
  girisOdak: { borderColor: C.asfalt, boxShadow: ODAK_HALKA },
  girisHata: { borderColor: C.hata },
  secim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  secimYazi: { flex: 1, fontSize: 16 },
  onay: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  onayKutu: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: C.asfalt, backgroundColor: C.beyaz, alignItems: 'center', justifyContent: 'center' },
  onayKutuSecili: { backgroundColor: C.asfalt },
  onayYazi: { fontSize: 15 },
  perde: { flex: 1, backgroundColor: C.perde, justifyContent: 'center', padding: 12 },
  pencere: { backgroundColor: C.beyaz, width: '100%', maxWidth: 520, maxHeight: '92%', alignSelf: 'center', borderRadius: 12, overflow: 'hidden', boxShadow: PENCERE_GOLGE },
  pencereUst: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 3, borderBottomColor: C.sari },
  pencereBaslik: { fontFamily: F.c7, fontSize: 28, lineHeight: 30 },
  pencereAlt: { color: C.gri, fontSize: 14, marginTop: 3 },
  kapat: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
  kapatYazi: { fontSize: 32, lineHeight: 34, color: C.asfalt },
  pencereGovde: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16 },
  pencereAltSatir: { flexDirection: 'row', gap: 10, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: C.cizgi },
  secenek: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 },
  secenekSecili: { backgroundColor: C.soluk },
  secenekYazi: { fontSize: 16 },
  toastKap: { position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center', zIndex: 50 },
  toast: { backgroundColor: C.asfalt, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 4, maxWidth: '90%' },
  toastYazi: { color: C.beyaz, fontFamily: F.m, fontSize: 16, lineHeight: 22 },
});
