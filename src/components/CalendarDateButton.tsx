import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarIcon } from './MiniIcons';

// ── Yuvarlak takvim butonu: DD.MM.YYYY değeri seçtirir (DatePickerInput ile aynı picker davranışı)
// Not: iOS'ta Modal kullanır — başka bir Modal'ın içinde kullanmayın.
type Props = {
  value: string; // "DD.MM.YYYY"
  onChange: (date: string) => void;
  title?: string;
  active?: boolean;
  accessibilityLabel?: string;
};

const ddmmyyyyToDate = (str: string): Date => {
  if (str && /^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
    const [d, m, y] = str.split('.').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
};

const dateToDDMMYYYY = (date: Date): string => `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;

const CalendarDateButton: React.FC<Props> = ({ value, onChange, title = 'Tarih Seçin', active, accessibilityLabel }) => {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(ddmmyyyyToDate(value));

  const handleOpen = () => {
    setTempDate(ddmmyyyyToDate(value));
    setShow(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (event.type === 'set' && selected) onChange(dateToDDMMYYYY(selected));
  };

  return (
    <View>
      <TouchableOpacity style={[styles.btn, active && styles.btnActive]} onPress={handleOpen} activeOpacity={0.7} accessibilityLabel={accessibilityLabel || title}>
        <CalendarIcon size={22} color="#222" />
      </TouchableOpacity>

      {Platform.OS === 'android' && show && <DateTimePicker value={tempDate} mode="date" display="calendar" onChange={handleAndroidChange} />}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelText}>İptal</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(dateToDDMMYYYY(tempDate));
                    setShow(false);
                  }}>
                  <Text style={styles.confirmText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={tempDate} mode="date" display="spinner" onChange={(_e, d) => d && setTempDate(d)} style={styles.picker} locale="tr-TR" textColor="#111111" themeVariant="light" />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default CalendarDateButton;

const styles = StyleSheet.create({
  // 42 px açık sarı daire, koyu ikon; varsayılandan farklı aralık seçiliyse (active) koyu sarı
  btn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#F2DC6B',
    backgroundColor: '#FFF3B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { borderColor: '#C9A800', borderWidth: 1.5, backgroundColor: '#FFD500' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  cancelText: { fontSize: 15, color: '#666', fontWeight: '600' },
  confirmText: { fontSize: 15, fontWeight: '800', color: '#E65100' },
  picker: { height: 200 },
});
