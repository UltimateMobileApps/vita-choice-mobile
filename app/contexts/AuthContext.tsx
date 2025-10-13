import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { apiService, User } from '../../services/api';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuestUser: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (userData: {
    email: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  handleAuthFailure: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuestUser, setIsGuestUser] = useState(false);
  const { showToast } = useToast();

  const handleAuthFailure = useCallback(async (reason?: 'refresh-expired' | 'auth-error', message?: string) => {
    try {
      setUser(null);
      setIsGuestUser(false);
      await AsyncStorage.removeItem('isGuestUser');
      await AsyncStorage.removeItem('rememberMe');
      await apiService.logout();
    } catch (error) {
      console.error('Error handling auth failure:', error);
    } finally {
      setIsLoading(false);
    }

    const toastMessage = message ?? (reason === 'refresh-expired'
      ? 'Session expired. Please sign in again.'
      : 'Authentication failed. Please login again.');
    const tone = reason === 'refresh-expired' ? 'warning' : 'error';
    showToast(toastMessage, tone);
  }, [showToast]);

  const handleAppStateChange = useCallback((nextState: AppStateStatus) => {
    if (nextState === 'active') {
      apiService.ensureFreshAccessToken().catch(error => {
        console.error('Failed to refresh session on resume', error);
      });
    }
  }, []);

  useEffect(() => {
    // Set auth failure handler
    apiService.setAuthFailureHandler(handleAuthFailure);
    checkAuthStatus();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleAuthFailure, handleAppStateChange]);

  const checkAuthStatus = async () => {
    try {
      // Check for guest user first
      const guestStatus = await AsyncStorage.getItem('isGuestUser');
      if (guestStatus === 'true') {
        setIsGuestUser(true);
        setIsLoading(false);
        return;
      }

      // Check remember me flag
      const rememberFlag = await AsyncStorage.getItem('rememberMe');
      // Configure apiService persistence based on remember flag
      apiService.setPersistTokens(rememberFlag === 'true');
      // If remember flag is not set to 'true' we still allow in-memory tokens to be used
      // Check for authenticated user
      if (apiService.isAuthenticated()) {
        const currentUser = await apiService.getCurrentUser();
        setUser(currentUser);
        await apiService.ensureFreshAccessToken();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, remember: boolean = false) => {
    try {
      // Configure persistence before attempting login
      apiService.setPersistTokens(remember);
      // Persist remember choice so future app starts know the preference
      const response = await apiService.login({ email, password });
      
      if (response.data) {
        setUser(response.data.user);
        // Persist remember choice
        if (remember) {
          await AsyncStorage.setItem('rememberMe', 'true');
        } else {
          await AsyncStorage.removeItem('rememberMe');
        }
        // Clear any guest user status
        setIsGuestUser(false);
        await AsyncStorage.removeItem('isGuestUser');
        await apiService.ensureFreshAccessToken();
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
  }) => {
    try {
      const response = await apiService.register(userData);
      
      if (response.data) {
        setUser(response.data.user);
        // Clear any guest user status
        setIsGuestUser(false);
        await AsyncStorage.removeItem('isGuestUser');
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Registration failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const loginAsGuest = async () => {
    try {
      setIsLoading(true);
      setIsGuestUser(true);
      await AsyncStorage.setItem('isGuestUser', 'true');
    } catch (error) {
      console.error('Error setting guest status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      if (!isGuestUser) {
        await apiService.logout();
      }
      setUser(null);
      setIsGuestUser(false);
      await AsyncStorage.removeItem('isGuestUser');
      await AsyncStorage.removeItem('rememberMe');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      const response = await apiService.updateProfile(userData);
      
      if (response.data) {
        setUser(response.data);
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Update failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user || isGuestUser,
    isGuestUser,
    login,
    register,
    loginAsGuest,
    logout,
    updateUser,
    handleAuthFailure,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
