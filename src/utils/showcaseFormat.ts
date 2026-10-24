// Firma tanıtımı — saf yardımcılar (deneme sürümü hafriyapp.com/firma-tanitimi ile birebir kurallar).
// Ekranlardan bağımsızdır, testleri __tests__/showcaseFormat.test.ts'de.

// ─────────────── Metin

/**
 * Türkçe harf duyarsız sadeleştirme (deneme sürümündeki `norm`): küçük harf (tr), ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u, â→a, î→i,
 * boşluklar teke indirilir. Cihazın yerel ayarına bağlı kalmamak için İ/I önce elle çevrilir.
 */
export const normTr = (s?: string | null): string =>
  String(s ?? '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/̇/g, '')
    .replace(/[çğıöşüâî]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i' } as Record<string, string>)[c])
    .replace(/\s+/g, ' ')
    .trim();

/** Türkçe küçük harf (cihaz yerel ayarından bağımsız): İ→i, I→ı */
export const trLower = (s?: string | null): string => String(s ?? '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/̇/g, '');

/** Baş harfler: ilk iki kelimenin ilk harfi, büyük (tr). "Kaya Hafriyat" → "KH" */
export const basHarf = (ad?: string | null): string =>
  (ad || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(k => k[0] || '')
    .join('')
    .replace(/i/g, 'İ')
    .replace(/ı/g, 'I')
    .toUpperCase() || '?';

/** Adresin şehir kısmı: son "/" sonrası, yoksa son "," sonrası */
export const sehir = (adres?: string | null): string => {
  const a = adres || '';
  const p = a.split('/');
  return (p.length > 1 ? p[p.length - 1] : a.split(',').pop() || '').trim();
};

/** Kartta il metni: en fazla 2 il "A, B"; fazlası "A, B ve n il daha"; il yoksa adresteki şehir */
export const ilMetni = (iller: string[], adres?: string | null): string => {
  if (!iller.length) return adres ? sehir(adres) : '';
  if (iller.length <= 2) return iller.join(', ');
  return `${iller.slice(0, 2).join(', ')} ve ${iller.length - 2} il daha`;
};

// ─────────────── Zaman

/**
 * API tarihini okur. Sunucu UTC yazar ama bazı alanlarda "Z" eki olmaz ("2026-10-23T16:46:22.778332");
 * ek yoksa UTC kabul edilir. Hermes 3'ten uzun kesirli saniyeyi her sürümde okuyamadığı için elle ayrıştırılır.
 */
export const parseApiDate = (s?: string | null): number | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(String(s).trim());
  if (!m) {
    const t = Date.parse(String(s));
    return isNaN(t) ? null : t;
  }
  const ms = m[7] ? Number((m[7] + '00').slice(0, 3)) : 0;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0), ms);
  const tz = m[8];
  if (tz && tz.toUpperCase() !== 'Z') {
    const sign = tz[0] === '-' ? -1 : 1;
    const d = tz.slice(1).replace(':', '');
    t -= sign * (+d.slice(0, 2) * 60 + +d.slice(2, 4)) * 60000;
  }
  return t;
};

/** "az önce", "5 dk önce", "3 saat önce", "2 gün önce" */
export const onceSure = (t: number, now: number = Date.now()): string => {
  const dk = Math.floor((now - t) / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return dk + ' dk önce';
  const s = Math.floor(dk / 60);
  return s < 24 ? s + ' saat önce' : Math.floor(s / 24) + ' gün önce';
};

/** Kartın son hareket satırı: "Profil güncellendi, 3 saat önce" / "Hikaye paylaştı, az önce" */
export const sonHareketMetni = (t: number | null, tur?: string | null, now: number = Date.now()): string =>
  t ? `${tur === 'story' ? 'Hikaye paylaştı' : 'Profil güncellendi'}, ${onceSure(t, now)}` : '';

const iki = (n: number) => (n < 10 ? '0' : '') + n;
/** gg.aa.yyyy (cihaz saatiyle) */
export const tarihYaz = (t: number): string => {
  const d = new Date(t);
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// ─────────────── Telefon

/** Sadece rakamlar; 12 haneli ve 90 ile başlıyorsa 90 atılır; baştaki 0 atılır. Geçerli numara 10 hanedir. */
export const telNormal = (t?: string | null): string => {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
};

/** "0532 123 45 67"; 10 hane değilse yazıldığı gibi */
export const telGoster = (t?: string | null): string => {
  const d = telNormal(t);
  return d.length === 10 ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : String(t || '');
};

export const telGecerli = (t?: string | null): boolean => telNormal(t).length === 10;
export const telLink = (t?: string | null): string => 'tel:+90' + telNormal(t);
/** Sadece cep (10 hane, 5 ile başlar): https://wa.me/90XXXXXXXXXX */
export const waLink = (t?: string | null): string | null => {
  const d = telNormal(t);
  return d.length === 10 && d.startsWith('5') ? 'https://wa.me/90' + d : null;
};
export const haritaLink = (adres: string): string => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adres);

// ─────────────── Fiyat

/**
 * Türkçe fiyat okuma (deneme sürümündeki `fiyatOku`): boşluk, "tl", "₺" atılır. Virgül varsa noktalar binlik sayılır,
 * virgül ondalık olur ("1.250,50"). Virgül yoksa birden fazla nokta ya da "1.250" kalıbı binlik sayılır. Okunamazsa NaN.
 */
export const fiyatOku = (s?: string | number | null): number => {
  let v = String(s ?? '').trim().replace(/\s|tl|₺/gi, '');
  if (!v) return NaN;
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if ((v.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(v)) v = v.replace(/\./g, '');
  return Number(v);
};

/** Sunucunun kabul ettiği en yüksek fiyat (ShowcaseCatalog.MaxPrice) */
export const MAX_FIYAT = 1_000_000_000;

/** "1.250 TL", "1.250,50 TL" (kesir varsa 2 hane) */
export const fiyatYaz = (n: number): string => {
  const kesirli = n % 1 !== 0;
  const [tam, kesir] = (kesirli ? n.toFixed(2) : Math.round(n).toString()).split('.');
  const binlik = tam.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (kesir ? `${binlik},${kesir}` : binlik) + ' TL';
};

/** "1.250 TL / ton" (birim boşsa sadece fiyat) */
export const fiyatMetni = (fiyat: number, birim?: string | null): string => fiyatYaz(fiyat) + (birim ? ' / ' + birim : '');

/** Formdaki fiyat kutusu için: 1250.5 → "1250,5" */
export const fiyatGirdi = (n: number): string => String(n).replace('.', ',');

// ─────────────── İller

export type Il = { code: number; name: string };

/**
 * İl önerileri: önce baştan eşleşenler, sonra içinde geçenler; seçili iller hariç, en fazla `limit` (8).
 * `iller` sunucunun gönderdiği sıradadır (Türkçe alfabe).
 */
export const ilOnerileri = (sorgu: string, iller: Il[], secili: number[], limit = 8): Il[] => {
  const q = normTr(sorgu);
  if (!q) return [];
  const aday = iller.filter(il => !secili.includes(il.code));
  const bas = aday.filter(il => normTr(il.name).startsWith(q));
  const ici = aday.filter(il => !normTr(il.name).startsWith(q) && normTr(il.name).includes(q));
  return bas.concat(ici).slice(0, limit);
};

/** Seçili il kodlarını sunucu listesindeki (alfabetik) sıraya dizer */
export const illeriSirala = (kodlar: number[], iller: Il[]): number[] => {
  const sira = new Map(iller.map((il, i) => [il.code, i]));
  return [...kodlar].sort((a, b) => (sira.get(a) ?? 999) - (sira.get(b) ?? 999));
};

// ─────────────── Fotoğraf şablonları

export type FotoSablon = { title: string; hint: string; example: string };
export type Sablonlar = Record<string, FotoSablon[]>;

/**
 * İş alanlarına göre 8'lik fotoğraf başlığı şablonu (deneme sürümündeki `sablonAl`): şablonu olan alan yoksa "Genel";
 * tek alan varsa onun şablonu; birden fazlaysa seçim sırasıyla sırayla (i = 0..7) birer başlık alınır, aynı başlık atlanır.
 */
export const sablonAl = (sablonlar: Sablonlar, alanlar: string[]): FotoSablon[] => {
  const secili = (alanlar || []).filter(a => a !== 'Genel' && sablonlar[a] && sablonlar[a].length);
  if (!secili.length) return sablonlar.Genel || [];
  if (secili.length === 1) return sablonlar[secili[0]];
  const setler = secili.map(a => sablonlar[a]);
  const out: FotoSablon[] = [];
  const gor = new Set<string>();
  for (let i = 0; i < 8 && out.length < 8; i++) {
    for (const s of setler) {
      const e = s[i];
      if (e && !gor.has(e.title) && out.length < 8) {
        gor.add(e.title);
        out.push(e);
      }
    }
  }
  return out;
};

// ─────────────── Doğrulama

export const EPOSTA_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
