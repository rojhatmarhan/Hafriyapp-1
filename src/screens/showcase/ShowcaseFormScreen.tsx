// "Firmanı tanıt" / "Firmanı düzenle" formu ve önizlemesi (deneme sürümündeki "form" ve "onizleme").
// Önizleme aynı ekranda ayrı bir görünümdür (taslak ekranlar arasında taşınmaz). Yayınla = PUT api/Showcase/my.
// iOS'ta bir Modal üstüne ikinci Modal açılamaz: bu ekranda aynı anda yalnızca bir pencere (birim seçimi ya da fiyat listesi) açılır.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { launchImageLibrary, PhotoQuality } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import Svg, { Line } from 'react-native-svg';
import { C, F } from './theme';
import { Btn, Giris, LinkBtn, Logo, OnayKutusu, SecimKutusu, T, UstCubuk, anaSayfayaDon, useToast } from './ui';
import ShowcaseDetailView, { FiyatPenceresi, taslaktanFiyat, taslaktanGorunum } from './ShowcaseDetailView';
import { alanDegistir, bosFiyatSatiri, dogrula, Hatalar, ilkHataBolumu, kapakYap, kayitGovdesi, MAX_ETIKET, MAX_FIYAT_SATIR, MAX_FOTO, MAX_TELEFON, sayfadanTaslak, Slot, Taslak, yeniTaslak } from './showcaseDraft';
import { getMyShowcase, getShowcaseOptions, markShowcaseChanged, saveMyShowcase, ShowcaseOptions, showcaseHata } from '../../services/showcaseService';
import { FotoSablon, ilOnerileri, illeriSirala, sablonAl } from '../../utils/showcaseFormat';

const FOTO_HATA = 'Fotoğraf açılamadı. JPG veya PNG bir dosya seçin.';
const HEIC_HATA = 'Bu fotoğraf HEIC formatında. Telefonda JPG olarak kaydedip tekrar deneyin.';

/** Başlık kutusunun kesik alt çizgisi (RN tek kenarda kesik çizgi çizemiyor) */
const KesikCizgi = ({ odak }: { odak: boolean }) =>
  odak ? (
    <View style={{ height: 2, backgroundColor: C.asfalt }} />
  ) : (
    <Svg height={2} width="100%">
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={C.kesik} strokeWidth={1.5} strokeDasharray="5,4" />
    </Svg>
  );

type SlotP = {
  s: Slot;
  i: number;
  sab: FotoSablon[];
  kapak: boolean;
  onBaslik: (v: string) => void;
  onBaslikSil: () => void;
  onAciklama: (v: string) => void;
  onSec: () => void;
  onKapak: () => void;
  onSil: () => void;
};

