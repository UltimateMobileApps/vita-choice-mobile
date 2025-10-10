import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Toast } from '../../components/ui/Toast';

interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  timeoutId?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastData['type'], duration?: number) => void;
  showPersistentToast: (message: string, type?: ToastData['type']) => string;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
  toasts: ToastData[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Counter to ensure unique IDs even when called rapidly
let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Cleanup all timeouts when component unmounts
  useEffect(() => {
    return () => {
      toasts.forEach(toast => {
        if (toast.timeoutId) {
          clearTimeout(toast.timeoutId);
        }
      });
    };
  }, []);

  const showToast = (message: string, type: ToastData['type'] = 'info', duration?: number) => {
    // Set longer duration for error messages, shorter for success
    const defaultDuration = type === 'error' ? 5000 : type === 'success' ? 2000 : 3000;
    const finalDuration = duration ?? defaultDuration;
    
    // Generate a truly unique ID using timestamp + counter + random
    toastIdCounter += 1;
    const id = `toast-${Date.now()}-${toastIdCounter}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: ToastData = {
      id,
      message,
      type,
      duration: finalDuration,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-hide toast with cleanup
    const timeoutId = setTimeout(() => {
      hideToast(id);
    }, finalDuration);

    // Store timeout ID for potential cleanup
    newToast.timeoutId = timeoutId;
  };

  const showPersistentToast = (message: string, type: ToastData['type'] = 'info'): string => {
    // Generate a truly unique ID using timestamp + counter + random
    toastIdCounter += 1;
    const id = `toast-persistent-${Date.now()}-${toastIdCounter}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: ToastData = {
      id,
      message,
      type,
      duration: undefined, // No auto-hide
    };

    setToasts(prev => [...prev, newToast]);
    return id; // Return ID so caller can manually dismiss
  };

  const hideToast = (id: string) => {
    setToasts(prev => {
      const toastToRemove = prev.find(toast => toast.id === id);
      if (toastToRemove?.timeoutId) {
        clearTimeout(toastToRemove.timeoutId);
      }
      return prev.filter(toast => toast.id !== id);
    });
  };

  const clearAllToasts = () => {
    // Clear all timeouts
    toasts.forEach(toast => {
      if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
      }
    });
    // Clear all toasts
    setToasts([]);
  };

  const value = {
    showToast,
    showPersistentToast,
    hideToast,
    clearAllToasts,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast, index) => (
          <View
            key={toast.id}
            style={[styles.toastWrapper, { top: 60 + (index * 80) }]}
          >
            <Toast
              visible={true}
              message={toast.message}
              type={toast.type}
              onDismiss={() => hideToast(toast.id)}
              duration={toast.duration}
              autoHide={toast.duration !== undefined}
            />
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  toastWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});

export default ToastProvider;
