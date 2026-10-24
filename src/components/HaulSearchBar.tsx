import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import CalendarDateButton from './CalendarDateButton';
import { QrScanIcon } from './MiniIcons';

// ── Sefer listesi arama çubuğu (İş detayı ve Araç Yönetimi ortak): solda QR, ortada arama, sağda başlangıç ▸ bitiş tarihi.
// Altında seçili aralık; varsayılan aralıktan farklıysa mavi ve ✕ ile sıfırlanır.
// Not: CalendarDateButton iOS'ta Modal kullanır — bu bileşeni başka bir Modal'ın içinde kullanmayın.
type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onQrPress: () => void;
  placeholder?: string;
  rangeStart: string;
  rangeEnd: string;
  onRangeStartChange: (v: string) => void;
  onRangeEndChange: (v: string) => void;
  isDefaultRange: boolean;
  onResetRange: () => void;
};

export default function HaulSearchBar({ query, onQueryChange, onQrPress, placeholder = 'Plaka, döküm, seri no…', rangeStart, rangeEnd, onRangeStartChange, onRangeEndChange, isDefaultRange, onResetRange }: Props) {
  return (
    <View>
      <View style={styles.searchBar}>
        <TouchableOpacity style={styles.qrBtn} onPress={onQrPress} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel="Fiş QR tara">
          <QrScanIcon size={26} color="#222" />
        </TouchableOpacity>
        <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#aaa" value={query} onChangeText={onQueryChange} autoCapitalize="none" autoCorrect={false} />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onQueryChange('')} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} accessibilityLabel="Aramayı temizle">
            <Text style={styles.clear}>✕</Text>
          </TouchableOpacity>
        )}
        <View style={styles.dates}>
          <CalendarDateButton value={rangeStart} onChange={onRangeStartChange} title="Başlangıç Tarihi" active={!isDefaultRange} />
          <Text style={styles.dateArrow}>▸</Text>
          <CalendarDateButton value={rangeEnd} onChange={onRangeEndChange} title="Bitiş Tarihi" active={!isDefaultRange} />
        </View>
      </View>
      <View style={styles.infoRow}>
        <Text style={[styles.infoText, !isDefaultRange && styles.infoTextActive]}>
          {rangeStart} – {rangeEnd}
        </Text>
        {!isDefaultRange && (
          <TouchableOpacity onPress={onResetRange} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Tarih aralığını sıfırla">
            <Text style={styles.infoClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 27,
    paddingLeft: 4,
    paddingRight: 4,
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  // Büyük, belirgin ikon butonları (kullanıcı geri bildirimi): 44 px açık sarı daire, koyu ikon. Dar ekranda input daralır, butonlar küçülmez.
  qrBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3B0',
    borderWidth: 1,
    borderColor: '#F2DC6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#1a1a1a',
    paddingVertical: 8,
  },
  clear: {
    fontSize: 14,
    color: '#aaa',
    paddingHorizontal: 4,
  },
  dates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
    flexShrink: 0,
  },
  dateArrow: { fontSize: 12, color: '#888', marginHorizontal: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  infoText: { fontSize: 12, color: '#888', fontWeight: '600' },
  infoTextActive: { color: '#1976D2', fontWeight: '800' },
  infoClear: { fontSize: 13, color: '#1976D2', fontWeight: '800', paddingHorizontal: 2 },
});
