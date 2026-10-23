module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    // Native modülü test ortamında sahte modülle değiştir (paketin kendi mock'u)
    '^react-native-device-info$': '<rootDir>/node_modules/react-native-device-info/jest/react-native-device-info-mock.js',
  },
};
