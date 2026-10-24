import { basHarf, fiyatMetni, fiyatOku, fiyatYaz, ilMetni, ilOnerileri, illeriSirala, normTr, onceSure, parseApiDate, sablonAl, sehir, sonHareketMetni, tarihYaz, telGecerli, telGoster, telLink, telNormal, waLink } from '../src/utils/showcaseFormat';
import { showcaseImageUrl } from '../src/services/showcaseService';

describe('fiyatOku (Türkçe fiyat)', () => {
  it.each([
    ['1.250', 1250],
    ['1250,50', 1250.5],
    ['1.250,50', 1250.5],
    ['1.250.000', 1250000],
    ['1250.50', 1250.5],
    ['1250', 1250],
    [' 700 TL', 700],
    ['₺ 2.600', 2600],
    ['0', 0],
    ['12.5', 12.5],
  ])('%s → %s', (girdi, beklenen) => {
    expect(fiyatOku(girdi)).toBe(beklenen);
  });

  it('boş ya da okunamayan değer NaN', () => {
    expect(fiyatOku('')).toBeNaN();
    expect(fiyatOku('   ')).toBeNaN();
    expect(fiyatOku('abc')).toBeNaN();
    expect(fiyatOku(null)).toBeNaN();
  });

  it('negatif sayı okunur (doğrulama reddeder)', () => {
    expect(fiyatOku('-5')).toBe(-5);
  });
});

describe('fiyatYaz / fiyatMetni', () => {
  it('binlik nokta, kesir varsa iki hane', () => {
    expect(fiyatYaz(1250)).toBe('1.250 TL');
    expect(fiyatYaz(1250.5)).toBe('1.250,50 TL');
    expect(fiyatYaz(700)).toBe('700 TL');
    expect(fiyatYaz(24000)).toBe('24.000 TL');
    expect(fiyatYaz(1000000)).toBe('1.000.000 TL');
  });
  it('birim varsa " / birim"', () => {
    expect(fiyatMetni(1250, 'ton')).toBe('1.250 TL / ton');
    expect(fiyatMetni(1250, '')).toBe('1.250 TL');
    expect(fiyatMetni(9000, null)).toBe('9.000 TL');
  });
});

describe('telefon', () => {
  it('normalleştirme', () => {
    expect(telNormal('0532 123 45 67')).toBe('5321234567');
    expect(telNormal('+90 532 123 45 67')).toBe('5321234567');
    expect(telNormal('905321234567')).toBe('5321234567');
    expect(telNormal('5321234567')).toBe('5321234567');
    expect(telNormal('(0212) 000-45-67')).toBe('2120004567');
  });
  it('gösterim', () => {
    expect(telGoster('+905434950019')).toBe('0543 495 00 19');
    expect(telGoster('2120004567')).toBe('0212 000 45 67');
    expect(telGoster('123')).toBe('123');
  });
  it('geçerlilik ve bağlantılar', () => {
    expect(telGecerli('0532 123 45 67')).toBe(true);
    expect(telGecerli('0532 123 45')).toBe(false);
    expect(telLink('0532 123 45 67')).toBe('tel:+905321234567');
    expect(waLink('0532 123 45 67')).toBe('https://wa.me/905321234567');
    expect(waLink('0212 000 45 67')).toBeNull();
  });
});

describe('ilMetni (kart il satırı)', () => {
  it('en fazla iki il, fazlası "ve n il daha"', () => {
    expect(ilMetni(['İstanbul'])).toBe('İstanbul');
    expect(ilMetni(['İstanbul', 'Tekirdağ'])).toBe('İstanbul, Tekirdağ');
    expect(ilMetni(['İstanbul', 'Kocaeli', 'Sakarya', 'Yalova'])).toBe('İstanbul, Kocaeli ve 2 il daha');
  });
  it('il yoksa adresteki şehir', () => {
    expect(ilMetni([], 'Mahmutbey Mah., Bağcılar / İstanbul')).toBe('İstanbul');
    expect(ilMetni([], 'Gebze, Kocaeli')).toBe('Kocaeli');
    expect(ilMetni([], '')).toBe('');
    expect(sehir('Ormanlı Mah., Çatalca / İstanbul')).toBe('İstanbul');
  });
});

