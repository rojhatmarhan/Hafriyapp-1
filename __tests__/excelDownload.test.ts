import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { excelAc } from '../src/utils/excelDownload';

describe('excelAc', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    jest.clearAllMocks();
  });

  it("iOS'ta QuickLook önizlemesi (previewDocument) açar, openDocument kullanmaz", async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    await excelAc('/cache/Seferler.xlsx');
    expect(RNBlobUtil.ios.previewDocument).toHaveBeenCalledWith('/cache/Seferler.xlsx');
    expect(RNBlobUtil.ios.openDocument).not.toHaveBeenCalled();
  });

  it("Android'de actionViewIntent ile xlsx açar", async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    await excelAc('/cache/Seferler.xlsx');
    expect(RNBlobUtil.android.actionViewIntent).toHaveBeenCalledWith('/cache/Seferler.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
