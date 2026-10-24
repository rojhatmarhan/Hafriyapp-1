// Firma sayfasının gövdesi (deneme sürümündeki detayHtml). Hem yayındaki sayfa (ShowcaseDetail) hem önizleme (ShowcaseForm) kullanır.
// Faz 3'te eklenecekler için yerler işaretli: hikaye halkası/artı rozeti, "Aktif hikaye" satırı, "Teklif hazırla", "Profili paylaş",
// yorum listesi ve "Yorum yaz". Çalışmayan düğme gösterilmez.

import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { C, F } from './theme';
import { Btn, HaritaIkon, KalemIkon, ListeIkon, Logo, OranliGorsel, Pencere, PinIkon, PostaIkon, puanYaz, T, TelIkon, WaIkon, Yildizlar } from './ui';
import type { ShowcaseDetail, ShowcasePrice } from '../../services/showcaseService';
import { showcaseImageUrl } from '../../services/showcaseService';
import { fiyatMetni, haritaLink, Il, tarihYaz, telGoster, telLink, waLink } from '../../utils/showcaseFormat';
import { gorunenEtiketler, onizlemeFiyatTarihi, doluFiyatlar, Taslak } from './showcaseDraft';

export type GorunumTel = { anahtar: string; gosterim: string; tel: string; wa: string | null; etiket?: string | null };
export type GorunumFoto = { anahtar: string; baslik?: string | null; aciklama?: string | null; uri: string; oran?: number | null };
export type SayfaGorunumu = {
  ad: string;
  logo: string | null;
  etiketler: string[];
  iller: string[];
  adres: string;
  telefonlar: GorunumTel[];
  eposta: string;
  fotolar: GorunumFoto[];
  fiyatVar: boolean;
  puan: number;
  yorumSayisi: number;
  duzenleyebilir: boolean;
  gizli: boolean;
};

/** Yayındaki sayfa → görünüm */
export const detaydanGorunum = (d: ShowcaseDetail): SayfaGorunumu => ({
  ad: d.name || '',
  logo: showcaseImageUrl(d.logoUrl),
  etiketler: d.tags && d.tags.length ? d.tags : d.areas || [],
  iller: (d.provinces || []).map(p => p.name),
  adres: d.address || '',
  telefonlar: (d.phones || []).map((p, i) => ({
    anahtar: `${i}-${p.number}`,
    gosterim: p.display || telGoster(p.number),
    tel: telLink(p.number),
    wa: p.isMobile === false ? null : waLink(p.number),
    etiket: p.label,
  })),
  eposta: d.email || '',
  fotolar: (d.photos || []).map(p => ({ anahtar: p.id, baslik: p.title, aciklama: p.caption, uri: showcaseImageUrl(p.imageUrl) || '' })).filter(p => p.uri),
  fiyatVar: !!d.hasPrices,
  puan: d.ratingAverage || 0,
  yorumSayisi: d.reviewCount || 0,
  duzenleyebilir: !!d.canEdit,
  gizli: !!d.isHidden,
});

/** Form taslağı → önizleme görünümü */
export const taslaktanGorunum = (t: Taslak, iller: Il[]): SayfaGorunumu => {
  const ad = new Map(iller.map(il => [il.code, il.name]));
  const telefonlar = t.telefonlar.filter(x => x.numara.trim());
  return {
    ad: t.ad.trim(),
    logo: t.logo?.uri || null,
    etiketler: gorunenEtiketler(t),
    iller: t.iller.map(k => ad.get(k) || String(k)),
    adres: t.adres.trim(),
    telefonlar: telefonlar.map((x, i) => ({ anahtar: String(i), gosterim: telGoster(x.numara.trim()), tel: telLink(x.numara), wa: waLink(x.numara), etiket: x.etiket.trim() || null })),
    eposta: t.eposta.trim(),
    fotolar: t.slotlar.filter(s => s.uri).map((s, i) => ({ anahtar: `${i}-${s.uri}`, baslik: s.baslik.trim(), aciklama: s.aciklama.trim(), uri: s.uri as string, oran: s.oran })),
    fiyatVar: doluFiyatlar(t).length > 0,
    puan: 0,
    yorumSayisi: 0,
    duzenleyebilir: false,
    gizli: false,
  };
};

const ac = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

type Props = {
  g: SayfaGorunumu;
  onizleme?: boolean;
  /** Önizlemede: düzenleme mi (banner metni) */
  duzenleme?: boolean;
  onFiyat?: () => void;
  onDuzenle?: () => void;
  onPuan?: () => void;
  onYorumKonum?: (y: number) => void;
};

