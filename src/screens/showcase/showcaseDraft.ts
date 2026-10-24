// Firma tanıtımı formu: taslak modeli, iş alanı/etiket kuralları, doğrulama ve kayıt gövdesi.
// Deneme sürümündeki yeniTaslak / firmadanTaslak / alanDegisti / dogrula / firmaNesnesi ile aynı kurallar. Saf fonksiyonlar.

import type { MyShowcase, SaveShowcasePayload, ShowcaseDetail } from '../../services/showcaseService';
import { showcaseImageUrl } from '../../services/showcaseService';
import { EPOSTA_RE, fiyatGirdi, fiyatOku, MAX_FIYAT, parseApiDate, sablonAl, Sablonlar, telGecerli, telGoster, trLower } from '../../utils/showcaseFormat';

export const MAX_FOTO = 8;
export const MAX_ETIKET = 6;
export const MAX_TELEFON = 5;
export const MAX_FIYAT_SATIR = 50;

export type Slot = {
  /** Şablondaki sırası (önerilen başlık, ipucu, örnek açıklama buradan) */
  sablon: number;
  baslik: string;
  /** Kullanıcı başlığı kendisi yazdı/sildi → iş alanı değişince başlık değişmez */
  ozel: boolean;
  /** Gösterilecek görsel (sunucu adresi ya da yeni seçilen dosya) */
  uri: string | null;
  /** Yeni seçilen görsel (data:image/...;base64,...) */
  yeni: string | null;
  /** Sunucudaki fotoğrafın kimliği */
  fotoId: string | null;
  /** En/boy oranı (biliniyorsa) */
  oran: number | null;
  aciklama: string;
  yukleniyor: boolean;
};

export type EtiketSatiri = { metin: string; alan: string | null };
export type TelefonSatiri = { numara: string; etiket: string };
export type FiyatSatiri = { aciklama: string; fiyat: string; birim: string };
export type LogoDurumu = { uri: string; tur: 'mevcut' | 'yeni'; veri?: string | null } | null;

export type Taslak = {
  duzenleme: boolean;
  companyId: string | null;
  ad: string;
  alanlar: string[];
  etiketler: EtiketSatiri[];
  iller: number[];
  adres: string;
  telefonlar: TelefonSatiri[];
  eposta: string;
  logo: LogoDurumu;
  /** Sayfada logo vardı (kaldırılırsa "" gönderilir) */
  logoVardi: boolean;
  fiyatlar: FiyatSatiri[];
  fiyatAcik: boolean;
  kdvDahil: boolean;
  fiyatTarih: number | null;
  fiyatDegisti: boolean;
  slotlar: Slot[];
};

const bosSlot = (sablon: number, baslik: string): Slot => ({ sablon, baslik, ozel: false, uri: null, yeni: null, fotoId: null, oran: null, aciklama: '', yukleniyor: false });

export const bosFiyatSatiri = (): FiyatSatiri => ({ aciklama: '', fiyat: '', birim: 'sefer' });

/**
 * Yeni sayfa: 8 Genel yuvası, bir boş telefon satırı; firma adı, telefonu ve adresi önerilerden doldurulur.
 * Firma logosu (suggestedLogoUrl) şimdilik alınmaz: sunucu yeni sayfada logoyu sadece base64 ile kabul ediyor.
 */
export const yeniTaslak = (sablonlar: Sablonlar, my?: MyShowcase | null): Taslak => {
  const sab = sablonAl(sablonlar, []);
  return {
    duzenleme: false,
    companyId: my?.companyId ?? null,
    ad: (my?.suggestedName || '').slice(0, 60),
    alanlar: [],
    etiketler: [],
    iller: [],
    adres: (my?.suggestedAddress || '').slice(0, 160),
    telefonlar: [{ numara: my?.suggestedPhone ? telGoster(my.suggestedPhone) : '', etiket: '' }],
    eposta: '',
    logo: null,
    logoVardi: false,
    fiyatlar: [],
    fiyatAcik: false,
    kdvDahil: false,
    fiyatTarih: null,
    fiyatDegisti: false,
    slotlar: sab.slice(0, MAX_FOTO).map((s, i) => bosSlot(i, s.title)),
  };
};

