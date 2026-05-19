module.exports = {
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
