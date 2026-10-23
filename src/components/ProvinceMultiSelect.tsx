import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput } from 'react-native';
import { CITIES } from '../constants/cities';

type Props = {
  selected: number[];
  onChange: (next: number[]) => void;
};

/**
 * Çoklu il seçimi (grup oluşturma ve grup ayarlarında ortak).
 * Seçili iller üstte çip olarak, eklenebilecek iller açılır listede gösterilir.
 * Sıra korunur: ilk seçilen il ana il (provinceCode) olarak kullanılır.
 */
export default function ProvinceMultiSelect({ selected, onChange }: Props) {
  const [citySearch, setCitySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return CITIES;
    return CITIES.filter(c => c.label.toLowerCase().includes(citySearch.toLowerCase()));
  }, [citySearch]);

  const toggleProvince = (code: number) => {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  return (
    <View>
      {/* 📌 Seçili İller (En Üstte) */}
      {selected.length > 0 && (
        <View style={styles.selectedProvincesContainer}>
          <View style={styles.selectedProvincesHeader}>
            <Text style={styles.selectedProvincesTitle}>Seçili İller ({selected.length})</Text>
            <TouchableOpacity onPress={() => onChange([])}>
              <Text style={styles.clearText}>Temizle</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cityList}>
            {selected.map(code => {
              // Listede olmayan eski bir il kodu gelirse de gösterilir ki kaldırılabilsin
              const label = CITIES.find(c => c.value === code)?.label ?? `İl ${code}`;
              return (
                <TouchableOpacity key={code} style={[styles.cityChip, styles.cityChipSelected]} onPress={() => toggleProvince(code)}>
                  <Text style={[styles.cityChipText, styles.cityChipTextSelected]}>{label} ✕</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 🔽 Dropdown Toggle */}
      <TouchableOpacity style={styles.dropdownToggle} onPress={() => setIsDropdownOpen(!isDropdownOpen)} activeOpacity={0.7}>
        <Text style={styles.dropdownToggleText}>{isDropdownOpen ? 'İl Seçimini Gizle' : 'İl Ekle / Seç'}</Text>
        <Image source={require('../../assets/icons/down-arrow.png')} style={{ width: 14, height: 14, opacity: 0.6, transform: [{ rotate: isDropdownOpen ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>

      {/* 📋 Dropdown İçeriği */}
      {isDropdownOpen && (
        <View style={styles.dropdownContent}>
          <TextInput style={styles.input} placeholder="İlleri arayın..." value={citySearch} onChangeText={setCitySearch} />
          <Text style={styles.helperText}>Arama yaparak istediğiniz ili seçebilirsiniz.</Text>

          <View style={styles.cityList}>
            {filteredCities.slice(0, 50).map(city => {
              if (selected.includes(city.value)) return null; // Seçili olanlar üstte görünüyor
              return (
                <TouchableOpacity key={city.value} style={styles.cityChip} onPress={() => toggleProvince(city.value)}>
                  <Text style={styles.cityChipText}>{city.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginBottom: 10,
  },
  cityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    paddingBottom: 20,
  },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cityChipSelected: {
    backgroundColor: '#FFD500',
    borderColor: '#FFD500',
  },
  cityChipText: {
    fontSize: 13,
    color: '#333',
  },
  cityChipTextSelected: {
    fontWeight: '600',
    color: '#000',
  },
  selectedProvincesContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedProvincesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedProvincesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  clearText: {
    fontSize: 13,
    color: '#d32f2f',
    fontWeight: '600',
  },
  dropdownToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 12,
  },
  dropdownToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  dropdownContent: {
    backgroundColor: '#fafafa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 16,
  },
});