describe('onceSure ve son hareket', () => {
  const simdi = Date.UTC(2026, 9, 24, 12, 0, 0);
  it('metinler', () => {
    expect(onceSure(simdi - 20 * 1000, simdi)).toBe('az önce');
    expect(onceSure(simdi - 5 * 60000, simdi)).toBe('5 dk önce');
    expect(onceSure(simdi - 59 * 60000, simdi)).toBe('59 dk önce');
    expect(onceSure(simdi - 3 * 3600000, simdi)).toBe('3 saat önce');
    expect(onceSure(simdi - 23 * 3600000, simdi)).toBe('23 saat önce');
    expect(onceSure(simdi - 26 * 3600000, simdi)).toBe('1 gün önce');
    expect(onceSure(simdi - 4 * 86400000, simdi)).toBe('4 gün önce');
  });
  it('kart satırı', () => {
    expect(sonHareketMetni(simdi - 3 * 3600000, 'profile', simdi)).toBe('Profil güncellendi, 3 saat önce');
    expect(sonHareketMetni(simdi - 60000, 'story', simdi)).toBe('Hikaye paylaştı, 1 dk önce');
    expect(sonHareketMetni(null, 'profile', simdi)).toBe('');
  });
});

describe('parseApiDate', () => {
  it('Z eki olmayan tarih UTC sayılır, uzun kesir okunur', () => {
    expect(parseApiDate('2026-10-23T16:46:22.778332')).toBe(Date.UTC(2026, 9, 23, 16, 46, 22, 778));
    expect(parseApiDate('2026-10-23T16:46:22Z')).toBe(Date.UTC(2026, 9, 23, 16, 46, 22));
    expect(parseApiDate('2026-10-23T19:46:22+03:00')).toBe(Date.UTC(2026, 9, 23, 16, 46, 22));
    expect(parseApiDate(null)).toBeNull();
    expect(parseApiDate('')).toBeNull();
  });
  it('tarihYaz gg.aa.yyyy', () => {
    expect(tarihYaz(new Date(2026, 9, 2, 10).getTime())).toBe('02.10.2026');
  });
});

describe('Türkçe arama', () => {
  it('normTr harfleri sadeleştirir', () => {
    expect(normTr('İSTANBUL')).toBe('istanbul');
    expect(normTr('Iğdır')).toBe('igdir');
    expect(normTr('  Şanlıurfa   Çorum ')).toBe('sanliurfa corum');
    expect(normTr('Kâğıthane')).toBe('kagithane');
    expect(normTr('ÖZGÜR')).toBe('ozgur');
  });

  const iller = [
    { code: 1, name: 'Adana' },
    { code: 6, name: 'Ankara' },
    { code: 34, name: 'İstanbul' },
    { code: 35, name: 'İzmir' },
    { code: 41, name: 'Kocaeli' },
    { code: 54, name: 'Sakarya' },
    { code: 63, name: 'Şanlıurfa' },
    { code: 76, name: 'Iğdır' },
  ];
  it('önce baştan eşleşenler, sonra içinde geçenler; seçililer hariç', () => {
    expect(ilOnerileri('an', iller, []).map(i => i.name)).toEqual(['Ankara', 'Adana', 'İstanbul', 'Şanlıurfa']);
    expect(ilOnerileri('istan', iller, []).map(i => i.name)).toEqual(['İstanbul']);
    expect(ilOnerileri('ISTANBUL', iller, []).map(i => i.name)).toEqual(['İstanbul']);
    expect(ilOnerileri('sanli', iller, []).map(i => i.name)).toEqual(['Şanlıurfa']);
    expect(ilOnerileri('igd', iller, []).map(i => i.name)).toEqual(['Iğdır']);
    expect(ilOnerileri('a', iller, [6, 1]).map(i => i.code)).not.toContain(6);
    expect(ilOnerileri('', iller, [])).toEqual([]);
    expect(ilOnerileri('xyz', iller, [])).toEqual([]);
  });
  it('en fazla 8 öneri', () => {
    const cok = Array.from({ length: 20 }, (_x, i) => ({ code: i + 1, name: 'Ankara' + i }));
    expect(ilOnerileri('ank', cok, [])).toHaveLength(8);
  });
  it('seçili iller sunucu sırasına dizilir', () => {
    expect(illeriSirala([41, 1, 34], iller)).toEqual([1, 34, 41]);
  });
});

