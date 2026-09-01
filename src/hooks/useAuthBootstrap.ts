import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, clearAuth } from '../utils/secureStore';
import { loginSuccess, setRole, setPhone, setCompanyId, setUser, logout } from '../store/slices/authSlice';
import { getProfile } from '../services/userService';
import { initPushNotifications } from '../services/notificationService';

const HAS_LAUNCHED = 'HAS_LAUNCHED';

export const useAuthBootstrap = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Check if app is launched for the first time (fresh install)
        const hasLaunched = await AsyncStorage.getItem(HAS_LAUNCHED);

        if (!hasLaunched) {
          // Fresh install: Clear any stale data in Keychain
          console.log('✨ Fresh install detected. Clearing Keychain...');
          await clearAuth();
          await AsyncStorage.setItem(HAS_LAUNCHED, 'true');
        }

        // 2. Try to restore session
        const auth = await getAuth();

        if (auth) {
          console.log('🔐 Restoring session from Keychain');
          dispatch(loginSuccess({ token: auth.token }));
          dispatch(setPhone(auth.phone));
          dispatch(setRole(auth.role as any));
          if (auth.companyId) dispatch(setCompanyId(auth.companyId));
          initPushNotifications();

          // 3. Fetch latest user details to sync warning and access control
          try {
            const profileRes = await getProfile(auth.token);
            if (profileRes?.isSuccess) {
              dispatch(setUser(profileRes.data));
              if (profileRes.data?.accessMode === 1) {
                console.log('👤 User is blocked on boot. Logging out...');
                await clearAuth();
                dispatch(logout());
              }
            } else {
              console.log('⚠️ Failed to load profile on boot:', profileRes?.message);
            }
          } catch (profileError: any) {
            console.error('⚠️ GetProfile failed during bootstrap', profileError);
            if (profileError?.response?.status === 401) {
              console.log('👤 Token expired/unauthorized. Logging out...');
              await clearAuth();
              dispatch(logout());
            }
          }
        }
      } catch (error) {
        console.error('Auth bootstrap failed', error);
      }
    };

    init();
  }, [dispatch]);
};
