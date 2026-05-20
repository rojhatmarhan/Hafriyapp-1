import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import OtpScreen from '../src/screens/Auth/OtpScreen';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));

jest.mock('../src/hooks', () => ({
  useAppDispatch: () => jest.fn(),
  useAppSelector: (selector: (state: any) => any) => selector({ auth: { phone: '0555 111 22 33' } }),
}));

jest.mock('../src/store/slices/authSlice', () => ({
  loginSuccess: jest.fn(),
  setRole: jest.fn(),
  setUser: jest.fn(),
  setCompanyId: jest.fn(),
}));

jest.mock('../src/services/authService', () => ({
  login: jest.fn(),
  verifySms: jest.fn(),
}));

jest.mock('../src/services/userService', () => ({
  getUserById: jest.fn(),
}));

jest.mock('../src/utils/secureStore', () => ({
  saveAuth: jest.fn(),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('react-native-confirmation-code-field', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    CodeField: (props: any) => React.createElement(View, props),
    Cursor: () => null,
    useBlurOnFulfill: () => ({ current: { focus: jest.fn() } }),
    useClearByFocusCell: () => [({}, () => undefined)],
  };
});

describe('OtpScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the back button inside the main content layer', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<OtpScreen />);
    });

    const topLevelTouchables = renderer!.root.children.filter(child => child.type === TouchableOpacity);
    const backButton = renderer!.root.findByProps({ testID: 'otp-back-button' });

    expect(topLevelTouchables).toHaveLength(0);
    expect(backButton.parent?.type).not.toBe(renderer!.root.type);

    renderer!.unmount();
  });
});