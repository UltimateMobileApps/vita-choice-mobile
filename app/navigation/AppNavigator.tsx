import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { theme } from '../../constants/theme';
import { useAuth } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';

// Main Screens
import FormulaBuilderScreen from '../screens/FormulaBuilderScreen';
import FormulaDetailScreen from '../screens/FormulaDetailScreen';
import FormulasScreen from '../screens/FormulasScreen';
import HomeScreen from '../screens/HomeScreen';
import ComplianceResultScreen from '../screens/ComplianceResultScreen';
import IngredientDetailScreen from '../screens/IngredientDetailScreen';
import IngredientPickerScreen from '../screens/IngredientPickerScreen';
import IngredientsScreen from '../screens/IngredientsScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Profile Screens
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import UpdateProfileScreen from '../screens/profile/UpdateProfileScreen';

// Placeholder screens - will be created
// const FormulasScreen = () => {
//   const { View, Text, StyleSheet } = require('react-native');
//   const { LinearGradient } = require('expo-linear-gradient');
  
//   return (
//     <LinearGradient
//       colors={[theme.colors.primary, theme.colors.secondary]}
//       style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
//     >
//       <Text style={{ color: theme.colors.textPrimary, fontSize: 18 }}>
//         Formulas Screen - Coming Soon
//       </Text>
//     </LinearGradient>
//   );
// };

// const ProfileScreen = () => {
//   const { View, Text, StyleSheet } = require('react-native');
//   const { LinearGradient } = require('expo-linear-gradient');
  
//   return (
//     <LinearGradient
//       colors={[theme.colors.primary, theme.colors.secondary]}
//       style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
//     >
//       <Text style={{ color: theme.colors.textPrimary, fontSize: 18 }}>
//         Profile Screen - Coming Soon
//       </Text>
//     </LinearGradient>
//   );
// };

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
};

const IngredientsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="IngredientsList" component={IngredientsScreen} />
      <Stack.Screen name="IngredientDetail" component={IngredientDetailScreen} />
    </Stack.Navigator>
  );
};

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Ingredients':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Formulas':
              iconName = focused ? 'document-text' : 'document-text-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'home-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.secondary,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: theme.typography.fontFamily,
          fontWeight: theme.typography.weights.medium,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Ingredients" component={IngredientsStack} />
      <Tab.Screen name="Formulas" component={FormulasScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const MainStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      {/* Auth screens accessible from MainStack for guest users */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      {/* Formula screens */}
      <Stack.Screen name="FormulaBuilder" component={FormulaBuilderScreen} />
      <Stack.Screen name="FormulaDetail" component={FormulaDetailScreen} />
  <Stack.Screen name="ComplianceResults" component={ComplianceResultScreen} />
      <Stack.Screen name="IngredientPicker" component={IngredientPickerScreen} />
      <Stack.Screen name="IngredientPickerDetail" component={IngredientDetailScreen} />
      {/* Profile screens */}
      <Stack.Screen name="UpdateProfile" component={UpdateProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      {/* Add modal screens here later */}
    </Stack.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Could render a splash/loading component here
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainStack} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthStack} />
      )}
    </RootStack.Navigator>
  );
};

export default AppNavigator;