/** Var olan sayfadan düzenleme taslağı: her fotoğraf aynı başlıklı yuvaya, yoksa ilk boş yuvaya (özel başlık) yerleşir */
export const sayfadanTaslak = (s: ShowcaseDetail, sablonlar: Sablonlar, companyId?: string | null): Taslak => {
  const alanlar = [...(s.areas || [])];
  const sab = sablonAl(sablonlar, alanlar);
  const kullanilan = new Set<number>();
  const slotlar: Slot[] = (s.photos || []).slice(0, MAX_FOTO).map(p => {
    const baslik = p.title || '';
    let si = sab.findIndex((x, i) => x.title === baslik && !kullanilan.has(i));
    const ozel = si < 0;
    if (si < 0) si = sab.findIndex((_x, i) => !kullanilan.has(i));
    if (si < 0) si = 0;
    kullanilan.add(si);
    return { ...bosSlot(si, baslik), ozel, uri: showcaseImageUrl(p.imageUrl), fotoId: p.id, aciklama: p.caption || '' };
  });
  sab.forEach((x, i) => {
    if (!kullanilan.has(i) && slotlar.length < MAX_FOTO) slotlar.push(bosSlot(i, x.title));
  });
  const ozelEtiket = s.customTags || [];
  const etiketler: EtiketSatiri[] = ozelEtiket.length ? ozelEtiket.map(m => ({ metin: m, alan: alanlar.includes(m) ? m : null })) : alanlar.map(a => ({ metin: a, alan: a }));
  const telefonlar = (s.phones || []).map(p => ({ numara: p.display || telGoster(p.number), etiket: p.label || '' }));
  const fiyatlar = (s.prices || []).map(r => ({ aciklama: r.description, fiyat: fiyatGirdi(r.price), birim: r.unit || '' }));
  const logoUri = showcaseImageUrl(s.logoUrl);
  return {
    duzenleme: true,
    companyId: companyId ?? s.companyId ?? null,
    ad: s.name || '',
    alanlar,
    etiketler,
    iller: (s.provinces || []).map(p => p.code),
    adres: s.address || '',
    telefonlar: telefonlar.length ? telefonlar : [{ numara: '', etiket: '' }],
    eposta: s.email || '',
    logo: logoUri ? { uri: logoUri, tur: 'mevcut' } : null,
    logoVardi: !!logoUri,
    fiyatlar,
    fiyatAcik: fiyatlar.length > 0,
    kdvDahil: !!s.kdvIncluded,
    fiyatTarih: parseApiDate(s.priceUpdatedAt),
    fiyatDegisti: false,
    slotlar,
  };
};

/** İş alanı seç/bırak: seçilince etiket eklenir (yoksa ve 6'dan azsa); bırakılınca kullanıcının değiştirmediği etiket silinir. Başlıklar yeniden türetilir. */
export const alanDegistir = (t: Taslak, alan: string, sablonlar: Sablonlar): Taslak => {
  let alanlar = [...t.alanlar];
  let etiketler = [...t.etiketler];
  if (!alanlar.includes(alan)) {
    alanlar.push(alan);
    if (!etiketler.some(e => e.alan === alan || e.metin.trim() === alan) && etiketler.length < MAX_ETIKET) etiketler.push({ metin: alan, alan });
  } else {
    alanlar = alanlar.filter(a => a !== alan);
    etiketler = etiketler.filter(e => !(e.alan === alan && e.metin.trim() === alan));
  }
  const sab = sablonAl(sablonlar, alanlar);
  const slotlar = t.slotlar.map(s => (s.ozel || !sab[s.sablon] ? s : { ...s, baslik: sab[s.sablon].title }));
  return { ...t, alanlar, etiketler, slotlar };
};

/** "Kapak yap": yuva başa taşınır */
export const kapakYap = (t: Taslak, i: number): Taslak => {
  const slotlar = [...t.slotlar];
  const [s] = slotlar.splice(i, 1);
  slotlar.unshift(s);
  return { ...t, slotlar };
};

export type Hatalar = Record<string, string>;

const FIYAT_HATA = 'geçerli bir fiyat yazın (örn. 1.250 ya da 1250,50)';

