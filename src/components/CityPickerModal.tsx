import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { CITIES } from '../constants/cities';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectCity: (cityValue: number | null) => void;
  selectedCity: number | null;
};

export default function CityPickerModal({
  visible,
  onClose,
  onSelectCity,
  selectedCity,
}: Props) {
  const [search, setSearch] = useState('');

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CITIES;
    return CITIES.filter(
      c =>
        c.label.toLowerCase().includes(q) ||
        String(c.value).includes(q)
    );
  }, [search]);

  const handleSelect = (val: number | null) => {
    onSelectCity(val);
    setSearch('');
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>İl Seçin</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="İl veya plaka kodu ara..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* City List */}
          <FlatList
            data={filteredCities}
            keyExtractor={item => String(item.value)}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              !search.trim() ? (
                <TouchableOpacity
                  style={[
                    styles.cityRow,
                    selectedCity === null && styles.cityRowSelected,
                  ]}
                  onPress={() => handleSelect(null)}
                >
                  <Text style={styles.cityIcon}>🇹🇷</Text>
                  <Text
                    style={[
                      styles.cityLabel,
                      selectedCity === null && styles.cityLabelSelected,
                    ]}
                  >
                    Tüm Türkiye
                  </Text>
                  {selectedCity === null && (
                    <Text style={styles.checkIcon}>✓</Text>
                  )}
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = selectedCity === item.value;
              return (
                <TouchableOpacity
                  style={[styles.cityRow, isSelected && styles.cityRowSelected]}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text style={styles.cityPlate}>
                    {item.value < 100 ? String(item.value).padStart(2, '0') : '34'}
                  </Text>
                  <Text
                    style={[
                      styles.cityLabel,
                      isSelected && styles.cityLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Aranan il bulunamadı</Text>
              </View>
            }
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#666',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#222',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  cityRowSelected: {
    backgroundColor: '#FFFBEB',
  },
  cityIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  cityPlate: {
    width: 28,
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    marginRight: 10,
  },
  cityLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  cityLabelSelected: {
    color: '#D97706',
    fontWeight: '800',
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#D97706',
  },
  separator: {
    height: 1,
    backgroundColor: '#F2F2F2',
    marginLeft: 58,
  },
  emptyWrap: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
  },
});
