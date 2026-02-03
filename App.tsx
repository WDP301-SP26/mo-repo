import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import './global.css';

import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      <Toast />
      {/* Thanh trạng thái (pin, sóng) */}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}