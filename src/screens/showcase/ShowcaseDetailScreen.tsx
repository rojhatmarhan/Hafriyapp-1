// Firma sayfası (deneme sürümündeki "detay"): GET api/Showcase/{id}; fiyat listesi düğmeyle GET .../prices.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { C } from './theme';
import { Btn, T, UstCubuk, anaSayfayaDon, useToast } from './ui';
import ShowcaseDetailView, { detaydanGorunum, FiyatPenceresi, FiyatVerisi } from './ShowcaseDetailView';
import { getShowcaseDetail, getShowcasePrices, ShowcaseDetail, showcaseHata } from '../../services/showcaseService';
import { parseApiDate } from '../../utils/showcaseFormat';

export default function ShowcaseDetailScreen({ navigation, route }: any) {
  const id: string = route?.params?.id;
  const insets = useSafeAreaInsets();
  const sekmeYuk = React.useContext(BottomTabBarHeightContext);
  const altBosluk = sekmeYuk ? 0 : insets.bottom;
  const [detay, setDetay] = useState<ShowcaseDetail | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [fiyatAcik, setFiyatAcik] = useState(false);
  const [fiyat, setFiyat] = useState<FiyatVerisi | null>(null);
  const [fiyatYuk, setFiyatYuk] = useState(false);
  const [fiyatHata, setFiyatHata] = useState<string | null>(null);
  const kaydir = useRef<ScrollView>(null);
  const yorumY = useRef(0);
  const ilk = useRef(true);
  const { toast, goster } = useToast();

  const yukle = useCallback(
    async (sessiz?: boolean) => {
      if (!id) return;
      if (!sessiz) setYukleniyor(true);
      try {
        const d = await getShowcaseDetail(id);
        setDetay(d);
        setHata(null);
      } catch (e) {
        setHata(showcaseHata(e, 'Firma sayfası yüklenemedi.'));
      } finally {
        setYukleniyor(false);
        setYenileniyor(false);
      }
    },
    [id],
  );

  // Açılışta yükle; düzenlemeden dönünce sessizce yenile
  useFocusEffect(
    useCallback(() => {
      yukle(!ilk.current);
      ilk.current = false;
    }, [yukle]),
  );

  // Yayından sonra gelen bildirim ("Firmanız yayınlandı.")
  const toastMetni: string | undefined = route?.params?.toast;
  const toastAnahtar = route?.params?.toastKey;
  useEffect(() => {
    if (toastMetni) goster(toastMetni, 4500);
  }, [toastMetni, toastAnahtar, goster]);

  const geriGit = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ShowcaseList'));

  const fiyatAc = async () => {
    if (!detay) return;
    setFiyatAcik(true);
    setFiyatYuk(true);
    setFiyatHata(null);
    try {
      const p = await getShowcasePrices(detay.id);
      setFiyat({ ad: p.name || detay.name, kalemler: p.items || [], kdvDahil: !!p.kdvIncluded, tarih: parseApiDate(p.priceUpdatedAt) ?? parseApiDate(detay.publishedAt), ilkTel: p.firstPhone || null });
    } catch (e) {
      setFiyatHata(showcaseHata(e, 'Fiyat listesi yüklenemedi.'));
    } finally {
      setFiyatYuk(false);
    }
  };

  return (
    <View style={s.kap}>
      <UstCubuk anaSayfa={() => anaSayfayaDon(navigation)} geri={{ baslik: 'Firmalar', onPress: geriGit }} />
      {yukleniyor && !detay ? (
        <T style={s.bos}>Firma sayfası yükleniyor…</T>
      ) : hata && !detay ? (
        <View style={s.hataKap}>
          <T style={s.bosYazi}>{hata}</T>
          <Btn tur="cizgi" baslik="Tekrar dene" onPress={() => yukle()} style={{ marginTop: 12 }} />
        </View>
      ) : detay ? (
        <ScrollView
          ref={kaydir}
          contentContainerStyle={{ paddingBottom: altBosluk }}
          refreshControl={
            <RefreshControl
              refreshing={yenileniyor}
              onRefresh={() => {
                setYenileniyor(true);
                yukle(true);
              }}
              tintColor={C.asfalt}
              colors={[C.asfalt]}
            />
          }>
          <ShowcaseDetailView
            g={detaydanGorunum(detay)}
            onFiyat={fiyatAc}
            onDuzenle={() => navigation.navigate('ShowcaseForm', { companyId: detay.companyId, from: 'detail' })}
            onPuan={() => kaydir.current?.scrollTo({ y: Math.max(0, yorumY.current), animated: true })}
            onYorumKonum={y => {
              yorumY.current = y;
            }}
          />
        </ScrollView>
      ) : (
        <ActivityIndicator color={C.asfalt} style={{ marginTop: 40 }} />
      )}
      <FiyatPenceresi gorunur={fiyatAcik} onKapat={() => setFiyatAcik(false)} veri={fiyat} yukleniyor={fiyatYuk} hata={fiyatHata} ad={detay?.name || ''} altBosluk={insets.bottom} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: C.zemin },
  bos: { textAlign: 'center', color: C.gri, paddingVertical: 40, paddingHorizontal: 16, fontSize: 16 },
  hataKap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  bosYazi: { textAlign: 'center', color: C.gri, fontSize: 16, lineHeight: 22 },
});
