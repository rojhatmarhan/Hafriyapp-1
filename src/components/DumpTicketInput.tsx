import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { QrScanIcon } from './MiniIcons';

// ── Döküm fişi numarası: Aztec kodlarda "12345-..." biçiminden numarayı ayıklar
export const extractDumpTicketNo = (raw?: string | null): string => {
  let codeVal = (raw || '').trim();
  const aztecMatch = codeVal.match(/^(\d{5,})-/);
  if (aztecMatch) {
    codeVal = aztecMatch[1];
  }
  return codeVal.slice(0, 50);
};

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onScanPress: () => void;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
};

// ── Kompakt "Döküm fişi…" alanı + QR/barkod tarama butonu
const DumpTicketInput: React.FC<Props> = ({ value, onChangeText, onScanPress, editable = true, style }) => (
  <View style={[styles.wrap, !editable && styles.disabled, style]}>
    <TextInput value={value} onChangeText={onChangeText} style={styles.input} placeholder="Döküm fişi…" placeholderTextColor="#AAA" maxLength={50} autoCapitalize="characters" autoCorrect={false} editable={editable} />
    <TouchableOpacity style={styles.scanBtn} onPress={onScanPress} disabled={!editable} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }} accessibilityLabel="Döküm fişi tara">
      <QrScanIcon size={26} color="#222" />
    </TouchableOpacity>
  </View>
);

export default DumpTicketInput;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CFCFCF',
    borderRadius: 12,
    backgroundColor: '#fff',
    height: 50,
    width: 186,
    paddingLeft: 10,
    paddingRight: 2,
  },
  disabled: { opacity: 0.5, backgroundColor: '#f0f0f0' },
  input: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#222',
    paddingVertical: 0,
  },
  // 44 px açık sarı daire, koyu ikon (HaulSearchBar QR butonu ile aynı)
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3B0',
    borderWidth: 1,
    borderColor: '#F2DC6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
