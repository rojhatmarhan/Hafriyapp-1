import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

interface CheckBoxProps {
  checked: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}

export const CheckBox: React.FC<CheckBoxProps> = ({ checked, onPress, children }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.8}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <View style={styles.labelContainer}>
        {children}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#CFCFCF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
    backgroundColor: '#FFF',
  },
  boxChecked: {
    borderColor: '#000',
    backgroundColor: '#FFD500',
  },
  checkMark: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  labelContainer: {
    flex: 1,
  },
});

export default CheckBox;
