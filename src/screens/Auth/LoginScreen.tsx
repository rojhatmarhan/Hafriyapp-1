import React, { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useAppDispatch } from '../../hooks';
import { setPhone } from '../../store/slices/authSlice';
import { setRole } from '../../store/slices/authSlice';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../../hooks';
import { login } from '../../services/authService';

const LoginScreen = () => {
  const [phone, setPhoneState] = useState('');
  // const [loginRole, setloginRole] = useState('');
  const [loginRole, setLoginRole] = useState<'driver' | 'supplier' | null>(null);

  // const loginRole = useAppSelector(state => state.auth.role);
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();

  const selectRole = (role: 'driver' | 'supplier') => {
    console.log('asdasd', role);
    dispatch(setRole(role));
    setLoginRole(role);
    console.log('asdasd111', loginRole);

    // console.log('object', loginRole);
    // navigation.navigate('Login');
  };
  //   useEffect(() => {

  //     console.log('loginRole',loginRole);
  //   }, []);
  //   // ...
  // }
  const formatPhone = (text: string) => {
    // sadece rakam al
    let digits = text.replace(/\D/g, '');

    // Eğer kullanıcı tamamen siliyorsa → "0" ekleme
    if (digits.length === 0) {
      setPhoneState('');
      return;
    }

    // Eğer kullanıcı yazıyor ve ilk karakter 0 değilse → 0 ekle
    if (digits[0] !== '0') {
      digits = '0' + digits;
    }

    // Maksimum 11 digit
    digits = digits.slice(0, 11);

    let formatted = digits;

    if (digits.length > 4) {
      formatted = digits.slice(0, 4) + ' ' + digits.slice(4);
    }
    if (digits.length > 7) {
      formatted = formatted.slice(0, 8) + ' ' + formatted.slice(8);
    }
    if (digits.length > 9) {
      formatted = formatted.slice(0, 11) + ' ' + formatted.slice(11);
    }

    setPhoneState(formatted);
  };

  const onContinue = async () => {
    try {
      dispatch(setPhone(phone));
      console.log('phonenumber', phone);

      const res = await login(phone);

      console.log('LOGIN RESPONSE', res);

      if (!res?.isSuccess) {
        Alert.alert('Hata', 'Kod gönderilemedi');
        return;
      }

      // 🔴 TEST AMAÇLI OTP GÖSTER
      Alert.alert('OTP Kodu (TEST)', `Gelen Kod: ${res.data.verificationCode}`);

      navigation.navigate('Otp');
    } catch (e) {
      console.log('LOGIN ERROR', e);
      Alert.alert('Hata', 'Bir hata oluştu');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? -200 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 4, justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', backgroundColor: '#F3F2F3' }}>
          <TouchableOpacity style={{ position: 'absolute', left: '2%', top: '10%' }} onPress={() => navigation.goBack()}>
            <Image style={{ width: 25, height: 25 }} source={require('../../../assets/login/left-arrow.png')} />
          </TouchableOpacity>
          <View style={{ flex: 2, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Image style={{ width: '80%', height: '80%', marginTop: '20%' }} source={require('../../../assets/login/loginKamyon.png')} />
          </View>
          <View style={{ flex: 1, backgroundColor: '#F3F2F3', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Image style={{ width: '100%', height: '100%', marginBottom: '-1%' }} source={require('../../../assets/login/Vector.png')} />
            <Text style={{ position: 'absolute', marginBottom: '20%', fontWeight: '600', fontSize: 20 }}>GİRİŞ YAPIN</Text>
            {loginRole != 'supplier' && loginRole != 'driver' ? <></> : <Text style={styles.phoneText}>Kayıtlı olduğunuz telefon numarasına kod gönderin</Text>}
            {loginRole != 'supplier' && loginRole != 'driver' ? (
              <TouchableOpacity style={styles.buttonRegister} onPress={() => selectRole('supplier')} activeOpacity={0.7}>
                <Text style={styles.text}>FİRMA ve ARAÇ SAHİBİ</Text>
              </TouchableOpacity>
            ) : (
              // <View style={{ width: '100%', backgroundColor: '#FFD500', paddingVertical: 20, justifyContent: 'center', alignItems: 'center' }}>

              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={phone}
                placeholder="05XX XXX XX XX"
                placeholderTextColor="#AAA"
                onChangeText={formatPhone}
                maxLength={14} // 0500 000 00 00
                returnKeyType="done"
              />
              // </View>
            )}
          </View>
          <View style={{ flex: 1, backgroundColor: '#FFD500', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            {/* <Text style={{ position: 'absolute', marginBottom: '65%', fontWeight: '500', fontSize: 18 }}>Kullanıcınız varsa giriş yapın</Text> */}
            {loginRole != 'driver' && loginRole != 'supplier' ? (
              <TouchableOpacity style={styles.buttonLogin} onPress={() => selectRole('driver')} activeOpacity={0.7}>
                <Text style={styles.text}>ŞOFÖR</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.buttonLogin} onPress={() => onContinue()} activeOpacity={0.7}>
                <Text style={styles.text}>KOD GÖNDER</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  buttonLogin: {
    backgroundColor: '#000', // Siyah arka plan
    height: '25%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '60%',
    marginBottom: '40%', // Bulunduğu alanı doldurur
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.96,
    shadowRadius: 2.68,
    elevation: 8,
  },
  buttonRegister: {
    backgroundColor: '#000', // Siyah arka plan
    height: '25%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '60%', // Bulunduğu alanı doldurur
    marginTop: '10%',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.96,
    shadowRadius: 2.68,
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600', // Tasarımdaki gibi yarı-bold
    // marginBottom:'20%'
    // position:'absolute',marginBottom:'20%'
  },
  phoneText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '700', // Tasarımdaki gibi yarı-bold
    position: 'absolute',
    marginBottom: '1%',
    alignSelf: 'center',
  },
  input: {
    width: '75%',
    height: 54,
    borderWidth: 1.4,
    borderColor: '#CFCFCF',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#000',
    fontWeight: '600',
    marginBottom: '-25%',
    position: 'absolute',
  },
  buttonPhoneCheck: {
    backgroundColor: '#000', // Siyah arka plan
    height: '55%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '60%',
    marginBottom: '35%', // Bulunduğu alanı doldurur
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.96,
    shadowRadius: 2.68,
    elevation: 8,
  },
});

export default LoginScreen;
