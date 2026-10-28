// Firmalar listesi (deneme sürümündeki "liste"): GET api/Showcase — arama (Türkçe harf duyarsız, sunucuda), il filtresi, sayfalama.
// API'de bu uçlar yoksa (eski API yayında) eski WebView ekranına (CompanyShowcase) geçilir.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { C, F, KART_GOLGE, KART_GOLGE_BASILI, ODAK_HALKA } from './theme';
import { AraIkon, ArtiIkon, Btn, LinkBtn, Logo, puanYaz, SecimKutusu, T, UstCubuk, anaSayfayaDon, Yildizlar } from './ui';
import { consumeShowcaseChanged, getMyShowcase, getShowcaseList, getShowcaseOptions, ShowcaseListItem, ShowcaseProvinceCount, showcaseHata, showcaseImageUrl, showcaseYok } from '../../services/showcaseService';
import { basHarf, ilMetni, parseApiDate, sonHareketMetni } from '../../utils/showcaseFormat';

const SAYFA_BOYUTU = 20;

/** Boş/filtre sonucu metni: "{İl} ilinde "{q}" ile eşleşen firma bulunamadı." (parçalar isteğe bağlı) */
export const bulunamadiMetni = (ilAdi: string | null, q: string): string => `${ilAdi ? ilAdi + ' ilinde ' : ''}${q.trim() ? '"' + q.trim() + '" ile eşleşen ' : ''}firma bulunamadı.`;

