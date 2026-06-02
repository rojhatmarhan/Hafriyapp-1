import React, { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, StatusBar } from 'react-native';
import { useAppDispatch } from '../../hooks';
import { setPhone } from '../../store/slices/authSlice';
import { setRole } from '../../store/slices/authSlice';
import { useNavigation } from '@react-navigation/native';
import { login } from '../../services/authService';
import CheckBox from '../../components/CheckBox';
import AgreementModal from '../../components/AgreementModal';

const LoginScreen = () => {
  const [phone, setPhoneState] = useState('');
  const [loginRole, setLoginRole] = useState<'driver' | 'supplier' | null>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Agreement Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalUrl, setModalUrl] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const openAgreementModal = (url: string, title: string) => {
    setModalUrl(url);
    setModalTitle(title);
    setModalVisible(true);
  };

  const selectRole = (role: 'driver' | 'supplier') => {
    dispatch(setRole(role));
    setLoginRole(role);
  };

  const formatPhone = (text: string) => {
    let digits = text.replace(/\D/g, '');

    if (digits.length === 0) {
      setPhoneState('');
      return;
    }

    if (digits[0] !== '0') {
      digits = '0' + digits;
    }

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
      const res = await login(phone);

      if (!res?.isSuccess) {
        Alert.alert('Hata', 'Kod gönderilemedi');
        return;
      }



      navigation.navigate('Otp');
    } catch (e) {
      console.log('LOGIN ERROR', e);
      Alert.alert('Hata', 'Bir hata oluştu');
    }
  };

  const isRoleSelected = loginRole === 'driver' || loginRole === 'supplier';

  if (isRoleSelected) {
    return (
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: '#F3F2F3' }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            {/* Back Button - Static at top left */}
            <TouchableOpacity 
              style={{ 
                position: 'absolute', 
                left: 8, 
                top: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 42), 
                zIndex: 10,
                padding: 8
              }} 
              onPress={() => { setLoginRole(null); setPhoneState(''); }}
            >
              <Image style={{ width: 25, height: 25 }} source={require('../../../assets/login/left-arrow.png')} />
            </TouchableOpacity>

            {/* Illustration Area */}
            <View style={{ flex: 1.6, justifyContent: 'center', alignItems: 'center' }}>
              <Image 
                style={{ width: '70%', height: '70%', marginTop: '10%', resizeMode: 'contain' }} 
                source={require('../../../assets/login/loginKamyon.png')} 
              />
            </View>

            {/* Form Area */}
            <View style={{ 
              flex: 2.6, 
              backgroundColor: '#F3F2F3', 
              width: '100%'
            }}>
              <Image 
                style={{ width: '100%', height: '100%', position: 'absolute' }} 
                source={require('../../../assets/login/Vector.png')} 
              />
              
              <View style={{ alignItems: 'center', marginTop: 30, paddingHorizontal: 20 }}>
                <Text style={{ fontWeight: '700', fontSize: 22, color: '#000', marginBottom: 8 }}>GİRİŞ YAPIN</Text>
                <Text style={{ color: '#444', fontSize: 13, textAlign: 'center', fontWeight: '700' }}>
                  Kayıtlı olduğunuz telefon numarasına kod gönderin
                </Text>
              </View>

              <View style={{ alignItems: 'center', marginTop: 24, paddingHorizontal: 20 }}>
                <TextInput
                  style={styles.inputForm}
                  keyboardType="number-pad"
                  value={phone}
                  placeholder="05XX XXX XX XX"
                  placeholderTextColor="#AAA"
                  onChangeText={formatPhone}
                  maxLength={14}
                  returnKeyType="done"
                />

                <TouchableOpacity 
                  style={[styles.buttonSubmit, { marginTop: 20, width: '80%' }]} 
                  onPress={onContinue} 
                  activeOpacity={0.7}
                >
                  <Text style={styles.textSubmit}>KOD GÖNDER</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Yellow Area with policy links */}
            <View 
              style={{ 
                height: 100, 
                backgroundColor: '#FFD500', 
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
              }}
            >
              <Text style={{ fontSize: 10, color: '#000', textAlign: 'center', lineHeight: 14, width: '90%' }}>
                <Text 
                  style={{ fontWeight: 'bold', textDecorationLine: 'underline' }} 
                  onPress={() => openAgreementModal('https://hafriyapp.com/kullanici-sozlesmesi', 'Kullanıcı Sözleşmesi')}
                >
                  Kullanıcı Sözleşmesi
                </Text>
                {', '}
                <Text 
                  style={{ fontWeight: 'bold', textDecorationLine: 'underline' }} 
                  onPress={() => openAgreementModal('https://hafriyapp.com/kvkk-aydinlatma-metni', 'KVKK Aydınlatma Metni')}
                >
                  KVKK Aydınlatma Metni
                </Text>
                {' ve '}
                <Text 
                  style={{ fontWeight: 'bold', textDecorationLine: 'underline' }} 
                  onPress={() => openAgreementModal('https://hafriyapp.com/gizlilik-politikasi', 'Gizlilik Politikası')}
                >
                  Gizlilik Politikası
                </Text>
                {'’nı onaylamış olursunuz. Sakıncalı içerik ve kötüye kullanıma sıfır tolerans gösterilmektedir.'}
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>

        <AgreementModal 
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          url={modalUrl}
          title={modalTitle}
        />
      </KeyboardAvoidingView>
    );
  }

  // Original Role Selection Layout
  return (
    <View style={{ flex: 4, justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', backgroundColor: '#F3F2F3' }}>
      <TouchableOpacity 
        style={{ 
          position: 'absolute', 
          left: 8, 
          top: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 42), 
          zIndex: 10,
          padding: 8
        }} 
        onPress={() => navigation.goBack()}
      >
        <Image style={{ width: 25, height: 25 }} source={require('../../../assets/login/left-arrow.png')} />
      </TouchableOpacity>
      
      <View style={{ flex: 2, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <Image style={{ width: '80%', height: '80%', marginTop: '20%' }} source={require('../../../assets/login/loginKamyon.png')} />
      </View>
      
      <View style={{ flex: 1, backgroundColor: '#F3F2F3', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <Image style={{ width: '100%', height: '100%', marginBottom: '-1%' }} source={require('../../../assets/login/Vector.png')} />
        <Text style={{ position: 'absolute', marginBottom: '20%', fontWeight: '600', fontSize: 20 }}>GİRİŞ YAPIN</Text>
        
        <TouchableOpacity style={styles.buttonRegister} onPress={() => selectRole('supplier')} activeOpacity={0.7}>
          <Text style={styles.text}>FİRMA ve ARAÇ SAHİBİ</Text>
        </TouchableOpacity>
      </View>
      
      <View style={{ flex: 1, backgroundColor: '#FFD500', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity style={styles.buttonLogin} onPress={() => selectRole('driver')} activeOpacity={0.7}>
          <Text style={styles.text}>ŞOFÖR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonLogin: {
    backgroundColor: '#000',
    height: '25%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '60%',
    marginBottom: '40%',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2.68,
    elevation: 8,
  },
  buttonRegister: {
    backgroundColor: '#000',
    height: '25%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '60%',
    marginTop: '10%',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2.68,
    elevation: 8,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  inputForm: {
    width: '80%',
    height: 54,
    borderWidth: 1.4,
    borderColor: '#CFCFCF',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#000',
    fontWeight: '600',
  },
  buttonSubmit: {
    backgroundColor: '#000',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2.68,
    elevation: 8,
    marginBottom: 20,
  },
  textSubmit: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default LoginScreen;
