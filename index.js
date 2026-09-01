/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, Text, TextInput } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import React from 'react';

// Cihaz yazı puntosu büyütmelerinin uygulama mizanpajını bozmasını engelle (Global Font Scaling Lock - iOS & Android)
const isTextType = function (type) {
  if (!type) return false;
  if (type === Text || type === TextInput) return true;
  const name = type.displayName || type.name || (type.render && (type.render.displayName || type.render.name));
  return name === 'Text' || name === 'TextInput' || type === 'RCTText' || type === 'RCTVirtualText' || type === 'RCTTextInput';
};

// 1. React.createElement interceptor
const originalCreateElement = React.createElement;
React.createElement = function (type, props, ...children) {
  if (isTextType(type)) {
    props = Object.assign({}, props, {
      allowFontScaling: false,
      maxFontSizeMultiplier: 1,
    });
  }
  return originalCreateElement.apply(this, [type, props, ...children]);
};

// 2. JSX Runtimes (Babel / Metro production & development transforms)
const patchJsxRuntime = function (runtime, methodNames) {
  if (!runtime) return;
  for (let i = 0; i < methodNames.length; i++) {
    const method = methodNames[i];
    if (typeof runtime[method] === 'function') {
      const original = runtime[method];
      runtime[method] = function (type, props, ...rest) {
        if (isTextType(type)) {
          props = Object.assign({}, props, {
            allowFontScaling: false,
            maxFontSizeMultiplier: 1,
          });
        }
        return original.call(this, type, props, ...rest);
      };
    }
  }
};

try {
  patchJsxRuntime(require('react/jsx-runtime'), ['jsx', 'jsxs']);
} catch (e) {}

try {
  patchJsxRuntime(require('react/jsx-dev-runtime'), ['jsxDEV']);
} catch (e) {}

// 3. Fallback defaultProps
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

import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

// Arka planda / kilitli ekranda gelen bildirimleri işle
try {
  setBackgroundMessageHandler(getMessaging(), async function (remoteMessage) {
    console.log('[NotificationService] Background message received:', remoteMessage);
  });
} catch (e) {
  console.warn('[NotificationService] Background message handler init failed:', e);
}

AppRegistry.registerComponent(appName, () => App);