/** Firma kartı (.kapak) */
export const FirmaKarti = React.memo(({ f, onPress, simdi }: { f: ShowcaseListItem; onPress: (f: ShowcaseListItem) => void; simdi: number }) => {
  const kapak = showcaseImageUrl(f.coverUrl);
  const etiket = (f.tags && f.tags.length ? f.tags : f.areas || []).join(', ');
  const yer = ilMetni((f.provinces || []).map(p => p.name), f.address);
  const hareket = sonHareketMetni(parseApiDate(f.lastActivityAt), f.lastActivityType, simdi);
  const yorum = f.reviewCount || 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${f.name} tanıtım sayfasını aç`} onPress={() => onPress(f)} style={({ pressed }) => [s.kart, pressed && s.kartBasili]}>
      <View style={s.kartIc}>
        <View style={s.kapak}>
          {kapak ? (
            <Image source={{ uri: kapak }} style={s.kapakGorsel} resizeMode="cover" />
          ) : (
            <View style={s.yerTutucu}>
              <T style={s.yerTutucuYazi}>{basHarf(f.name)}</T>
            </View>
          )}
          {f.isSample ? (
            <View style={s.ornek}>
              <T style={s.ornekYazi}>Örnek</T>
            </View>
          ) : null}
        </View>
        <View style={s.bilgi}>
          <Logo uri={showcaseImageUrl(f.logoUrl)} ad={f.name} boy={50} yazi={20} />
          <View style={{ flex: 1 }}>
            <T style={s.ad}>{f.name}</T>
            {etiket ? <T style={s.is}>{etiket}</T> : null}
            {yer ? <T style={s.yer}>{yer}</T> : null}
            {yorum > 0 ? (
              <View style={s.puan}>
                <Yildizlar puan={f.ratingAverage || 0} />
                <T style={{ fontSize: 13, fontFamily: F.sb }}>{puanYaz(f.ratingAverage || 0)}</T>
                <T style={{ fontSize: 13, color: C.gri }}>({yorum} yorum)</T>
              </View>
            ) : null}
            {hareket ? <T style={s.hareket}>{hareket}</T> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export default function ShowcaseListScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const dar = width < 380;
  const [arama, setArama] = useState('');
  const [sorgu, setSorgu] = useState('');
  const [il, setIl] = useState<number | null>(null);
  const [liste, setListe] = useState<ShowcaseListItem[]>([]);
  const [sayfa, setSayfa] = useState(1);
  const [toplamSayfa, setToplamSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);
  const [ilSayilari, setIlSayilari] = useState<ShowcaseProvinceCount[]>([]);
  const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'hata'>('yukleniyor');
  const [hata, setHata] = useState('');
  const [dahaYuk, setDahaYuk] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [tanitYuk, setTanitYuk] = useState(false);
  const [aramaOdak, setAramaOdak] = useState(false);
  const [simdi, setSimdi] = useState(Date.now());
  const istekNo = useRef(0);
  const eskiyeGecti = useRef(false);

  // Eski API (uç yok) → mevcut WebView ekranı
  const eskiyeDon = useCallback(() => {
    if (eskiyeGecti.current) return;
    eskiyeGecti.current = true;
    if (typeof navigation.replace === 'function') navigation.replace('CompanyShowcase');
    else navigation.navigate('CompanyShowcase');
  }, [navigation]);

  useEffect(() => {
    getShowcaseOptions().catch(e => {
      if (showcaseYok(e)) eskiyeDon();
    });
  }, [eskiyeDon]);

  // Arama 350 ms bekleyip sunucuya gider
  useEffect(() => {
    const t = setTimeout(() => setSorgu(arama), 350);
    return () => clearTimeout(t);
  }, [arama]);

  const getir = useCallback(
    async (p: number) => {
      const no = ++istekNo.current;
      if (p > 1) setDahaYuk(true);
      try {
        const r = await getShowcaseList({ search: sorgu, province: il, page: p, pageSize: SAYFA_BOYUTU });
        if (no !== istekNo.current) return;
        const yeni = r.items || [];
        setListe(onceki => (p > 1 ? [...onceki, ...yeni.filter(x => !onceki.some(o => o.id === x.id))] : yeni));
        setSayfa(r.page || p);
        setToplamSayfa(r.totalPages || 1);
        setToplam(r.totalCount || 0);
        setIlSayilari(r.provinceCounts || []);
        setSimdi(Date.now());
        setDurum('hazir');
      } catch (e) {
        if (no !== istekNo.current) return;
        if (showcaseYok(e)) return eskiyeDon();
        if (p === 1) {
          setHata(showcaseHata(e, 'Firmalar yüklenemedi. Lütfen tekrar deneyin.'));
          setDurum('hata');
        }
      } finally {
        if (no === istekNo.current) {
          setDahaYuk(false);
          setYenileniyor(false);
        }
      }
    },
    [sorgu, il, eskiyeDon],
  );

  useEffect(() => {
    getir(1);
  }, [getir]);

  // Bir sayfa yayınlandıysa listeye dönünce yenile
  useFocusEffect(
    useCallback(() => {
      if (consumeShowcaseChanged()) getir(1);
    }, [getir]),
  );

  const temizle = () => {
    setArama('');
    setSorgu('');
    setIl(null);
  };

  const tanit = async () => {
    if (tanitYuk) return;
    setTanitYuk(true);
    try {
      const my = await getMyShowcase();
      if (!my.canCreate) Alert.alert('Firmanı tanıt', my.reason || 'Firma sayfası sadece firma sahipleri ve yetkilileri tarafından oluşturulabilir.');
      else navigation.navigate('ShowcaseForm', { companyId: my.companyId || null, from: 'list' });
    } catch (e) {
      Alert.alert('Firmanı tanıt', showcaseHata(e));
    } finally {
      setTanitYuk(false);
    }
  };

  const ac = useCallback((f: ShowcaseListItem) => navigation.navigate('ShowcaseDetail', { id: f.id }), [navigation]);

  const ilSecenekleri = useMemo(() => {
    const l = ilSayilari.map(x => ({ value: String(x.code), label: `${x.name} (${x.count})` }));
    if (il && !ilSayilari.some(x => x.code === il)) l.push({ value: String(il), label: `${il} (0)` });
    return [{ value: '', label: 'Tüm iller' }, ...l];
  }, [ilSayilari, il]);
  const ilAdi = il ? ilSayilari.find(x => x.code === il)?.name || null : null;
  const filtreli = !!(sorgu.trim() || il);
  const hicFirmaYok = durum === 'hazir' && (filtreli ? ilSayilari.length === 0 : toplam === 0);

  const ust = (
    <View>
      {/* TODO Faz 3: hikaye şeridi (.serit) — "Hikayen" + aktif hikayesi olan firmalar */}
      <View style={s.giris}>
        <T style={s.h1} accessibilityRole="header">
          Sektör Firmaları
        </T>
        <T style={s.p}>Ocaklar, hafriyat, nakliye ve iş makinesi firmaları. İncelemek için bir firmaya dokunun.</T>
      </View>
      <View style={[s.arama, dar && { flexDirection: 'column' }]}>
        <View style={[s.aramaKutu, aramaOdak && s.odak, !dar && { flex: 1 }]}>
          <AraIkon />
          <TextInput
            testID="firma-ara"
            accessibilityLabel="Firma ara"
            value={arama}
            onChangeText={setArama}
            placeholder="Firma adı, iş ya da etiket ara"
            placeholderTextColor={C.yerTutucu}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            onSubmitEditing={() => setSorgu(arama)}
            onFocus={() => setAramaOdak(true)}
            onBlur={() => setAramaOdak(false)}
            maxFontSizeMultiplier={1.4}
            style={s.aramaGiris}
          />
        </View>
        <SecimKutusu
          testID="il-filtre"
          baslik="İle göre filtrele"
          value={il ? String(il) : ''}
          secenekler={ilSecenekleri}
          onChange={v => setIl(v ? Number(v) : null)}
          style={[{ paddingHorizontal: 8 }, dar ? { width: '100%' } : { width: 150 }]}
        />
      </View>
      {filtreli && toplam > 0 && durum === 'hazir' ? (
        <View style={s.sonuc}>
          <T style={s.sonucYazi}>{toplam} firma bulundu</T>
          <LinkBtn baslik="Temizle" onPress={temizle} />
        </View>
      ) : null}
    </View>
  );

  const bos =
    durum === 'yukleniyor' ? (
      <T style={s.bos}>Firmalar yükleniyor…</T>
    ) : durum === 'hata' ? (
      <View style={s.bosKap}>
        <T style={s.bosYazi}>{hata}</T>
        <Btn tur="cizgi" baslik="Tekrar dene" onPress={() => getir(1)} style={{ marginTop: 12 }} />
      </View>
    ) : hicFirmaYok ? (
      <T style={s.bos}>Henüz tanıtılan firma yok. İlk tanıtımı siz yapın.</T>
    ) : (
      <View style={s.bosKap}>
        <T style={s.bosYazi}>{bulunamadiMetni(ilAdi, sorgu)}</T>
        <Btn tur="cizgi" baslik="Filtreleri temizle" onPress={temizle} style={{ marginTop: 12 }} />
      </View>
    );

  return (
    <View style={s.kap}>
      <UstCubuk anaSayfa={() => anaSayfayaDon(navigation)} sag={<Btn testID="firmani-tanit" baslik="Firmanı tanıt" ikon={tanitYuk ? <ActivityIndicator size="small" color={C.sari} /> : <ArtiIkon />} onPress={tanit} disabled={tanitYuk} />} />
      <FlatList
        data={durum === 'hazir' ? liste : []}
        keyExtractor={f => f.id}
        renderItem={({ item }) => <FirmaKarti f={item} onPress={ac} simdi={simdi} />}
        ListHeaderComponent={ust}
        ListEmptyComponent={bos}
        ItemSeparatorComponent={Ayrac}
        contentContainerStyle={s.icerik}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (durum === 'hazir' && !dahaYuk && sayfa < toplamSayfa) getir(sayfa + 1);
        }}
        ListFooterComponent={dahaYuk ? <ActivityIndicator color={C.asfalt} style={{ marginTop: 18 }} /> : null}
        refreshControl={
          <RefreshControl
            refreshing={yenileniyor}
            onRefresh={() => {
              setYenileniyor(true);
              getir(1);
            }}
            tintColor={C.asfalt}
            colors={[C.asfalt]}
          />
        }
      />
    </View>
  );
}

const Ayrac = () => <View style={{ height: 18 }} />;

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: C.zemin },
  icerik: { paddingBottom: 48 },
  giris: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 6 },
  h1: { fontFamily: F.c7, fontSize: 34, lineHeight: 37 },
  p: { color: C.gri, marginTop: 6, fontSize: 15, lineHeight: 22 },
  arama: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingHorizontal: 16, marginBottom: 14 },
  aramaKutu: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.beyaz, borderWidth: 1.5, borderColor: C.cizgi, borderRadius: 4, paddingHorizontal: 10 },
  odak: { borderColor: C.asfalt, boxShadow: ODAK_HALKA },
  aramaGiris: { flex: 1, fontFamily: F.r, fontSize: 16, paddingVertical: 11, paddingHorizontal: 0, color: C.asfalt },
  sonuc: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginTop: -6, marginBottom: 14 },
  sonucYazi: { fontSize: 14, color: C.gri },
  bos: { textAlign: 'center', color: C.gri, paddingVertical: 40, paddingHorizontal: 16, fontSize: 16 },
  bosKap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  bosYazi: { textAlign: 'center', color: C.gri, fontSize: 16, lineHeight: 22 },
  kart: { marginHorizontal: 16, borderRadius: 10, backgroundColor: C.beyaz, boxShadow: KART_GOLGE },
  kartBasili: { transform: [{ scale: 0.985 }], boxShadow: KART_GOLGE_BASILI },
  kartIc: { borderRadius: 10, borderWidth: 1, borderColor: C.cizgi, overflow: 'hidden', backgroundColor: C.beyaz },
  kapak: { width: '100%', aspectRatio: 16 / 9, backgroundColor: C.asfalt },
  kapakGorsel: { width: '100%', height: '100%' },
  yerTutucu: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  yerTutucuYazi: { fontFamily: F.c7, fontSize: 64, color: C.sari },
  ornek: { position: 'absolute', left: 10, top: 10, backgroundColor: C.sari, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 3 },
  ornekYazi: { fontFamily: F.sb, fontSize: 12, lineHeight: 15 },
  bilgi: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 4, borderTopColor: C.sari },
  ad: { fontFamily: F.c7, fontSize: 22, lineHeight: 25 },
  is: { fontFamily: F.sb, fontSize: 14, lineHeight: 19, color: C.sariKoyu, marginTop: 2 },
  yer: { fontSize: 14, lineHeight: 19, color: C.gri, marginTop: 1 },
  puan: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  hareket: { fontSize: 12.5, lineHeight: 17, color: C.gri, marginTop: 3 },
});
