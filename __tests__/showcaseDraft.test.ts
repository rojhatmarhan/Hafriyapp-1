import { alanDegistir, dogrula, ilkHataBolumu, kapakYap, kayitGovdesi, sayfadanTaslak, Taslak, yeniTaslak } from '../src/screens/showcase/showcaseDraft';

const t = (title: string) => ({ title, hint: title + ' ipucu', example: title + ' örnek' });
const sablonlar = {
  Genel: ['Firmamız', 'Ekipmanlarımız', 'Ekibimiz', 'Tamamladığımız işler', 'Devam eden işler', 'Çalışma sahamız', 'Referanslarımız', 'Belgelerimiz'].map(t),
  Hafriyat: ['Firmamız', 'Kamyon filomuz', 'İş makinelerimiz', 'Ekibimiz', 'Tamamladığımız kazılar', 'Devam eden işler', 'Döküm sahalarımız', 'Belgelerimiz'].map(t),
  Nakliye: ['Araç filomuz', 'Damperli kamyonlar', 'Lowbed ve özel taşıma', 'Şoförlerimiz', 'Taşıdığımız yükler', 'Garaj ve bakım', 'Araç takip sistemimiz', 'Belgelerimiz'].map(t),
};

const doldur = (x: Taslak): Taslak => ({
  ...x,
  ad: 'Test Firma',
  alanlar: ['Hafriyat'],
  iller: [34],
  slotlar: x.slotlar.map((s, i) => (i === 0 ? { ...s, uri: 'file:///a.jpg', yeni: 'data:image/jpeg;base64,AAAA' } : s)),
});

describe('yeniTaslak', () => {
  it('8 Genel yuvası, bir boş telefon, önerilerle dolu', () => {
    const x = yeniTaslak(sablonlar, { canCreate: true, companyId: 'c1', suggestedName: 'Test Firma', suggestedPhone: '+905434950019', suggestedAddress: 'Bağcılar / İstanbul' });
    expect(x.slotlar).toHaveLength(8);
    expect(x.slotlar.map(s => s.baslik)[0]).toBe('Firmamız');
    expect(x.telefonlar).toEqual([{ numara: '0543 495 00 19', etiket: '' }]);
    expect(x.ad).toBe('Test Firma');
    expect(x.adres).toBe('Bağcılar / İstanbul');
    expect(x.companyId).toBe('c1');
    expect(x.duzenleme).toBe(false);
    expect(x.kdvDahil).toBe(false);
  });
});

describe('alanDegistir', () => {
  it('seçince etiket eklenir ve başlıklar değişir; bırakınca değiştirilmemiş etiket silinir', () => {
    let x = yeniTaslak(sablonlar);
    x = alanDegistir(x, 'Hafriyat', sablonlar);
    expect(x.alanlar).toEqual(['Hafriyat']);
    expect(x.etiketler).toEqual([{ metin: 'Hafriyat', alan: 'Hafriyat' }]);
    expect(x.slotlar[1].baslik).toBe('Kamyon filomuz');
    x = alanDegistir(x, 'Nakliye', sablonlar);
    expect(x.slotlar.map(s => s.baslik).slice(0, 4)).toEqual(['Firmamız', 'Araç filomuz', 'Kamyon filomuz', 'Damperli kamyonlar']);
    x = alanDegistir(x, 'Hafriyat', sablonlar);
    expect(x.etiketler).toEqual([{ metin: 'Nakliye', alan: 'Nakliye' }]);
    expect(x.slotlar[0].baslik).toBe('Araç filomuz');
  });

  it('kullanıcının değiştirdiği etiket ve özel başlık korunur', () => {
    let x = alanDegistir(yeniTaslak(sablonlar), 'Hafriyat', sablonlar);
    x = { ...x, etiketler: [{ metin: 'Temel kazısı', alan: 'Hafriyat' }], slotlar: x.slotlar.map((s, i) => (i === 1 ? { ...s, baslik: 'Benim başlığım', ozel: true } : s)) };
    x = alanDegistir(x, 'Hafriyat', sablonlar);
    expect(x.etiketler).toEqual([{ metin: 'Temel kazısı', alan: 'Hafriyat' }]);
    expect(x.slotlar[1].baslik).toBe('Benim başlığım');
    expect(x.slotlar[0].baslik).toBe('Firmamız');
  });

  it('6 etiketten fazlası eklenmez', () => {
    let x = yeniTaslak(sablonlar);
    x = { ...x, etiketler: Array.from({ length: 6 }, (_y, i) => ({ metin: 'E' + i, alan: null })) };
    x = alanDegistir(x, 'Hafriyat', sablonlar);
    expect(x.etiketler).toHaveLength(6);
    expect(x.alanlar).toEqual(['Hafriyat']);
  });
});

