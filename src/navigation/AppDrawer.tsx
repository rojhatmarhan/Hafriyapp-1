import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import BottomTabs from './BottomTabs';
import ProfileScreen from '../screens/ProfileScreen';
import MyAds from '../screens/MyAds';
import CustomHeader from '../components/CustomHeader';
import CustomDrawerContent from './CustomDrawerContent';

const Drawer = createDrawerNavigator();

const NO_SWIPE = {
  swipeEnabled: false,
  swipeEdgeWidth: 0,
  gestureHandlerProps: { enabled: false },
} as const;

export default function AppNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        header: () => <CustomHeader title="HAFRİYAPP" />,
        ...NO_SWIPE,

        drawerActiveBackgroundColor: '#FFD500',
        drawerActiveTintColor: '#000',
        drawerInactiveTintColor: '#444',

        drawerItemStyle: {
          borderRadius: 999,
          marginHorizontal: 12,
          marginVertical: 6,
        },

        drawerLabelStyle: {
          fontSize: 17,
          fontWeight: '800',
        },
      }}>
      <Drawer.Screen
        name="HomeTabs"
        component={BottomTabs}
        options={{ title: 'ANASAYFA', ...NO_SWIPE }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'PROFİLİM', ...NO_SWIPE }}
      />
      <Drawer.Screen
        name="MyAds"
        component={MyAds}
        options={{ title: 'İLANLAR', ...NO_SWIPE }}
      />
    </Drawer.Navigator>
  );
}
