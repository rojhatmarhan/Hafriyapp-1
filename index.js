/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, Text, TextInput } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import React from 'react';

// Cihaz yazı puntosu büyütmelerinin uygulama mizanpajını bozmasını engelle (Global Font Scaling Lock - iOS & Android)
if (Text.defaultProps == null) {
  Text.defaultProps = {};
}
Text.defaultProps.allowFontScaling = false;
Text.defaultProps.maxFontSizeMultiplier = 1;

if (TextInput.defaultProps == null) {
  TextInput.defaultProps = {};
}
TextInput.defaultProps.allowFontScaling = false;
TextInput.defaultProps.maxFontSizeMultiplier = 1;

// React Native yeni sürümlerinde defaultProps bypass edilmesini önlemek için render düzeyinde zorla kilitle
const applyFontLock = (Component: any) => {
  if (!Component || !Component.render) return;
  const oldRender = Component.render;
  Component.render = function (...args: any[]) {
    const origin = oldRender.call(this, ...args);
    if (!origin) return origin;
    return React.cloneElement(origin, {
      allowFontScaling: false,
      maxFontSizeMultiplier: 1,
    });
  };
};

try {
  applyFontLock(Text);
  applyFontLock(TextInput);
} catch (e) {
  console.warn('[FontLock] Failed to apply render patch:', e);
}

import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

// Arka planda / kilitli ekranda gelen bildirimleri işle
try {
  setBackgroundMessageHandler(getMessaging(), async (remoteMessage: any) => {
    console.log('[NotificationService] Background message received:', remoteMessage);
  });
} catch (e) {
  console.warn('[NotificationService] Background message handler init failed:', e);
}

AppRegistry.registerComponent(appName, () => App);