describe('dogrula', () => {
  it('boş taslak: sunucuyla aynı mesajlar', () => {
    const h = dogrula(yeniTaslak(sablonlar));
    expect(h.ad).toBe('Firma adını yazın.');
    expect(h.alanlar).toBe('En az bir iş alanı seçin.');
    expect(h.iller).toBe('Hizmet verdiğiniz en az bir ili seçin.');
    expect(h.fotolar).toBe('En az bir fotoğraf ekleyin.');
    expect(ilkHataBolumu(h)).toBe('ad');
  });

  it('telefon, e-posta ve fiyat satırları', () => {
    const x = doldur(yeniTaslak(sablonlar));
    const h = dogrula({
      ...x,
      telefonlar: [
        { numara: '0532 123 45', etiket: '' },
        { numara: '', etiket: 'Ofis' },
      ],
      eposta: 'ali@',
      fiyatlar: [
        { aciklama: '', fiyat: '1.250', birim: 'ton' },
        { aciklama: 'Kum', fiyat: 'abc', birim: 'ton' },
        { aciklama: '', fiyat: '', birim: 'sefer' },
        { aciklama: '', fiyat: 'x', birim: 'sefer' },
        { aciklama: 'Mıcır', fiyat: '1250,50', birim: '' },
      ],
    });
    expect(h.tel0).toBe('Geçerli bir telefon numarası yazın. Örn. 0532 123 45 67');
    expect(h.tel1).toBeUndefined();
    expect(h.eposta).toBe('E-posta adresini kontrol edin.');
    expect(h.fy0).toBe('Satır 1: açıklama yazın.');
    expect(h.fy1).toBe('Satır 2: geçerli bir fiyat yazın (örn. 1.250 ya da 1250,50).');
    expect(h.fy2).toBeUndefined();
    expect(h.fy3).toBe('Satır 4: açıklama yazın, geçerli bir fiyat yazın (örn. 1.250 ya da 1250,50).');
    expect(h.fy4).toBeUndefined();
    expect(h.ad).toBeUndefined();
    expect(ilkHataBolumu(h)).toBe('iletisim');
  });

  it('dolu taslak geçer', () => {
    expect(dogrula(doldur(yeniTaslak(sablonlar)))).toEqual({});
  });
});

describe('kapakYap', () => {
  it('yuvayı başa taşır', () => {
    const x = yeniTaslak(sablonlar);
    const y = kapakYap(x, 3);
    expect(y.slotlar[0].baslik).toBe('Tamamladığımız işler');
    expect(y.slotlar[1].baslik).toBe('Firmamız');
    expect(y.slotlar).toHaveLength(8);
  });
});

