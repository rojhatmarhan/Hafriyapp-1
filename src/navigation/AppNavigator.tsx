import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import BottomTabs from './BottomTabs';
import ProfileScreen from '../screens/ProfileScreen';
import MyAds from '../screens/MyAds';
import CustomHeader from '../components/CustomHeader';
import CustomDrawerContent from './CustomDrawerContent';
import CompanyChat from '../screens/supplier/CompanyChat';
import CompanyDetailsScreen from '../screens/supplier/CompanyDetailsScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import CompanyEditScreen from '../screens/supplier/CompanyEditScreen';
import CompanyShowcase from '../screens/common/CompanyShowcase';
import WebToolScreen from '../screens/common/WebToolScreen';
import ShowcaseListScreen from '../screens/showcase/ShowcaseListScreen';
import ShowcaseDetailScreen from '../screens/showcase/ShowcaseDetailScreen';
import ShowcaseFormScreen from '../screens/showcase/ShowcaseFormScreen';
import IntegrationsScreen from '../screens/supplier/IntegrationsScreen';

const Drawer = createDrawerNavigator();

export default function AppNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        header: () => <CustomHeader title="HAFRİYAPP" />,
        swipeEnabled: false,
        swipeEdgeWidth: 0,
        gestureHandlerProps: { enabled: false },
      } as any}>
      {/* 🔑 Tabs burada olmalı */}
      <Drawer.Screen name="HomeTabs" component={BottomTabs} options={{ title: 'ANASAYFA' }} />

      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'PROFİLİM' }} />

      <Drawer.Screen
        name="MyAds"
        component={MyAds}
        options={{
          title: 'PAZAR',
          drawerItemStyle: { display: 'none' },
        }}
      />

      {/* 💬 CompanyChat is hoisted here to hide the global drawer header and bottom tabs */}
      <Drawer.Screen
        name="CompanyChat"
        component={CompanyChat}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="CompanyDetails"
        component={CompanyDetailsScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="CompanyEdit"
        component={CompanyEditScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="ProfileEdit"
        component={ProfileEditScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="CompanyShowcase"
        component={CompanyShowcase}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="ShowcaseList"
        component={ShowcaseListScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="ShowcaseDetail"
        component={ShowcaseDetailScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="ShowcaseForm"
        component={ShowcaseFormScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="WebToolScreen"
        component={WebToolScreen}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="Integrations"
        component={IntegrationsScreen}
        options={{
          // Standart sarı başlık açık (diğer profil ekranları gibi); önceden gizliydi ve sayfa barı durum çubuğuna yapışıyordu
          title: 'ENTEGRASYONLAR',
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer.Navigator>
  );
}
