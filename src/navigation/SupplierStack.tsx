import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SupplierHome from '../screens/supplier/SupplierHome';
import CompanyShowcase from '../screens/common/CompanyShowcase';
import WebToolScreen from '../screens/common/WebToolScreen';

const Stack = createNativeStackNavigator();

export default function SupplierStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupplierHome" component={SupplierHome} />
      <Stack.Screen name="CompanyShowcase" component={CompanyShowcase} />
      <Stack.Screen name="WebToolScreen" component={WebToolScreen} />
    </Stack.Navigator>
  );
}
