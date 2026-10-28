import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SectionList, Text, TextInput } from 'react-native';

// Ana sayfa (FİRMA SAYFALARI): üst kısım listeyle birlikte kayar, sadece "Ara | il | +" satırı sabit (sticky) kalır.
// Arama kutusu yazarken yeniden oluşmamalı (oluşursa odak/klavye kaybolur).

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

const mockState = { ui: { selectedCity: null }, auth: { token: null, user: null } };
jest.mock('../src/hooks', () => ({
  useAppSelector: (sel: (s: any) => any) => sel(mockState),
  useAppDispatch: () => jest.fn(),
}));
jest.mock('../src/hooks/useActiveUserCount', () => ({ useActiveUserCount: () => 3 }));
jest.mock('../src/services/chatService', () => ({
  getChatGroups: jest.fn(),
  createChatGroup: jest.fn(),
  uploadGroupImage: jest.fn(),
  toggleChatGroupPin: jest.fn(),
  getGroupDetail: jest.fn(),
}));
jest.mock('../src/services/userService', () => ({ getProfile: jest.fn() }));

import SupplierHome from '../src/screens/supplier/SupplierHome';
import DriverHome from '../src/screens/driver/DriverHome';
import { shouldStickSearch } from '../src/hooks/useStickySearch';

const acik: ReactTestRenderer.ReactTestRenderer[] = [];
const render = async (el: React.ReactElement) => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(el);
  });
  acik.push(r!);
  return r!;
};

// Arama gecikmesi (400 ms) ve liste zamanlayıcıları test bittikten sonra çalışmasın
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    jest.runOnlyPendingTimers();
  });
  await ReactTestRenderer.act(async () => {
    acik.splice(0).forEach(r => r.unmount());
  });
  jest.useRealTimers();
});

const metinVar = (node: ReactTestRenderer.ReactTestInstance, metin: string) => node.findAllByType(Text).some(t => t.props.children === metin);

describe.each([
  ['SupplierHome', SupplierHome],
  ['DriverHome', DriverHome],
])('%s üst kısım düzeni', (_ad, Ekran) => {
  it('başlık liste başlığında (kayar), arama satırı sabit bölüm başlığında', async () => {
    const r = await render(<Ekran />);
    const list = r.root.findByType(SectionList);
    expect(list.props.stickySectionHeadersEnabled).toBe(true);

    // Liste başlığı bileşen fonksiyonu değil eleman olmalı (her render'da yeniden oluşmasın)
    const header = list.props.ListHeaderComponent;
    expect(React.isValidElement(header)).toBe(true);
    const headerR = await render(header);
    expect(metinVar(headerR.root, 'FİRMA SAYFALARI')).toBe(true);
    expect(metinVar(headerR.root, 'Sektör Firmaları')).toBe(true);
    expect(headerR.root.findAllByType(TextInput)).toHaveLength(0);

    // Sabit kısım sadece arama satırı
    const sticky = await render(list.props.renderSectionHeader({ section: list.props.sections[0] }));
    expect(sticky.root.findAllByType(TextInput)).toHaveLength(1);
    expect(metinVar(sticky.root, 'FİRMA SAYFALARI')).toBe(false);
  });

  it('yazarken arama kutusu aynı kalır (odak kaybolmaz)', async () => {
    const r = await render(<Ekran />);
    const input = () => r.root.findByProps({ placeholder: 'Ara' });
    const ilk = input().instance;
    await ReactTestRenderer.act(async () => {
      input().props.onChangeText('ka');
    });
    await ReactTestRenderer.act(async () => {
      input().props.onChangeText('kay');
    });
    expect(input().props.value).toBe('kay');
    expect(input().instance).toBe(ilk);
  });
});

describe('shouldStickSearch', () => {
  it('dikey telefonda (360×640) arama satırı sabit, yatayda (800×360) tüm sayfa kayar', () => {
    expect(shouldStickSearch(640)).toBe(true);
    expect(shouldStickSearch(568)).toBe(true); // 320×568 (en küçük iPhone)
    expect(shouldStickSearch(360)).toBe(false);
    expect(shouldStickSearch(320)).toBe(false);
  });
});