/** Fotoğraf yuvası (.slot) */
const FotoYuvasi = ({ s, i, sab, kapak, onBaslik, onBaslikSil, onAciklama, onSec, onKapak, onSil }: SlotP) => {
  const [odak, setOdak] = useState(false);
  const sb = sab[s.sablon] || { title: '', hint: '', example: '' };
  const not = s.ozel ? (s.baslik.trim() ? 'Kendi başlığınız' : 'Başlıksız fotoğraf. Dilerseniz bir başlık yazın.') : 'Önerilen başlık. Silip kendi başlığınızı yazabilirsiniz.';
  return (
    <View style={[f.slot, s.uri ? f.slotDolu : null]}>
      <View style={f.slotUst}>
        <View style={f.slotNo}>
          <T style={f.slotNoYazi}>{i + 1}</T>
        </View>
        <View style={f.baslikKutu}>
          <TextInput
            accessibilityLabel={`Fotoğraf ${i + 1} başlığı`}
            value={s.baslik}
            onChangeText={onBaslik}
            maxLength={80}
            placeholder={`Örn. ${sb.title}`}
            placeholderTextColor={C.yerTutucu}
            autoCorrect={false}
            onFocus={() => setOdak(true)}
            onBlur={() => setOdak(false)}
            maxFontSizeMultiplier={1.4}
            underlineColorAndroid="transparent"
            style={[f.baslikGiris, s.baslik ? null : f.baslikBos]}
          />
          <KesikCizgi odak={odak} />
          {s.baslik ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Fotoğraf ${i + 1} başlığını sil`} onPress={onBaslikSil} style={f.baslikTemizle} hitSlop={4}>
              <T style={f.baslikTemizleYazi}>×</T>
            </Pressable>
          ) : null}
        </View>
      </View>
      <T style={f.baslikNot}>{not}</T>
      {s.uri ? (
        <View style={f.slotIcerik}>
          <View>
            <ImageKucuk uri={s.uri} />
            {kapak ? (
              <View style={f.kapakRozet}>
                <T style={f.kapakRozetYazi}>Kapak</T>
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Giris
              accessibilityLabel={`${s.baslik || 'Fotoğraf'} açıklaması`}
              value={s.aciklama}
              onChangeText={onAciklama}
              multiline
              scrollEnabled={false}
              maxLength={500}
              placeholder={`Örn. ${sb.example}`}
              style={f.aciklama}
            />
            <View style={f.fotoIslem}>
              {kapak ? null : <LinkBtn baslik="Kapak yap" onPress={onKapak} />}
              <LinkBtn baslik="Değiştir" onPress={onSec} />
              <LinkBtn baslik="Sil" onPress={onSil} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" disabled={s.yukleniyor} onPress={onSec} style={({ pressed }) => [f.slotEkle, pressed && { borderColor: C.asfalt }]}>
          <T style={f.slotEkleYazi}>{s.yukleniyor ? 'Fotoğraf hazırlanıyor…' : '+ Fotoğraf ekle'}</T>
          {sb.hint ? <T style={f.slotEkleAlt}>{sb.hint}</T> : null}
        </Pressable>
      )}
    </View>
  );
};

const ImageKucuk = ({ uri }: { uri: string }) => <Image source={{ uri }} style={f.kucuk} resizeMode="cover" />;

const Etiket = ({ children, sayac }: { children: React.ReactNode; sayac?: string }) => (
  <T style={f.etiket}>
    {children}
    {sayac ? <T style={f.sayac}> {sayac}</T> : null}
  </T>
);
const Ipucu = ({ children, style }: { children: React.ReactNode; style?: any }) => <T style={[f.ipucu, style]}>{children}</T>;
const HataYazi = ({ m, style }: { m?: string; style?: any }) => (m ? <T style={[f.hata, style]}>{m}</T> : null);

export default function ShowcaseFormScreen({ navigation, route }: any) {
  const companyIdParam: string | null = route?.params?.companyId ?? null;
  const geldigiYer: string = route?.params?.from || 'list';
  const insets = useSafeAreaInsets();
  const sekmeYuk = React.useContext(BottomTabBarHeightContext);
  const altBosluk = sekmeYuk ? 0 : insets.bottom;
  const { width } = useWindowDimensions();
  const darTel = width <= 420;
  const darFiyat = width < 480;

  const [secenek, setSecenek] = useState<ShowcaseOptions | null>(null);
  const [t, setT] = useState<Taslak | null>(null);
  const [yukHata, setYukHata] = useState<string | null>(null);
  const [h, setH] = useState<Hatalar>({});
  const [mod, setMod] = useState<'form' | 'onizleme'>('form');
  const [yayinda, setYayinda] = useState(false);
  const [ilAra, setIlAra] = useState('');
  const [fiyatAcik, setFiyatAcik] = useState(false);
  const kaydir = useRef<ScrollView>(null);
  const bolumY = useRef<Record<string, number>>({});
  const modRef = useRef(mod);
  modRef.current = mod;
  const cikis = useRef(false);
  const ilGirisRef = useRef<TextInput>(null);
  const { toast, goster } = useToast();

  const yukle = useCallback(async () => {
    setYukHata(null);
    try {
      const [o, my] = await Promise.all([getShowcaseOptions(), getMyShowcase(companyIdParam)]);
      if (!my.canCreate) {
        Alert.alert('Firmanı tanıt', my.reason || 'Firma sayfası sadece firma sahipleri ve yetkilileri tarafından oluşturulabilir.');
        cikis.current = true;
        navigation.goBack();
        return;
      }
      setSecenek(o);
      setT(my.showcase ? sayfadanTaslak(my.showcase, o.templates, my.companyId) : yeniTaslak(o.templates, my));
    } catch (e) {
      setYukHata(showcaseHata(e, 'Firma sayfanız yüklenemedi.'));
    }
  }, [companyIdParam, navigation]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // Önizlemedeyken geri tuşu/kaydırma düzenlemeye döner
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e: any) => {
        if (modRef.current === 'onizleme' && !cikis.current) {
          e.preventDefault();
          setMod('form');
        }
      }),
    [navigation],
  );

  // Önizlemede iOS kaydırarak geri hareketi kapalı (taslak kaybolmasın; "Düzenlemeye dön" ya da geri tuşu forma döner)
  useEffect(() => {
    navigation.setOptions?.({ gestureEnabled: mod !== 'onizleme' });
  }, [mod, navigation]);

  const sablonlar = useMemo(() => secenek?.templates || {}, [secenek]);
  const sab = useMemo(() => sablonAl(sablonlar, t?.alanlar || []), [sablonlar, t?.alanlar]);
  const iller = useMemo(() => secenek?.provinces || [], [secenek]);
  const birimler = useMemo(() => (secenek?.units?.length ? secenek.units : ['sefer', 'saat', 'gün', 'ay', 'ton', 'm³', 'adet', 'km', '']).map(u => ({ value: u, label: u || 'birimsiz' })), [secenek]);
  const alanlar = secenek?.areas?.length ? secenek.areas : ['Hafriyat', 'Kum ve çakıl ocağı', 'Taş ocağı', 'İş makinesi kiralama', 'Nakliye', 'Hazır beton', 'Yıkım', 'Diğer'];

  const guncelle = (fn: (x: Taslak) => Taslak, ...hataAnahtar: string[]) => {
    setT(x => (x ? fn(x) : x));
    if (hataAnahtar.length) {
      setH(onceki => {
        const yeni = { ...onceki };
        let degisti = false;
        Object.keys(yeni).forEach(k => {
          if (hataAnahtar.some(a => k === a || (a.endsWith('*') && k.startsWith(a.slice(0, -1))))) {
            delete yeni[k];
            degisti = true;
          }
        });
        return degisti ? yeni : onceki;
      });
    }
  };
  const slotGuncelle = (i: number, p: Partial<Slot>) => guncelle(x => ({ ...x, slotlar: x.slotlar.map((s, k) => (k === i ? { ...s, ...p } : s)) }), 'fotolar');

  const vazgec = () => {
    cikis.current = true;
    navigation.goBack();
  };

  // ── Görsel seçimi (logo 320 px / 0,85; fotoğraf 1000 px / 0,7)
  const gorselSec = (hedef: 'logo' | number) => {
    const logo = hedef === 'logo';
    if (!logo) slotGuncelle(hedef, { yukleniyor: true });
    const birak = () => {
      if (!logo) slotGuncelle(hedef, { yukleniyor: false });
    };
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, selectionLimit: 1, maxWidth: logo ? 320 : 1000, maxHeight: logo ? 320 : 1000, quality: (logo ? 0.85 : 0.7) as PhotoQuality },
      res => {
        if (res.didCancel) return birak();
        const a = res.assets?.[0];
        if (res.errorCode || !a?.base64) {
          birak();
          goster(/\.(heic|heif)$/i.test(a?.fileName || '') ? HEIC_HATA : FOTO_HATA);
          return;
        }
        const tip = a.type && /^image\/(png|webp)$/i.test(a.type) ? a.type.toLowerCase() : 'image/jpeg';
        const veri = `data:${tip};base64,${a.base64}`;
        const uri = a.uri || veri;
        if (logo) guncelle(x => ({ ...x, logo: { uri, tur: 'yeni', veri } }));
        else slotGuncelle(hedef, { uri, yeni: veri, oran: a.width && a.height ? a.width / a.height : null, yukleniyor: false });
      },
    ).catch(() => {
      birak();
      goster(FOTO_HATA);
    });
  };

  const ilEkle = (code: number) => {
    guncelle(x => (x.iller.includes(code) ? x : { ...x, iller: illeriSirala([...x.iller, code], iller) }), 'iller');
    setIlAra('');
    ilGirisRef.current?.focus();
  };
  const oneriler = useMemo(() => (t ? ilOnerileri(ilAra, iller, t.iller) : []), [ilAra, iller, t]);

  const onizle = () => {
    if (!t) return;
    Keyboard.dismiss();
    const hata = dogrula(t);
    setH(hata);
    const bolum = ilkHataBolumu(hata);
    if (bolum) {
      const y = bolumY.current[bolum];
      if (y != null) kaydir.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
      return;
    }
    setMod('onizleme');
  };

  const yayinla = async () => {
    if (!t || yayinda) return;
    setYayinda(true);
    try {
      const d = await saveMyShowcase(kayitGovdesi(t));
      markShowcaseChanged();
      cikis.current = true;
      const params = { id: d.id, toast: t.duzenleme ? 'Değişiklikler yayınlandı.' : 'Firmanız yayınlandı.', toastKey: Date.now() };
      if (geldigiYer === 'detail' && typeof navigation.popTo === 'function') navigation.popTo('ShowcaseDetail', params);
      else if (typeof navigation.replace === 'function') navigation.replace('ShowcaseDetail', params);
      else navigation.navigate('ShowcaseDetail', params);
    } catch (e) {
      setYayinda(false);
      Alert.alert('Yayınlanamadı', showcaseHata(e, 'Firma sayfası kaydedilemedi. Lütfen tekrar deneyin.'));
    }
  };

  const geriBaslik = mod === 'onizleme' ? 'Düzenlemeye dön' : t?.duzenleme && geldigiYer === 'detail' ? 'Firma sayfası' : 'Firmalar';
  const geriBas = () => (mod === 'onizleme' ? setMod('form') : vazgec());

  if (!t || !secenek) {
    return (
      <View style={f.kap}>
        <UstCubuk anaSayfa={() => anaSayfayaDon(navigation)} geri={{ baslik: geldigiYer === 'detail' ? 'Firma sayfası' : 'Firmalar', onPress: vazgec }} />
        {yukHata ? (
          <View style={f.bosKap}>
            <T style={f.bosYazi}>{yukHata}</T>
            <Btn tur="cizgi" baslik="Tekrar dene" onPress={yukle} style={{ marginTop: 12 }} />
          </View>
        ) : (
          <ActivityIndicator color={C.asfalt} style={{ marginTop: 40 }} />
        )}
      </View>
    );
  }

  const altBar = (sol: React.ReactNode, sag: React.ReactNode) => (
    <View style={[f.altBar, { paddingBottom: 12 + altBosluk }]}>
      {sol}
      {sag}
    </View>
  );

  if (mod === 'onizleme') {
    return (
      <View style={f.kap}>
        <UstCubuk anaSayfa={() => anaSayfayaDon(navigation)} geri={{ baslik: geriBaslik, onPress: geriBas }} />
        <ScrollView>
          <ShowcaseDetailView g={taslaktanGorunum(t, iller)} onizleme duzenleme={t.duzenleme} onFiyat={() => setFiyatAcik(true)} />
        </ScrollView>
        {altBar(<Btn tur="cizgi" baslik="Düzenle" onPress={() => setMod('form')} style={f.altBtn} disabled={yayinda} />, <Btn testID="yayinla" baslik={yayinda ? 'Yayınlanıyor…' : 'Yayınla'} onPress={yayinla} disabled={yayinda} style={f.altBtn} />)}
        <FiyatPenceresi gorunur={fiyatAcik} onKapat={() => setFiyatAcik(false)} veri={taslaktanFiyat(t)} ad={t.ad} altBosluk={insets.bottom} />
        {toast}
      </View>
    );
  }

  const n = t.slotlar.filter(s => s.uri).length;
  const ilkDolu = t.slotlar.findIndex(s => s.uri);
  const olc = (k: string) => (e: any) => {
    bolumY.current[k] = e.nativeEvent.layout.y;
  };
  const ilAdi = new Map(iller.map(il => [il.code, il.name]));

  return (
    <View style={f.kap}>
      <UstCubuk anaSayfa={() => anaSayfayaDon(navigation)} geri={{ baslik: geriBaslik, onPress: geriBas }} />
      <ScrollView ref={kaydir} contentContainerStyle={f.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View>
          <T style={f.h1} accessibilityRole="header">
            {t.duzenleme ? 'Firmanı düzenle' : 'Firmanı tanıt'}
          </T>
          {/* TODO Faz 3: hikayeler gelince düzenleme metnine "Hikayeleriniz etkilenmez." eklenecek (deneme sürümündeki gibi) */}
          <T style={f.altBaslik}>{t.duzenleme ? 'Değişikliklerinizi yapın, önizleyin ve yeniden yayınlayın.' : 'Boşlukları doldurun, önizleyin ve yayınlayın. Sayfanız firmalar listesinde görünecek.'}</T>
        </View>

        {/* Firma logosu */}
        <View>
          <Etiket>Firma logosu</Etiket>
          <View style={f.logoSec}>
            <Logo uri={t.logo?.uri} ad={t.ad} boy={92} yazi={38} />
            <View style={f.logoKontrol}>
              <Btn tur="cizgi" baslik={t.logo ? 'Logoyu değiştir' : 'Logo yükle'} onPress={() => gorselSec('logo')} />
              {t.logo ? <LinkBtn baslik="Logoyu kaldır" onPress={() => guncelle(x => ({ ...x, logo: null }))} /> : null}
            </View>
          </View>
          <Ipucu>Kare bir görsel en iyi sonucu verir. Logo yüklemezseniz firma adının baş harfleri gösterilir.</Ipucu>
        </View>

        {/* Firma adı */}
        <View onLayout={olc('ad')}>
          <Etiket>Firma adı</Etiket>
          <Giris testID="firma-adi" accessibilityLabel="Firma adı" value={t.ad} onChangeText={v => guncelle(x => ({ ...x, ad: v }), 'ad')} maxLength={60} placeholder="Örn. Yıldız Hafriyat" hatali={!!h.ad} />
          <HataYazi m={h.ad} />
        </View>

        {/* İş alanları */}
        <View onLayout={olc('alanlar')}>
          <Etiket>İş alanları</Etiket>
          <View style={f.alanSecim}>
            {alanlar.map(a => {
              const on = t.alanlar.includes(a);
              return (
                <Pressable key={a} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => guncelle(x => alanDegistir(x, a, sablonlar), 'alanlar')} style={({ pressed }) => [f.alanCip, h.alanlar && f.alanCipHata, on && f.alanCipSecili, pressed && !on && { borderColor: C.asfalt }]}>
                  <T style={[f.alanCipYazi, on && { color: C.sari }]}>{(on ? '✓ ' : '') + a}</T>
                </Pressable>
              );
            })}
          </View>
          <Ipucu>Yaptığınız tüm işleri seçin. Fotoğraf başlıkları seçimlerinize göre değişir.</Ipucu>
          <HataYazi m={h.alanlar} />
        </View>

        {/* Profilde görünecek etiketler */}
        {t.alanlar.length || t.etiketler.length ? (
          <View>
            <Etiket>Profilde görünecek etiketler</Etiket>
            <Ipucu style={f.ipucuUst}>Seçtiğiniz iş alanları buraya eklenir. İşinizi daha iyi anlatacak şekilde değiştirebilir, yeni etiket ekleyebilir ya da silebilirsiniz.</Ipucu>
            <View style={{ gap: 8 }}>
              {t.etiketler.map((e, i) => (
                <View key={i} style={f.etiketSatir}>
                  <View style={f.etiketOnizle} />
                  <Giris accessibilityLabel={`Etiket ${i + 1}`} value={e.metin} onChangeText={v => guncelle(x => ({ ...x, etiketler: x.etiketler.map((y, k) => (k === i ? { ...y, metin: v } : y)) }))} maxLength={30} placeholder="Örn. Temel kazısı ve dolgu" style={[f.kucukGiris, { flex: 1 }]} />
                  <SilX etiket={`Etiket ${i + 1} sil`} onPress={() => guncelle(x => ({ ...x, etiketler: x.etiketler.filter((_y, k) => k !== i) }))} />
                </View>
              ))}
            </View>
            {t.etiketler.length < MAX_ETIKET ? <LinkBtn baslik="+ Etiket ekle" onPress={() => guncelle(x => ({ ...x, etiketler: [...x.etiketler, { metin: '', alan: null }] }))} style={{ marginTop: 6 }} /> : <Ipucu>En fazla {MAX_ETIKET} etiket eklenebilir.</Ipucu>}
            <Ipucu>Boş bıraktığınız etiketler görünmez. Hiç etiket yazmazsanız seçtiğiniz iş alanları gösterilir.</Ipucu>
          </View>
        ) : null}

        {/* Hizmet verdiğiniz iller */}
        <View onLayout={olc('iller')}>
          <Etiket>Hizmet verdiğiniz iller</Etiket>
          <Ipucu style={f.ipucuUst}>Firmanız ana sayfada seçtiğiniz her ilin filtresinde görünür. Birden fazla il seçebilirsiniz.</Ipucu>
          {t.iller.length ? (
            <View style={f.ilSecili}>
              {t.iller.map(k => (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={`${ilAdi.get(k)} ilini kaldır`} onPress={() => guncelle(x => ({ ...x, iller: x.iller.filter(y => y !== k) }))} style={f.ilCip}>
                  <T style={f.ilCipYazi}>{ilAdi.get(k) || k} ×</T>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Giris
            ref={ilGirisRef}
            testID="il-ara"
            accessibilityLabel="Hizmet verdiğiniz iller"
            value={ilAra}
            onChangeText={setIlAra}
            placeholder="İl adı yazın, örn. Kocaeli"
            autoCorrect={false}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => {
              if (oneriler[0]) ilEkle(oneriler[0].code);
            }}
            hatali={!!h.iller}
          />
          {ilAra.trim() ? (
            <View style={f.ilOneri}>
              {oneriler.length ? (
                oneriler.map(il => (
                  <Pressable key={il.code} accessibilityRole="button" onPress={() => ilEkle(il.code)} style={({ pressed }) => [f.ilCip, f.ilCipOneri, pressed && { borderColor: C.asfalt }]}>
                    <T style={[f.ilCipYazi, { color: C.asfalt, fontFamily: F.m }]}>+ {il.name}</T>
                  </Pressable>
                ))
              ) : (
                <Ipucu style={{ marginTop: 0 }}>Eşleşen il bulunamadı.</Ipucu>
              )}
            </View>
          ) : null}
          <HataYazi m={h.iller} />
        </View>

        {/* Adres */}
        <View>
          <Etiket sayac="(isteğe bağlı)">Firma adresi</Etiket>
          <Giris accessibilityLabel="Firma adresi" value={t.adres} onChangeText={v => guncelle(x => ({ ...x, adres: v }))} multiline numberOfLines={2} maxLength={160} placeholder="Mahalle, sokak, no, ilçe / il" style={{ minHeight: 70 }} />
          <Ipucu>Açık adres profilinizde harita bağlantısıyla gösterilir. Filtrelemede yukarıda seçtiğiniz iller kullanılır.</Ipucu>
        </View>

        {/* İletişim */}
        <View onLayout={olc('iletisim')}>
          <Etiket>İletişim</Etiket>
          <View style={{ gap: 12 }}>
            <View style={{ gap: 14 }}>
              {t.telefonlar.map((x, i) => {
                const numara = (
                  <Giris
                    accessibilityLabel={`Telefon ${i + 1}`}
                    value={x.numara}
                    onChangeText={v => guncelle(y => ({ ...y, telefonlar: y.telefonlar.map((z, k) => (k === i ? { ...z, numara: v } : z)) }), 'tel' + i)}
                    keyboardType="phone-pad"
                    maxLength={20}
                    placeholder={`${i ? 'Diğer numara' : 'Telefon'}, örn. 0532 123 45 67`}
                    hatali={!!h['tel' + i]}
                    style={darTel ? undefined : { flex: 1.2 }}
                  />
                );
                const etiket = <Giris accessibilityLabel={`Telefon ${i + 1} açıklaması`} value={x.etiket} onChangeText={v => guncelle(y => ({ ...y, telefonlar: y.telefonlar.map((z, k) => (k === i ? { ...z, etiket: v } : z)) }))} maxLength={24} placeholder="Açıklama, örn. Şantiye" style={darTel ? undefined : { flex: 1 }} />;
                const sil = t.telefonlar.length > 1 ? <SilX etiket={`Telefon ${i + 1} sil`} onPress={() => guncelle(y => ({ ...y, telefonlar: y.telefonlar.filter((_z, k) => k !== i) }), 'tel*')} /> : <View style={{ width: 34 }} />;
                return (
                  <View key={i}>
                    {darTel ? (
                      <View style={f.telSatirDar}>
                        <View style={{ flex: 1, gap: 6 }}>
                          {numara}
                          {etiket}
                        </View>
                        {sil}
                      </View>
                    ) : (
                      <View style={f.telSatir}>
                        {numara}
                        {etiket}
                        {sil}
                      </View>
                    )}
                    <HataYazi m={h['tel' + i]} style={{ marginTop: 6 }} />
                  </View>
                );
              })}
              {t.telefonlar.length < MAX_TELEFON ? <LinkBtn baslik="+ Numara ekle" onPress={() => guncelle(y => ({ ...y, telefonlar: [...y.telefonlar, { numara: '', etiket: '' }] }))} /> : <Ipucu style={{ marginTop: 0 }}>En fazla {MAX_TELEFON} numara eklenebilir.</Ipucu>}
            </View>
            <View>
              <Giris accessibilityLabel="E-posta" value={t.eposta} onChangeText={v => guncelle(y => ({ ...y, eposta: v }), 'eposta')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={80} placeholder="E-posta (isteğe bağlı)" hatali={!!h.eposta} />
              <HataYazi m={h.eposta} />
            </View>
          </View>
          <Ipucu>Numaralar isteğe bağlıdır. Ofis, şantiye ya da kişi adı gibi bir açıklama ekleyebilirsiniz. Cep numaralarının yanında WhatsApp bağlantısı da görünür.</Ipucu>
        </View>

        {/* Fotoğraflar */}
        <View onLayout={olc('fotolar')}>
          <Etiket sayac={`${n}/${MAX_FOTO}`}>Fotoğraflar</Etiket>
          <Ipucu style={{ marginTop: 0 }}>Her başlığa uygun bir fotoğraf ekleyin. Başlıkları dilediğiniz gibi değiştirebilir, boş bıraktıklarınızı atlayabilirsiniz. İlk fotoğraf listede kapak olur.</Ipucu>
          <View style={f.slotlar}>
            {t.slotlar.map((s, i) => (
              <FotoYuvasi
                key={`${s.sablon}-${i}`}
                s={s}
                i={i}
                sab={sab}
                kapak={i === ilkDolu}
                onBaslik={v => slotGuncelle(i, { baslik: v, ozel: true })}
                onBaslikSil={() => slotGuncelle(i, { baslik: '', ozel: true })}
                onAciklama={v => slotGuncelle(i, { aciklama: v })}
                onSec={() => gorselSec(i)}
                onKapak={() => guncelle(x => kapakYap(x, i))}
                onSil={() => slotGuncelle(i, { uri: null, yeni: null, fotoId: null, oran: null, aciklama: '' })}
              />
            ))}
          </View>
          <HataYazi m={h.fotolar} />
        </View>

        {/* Fiyat listesi */}
        <View onLayout={olc('fiyat')}>
          {!t.fiyatAcik ? (
            <>
              <Etiket sayac="(isteğe bağlı)">Fiyat listesi</Etiket>
              <Pressable accessibilityRole="button" onPress={() => guncelle(x => ({ ...x, fiyatAcik: true, fiyatDegisti: true, fiyatlar: x.fiyatlar.length ? x.fiyatlar : [bosFiyatSatiri()] }))} style={({ pressed }) => [f.slotEkle, pressed && { borderColor: C.asfalt }]}>
                <T style={f.slotEkleYazi}>+ Fiyat listesi ekle</T>
                <T style={f.slotEkleAlt}>Ziyaretçiler fiyatlarınızı profilinizdeki "Fiyat listesi" düğmesiyle görür. Sayfada açıkça gösterilmez.</T>
              </Pressable>
            </>
          ) : (
            <>
              <Etiket>Fiyat listesi</Etiket>
              <Ipucu style={f.ipucuUst}>Her satıra bir hizmet ya da ürün yazın. Liste sayfada açıkça görünmez, ziyaretçiler düğmeyle açar.</Ipucu>
              <View style={f.fiyatBolum}>
                {darFiyat ? null : (
                  <View style={f.fiyatSatir}>
                    <T style={[f.fiyatBas, { flex: 1 }]}>Açıklama</T>
                    <T style={[f.fiyatBas, { width: 108 }]}>Birim fiyat (TL)</T>
                    <T style={[f.fiyatBas, { width: 96 }]}>Birim</T>
                    <View style={{ width: 34 }} />
                  </View>
                )}
                {t.fiyatlar.map((r, i) => {
                  const fy = (p: Partial<typeof r>) => guncelle(x => ({ ...x, fiyatDegisti: true, fiyatlar: x.fiyatlar.map((y, k) => (k === i ? { ...y, ...p } : y)) }), 'fy' + i, 'fya' + i, 'fyf' + i);
                  const aciklama = <Giris accessibilityLabel={`Satır ${i + 1} açıklama`} value={r.aciklama} onChangeText={v => fy({ aciklama: v })} maxLength={80} placeholder="Örn. Hafriyat taşıma, 10 km'ye kadar" hatali={!!h['fya' + i]} style={[f.kucukGiris, !darFiyat && { flex: 1 }]} />;
                  const fiyat = <Giris accessibilityLabel={`Satır ${i + 1} birim fiyat, TL`} value={r.fiyat} onChangeText={v => fy({ fiyat: v })} keyboardType="decimal-pad" placeholder="0" hatali={!!h['fyf' + i]} style={[f.kucukGiris, darFiyat ? { flex: 1 } : { width: 108 }]} />;
                  const birim = <SecimKutusu baslik={`Satır ${i + 1} birim`} value={r.birim} secenekler={birimler} onChange={v => fy({ birim: v })} style={[f.kucukGiris, darFiyat ? { flex: 1 } : { width: 96 }]} yaziStil={{ fontSize: 15 }} />;
                  const sil = <SilX etiket={`Satır ${i + 1} sil`} onPress={() => guncelle(x => ({ ...x, fiyatDegisti: true, fiyatlar: x.fiyatlar.filter((_y, k) => k !== i), fiyatAcik: x.fiyatlar.length > 1 }), 'fy*')} />;
                  return (
                    <View key={i}>
                      {darFiyat ? (
                        <View style={f.fiyatSatirDar}>
                          {aciklama}
                          <View style={f.fiyatSatir}>
                            {fiyat}
                            {birim}
                            {sil}
                          </View>
                        </View>
                      ) : (
                        <View style={f.fiyatSatir}>
                          {aciklama}
                          {fiyat}
                          {birim}
                          {sil}
                        </View>
                      )}
                      <HataYazi m={h['fy' + i]} style={{ marginTop: 6 }} />
                    </View>
                  );
                })}
                {t.fiyatlar.length < MAX_FIYAT_SATIR ? <LinkBtn baslik="+ Satır ekle" onPress={() => guncelle(x => ({ ...x, fiyatDegisti: true, fiyatlar: [...x.fiyatlar, bosFiyatSatiri()] }))} /> : <Ipucu style={{ marginTop: 0 }}>En fazla {MAX_FIYAT_SATIR} satır eklenebilir.</Ipucu>}
                <OnayKutusu secili={t.kdvDahil} onChange={v => guncelle(x => ({ ...x, kdvDahil: v, fiyatDegisti: true }))} baslik="Fiyatlara KDV dahil" />
              </View>
              <LinkBtn baslik="Fiyat listesini kaldır" onPress={() => guncelle(x => ({ ...x, fiyatlar: [], fiyatAcik: false, fiyatDegisti: true }), 'fy*')} />
            </>
          )}
        </View>

        <Ipucu>Yayınladığınız sayfayı uygulamayı kullanan herkes görebilir.</Ipucu>
      </ScrollView>
      {altBar(<Btn tur="cizgi" baslik="Vazgeç" onPress={vazgec} style={f.altBtn} />, <Btn testID="onizle" baslik="Önizle" onPress={onizle} style={f.altBtn} />)}
      {toast}
    </View>
  );
}

const SilX = ({ etiket, onPress }: { etiket: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={etiket} onPress={onPress} style={({ pressed }) => [f.silX, pressed && { opacity: 0.6 }]} hitSlop={4}>
    {({ pressed }) => <T style={[f.silXYazi, pressed && { color: C.hata }]}>×</T>}
  </Pressable>
);

const f = StyleSheet.create({
  kap: { flex: 1, backgroundColor: C.zemin },
  bosKap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  bosYazi: { textAlign: 'center', color: C.gri, fontSize: 16, lineHeight: 22 },
  form: { paddingTop: 22, paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  h1: { fontFamily: F.c7, fontSize: 34, lineHeight: 37 },
  altBaslik: { color: C.gri, marginTop: 6, fontSize: 15, lineHeight: 22 },
  etiket: { fontFamily: F.sb, fontSize: 15, marginBottom: 7 },
  sayac: { fontFamily: F.m, color: C.gri },
  ipucu: { fontSize: 13, color: C.gri, marginTop: 6, lineHeight: 18 },
  ipucuUst: { marginTop: 0, marginBottom: 10 },
  hata: { color: C.hata, fontSize: 14, fontFamily: F.m, marginTop: 6 },
  logoSec: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoKontrol: { gap: 6, alignItems: 'flex-start' },
  alanSecim: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alanCip: { borderWidth: 1.5, borderColor: C.cizgi, backgroundColor: C.beyaz, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  alanCipHata: { borderColor: C.hata },
  alanCipSecili: { backgroundColor: C.asfalt, borderColor: C.asfalt },
  alanCipYazi: { fontFamily: F.m, fontSize: 15, lineHeight: 19 },
  etiketSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  etiketOnizle: { width: 10, height: 28, borderRadius: 2, backgroundColor: C.asfalt },
  kucukGiris: { paddingVertical: 9, paddingHorizontal: 10, fontSize: 15, width: undefined },
  silX: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  silXYazi: { fontSize: 24, lineHeight: 26, color: C.gri },
  ilSecili: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  ilCip: { borderWidth: 1.5, borderColor: C.asfalt, backgroundColor: C.asfalt, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  ilCipOneri: { backgroundColor: C.beyaz, borderColor: C.cizgi },
  ilCipYazi: { fontFamily: F.sb, fontSize: 14, lineHeight: 18, color: C.sari },
  ilOneri: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  telSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  telSatirDar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: C.sari },
  slotlar: { gap: 12, marginTop: 12 },
  slot: { backgroundColor: C.beyaz, borderWidth: 1, borderColor: C.cizgi, borderRadius: 6, padding: 12, gap: 10 },
  slotDolu: { borderLeftWidth: 4, borderLeftColor: C.sari },
  slotUst: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotNo: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.asfalt, alignItems: 'center', justifyContent: 'center' },
  slotNoYazi: { fontFamily: F.c7, fontSize: 15, color: C.sari },
  baslikKutu: { flex: 1, minWidth: 0 },
  baslikGiris: { fontFamily: F.c7, fontSize: 20, color: C.asfalt, paddingVertical: 4, paddingLeft: 2, paddingRight: 34, minHeight: 36 },
  baslikBos: { fontFamily: F.m, fontSize: 15 },
  baslikTemizle: { position: 'absolute', right: 0, top: 3, width: 30, height: 30, borderRadius: 15, backgroundColor: C.cubuk, alignItems: 'center', justifyContent: 'center' },
  baslikTemizleYazi: { fontSize: 18, lineHeight: 20, color: C.asfalt },
  baslikNot: { fontSize: 12.5, lineHeight: 17, color: C.gri, marginTop: -4 },
  slotEkle: { width: '100%', borderWidth: 2, borderStyle: 'dashed', borderColor: C.kesik, backgroundColor: C.kesikZemin, borderRadius: 5, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  slotEkleYazi: { fontFamily: F.sb, fontSize: 15, textAlign: 'center' },
  slotEkleAlt: { fontSize: 13, color: C.gri, marginTop: 3, lineHeight: 18, textAlign: 'center' },
  slotIcerik: { flexDirection: 'row', gap: 12 },
  kucuk: { width: 104, height: 104, borderRadius: 4, backgroundColor: '#ddd' },
  kapakRozet: { position: 'absolute', left: 5, top: 5, backgroundColor: C.sari, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3 },
  kapakRozetYazi: { fontFamily: F.sb, fontSize: 11, lineHeight: 14 },
  aciklama: { minHeight: 74, fontSize: 15, lineHeight: 21, paddingVertical: 8, paddingHorizontal: 10 },
  fotoIslem: { flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' },
  fiyatBolum: { backgroundColor: C.beyaz, borderWidth: 1, borderColor: C.cizgi, borderRadius: 6, padding: 12, gap: 10, marginBottom: 6 },
  fiyatBas: { fontSize: 13, fontFamily: F.sb, color: C.gri },
  fiyatSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fiyatSatirDar: { gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.cizgi },
  altBar: { backgroundColor: C.beyaz, borderTopWidth: 1, borderTopColor: C.cizgi, paddingTop: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 10 },
  altBtn: { flex: 1, padding: 13 },
});