export default function ShowcaseDetailView({ g, onizleme, duzenleme, onFiyat, onDuzenle, onPuan, onYorumKonum }: Props) {
  const sahip = !onizleme && g.duzenleyebilir;
  return (
    <View>
      {onizleme ? (
        <View style={s.onizUyari}>
          <T style={s.onizYazi}>Önizleme. {duzenleme ? 'Değişiklikler' : 'Sayfanız'} henüz yayınlanmadı.</T>
        </View>
      ) : null}

      <View style={s.ust}>
        {/* TODO Faz 3: aktif hikaye varsa halka (dokununca hikayeleri izle) ve sahibine büyük "+" (Hikaye paylaş) rozeti */}
        <View style={s.halka}>
          <Logo uri={g.logo} ad={g.ad} boy={92} yazi={38} tip="ust" />
        </View>
        {g.etiketler.length ? (
          <View style={s.etiketler}>
            {g.etiketler.map(e => (
              <View key={e} style={s.etiket}>
                <T style={s.etiketYazi}>{e}</T>
              </View>
            ))}
          </View>
        ) : null}
        <T style={s.h1} accessibilityRole="header">
          {g.ad}
        </T>
        {onizleme ? null : (
          <Pressable accessibilityRole="button" onPress={onPuan} style={s.puan} hitSlop={4}>
            {g.yorumSayisi > 0 ? (
              <>
                <Yildizlar puan={g.puan} size={18} dolu={C.asfalt} bos="rgba(30,30,28,0.25)" />
                <T style={[s.puanYazi, { fontFamily: F.sb }]}>{puanYaz(g.puan)}</T>
                <T style={s.puanYazi}>{g.yorumSayisi} yorum</T>
              </>
            ) : (
              <T style={s.puanYazi}>Henüz yorum yok</T>
            )}
          </Pressable>
        )}
        <View style={s.iletisim}>
          {g.iller.length ? (
            <View style={s.ilt}>
              <View style={s.ikon}>
                <HaritaIkon />
              </View>
              <T style={s.iltYazi}>Hizmet verdiği iller: {g.iller.join(', ')}</T>
            </View>
          ) : null}
          {g.adres ? (
            <Pressable accessibilityRole="link" onPress={() => ac(haritaLink(g.adres))} style={s.ilt}>
              <View style={s.ikon}>
                <PinIkon />
              </View>
              <T style={[s.iltYazi, s.alti]}>{g.adres}</T>
            </Pressable>
          ) : null}
          {g.telefonlar.map(x => (
            <View key={x.anahtar} style={s.telSira}>
              <Pressable accessibilityRole="link" accessibilityLabel={`${x.gosterim} numarasını ara`} onPress={() => ac(x.tel)} style={[s.ilt, s.telLink]}>
                <View style={s.ikon}>
                  <TelIkon />
                </View>
                <T style={[s.iltYazi, s.alti]}>{x.gosterim}</T>
                {x.etiket ? (
                  <View style={s.em}>
                    <T style={s.emYazi}>{x.etiket}</T>
                  </View>
                ) : null}
              </Pressable>
              {x.wa ? (
                <Pressable accessibilityRole="link" accessibilityLabel={`${x.gosterim} numarasına WhatsApp ile yazın`} onPress={() => ac(x.wa as string)} style={({ pressed }) => [s.wa, pressed && { opacity: 0.75 }]}>
                  <WaIkon />
                  <T style={s.waYazi}>WhatsApp</T>
                </Pressable>
              ) : null}
            </View>
          ))}
          {g.eposta ? (
            <Pressable accessibilityRole="link" onPress={() => ac('mailto:' + g.eposta)} style={s.ilt}>
              <View style={s.ikon}>
                <PostaIkon />
              </View>
              <T style={[s.iltYazi, s.alti]}>{g.eposta}</T>
            </Pressable>
          ) : null}
        </View>
      </View>

      {sahip && g.gizli ? (
        <View style={s.testUyari}>
          <T style={s.testYazi}>Sayfanız şu an gizli: firmalar listesinde görünmüyor.</T>
        </View>
      ) : null}

      {sahip ? (
        <View style={s.sahip}>
          {/* TODO Faz 3: "Aktif hikaye: n/3" + "Hikayelerimi yönet"; Faz 5: "Teklif hazırla" */}
          <View style={s.sbButonlar}>
            <Btn tur="cizgi" baslik="Sayfayı düzenle" ikon={<KalemIkon />} onPress={onDuzenle} style={s.sbBtn} testID="sayfayi-duzenle" />
          </View>
        </View>
      ) : null}

      {/* TODO Faz 4: "Profili paylaş" (PDF) bu satıra eklenecek */}
      {g.fiyatVar ? (
        <View style={s.aksiyonlar}>
          <Btn baslik="Fiyat listesi" ikon={<ListeIkon />} onPress={onFiyat} style={s.aksBtn} testID="fiyat-listesi" />
        </View>
      ) : null}

      <View style={[s.fotolar, onizleme && { paddingBottom: 110 }]}>
        {g.fotolar.length ? (
          g.fotolar.map(p => (
            <View key={p.anahtar}>
              {p.baslik ? <T style={s.fotoBaslik}>{p.baslik}</T> : null}
              <OranliGorsel uri={p.uri} oran={p.oran} style={s.foto} />
              {p.aciklama ? <T style={s.fotoAciklama}>{p.aciklama}</T> : null}
            </View>
          ))
        ) : (
          <T style={s.fotoYok}>Bu firma henüz fotoğraf eklemedi.</T>
        )}
      </View>

      {onizleme ? null : (
        <View style={s.yorumlar} onLayout={e => onYorumKonum?.(e.nativeEvent.layout.y)}>
          <View style={s.yBas}>
            <T style={s.h2} accessibilityRole="header">
              Yorumlar ve puanlar
            </T>
            {/* TODO Faz 3: sahibi değilse "Yorum yaz" düğmesi */}
          </View>
          {g.yorumSayisi > 0 ? (
            // TODO Faz 3: puan dağılımı çubukları, son 3 yorum ve "Tüm yorumları göster (n)"
            <View style={s.yOzet}>
              <View style={s.yOrt}>
                <T style={s.yOrtSayi}>{puanYaz(g.puan)}</T>
                <Yildizlar puan={g.puan} />
                <T style={s.yOrtAlt}>{g.yorumSayisi} yorum</T>
              </View>
            </View>
          ) : (
            <T style={s.ipucu}>{sahip ? 'Firmanız için henüz yorum yapılmadı.' : 'Bu firma için henüz yorum yok. İlk yorumu siz yazın.'}</T>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────── Fiyat listesi penceresi

export type FiyatVerisi = { ad: string; kalemler: ShowcasePrice[]; kdvDahil: boolean; tarih: number | null; ilkTel?: string | null };

/** Önizlemede fiyat penceresi verisi taslaktan */
export const taslaktanFiyat = (t: Taslak): FiyatVerisi => {
  const tel = t.telefonlar.find(x => x.numara.trim());
  return { ad: t.ad.trim(), kalemler: doluFiyatlar(t), kdvDahil: t.kdvDahil, tarih: onizlemeFiyatTarihi(t), ilkTel: tel ? tel.numara.trim() : null };
};

export function FiyatPenceresi({ gorunur, onKapat, veri, yukleniyor, hata, ad, altBosluk }: { gorunur: boolean; onKapat: () => void; veri: FiyatVerisi | null; yukleniyor?: boolean; hata?: string | null; ad: string; altBosluk?: number }) {
  const tel = veri?.ilkTel;
  return (
    <Pencere
      gorunur={gorunur}
      onKapat={onKapat}
      baslik="Fiyat listesi"
      alt={veri?.ad || ad}
      altBosluk={altBosluk}
      altDugmeler={
        // TODO Faz 4: "PDF olarak paylaş"
        tel ? <Btn tur="cizgi" baslik="Ara" ikon={<TelIkon />} onPress={() => ac(telLink(tel))} style={{ flex: 1, paddingVertical: 13 }} /> : undefined
      }>
      {yukleniyor ? (
        <ActivityIndicator color={C.asfalt} style={{ marginVertical: 24 }} />
      ) : hata ? (
        <T style={s.hata}>{hata}</T>
      ) : veri ? (
        <>
          <View style={s.tablo}>
            <View style={[s.tSatir, s.tBas]}>
              <T style={[s.th, { flex: 1 }]}>Açıklama</T>
              <T style={[s.th, s.sag]}>Birim fiyat</T>
            </View>
            {veri.kalemler.map((r, i) => (
              <View key={i} style={[s.tSatir, s.tHucre]}>
                <T style={[s.td, { flex: 1 }]}>{r.description}</T>
                <T style={[s.td, s.sag, { fontFamily: F.sb }]}>{fiyatMetni(r.price, r.unit)}</T>
              </View>
            ))}
          </View>
          <T style={[s.ipucu, { marginTop: 12 }]}>
            Fiyatlara KDV {veri.kdvDahil ? 'dahildir' : 'dahil değildir'}. Güncelleme tarihi: {tarihYaz(veri.tarih || Date.now())}
          </T>
        </>
      ) : null}
    </Pencere>
  );
}

const s = StyleSheet.create({
  onizUyari: { backgroundColor: C.asfalt, paddingVertical: 9, paddingHorizontal: 16 },
  onizYazi: { color: C.beyaz, fontSize: 14, lineHeight: 19 },
  ust: { backgroundColor: C.banner, paddingTop: 22, paddingHorizontal: 16, paddingBottom: 26, gap: 12, alignItems: 'flex-start' },
  halka: { margin: 3 },
  etiketler: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  etiket: { backgroundColor: C.asfalt, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 3 },
  etiketYazi: { color: C.sari, fontFamily: F.sb, fontSize: 13, lineHeight: 16 },
  h1: { fontFamily: F.c7, fontSize: 40, lineHeight: 43 },
  puan: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  puanYazi: { fontFamily: F.m, fontSize: 15, textDecorationLine: 'underline' },
  iletisim: { gap: 8, alignSelf: 'stretch' },
  ilt: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  ikon: { marginTop: 2 },
  iltYazi: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  alti: { textDecorationLine: 'underline' },
  telSira: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  telLink: { alignItems: 'center' },
  em: { backgroundColor: 'rgba(30,30,28,0.12)', paddingVertical: 1, paddingHorizontal: 6, borderRadius: 3, marginLeft: -4 },
  emYazi: { fontFamily: F.sb, fontSize: 13, lineHeight: 17 },
  wa: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.beyaz, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  waYazi: { fontFamily: F.sb, fontSize: 13, lineHeight: 17 },
  testUyari: { backgroundColor: C.testZemin, borderBottomWidth: 1, borderBottomColor: C.testCizgi, paddingVertical: 10, paddingHorizontal: 16 },
  testYazi: { color: C.testMetin, fontSize: 14, lineHeight: 20 },
  sahip: { backgroundColor: C.beyaz, borderBottomWidth: 1, borderBottomColor: C.cizgi, paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  sbButonlar: { flexDirection: 'row', gap: 10 },
  sbBtn: { flex: 1, paddingVertical: 11, paddingHorizontal: 8 },
  aksiyonlar: { backgroundColor: C.beyaz, borderBottomWidth: 1, borderBottomColor: C.cizgi, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  aksBtn: { flex: 1, minWidth: 140, padding: 12 },
  fotolar: { gap: 28, paddingTop: 22, paddingHorizontal: 16, paddingBottom: 48 },
  fotoBaslik: { fontFamily: F.c7, fontSize: 24, lineHeight: 27, marginBottom: 10, paddingLeft: 10, borderLeftWidth: 4, borderLeftColor: C.sari },
  foto: { borderRadius: 6 },
  fotoAciklama: { paddingTop: 9, paddingHorizontal: 2, fontSize: 16, lineHeight: 24, color: C.metin },
  fotoYok: { color: C.gri, fontSize: 15 },
  yorumlar: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 48, borderTopWidth: 8, borderTopColor: C.ayrac },
  yBas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 18, paddingBottom: 12 },
  h2: { fontFamily: F.c7, fontSize: 24, lineHeight: 27 },
  ipucu: { fontSize: 13, color: C.gri, marginTop: 6, lineHeight: 18 },
  yOzet: { flexDirection: 'row', gap: 20, alignItems: 'center', backgroundColor: C.beyaz, borderWidth: 1, borderColor: C.cizgi, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12 },
  yOrt: { alignItems: 'center', gap: 4 },
  yOrtSayi: { fontFamily: F.c7, fontSize: 42, lineHeight: 44 },
  yOrtAlt: { fontSize: 13, color: C.gri },
  hata: { color: C.hata, fontFamily: F.m, fontSize: 14 },
  tablo: {},
  tSatir: { flexDirection: 'row', gap: 12 },
  tBas: { paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1.5, borderBottomColor: C.asfalt },
  th: { fontSize: 13, color: C.gri, fontFamily: F.sb },
  tHucre: { paddingVertical: 11, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: C.cizgi },
  td: { fontSize: 15, lineHeight: 20 },
  sag: { textAlign: 'right', flexShrink: 0 },
});
