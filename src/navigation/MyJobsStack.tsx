import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MyJobs from '../screens/supplier/MyJobs';
// Geri dönmek istenirse: import MyJobs from '../screens/supplier/MyJobs2';
import JobDetails from '../screens/supplier/JobDetails';

const Stack = createNativeStackNavigator();

export default function MyJobsStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MyJobsList" component={MyJobs} />
            <Stack.Screen name="JobDetails" component={JobDetails} />
        </Stack.Navigator>
    );
}
