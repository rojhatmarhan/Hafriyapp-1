import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DumpRecord } from '../services/dumpService';
import { formatKg, formatTL, formatDumpDateTime, dumpSourceLabel, DumpSource } from '../utils/dumpFormat';

// ── Döküm listesi satırına tıklayınca açılan detay: Excel'in diğer sütunları + eşleşen sefer.
// Alanlar yeni API'de gelir; eski API'de olmayan satırlar gösterilmez.

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n);

const Item = ({ label, value, full }: { label: string; value?: string | null; full?: boolean }) =>
  value ? (
    <Text style={[styles.item, full && styles.full]}>
      <Text style={styles.label}>{label}: </Text>
      {value}
    </Text>
  ) : null;

export default function DumpRecordDetail({ item }: { item: DumpRecord }) {
  const exit = item.cikisTarihi ? formatDumpDateTime(item.cikisTarihi) : null;
  const haulTime = item.haulTimeOfHaul ? formatDumpDateTime(item.haulTimeOfHaul) : null;
  const source = item.sourceSite || (item.sourceFormat === 'Kig' || item.sourceFormat === 'Istac' ? dumpSourceLabel(item.sourceFormat as DumpSource) : null);
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <Item label="Kabul belgesi" value={item.kabulBelgesiNo} full />
        <Item label="Toplam" value={isNum(item.brutKg) ? formatKg(item.brutKg) : null} />
        <Item label="Dara" value={isNum(item.daraKg) ? formatKg(item.daraKg) : null} />
        <Item label="Net" value={isNum(item.netKg) ? formatKg(item.netKg) : null} />
        <Item label="Bedel" value={isNum(item.fisBedeli) ? formatTL(item.fisBedeli) : null} />
        <Item label="Etiket" value={item.etiketNo} />
        <Item label="Kart kodu" value={item.kartKodu} />
        <Item label="Fiş no" value={item.fisNo} />
        <Item label="Çıkış" value={exit ? `${exit.date} ${exit.time}`.trim() : null} />
        <Item label="Saha" value={source} />
        <Item label="Yük tipi" value={item.yukTipi} full />
        <Item label="ATS" value={item.ats} />
        <Item label="Operatör" value={item.operator} />
      </View>
      {item.haulId ? (
        <View style={styles.haulBox}>
          <Text style={styles.haulTitle}>Eşleşen sefer</Text>
          <Text style={styles.haulText}>
            <Text style={item.matchStatus === 'plateMismatch' ? styles.mismatch : styles.bold}>{item.haulPlateNumber || '-'}</Text>
            {item.jobSiteName ? ` · ${item.jobSiteName}` : ''}
          </Text>
          <Text style={styles.haulText}>
            Seri no: {item.haulSerialNumber || '-'}
            {haulTime ? ` · ${haulTime.date} ${haulTime.time}` : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.noHaul}>Bu etiket numarasıyla kesilmiş sefer bulunamadı.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Android'de tek kenarda kesikli çizgi (borderStyle: 'dashed') düzgün çizilmiyor → düz ince çizgi
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#BDBDBD', marginHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '50%', fontSize: 12.5, color: '#222', paddingVertical: 2, paddingRight: 6 },
  full: { width: '100%' },
  label: { color: '#888' },
  haulBox: { backgroundColor: '#F6F5F2', borderRadius: 8, padding: 8, marginTop: 6 },
  haulTitle: { fontSize: 11.5, color: '#888', fontWeight: '700', marginBottom: 2 },
  haulText: { fontSize: 12.5, color: '#222' },
  bold: { fontWeight: '800' },
  mismatch: { fontWeight: '800', color: '#C62828' },
  noHaul: { fontSize: 12, color: '#888', marginTop: 6 },
});
