import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DriverHome from '../screens/driver/DriverHome';
import CompanyShowcase from '../screens/common/CompanyShowcase';
import WebToolScreen from '../screens/common/WebToolScreen';

const Stack = createNativeStackNavigator();

export default function DriverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverHome" component={DriverHome} />
      <Stack.Screen name="CompanyShowcase" component={CompanyShowcase} />
      <Stack.Screen name="WebToolScreen" component={WebToolScreen} />
    </Stack.Navigator>
  );
}
