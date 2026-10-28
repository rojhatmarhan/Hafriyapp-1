import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const R = require('react');
  return { ...actual, useFocusEffect: (cb: any) => R.useEffect(() => cb(), [cb]) };
});

jest.mock('../src/services/showcaseService', () => {
  const actual = jest.requireActual('../src/services/showcaseService');
  return {
    ...actual,
    getShowcaseOptions: jest.fn(),
    getShowcaseList: jest.fn(),
    getMyShowcase: jest.fn(),
    getShowcaseDetail: jest.fn(),
    getShowcasePrices: jest.fn(),
    saveMyShowcase: jest.fn(),
  };
});

import * as servis from '../src/services/showcaseService';
import ShowcaseDetailView, { detaydanGorunum } from '../src/screens/showcase/ShowcaseDetailView';
import ShowcaseListScreen, { bulunamadiMetni, FirmaKarti } from '../src/screens/showcase/ShowcaseListScreen';
import ShowcaseFormScreen from '../src/screens/showcase/ShowcaseFormScreen';

const m = servis as jest.Mocked<typeof servis>;

const render = async (el: React.ReactElement) => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(el);
  });
  return r!;
};
const metinler = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map(t => {
      const c = t.props.children;
      return Array.isArray(c) ? c.filter(x => typeof x === 'string' || typeof x === 'number').join('') : typeof c === 'string' || typeof c === 'number' ? String(c) : '';
    })
    .filter(Boolean);

const ornek = {
  id: 'k1',
  name: 'Kaya Hafriyat',
  tags: ['Hafriyat ve kazı', 'Nakliye'],
  areas: ['Hafriyat', 'Nakliye'],
  provinces: [
    { code: 34, name: 'İstanbul' },
    { code: 41, name: 'Kocaeli' },
    { code: 54, name: 'Sakarya' },
  ],
  address: 'Bağcılar / İstanbul',
  ratingAverage: 0,
  reviewCount: 0,
  lastActivityAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  lastActivityType: 'profile',
  isSample: true,
};

describe('FirmaKarti', () => {
  it('Örnek rozeti, baş harfler, il metni ve son hareket', async () => {
    const r = await render(<FirmaKarti f={ornek} onPress={() => {}} simdi={Date.now()} />);
    const t = metinler(r);
    expect(t).toContain('Örnek');
    expect(t).toContain('KH');
    expect(t).toContain('Hafriyat ve kazı, Nakliye');
    expect(t).toContain('İstanbul, Kocaeli ve 1 il daha');
    expect(t).toContain('Profil güncellendi, 3 saat önce');
  });

  it('boş filtre metni', () => {
    expect(bulunamadiMetni('İstanbul', 'kum')).toBe('İstanbul ilinde "kum" ile eşleşen firma bulunamadı.');
    expect(bulunamadiMetni(null, '')).toBe('firma bulunamadı.');
    expect(bulunamadiMetni(null, ' yıkım ')).toBe('"yıkım" ile eşleşen firma bulunamadı.');
  });
});

describe('ShowcaseDetailView', () => {
  const detay = {
    ...ornek,
    canEdit: false,
    hasPrices: false,
    phones: [
      { number: '5320001234', display: '0532 000 12 34', label: 'Şantiye', isMobile: true },
      { number: '2120004567', display: '0212 000 45 67', label: 'Ofis', isMobile: false },
    ],
    email: 'info@kaya.com',
    photos: [{ id: 'p1', title: 'Kamyon filomuz', caption: 'Damperli kamyonlar', imageUrl: '/uploads/k.jpg' }],
  };

  it('ziyaretçi: yorum yok metinleri, iller, telefon, WhatsApp; fiyat yoksa düğme yok', async () => {
    const r = await render(<ShowcaseDetailView g={detaydanGorunum(detay)} />);
    const t = metinler(r);
    expect(t).toContain('Henüz yorum yok');
    expect(t).toContain('Bu firma için henüz yorum yok. İlk yorumu siz yazın.');
    expect(t).toContain('Hizmet verdiği iller: İstanbul, Kocaeli, Sakarya');
    expect(t).toContain('0532 000 12 34');
    expect(t.filter(x => x === 'WhatsApp')).toHaveLength(1);
    expect(t).toContain('Kamyon filomuz');
    expect(t).not.toContain('Fiyat listesi');
    expect(t).not.toContain('Sayfayı düzenle');
    expect(t).not.toContain('Profili paylaş');
    expect(t).not.toContain('Yorum yaz');
  });

  it('sahip: düzenle düğmesi ve sahip metni; fiyat varsa fiyat düğmesi', async () => {
    const r = await render(<ShowcaseDetailView g={detaydanGorunum({ ...detay, canEdit: true, hasPrices: true, photos: [] })} />);
    const t = metinler(r);
    expect(t).toContain('Sayfayı düzenle');
    expect(t).toContain('Fiyat listesi');
    expect(t).toContain('Firmanız için henüz yorum yapılmadı.');
    expect(t).toContain('Bu firma henüz fotoğraf eklemedi.');
    expect(t).not.toContain('Teklif hazırla');
  });

  it('önizleme: uyarı bandı, puan ve yorum bölümü yok', async () => {
    const r = await render(<ShowcaseDetailView g={detaydanGorunum(detay)} onizleme />);
    const t = metinler(r);
    expect(t.some(x => x.includes('Önizleme.') && x.includes('henüz yayınlanmadı.'))).toBe(true);
    expect(t).not.toContain('Henüz yorum yok');
    expect(t).not.toContain('Yorumlar ve puanlar');
  });
});

