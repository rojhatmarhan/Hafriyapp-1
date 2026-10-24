import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import MarketCategoryPicker, { COMPACT_HEIGHT, MarketCategory } from '../src/components/MarketCategoryPicker';

// Pazar giriş ekranının 3 kategori kartı: her genişliğe sığması için tek satır + eşit (flex) kart,
// dokunma alanı ≥ 44 dp, yazı büyütme sınırlı, alçak ekranda kompakt başlık.

const CATS: MarketCategory[] = [
  { type: 0, label: 'Araç Kiralama', icon: '🚛', iconBg: '#DBEAFE' },
  { type: 1, label: 'Al-Sat', icon: '🏬', iconBg: '#DCFCE7' },
  { type: 2, label: 'Şoför İlanları', icon: '👤', iconBg: '#FFEDD5' },
];

const render = async (el: React.ReactElement) => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(el);
  });
  return renderer!;
};

// react-native index'i hook'u getter ile verdiği için modülün kendisi sahtelenir
const mockDims = { width: 360, height: 640, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDims,
}));
const mockWindow = (width: number, height: number) => {
  mockDims.width = width;
  mockDims.height = height;
};

describe('MarketCategoryPicker', () => {
  it('dikey ekranda 3 kartı alt alta, ekranı eşit paylaşan geniş kartlar olarak gösterir ve seçimi bildirir', async () => {
    mockWindow(320, 640);
    const onSelect = jest.fn();
    const r = await render(<MarketCategoryPicker categories={CATS} onSelect={onSelect} />);

    const cards = r.root.findAllByType(TouchableOpacity);
    expect(cards).toHaveLength(3);
    cards.forEach(card => {
      const st = StyleSheet.flatten(card.props.style);
      expect(st.flex).toBe(1); // kalan yüksekliği eşit paylaşır → altı boş kalmaz
      expect(st.width).toBeUndefined(); // sabit genişlik yok → 320 dp'de de taşmaz
      expect(st.minHeight).toBeGreaterThanOrEqual(44);
      expect(st.maxHeight).toBeGreaterThan(st.minHeight);
      expect(card.props.accessibilityRole).toBe('button');
    });
    // Kartlar alt alta (sütun) ve sütun kalan alanı doldurur
    const column = StyleSheet.flatten(cards[0].parent!.props.style);
    expect(column.flexDirection).toBeUndefined();
    expect(column.flex).toBe(1);

    await ReactTestRenderer.act(() => {
      cards[2].props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('etiketleri ve açıklamaları okunur boyutta, sınırlı yazı büyütmeyle gösterir', async () => {
    mockWindow(360, 640);
    const cats = CATS.map(c => ({ ...c, description: c.label + ' açıklaması' }));
    const r = await render(<MarketCategoryPicker categories={cats} onSelect={() => {}} />);
    const label = r.root.findAllByType(Text).find(t => t.props.children === 'Şoför İlanları')!;
    expect(label).toBeTruthy();
    expect(label.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
    expect(StyleSheet.flatten(label.props.style).fontSize).toBeGreaterThanOrEqual(13);
    const desc = r.root.findAllByType(Text).find(t => t.props.children === 'Şoför İlanları açıklaması')!;
    expect(desc.props.numberOfLines).toBe(2);
  });

  it('yatay telefonda kartlar tek satırda yan yana', async () => {
    mockWindow(800, COMPACT_HEIGHT - 160);
    const r = await render(<MarketCategoryPicker categories={CATS} onSelect={() => {}} />);
    const cards = r.root.findAllByType(TouchableOpacity);
    expect(StyleSheet.flatten(cards[0].parent!.props.style).flexDirection).toBe('row');
    const label = r.root.findAllByType(Text).find(t => t.props.children === 'Şoför İlanları')!;
    expect(label.props.numberOfLines).toBe(2);
  });

  it('alçak ekranda (yatay telefon) kompakt başlık kullanır ve kaydırılabilir', async () => {
    mockWindow(800, COMPACT_HEIGHT - 160);
    const r = await render(<MarketCategoryPicker categories={CATS} onSelect={() => {}} />);
    expect(r.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
    const title = r.root.findAllByType(Text).find(t => t.props.children === 'Pazar')!;
    const compactTitle = StyleSheet.flatten(title.props.style).fontSize;

    mockWindow(360, 640);
    const r2 = await render(<MarketCategoryPicker categories={CATS} onSelect={() => {}} />);
    const title2 = r2.root.findAllByType(Text).find(t => t.props.children === 'Pazar')!;
    expect(compactTitle).toBeLessThan(StyleSheet.flatten(title2.props.style).fontSize);
  });
});