/** Önizle'den önce doğrulama; sunucuyla aynı mesajlar. Anahtarlar: ad, alanlar, iller, tel{i}, eposta, fotolar, fy{i} (+ fya{i}/fyf{i} işaretleri) */
export const dogrula = (t: Taslak): Hatalar => {
  const h: Hatalar = {};
  if (!t.ad.trim()) h.ad = 'Firma adını yazın.';
  if (!t.alanlar.length) h.alanlar = 'En az bir iş alanı seçin.';
  if (!t.iller.length) h.iller = 'Hizmet verdiğiniz en az bir ili seçin.';
  t.telefonlar.forEach((x, i) => {
    if (x.numara.trim() && !telGecerli(x.numara)) h['tel' + i] = 'Geçerli bir telefon numarası yazın. Örn. 0532 123 45 67';
  });
  if (t.eposta.trim() && !EPOSTA_RE.test(t.eposta.trim())) h.eposta = 'E-posta adresini kontrol edin.';
  if (!t.slotlar.some(s => s.uri)) h.fotolar = 'En az bir fotoğraf ekleyin.';
  t.fiyatlar.forEach((r, i) => {
    const ac = r.aciklama.trim();
    const fs = String(r.fiyat).trim();
    if (!ac && !fs) return;
    const m: string[] = [];
    if (!ac) {
      h['fya' + i] = '1';
      m.push('açıklama yazın');
    }
    const n = fiyatOku(fs);
    if (!fs || isNaN(n) || n < 0 || n > MAX_FIYAT) {
      h['fyf' + i] = '1';
      m.push(FIYAT_HATA);
    }
    if (m.length) h['fy' + i] = 'Satır ' + (i + 1) + ': ' + m.join(', ') + '.';
  });
  return h;
};

/** Hata anahtarlarından ilk hatalı bölüm (ekranda oraya kaydırılır) */
export const ilkHataBolumu = (h: Hatalar): string | null => {
  const k = Object.keys(h);
  if (h.ad) return 'ad';
  if (h.alanlar) return 'alanlar';
  if (h.iller) return 'iller';
  if (k.some(x => /^tel\d+$/.test(x)) || h.eposta) return 'iletisim';
  if (h.fotolar) return 'fotolar';
  if (k.some(x => /^fy\d+$/.test(x))) return 'fiyat';
  return null;
};

/** Doldurulmuş fiyat satırları (ikisi de boş olanlar atılır) */
export const doluFiyatlar = (t: Taslak) =>
  t.fiyatlar.filter(r => r.aciklama.trim() || String(r.fiyat).trim()).map(r => ({ description: r.aciklama.trim(), price: fiyatOku(r.fiyat), unit: r.birim || '' }));

/** Görünen etiketler: yazılan etiketler (boşlar atılır, tekrarlar teke), hiç yoksa iş alanları */
export const gorunenEtiketler = (t: Taslak): string[] => {
  const e = ozelEtiketler(t);
  return e.length ? e : [...t.alanlar];
};

export const ozelEtiketler = (t: Taslak): string[] => {
  const out: string[] = [];
  for (const e of t.etiketler) {
    const m = e.metin.trim();
    if (m && !out.some(x => trLower(x) === trLower(m))) out.push(m);
  }
  return out;
};

/** Önizlemedeki fiyat güncelleme tarihi: liste değiştiyse ya da hiç tarih yoksa şimdi */
export const onizlemeFiyatTarihi = (t: Taslak, now: number = Date.now()): number | null => {
  if (!doluFiyatlar(t).length) return null;
  return t.fiyatDegisti || !t.fiyatTarih ? now : t.fiyatTarih;
};

/** Logo alanı: null = değişmez, "" = kaldır, data URL = yeni */
export const logoGovdesi = (t: Taslak): string | null => {
  if (!t.logo) return t.logoVardi ? '' : null;
  if (t.logo.tur === 'yeni' && t.logo.veri) return t.logo.veri;
  return null;
};

/** PUT api/Showcase/my gövdesi */
export const kayitGovdesi = (t: Taslak): SaveShowcasePayload => ({
  companyId: t.companyId || undefined,
  name: t.ad.trim(),
  areas: [...t.alanlar],
  tags: ozelEtiketler(t),
  provinceCodes: [...t.iller],
  address: t.adres.trim(),
  phones: t.telefonlar.filter(x => x.numara.trim()).map(x => ({ number: x.numara.trim(), label: x.etiket.trim() })),
  email: t.eposta.trim(),
  logo: logoGovdesi(t),
  photos: t.slotlar
    .filter(s => s.uri)
    .map(s => {
      const p: SaveShowcasePayload['photos'][number] = { title: s.baslik.trim(), caption: s.aciklama.trim() };
      if (s.fotoId) p.id = s.fotoId;
      if (s.yeni) p.imageBase64 = s.yeni;
      return p;
    }),
  prices: doluFiyatlar(t),
  kdvIncluded: t.kdvDahil,
});
