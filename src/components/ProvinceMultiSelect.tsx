import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, ScrollView, Keyboard } from 'react-native';
import { CITIES } from '../constants/cities';
import { trIncludes } from '../utils/trSearch';

type Props = {
  selected: number[];
  onChange: (next: number[]) => void;
};

const labelOf = (code: number) => CITIES.find(c => c.value === code)?.label ?? `İl ${code}`;

/**
 * Çoklu il seçimi (grup oluşturma ve grup ayarlarında ortak).
 * Alan seçili illeri gösterir; "İl Seç" ile açılan listede 82 ilin tamamı onay kutusuyla seçilir ve "Tamam" ile aktarılır.
 * Liste ayrı bir Modal değil, alanın altında açılır (grup formları zaten Modal içinde; iOS Modal üstüne Modal açamaz).
 * Sıra korunur: ilk seçilen il ana il (provinceCode) olarak kullanılır.
 */
export default function ProvinceMultiSelect({ selected, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(selected);
  const [citySearch, setCitySearch] = useState('');

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return CITIES;
    return CITIES.filter(c => trIncludes(c.label, citySearch));
  }, [citySearch]);

  const open = () => {
    setDraft(selected);
    setCitySearch('');
    setIsOpen(true);
  };

  const close = () => {
    Keyboard.dismiss();
    setIsOpen(false);
  };

  const apply = () => {
    onChange(draft);
    close();
  };

  const toggleDraft = (code: number) => {
    setDraft(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]));
  };

  const selectAllFiltered = () => {
    setDraft(prev => [...prev, ...filteredCities.map(c => c.value).filter(v => !prev.includes(v))]);
  };

  return (
    <View>
      {/* Seçim alanı: seçili iller + açma butonu */}
      <TouchableOpacity style={[styles.field, isOpen && styles.fieldOpen]} onPress={isOpen ? close : open} activeOpacity={0.7}>
        <View style={styles.fieldBody}>
          {selected.length === 0 ? (
            <Text style={styles.placeholder}>İl seçin…</Text>
          ) : (
            <View style={styles.chips}>
              {selected.map((code, index) => (
                <View key={code} style={[styles.chip, index === 0 && styles.chipMain]}>
                  <Text style={styles.chipText}>{labelOf(code)}</Text>
                  {!isOpen && (
                    <TouchableOpacity onPress={() => onChange(selected.filter(c => c !== code))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel={`${labelOf(code)} kaldır`}>
                      <Text style={styles.chipRemove}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
        <Image source={require('../../assets/icons/down-arrow.png')} style={[styles.arrow, isOpen && styles.arrowOpen]} />
      </TouchableOpacity>
      {selected.length > 0 && !isOpen && <Text style={styles.helperText}>{selected.length} il seçili · ilk il ana il olarak kullanılır</Text>}

      {/* Açılan liste */}
      {isOpen && (
        <View style={styles.panel}>
          <TextInput style={styles.search} placeholder="İl ara…" placeholderTextColor="#999" value={citySearch} onChangeText={setCitySearch} returnKeyType="done" />

          <View style={styles.panelActions}>
            <TouchableOpacity onPress={selectAllFiltered}>
              <Text style={styles.linkText}>{citySearch.trim() ? 'Bulunanları seç' : 'Tümünü seç'}</Text>
            </TouchableOpacity>
            <Text style={styles.countText}>{draft.length} seçili</Text>
            <TouchableOpacity onPress={() => setDraft([])}>
              <Text style={[styles.linkText, styles.linkDanger]}>Temizle</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filteredCities.length === 0 && <Text style={styles.emptyText}>İl bulunamadı</Text>}
            {filteredCities.map(city => {
              const checked = draft.includes(city.value);
              return (
                <TouchableOpacity key={city.value} style={[styles.row, checked && styles.rowChecked]} onPress={() => toggleDraft(city.value)} activeOpacity={0.6}>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <Text style={styles.checkmark}>✓</Text>}</View>
                  <Text style={[styles.rowText, checked && styles.rowTextChecked]}>{city.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.footerBtn, styles.cancelBtn]} onPress={close}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerBtn, styles.applyBtn]} onPress={apply}>
              <Text style={styles.applyText}>Tamam ({draft.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
  },
  fieldOpen: {
    borderColor: '#FFD500',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  fieldBody: {
    flex: 1,
  },
  placeholder: {
    fontSize: 14,
    color: '#999',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFF6CC',
    borderRadius: 14,
  },
  chipMain: {
    backgroundColor: '#FFD500',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  chipRemove: {
    fontSize: 12,
    color: '#555',
  },
  arrow: {
    width: 14,
    height: 14,
    opacity: 0.6,
    marginLeft: 8,
  },
  arrowOpen: {
    transform: [{ rotate: '180deg' }],
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginBottom: 12,
  },
  panel: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#FFD500',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#fff',
    padding: 10,
    marginBottom: 16,
  },
  search: {
    height: 42,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  panelActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
  },
  linkDanger: {
    color: '#d32f2f',
  },
  countText: {
    fontSize: 12,
    color: '#777',
  },
  list: {
    maxHeight: 300,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowChecked: {
    backgroundColor: '#FFFBE6',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#bbb',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FFD500',
    borderColor: '#FFD500',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
  rowText: {
    fontSize: 15,
    color: '#333',
  },
  rowTextChecked: {
    fontWeight: '700',
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  footerBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F1F1F1',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  applyBtn: {
    backgroundColor: '#FFD500',
  },
  applyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
});
