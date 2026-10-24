import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import TagIcon from './TagIcon';

// ── Pazar giriş ekranı: başlık + 3 kategori kartı (Araç Kiralama, Al-Sat, Şoför İlanları).
// Dikey ekranda kartlar alt alta, kalan yüksekliği eşit paylaşır (flex) → ekranın altı boş kalmaz, küçük telefonda
// en az 96 dp'ye iner, büyük ekranda 170 dp'yi geçmez. Alçak ekranda (yatay telefon) kartlar tek satırda yan yana,
// başlık küçük; yine sığmazsa sayfa kayar (kesilmez).
// Büyük sistem yazı boyutunda düzen bozulmasın diye yazı büyütme sınırlıdır (maxFontSizeMultiplier).

export type MarketCategory = { type: number; label: string; icon: string; iconBg: string; description?: string };

type Props = {
  categories: MarketCategory[];
  onSelect: (type: number) => void;
  subtitle?: string;
};

// Bu yükseklikten alçak pencerede (ör. 800×360 yatay) kompakt başlık
export const COMPACT_HEIGHT = 520;
const MAX_CONTENT_WIDTH = 720;
const FONT_SCALE_MAX = 1.3;

export default function MarketCategoryPicker({ categories, onSelect, subtitle = 'Kategoriye tıklayarak pazar ilanlarını görüntüleyin' }: Props) {
  const { height } = useWindowDimensions();
  const compact = height < COMPACT_HEIGHT;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} testID="market-category-picker">
      <View style={styles.inner}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
            <TagIcon size={compact ? 26 : 38} color="#000" />
          </View>
          <View style={[styles.headerText, compact && styles.headerTextCompact]}>
            <Text style={[styles.title, compact && styles.titleCompact]} maxFontSizeMultiplier={FONT_SCALE_MAX}>
              Pazar
            </Text>
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]} maxFontSizeMultiplier={FONT_SCALE_MAX}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={compact ? styles.row : styles.column}>
          {categories.map(c =>
            compact ? (
              <TouchableOpacity
                key={c.type}
                style={[styles.card, styles.cardCompact]}
                onPress={() => onSelect(c.type)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                testID={`market-category-${c.type}`}>
                <View style={[styles.cardIcon, styles.cardIconCompact, { backgroundColor: c.iconBg }]}>
                  <Text style={[styles.cardEmoji, styles.cardEmojiCompact]} maxFontSizeMultiplier={1.2}>
                    {c.icon}
                  </Text>
                </View>
                <Text style={styles.cardLabel} numberOfLines={2} maxFontSizeMultiplier={FONT_SCALE_MAX}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={c.type}
                style={styles.wideCard}
                onPress={() => onSelect(c.type)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                testID={`market-category-${c.type}`}>
                <View style={[styles.wideIcon, { backgroundColor: c.iconBg }]}>
                  <Text style={styles.wideEmoji} maxFontSizeMultiplier={1.2}>
                    {c.icon}
                  </Text>
                </View>
                <View style={styles.wideText}>
                  <Text style={styles.wideLabel} numberOfLines={1} maxFontSizeMultiplier={FONT_SCALE_MAX}>
                    {c.label}
                  </Text>
                  {c.description ? (
                    <Text style={styles.wideDesc} numberOfLines={2} maxFontSizeMultiplier={FONT_SCALE_MAX}>
                      {c.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.chevron} maxFontSizeMultiplier={1.2}>
                  ›
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 16 },
  // Tablette içerik ortada, aşırı geniş kartlar olmasın
  inner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: 16 },

  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  headerCompact: { flexDirection: 'row', paddingTop: 12, paddingBottom: 12, gap: 12 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFD500',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  iconWrapCompact: { width: 44, height: 44, borderRadius: 22, marginBottom: 0 },
  headerText: { alignItems: 'center' },
  headerTextCompact: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  title: { fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 4 },
  titleCompact: { fontSize: 20, marginBottom: 0 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 19 },
  subtitleCompact: { textAlign: 'left' },

  // Dikey: alt alta, kalan yüksekliği eşit paylaşan geniş kartlar
  column: { flex: 1, gap: 12 },
  wideCard: {
    flex: 1,
    minHeight: 96,
    maxHeight: 170,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#FFD500',
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  wideIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  wideEmoji: { fontSize: 32 },
  wideText: { flex: 1, minWidth: 0 },
  wideLabel: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: '#111' },
  wideDesc: { fontSize: 14, lineHeight: 19, color: '#666', marginTop: 3 },
  chevron: { fontSize: 32, lineHeight: 34, color: '#C9A800', fontWeight: '700' },

  // Yatay telefon: tek satır, 3 eşit kart; dar ekranda etiket 2 satıra iner, yazı küçülmez
  row: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 116,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderTopWidth: 3,
    borderTopColor: '#FFD500',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardCompact: { minHeight: 92, paddingVertical: 10 },
  cardIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardIconCompact: { width: 40, height: 40, borderRadius: 20, marginBottom: 6 },
  cardEmoji: { fontSize: 26 },
  cardEmojiCompact: { fontSize: 20 },
  cardLabel: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: '#111', textAlign: 'center' },
});
