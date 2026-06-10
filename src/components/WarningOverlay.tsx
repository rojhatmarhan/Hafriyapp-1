import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfile } from '../services/userService';
import { setUser, logout } from '../store/slices/authSlice';
import { clearAuth } from '../utils/secureStore';

const LAST_DISMISSED_MSG_KEY = 'lastDismissedWarningMessage';
const LAST_DISMISSED_TIME_KEY = 'lastDismissedWarningTime';

export default function WarningOverlay() {
  const dispatch = useDispatch();
  const token = useSelector((state: any) => state.auth.token);
  const user = useSelector((state: any) => state.auth.user);
  
  const [visible, setVisible] = useState(false);

  // 1. Polling: Fetch profile every 3 minutes (180000ms) to sync warnings & access restrictions
  useEffect(() => {
    if (!token) return;

    const pollProfile = async () => {
      try {
        const profileRes = await getProfile(token);
        if (profileRes?.isSuccess) {
          dispatch(setUser(profileRes.data));
        }
      } catch (error: any) {
        console.error('WarningOverlay profile poll failed:', error);
        if (error?.response?.status === 401) {
          console.log('👤 Token expired during poll. Logging out...');
          await clearAuth();
          dispatch(logout());
        }
      }
    };

    // Run immediately on mount/token change
    pollProfile();

    const intervalId = setInterval(pollProfile, 180000); // 3 minutes
    return () => clearInterval(intervalId);
  }, [token, dispatch]);

  // 2. Snooze Logic: Check every 30 seconds if we need to show the warning popup
  useEffect(() => {
    if (!user || !user.warningMessage) {
      setVisible(false);
      return;
    }

    const checkWarningVisibility = async () => {
      try {
        const lastMsg = await AsyncStorage.getItem(LAST_DISMISSED_MSG_KEY);
        const lastTimeStr = await AsyncStorage.getItem(LAST_DISMISSED_TIME_KEY);

        // If warning message changed, show immediately
        if (lastMsg !== user.warningMessage) {
          setVisible(true);
          return;
        }

        // If warning is the same, check the interval
        if (lastTimeStr) {
          const lastTime = parseInt(lastTimeStr, 10);
          const intervalMs = (user.warningIntervalMinutes || 15) * 60 * 1000;
          const now = Date.now();

          if (now - lastTime >= intervalMs) {
            setVisible(true);
          } else {
            setVisible(false);
          }
        } else {
          // No dismissed time recorded, show warning
          setVisible(true);
        }
      } catch (e) {
        console.error('Error checking warning visibility:', e);
        setVisible(true); // Default to showing if error occurs
      }
    };

    checkWarningVisibility();

    const intervalId = setInterval(checkWarningVisibility, 30000); // Check every 30 seconds
    return () => clearInterval(intervalId);
  }, [user?.warningMessage, user?.warningIntervalMinutes]);

  const handleDismiss = async () => {
    if (!user?.warningMessage) return;

    try {
      // Record dismissal details
      await AsyncStorage.setItem(LAST_DISMISSED_MSG_KEY, user.warningMessage);
      await AsyncStorage.setItem(LAST_DISMISSED_TIME_KEY, Date.now().toString());
      setVisible(false);
    } catch (e) {
      console.error('Error dismissing warning:', e);
      setVisible(false);
    }
  };

  if (!visible || !user?.warningMessage) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.modalWrapper}>
          <View style={styles.modalCard}>
            
            {/* Warning Header */}
            <View style={styles.header}>
              <View style={styles.alertIconCircle}>
                <Text style={styles.alertIcon}>⚠️</Text>
              </View>
              <Text style={styles.title}>Sistem Uyarısı</Text>
            </View>

            {/* Warning Message Content */}
            <View style={styles.content}>
              <Text style={styles.messageText}>{user.warningMessage}</Text>
            </View>

            {/* Action Button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissButtonText}>Daha Sonra Hatırlat</Text>
              </TouchableOpacity>
              
              <Text style={styles.reminderInfo}>
                {user.warningIntervalMinutes && user.warningIntervalMinutes > 0
                  ? `Bu uyarı ${user.warningIntervalMinutes} dakika sonra tekrar gösterilecektir.`
                  : 'Bu uyarı belirli aralıklarla tekrar gösterilecektir.'}
              </Text>
            </View>

          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalWrapper: {
    width: '85%',
    maxWidth: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: '#FFD500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  alertIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF9DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD500',
  },
  alertIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1D1B20',
  },
  content: {
    maxHeight: 250,
    marginBottom: 24,
    backgroundColor: '#F9F8FA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEAEF',
  },
  messageText: {
    fontSize: 15,
    color: '#3A3840',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    width: '100%',
  },
  dismissButton: {
    backgroundColor: '#FFD500',
    width: '100%',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
    marginBottom: 12,
  },
  dismissButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  reminderInfo: {
    fontSize: 11,
    color: '#8A858F',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
