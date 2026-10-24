module.exports = {
  // Firma tanıtımı fontları (Barlow / Barlow Condensed, OFL). Değişince: npx react-native-asset
  assets: ['./assets/fonts'],
  dependencies: {
    'react-native-bluetooth-escpos-printer': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-bluetooth-escpos-printer/android',
          packageImportPath: 'import cn.jystudio.bluetooth.RNBluetoothEscposPrinterPackage;',
          packageInstance: 'new RNBluetoothEscposPrinterPackage()',
        },
        ios: null,
      },
    },
  },
};