describe('sayfadanTaslak', () => {
  const sayfa = {
    id: 's1',
    companyId: 'c1',
    name: 'Kaya Hafriyat',
    logoUrl: '/uploads/logo.jpg',
    areas: ['Hafriyat'],
    customTags: ['Hafriyat ve kazı', 'Hafriyat'],
    provinces: [{ code: 34, name: 'İstanbul' }],
    address: 'Bağcılar / İstanbul',
    email: 'info@kaya.com',
    phones: [{ number: '5320001234', display: '0532 000 12 34', label: 'Şantiye', isMobile: true }],
    photos: [
      { id: 'p1', title: 'Kamyon filomuz', caption: 'Damperli', imageUrl: '/uploads/k.jpg' },
      { id: 'p2', title: 'Sahada çalışırken', caption: '', imageUrl: '/uploads/s.jpg' },
    ],
    prices: [{ description: 'Kırma kum', price: 1250.5, unit: 'ton' }],
    kdvIncluded: true,
    priceUpdatedAt: '2026-10-22T16:46:22.778332',
  };

  it('fotoğraflar aynı başlıklı yuvaya, yoksa ilk boş yuvaya (özel) yerleşir; kalan yuvalar eklenir', () => {
    const x = sayfadanTaslak(sayfa as any, sablonlar);
    expect(x.duzenleme).toBe(true);
    expect(x.slotlar).toHaveLength(8);
    expect(x.slotlar[0]).toMatchObject({ baslik: 'Kamyon filomuz', ozel: false, fotoId: 'p1', sablon: 1 });
    expect(x.slotlar[1]).toMatchObject({ baslik: 'Sahada çalışırken', ozel: true, fotoId: 'p2', sablon: 0 });
    expect(x.slotlar.slice(2).every(s => !s.uri)).toBe(true);
    expect(x.etiketler).toEqual([
      { metin: 'Hafriyat ve kazı', alan: null },
      { metin: 'Hafriyat', alan: 'Hafriyat' },
    ]);
    expect(x.fiyatlar).toEqual([{ aciklama: 'Kırma kum', fiyat: '1250,5', birim: 'ton' }]);
    expect(x.fiyatAcik).toBe(true);
    expect(x.telefonlar).toEqual([{ numara: '0532 000 12 34', etiket: 'Şantiye' }]);
    expect(x.logo).toMatchObject({ tur: 'mevcut' });
  });

  it('kayıt gövdesi: var olan fotoğraf sadece id ile, logo değişmediyse null', () => {
    const x = sayfadanTaslak(sayfa as any, sablonlar);
    const g = kayitGovdesi(x);
    expect(g.companyId).toBe('c1');
    expect(g.logo).toBeNull();
    expect(g.photos).toEqual([
      { id: 'p1', title: 'Kamyon filomuz', caption: 'Damperli' },
      { id: 'p2', title: 'Sahada çalışırken', caption: '' },
    ]);
    expect(g.prices).toEqual([{ description: 'Kırma kum', price: 1250.5, unit: 'ton' }]);
    expect(g.tags).toEqual(['Hafriyat ve kazı', 'Hafriyat']);
    expect(g.provinceCodes).toEqual([34]);
    expect(g.phones).toEqual([{ number: '0532 000 12 34', label: 'Şantiye' }]);
    expect(g.kdvIncluded).toBe(true);
  });

  it('logo kaldırılınca "", yeni logo data URL olarak gider', () => {
    const x = sayfadanTaslak(sayfa as any, sablonlar);
    expect(kayitGovdesi({ ...x, logo: null }).logo).toBe('');
    expect(kayitGovdesi({ ...x, logo: { uri: 'file:///l.jpg', tur: 'yeni', veri: 'data:image/jpeg;base64,BBBB' } }).logo).toBe('data:image/jpeg;base64,BBBB');
  });

  it('yeni fotoğraf base64 ile, boş yuvalar ve boş etiketler gönderilmez', () => {
    const x = doldur(yeniTaslak(sablonlar));
    const g = kayitGovdesi({ ...x, etiketler: [{ metin: ' ', alan: null }, { metin: 'Kazı', alan: null }, { metin: 'kazı', alan: null }] });
    expect(g.photos).toEqual([{ title: 'Firmamız', caption: '', imageBase64: 'data:image/jpeg;base64,AAAA' }]);
    expect(g.tags).toEqual(['Kazı']);
    expect(g.logo).toBeNull();
  });
});
