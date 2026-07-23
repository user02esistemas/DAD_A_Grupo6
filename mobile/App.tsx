import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/auth/LoginScreen';
import MozoScreen from './src/screens/MozoScreen';
import KdsScreen from './src/screens/KdsScreen';
import CajeroScreen from './src/screens/CajeroScreen';
import MesaDetailScreen from './src/screens/MesaDetailScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="MozoScreen" component={MozoScreen} />
          <Stack.Screen name="MesaDetailScreen" component={MesaDetailScreen} />
          <Stack.Screen name="KdsScreen" component={KdsScreen} />
          <Stack.Screen name="CajeroScreen" component={CajeroScreen} />
          <Stack.Screen name="AdminScreen" component={AdminScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
