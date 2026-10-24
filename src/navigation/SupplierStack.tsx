import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SupplierHome from '../screens/supplier/SupplierHome';
import CompanyShowcase from '../screens/common/CompanyShowcase';
import WebToolScreen from '../screens/common/WebToolScreen';
import ShowcaseListScreen from '../screens/showcase/ShowcaseListScreen';
import ShowcaseDetailScreen from '../screens/showcase/ShowcaseDetailScreen';
import ShowcaseFormScreen from '../screens/showcase/ShowcaseFormScreen';

const Stack = createNativeStackNavigator();

export default function SupplierStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupplierHome" component={SupplierHome} />
      <Stack.Screen name="CompanyShowcase" component={CompanyShowcase} />
      {/* Firma tanıtımı (native). Eski API'de ShowcaseList → CompanyShowcase (WebView) */}
      <Stack.Screen name="ShowcaseList" component={ShowcaseListScreen} />
      <Stack.Screen name="ShowcaseDetail" component={ShowcaseDetailScreen} />
      <Stack.Screen name="ShowcaseForm" component={ShowcaseFormScreen} />
      <Stack.Screen name="WebToolScreen" component={WebToolScreen} />
    </Stack.Navigator>
  );
}