describe('ShowcaseListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('API eskiyse (404) WebView ekranına geçer', async () => {
    const hata: any = new Error('404');
    hata.response = { status: 404 };
    m.getShowcaseOptions.mockRejectedValue(hata);
    m.getShowcaseList.mockRejectedValue(hata);
    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    await render(<ShowcaseListScreen navigation={navigation} />);
    expect(navigation.replace).toHaveBeenCalledWith('CompanyShowcase');
    expect(navigation.replace).toHaveBeenCalledTimes(1);
  });

  it('listeyi ve il seçeneklerini gösterir', async () => {
    m.getShowcaseOptions.mockResolvedValue({ areas: [], units: [], provinces: [], templates: {} });
    m.getShowcaseList.mockResolvedValue({ items: [ornek], totalCount: 1, page: 1, totalPages: 1, provinceCounts: [{ code: 34, name: 'İstanbul', count: 3 }] });
    const navigation = { replace: jest.fn(), navigate: jest.fn() };
    const r = await render(<ShowcaseListScreen navigation={navigation} />);
    const t = metinler(r);
    expect(t).toContain('Sektör Firmaları');
    expect(t).toContain('Kaya Hafriyat');
    expect(t).toContain('Tüm iller');
    expect(t).toContain('Firmanı tanıt');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('hiç firma yoksa ilk tanıtım metni', async () => {
    m.getShowcaseOptions.mockResolvedValue({ areas: [], units: [], provinces: [], templates: {} });
    m.getShowcaseList.mockResolvedValue({ items: [], totalCount: 0, page: 1, totalPages: 0, provinceCounts: [] });
    const r = await render(<ShowcaseListScreen navigation={{ navigate: jest.fn() }} />);
    expect(metinler(r)).toContain('Henüz tanıtılan firma yok. İlk tanıtımı siz yapın.');
  });
});

describe('ShowcaseFormScreen', () => {
  const sablon = (title: string) => ({ title, hint: title + ' ipucu', example: title + ' örnek' });
  beforeEach(() => {
    jest.clearAllMocks();
    m.getShowcaseOptions.mockResolvedValue({
      areas: ['Hafriyat', 'Nakliye', 'Diğer'],
      units: ['sefer', 'ton', ''],
      provinces: [
        { code: 34, name: 'İstanbul' },
        { code: 41, name: 'Kocaeli' },
      ],
      templates: { Genel: ['Firmamız', 'Ekipmanlarımız', 'Ekibimiz', 'G4', 'G5', 'G6', 'G7', 'Belgelerimiz'].map(sablon), Hafriyat: ['Firmamız', 'Kamyon filomuz', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8'].map(sablon) },
    });
    m.getMyShowcase.mockResolvedValue({ canCreate: true, companyId: 'c1', suggestedName: 'Test Firma', suggestedPhone: '+905434950019' });
  });

  const navigation = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });

  it('yeni sayfa: öneriler dolu, 8 yuva ve sabit metinler', async () => {
    const r = await render(<ShowcaseFormScreen navigation={navigation()} route={{ params: { companyId: 'c1' } }} />);
    const t = metinler(r);
    expect(t).toContain('Firmanı tanıt');
    expect(t).toContain('Boşlukları doldurun, önizleyin ve yayınlayın. Sayfanız firmalar listesinde görünecek.');
    expect(t.filter(x => x === '+ Fotoğraf ekle')).toHaveLength(8);
    expect(t).toContain('Önerilen başlık. Silip kendi başlığınızı yazabilirsiniz.');
    expect(t).toContain('+ Fiyat listesi ekle');
    const ad = r.root.findByProps({ testID: 'firma-adi' });
    expect(ad.props.value).toBe('Test Firma');
  });

  it('Önizle doğrulamadan geçmezse hata metinleri görünür', async () => {
    const r = await render(<ShowcaseFormScreen navigation={navigation()} route={{ params: {} }} />);
    const onizle = r.root.findAll(n => n.props.testID === 'onizle' && typeof n.props.onPress === 'function')[0];
    await ReactTestRenderer.act(async () => {
      onizle.props.onPress();
    });
    const t = metinler(r);
    expect(t).toContain('En az bir iş alanı seçin.');
    expect(t).toContain('Hizmet verdiğiniz en az bir ili seçin.');
    expect(t).toContain('En az bir fotoğraf ekleyin.');
    expect(t).not.toContain('Firma adını yazın.');
  });

  it('il yazınca öneri çıkar, seçince çip olur', async () => {
    const r = await render(<ShowcaseFormScreen navigation={navigation()} route={{ params: {} }} />);
    const giris = r.root.findAll(n => n.props.testID === 'il-ara' && typeof n.props.onChangeText === 'function')[0];
    await ReactTestRenderer.act(async () => {
      giris.props.onChangeText('koc');
    });
    expect(metinler(r)).toContain('+ Kocaeli');
    await ReactTestRenderer.act(async () => {
      giris.props.onSubmitEditing();
    });
    expect(metinler(r)).toContain('Kocaeli ×');
    await ReactTestRenderer.act(async () => {
      giris.props.onChangeText('xyz');
    });
    expect(metinler(r)).toContain('Eşleşen il bulunamadı.');
  });
});
