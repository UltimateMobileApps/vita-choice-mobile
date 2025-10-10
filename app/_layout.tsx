import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import AppNavigator from './navigation/AppNavigator';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <AppNavigator />
          <StatusBar style="light" />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
