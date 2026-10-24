// Firma tanıtımı tasarım değerleri (deneme sürümünün CSS değişkenleriyle birebir). Uygulamanın geri kalanı #FFD500 kullanır;
// bu ekranlar bilerek deneme sürümünün sarısını (#FAD211) kullanır.

export const C = {
  sari: '#FAD211',
  banner: '#FAD211',
  sariKoyu: '#6B5600',
  asfalt: '#1E1E1C',
  gri: '#6B6A66',
  zemin: '#ECE9E3',
  cizgi: '#D9D5CC',
  hata: '#B3261E',
  metin: '#3B3A37',
  kesik: '#C9C6BE',
  kesikZemin: '#FAFAF8',
  bosYildiz: '#CFCBC2',
  cubuk: '#ECEAE5',
  ayrac: '#E9E7E2',
  testZemin: '#FFF4D1',
  testCizgi: '#EBD48A',
  testMetin: '#5C4500',
  soluk: '#F6F5F2',
  yerTutucu: '#9B978F',
  perde: 'rgba(20,20,18,0.55)',
  beyaz: '#FFFFFF',
};

// fontWeight kullanılmaz: Android'de ağırlık yerine dosya adı seçer, iOS'ta PostScript adı. İkisi aynı ada sahip.
export const F = {
  r: 'Barlow-Regular',
  m: 'Barlow-Medium',
  sb: 'Barlow-SemiBold',
  c6: 'BarlowCondensed-SemiBold',
  c7: 'BarlowCondensed-Bold',
};

/** Kart gölgesi: 0 1px 2px rgba(30,30,28,.08), 0 6px 18px rgba(30,30,28,.10) */
export const KART_GOLGE = '0px 1px 2px rgba(30,30,28,0.08), 0px 6px 18px rgba(30,30,28,0.10)';
export const KART_GOLGE_BASILI = '0px 1px 2px rgba(30,30,28,0.14)';
export const PENCERE_GOLGE = '0px 10px 40px rgba(0,0,0,0.3)';
export const ODAK_HALKA = '0px 0px 0px 3px #FAD211';
