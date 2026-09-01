/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, Text, TextInput } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import React from 'react';

// Cihaz yazı puntosu büyütmelerinin uygulama mizanpajını bozmasını engelle (Global Font Scaling Lock - iOS & Android)
const isTextType = (type: any): boolean => {
  if (!type) return false;
  if (type === Text || type === TextInput) return true;
  const name = type.displayName || type.name || (type.render && (type.render.displayName || type.render.name));
  return name === 'Text' || name === 'TextInput' || type === 'RCTText' || type === 'RCTVirtualText' || type === 'RCTTextInput';
};

// 1. React.createElement interceptor
const originalCreateElement = React.createElement;
(React as any).createElement = function (type: any, props: any, ...children: any[]) {
  if (isTextType(type)) {
    props = Object.assign({}, props, {
      allowFontScaling: false,
      maxFontSizeMultiplier: 1,
    });
  }
  return originalCreateElement.apply(this, [type, props, ...children]);
};

// 2. JSX Runtimes (Babel / Metro production & development transforms)
const patchJsxRuntime = (runtime: any, methodNames: string[]) => {
  if (!runtime) return;
  for (const method of methodNames) {
    if (typeof runtime[method] === 'function') {
      const original = runtime[method];
      runtime[method] = function (type: any, props: any, ...rest: any[]) {
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
if ((Text as any).defaultProps == null) {
  (Text as any).defaultProps = {};
}
(Text as any).defaultProps.allowFontScaling = false;
(Text as any).defaultProps.maxFontSizeMultiplier = 1;

if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1;

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
