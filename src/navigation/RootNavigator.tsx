import React, { useEffect } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';

import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';
import BlockedScreen from '../screens/Auth/BlockedScreen';
import { useAuthBootstrap } from '../hooks/useAuthBootstrap';
import { RootState } from '../store';
import { getProfile } from '../services/userService';
import { setUser, logout } from '../store/slices/authSlice';
import { clearAuth } from '../utils/secureStore';

export default function RootNavigator() {
  const dispatch = useDispatch();
  // 🔐 Keychain → Redux
  useAuthBootstrap();

  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);

  // Poll profile every 3 minutes to keep warning and blocked states updated dynamically
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const pollProfile = async () => {
      try {
        const profileRes = await getProfile(token);
        if (profileRes?.isSuccess) {
          dispatch(setUser(profileRes.data));
          if (profileRes.data?.accessMode === 1) {
            console.log('👤 User is blocked (poll). Logging out...');
            await clearAuth();
            dispatch(logout());
          }
        }
      } catch (error: any) {
        console.error('RootNavigator profile poll failed:', error);
        if (error?.response?.status === 401) {
          console.log('👤 Token expired during poll. Logging out...');
          await clearAuth();
          dispatch(logout());
        }
      }
    };

    pollProfile();
    const intervalId = setInterval(pollProfile, 180000); // 3 minutes
    return () => clearInterval(intervalId);
  }, [isLoggedIn, token, dispatch]);

  if (isLoggedIn && user?.accessMode === 1) {
    return (
      <NavigationContainer>
        <BlockedScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        {isLoggedIn && user?.accessMode === 2 && user?.accessRestrictionNote && (
          <SafeAreaView style={{ backgroundColor: '#FFD500' }}>
            <View style={{ paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 13, textAlign: 'center' }}>
                ⚠️ Kısıtlı Erişim: {user.accessRestrictionNote}
              </Text>
            </View>
          </SafeAreaView>
        )}
        {isLoggedIn ? <AppNavigator /> : <AuthNavigator />}
      </View>
    </NavigationContainer>
  );
}
