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
  value: string;        // "HH:mm" formatında (Örn: "14:30")
  onChange: (time: string) => void;
  label?: string;
  placeholder?: string;
  flex?: boolean;
};

const timeStringToDate = (str: string): Date => {
  const d = new Date();
  if (str && /^\d{1,2}:\d{2}$/.test(str)) {
    const [h, m] = str.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }
  const trMs = Date.now() + 3 * 60 * 60000;
  const tr = new Date(trMs);
  d.setHours(tr.getUTCHours(), tr.getUTCMinutes(), 0, 0);
  return d;
};

const dateToHHMM = (date: Date): string => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const TimePickerInput: React.FC<Props> = ({ value, onChange, label, placeholder, flex }) => {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(timeStringToDate(value));

  const handleOpen = () => {
    setTempDate(timeStringToDate(value));
    setShow(true);
  };

  const handleAndroidChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (selected) onChange(dateToHHMM(selected));
  };

  const handleIOSChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setTempDate(selected);
  };

  const handleIOSConfirm = () => {
    onChange(dateToHHMM(tempDate));
    setShow(false);
  };

  return (
    <View style={[styles.wrapper, flex ? { flex: 1 } : undefined]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.input} onPress={handleOpen} activeOpacity={0.7}>
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {value || placeholder || '00:00'}
        </Text>
        <Text style={styles.clockIcon}>⏰</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          is24Hour={true}
          display="default"
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
                <Text style={styles.title}>Saat Seçin</Text>
                <TouchableOpacity onPress={handleIOSConfirm}>
                  <Text style={styles.confirmText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="time"
                is24Hour={true}
                display="spinner"
                onChange={handleIOSChange}
                style={styles.picker}
                locale="tr-TR"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default TimePickerInput;

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
  clockIcon: {
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
    color: '#222',
  },
  cancelText: {
    fontSize: 15,
    color: '#888',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFD500',
  },
  picker: {
    height: 200,
  },
});
