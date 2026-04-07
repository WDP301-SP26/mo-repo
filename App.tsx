import React from 'react';
import { enableFreeze, enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import './global.css';
import AppNavigator from './src/navigation/AppNavigator';

// Enable native screen views for better memory and smoother transitions
enableScreens(true);
enableFreeze(true);

/**
 * Dark navigation theme — prevents white background flashes during transitions.
 * Sets the default background for ALL navigation containers and screens.
 */
const DarkNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#101922',
    card: '#101922',
    border: '#1A2332',
    text: '#FFFFFF',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkNavTheme}>
        <AppNavigator />
      </NavigationContainer>
      <Toast />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
