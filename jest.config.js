// Bu paketler ESM/TS kaynağıyla yayınlanıyor (veya "react-native" alanı ESM'e işaret ediyor);
// jest'in babel ile dönüştürmesi gerekiyor, yoksa "Cannot use import statement outside a module" hatası alınır.
const TRANSFORM_PACKAGES = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  '@react-native-[a-z-]+',
  '@react-navigation',
  'react-native-.*',
  'react-redux',
  'redux-persist',
  '@reduxjs',
  'immer',
  'reselect',
  'redux',
  'redux-thunk',
  'sp-react-native-in-app-updates',
  '@microsoft/signalr',
];

module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [`node_modules/(?!(${TRANSFORM_PACKAGES.join('|')})/)`],
  moduleNameMapper: {
    // Native modülü test ortamında sahte modülle değiştir (paketin kendi mock'u)
    '^react-native-device-info$': '<rootDir>/node_modules/react-native-device-info/jest/react-native-device-info-mock.js',
  },
};
