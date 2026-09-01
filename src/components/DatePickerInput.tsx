import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Props = {
  value: string;        // "DD.MM.YYYY" formatında
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  flex?: boolean;
};

const ddmmyyyToDate = (str: string): Date => {
  if (str && /^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
    const [d, m, y] = str.split('.').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
};

const dateToDDMMYYYY = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
};

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const formatDisplay = (ddmmyyyy: string): string => {
  if (!ddmmyyyy || !/^\d{2}\.\d{2}\.\d{4}$/.test(ddmmyyyy)) return ddmmyyyy;
  const [d, m, y] = ddmmyyyy.split('.');
  return `${parseInt(d)} ${MONTHS_TR[parseInt(m) - 1]} ${y}`;
};

const DatePickerInput: React.FC<Props> = ({ value, onChange, label, placeholder, flex }) => {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(ddmmyyyToDate(value));

  const handleOpen = () => {
    setTempDate(ddmmyyyToDate(value));
    setShow(true);
  };

  const handleAndroidChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (selected) onChange(dateToDDMMYYYY(selected));
  };

  const handleIOSChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setTempDate(selected);
  };

  const handleIOSConfirm = () => {
    onChange(dateToDDMMYYYY(tempDate));
    setShow(false);
  };

  return (
    <View style={[styles.wrapper, flex ? { flex: 1 } : undefined]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.input} onPress={handleOpen} activeOpacity={0.7}>
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {value ? formatDisplay(value) : placeholder || 'Tarih Seçin'}
        </Text>
        <Text style={styles.calIcon}>📅</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="spinner"
          onChange={handleAndroidChange}
          locale="tr-TR"
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={styles.cancelText}>İptal</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Tarih Seçin</Text>
                <TouchableOpacity onPress={handleIOSConfirm}>
                  <Text style={styles.confirmText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleIOSChange}
                style={styles.picker}
                locale="tr-TR"
                textColor="#111111"
                themeVariant="light"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default DatePickerInput;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CFCFCF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 46,
  },
  valueText: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
  },
  placeholderText: {
    color: '#999',
    fontWeight: '400',
  },
  calIcon: {
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  cancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E65100',
  },
  picker: {
    height: 200,
  },
});