describe('basHarf', () => {
  it('ilk iki kelimenin baş harfleri', () => {
    expect(basHarf('Kaya Hafriyat')).toBe('KH');
    expect(basHarf('ilk iş makinesi')).toBe('İİ');
    expect(basHarf('ışık')).toBe('I');
    expect(basHarf('')).toBe('?');
  });
});

describe('sablonAl (fotoğraf başlıkları)', () => {
  const t = (title: string) => ({ title, hint: title + ' ipucu', example: title + ' örnek' });
  const sablonlar = {
    Genel: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'].map(t),
    Hafriyat: ['Firmamız', 'Kamyon filomuz', 'İş makinelerimiz', 'Ekibimiz', 'H5', 'H6', 'H7', 'Belgelerimiz'].map(t),
    Nakliye: ['Araç filomuz', 'Damperli kamyonlar', 'N3', 'Şoförlerimiz', 'N5', 'N6', 'N7', 'Belgelerimiz'].map(t),
  };
  it('alan yoksa ya da şablonsuz alan (Diğer) seçiliyse Genel', () => {
    expect(sablonAl(sablonlar, []).map(x => x.title)[0]).toBe('G1');
    expect(sablonAl(sablonlar, ['Diğer']).map(x => x.title)[0]).toBe('G1');
  });
  it('tek alan → o alanın şablonu', () => {
    expect(sablonAl(sablonlar, ['Hafriyat']).map(x => x.title)).toEqual(sablonlar.Hafriyat.map(x => x.title));
    expect(sablonAl(sablonlar, ['Hafriyat', 'Diğer']).map(x => x.title)).toEqual(sablonlar.Hafriyat.map(x => x.title));
  });
  it('birden fazla alan → seçim sırasıyla sırayla, tekrar eden başlık atlanır, 8 yuva', () => {
    expect(sablonAl(sablonlar, ['Hafriyat', 'Nakliye']).map(x => x.title)).toEqual(['Firmamız', 'Araç filomuz', 'Kamyon filomuz', 'Damperli kamyonlar', 'İş makinelerimiz', 'N3', 'Ekibimiz', 'Şoförlerimiz']);
    expect(sablonAl(sablonlar, ['Nakliye', 'Hafriyat']).map(x => x.title)[0]).toBe('Araç filomuz');
  });
});

describe('showcaseImageUrl', () => {
  it('göreli yolu sunucu adresiyle birleştirir', () => {
    expect(showcaseImageUrl('/uploads/a.jpg', 'http://localhost:5062')).toBe('http://localhost:5062/uploads/a.jpg');
    expect(showcaseImageUrl('uploads/a.jpg', 'http://localhost:5062')).toBe('http://localhost:5062/uploads/a.jpg');
    expect(showcaseImageUrl('https://x.com/a.jpg', 'http://localhost:5062')).toBe('https://x.com/a.jpg');
    expect(showcaseImageUrl('file:///tmp/a.jpg')).toBe('file:///tmp/a.jpg');
    expect(showcaseImageUrl(null)).toBeNull();
  });
});
