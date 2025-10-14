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
  // message can be a string or any error-like object; we will normalize it
  showToast: (message: string | unknown, type?: ToastData['type'], duration?: number) => void;
  showPersistentToast: (message: string | unknown, type?: ToastData['type']) => string;
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

  const formatErrorLike = (input: unknown): string => {
    try {
      // If it's a string, return it
      if (typeof input === 'string') return input;

      // If it's an Error instance
      if (input instanceof Error) {
        // Try to include extra context if present (e.g., fetch/axios style)
        const anyErr = input as any;
        if (anyErr.response && anyErr.response.status) {
          const status = anyErr.response.status;
          const url = anyErr.config?.url || anyErr.response.config?.url || '';
          const serverMsg = anyErr.response.data?.detail || anyErr.response.data?.message || anyErr.message;
          return `${url ? url + ' - ' : ''}Error ${status}: ${serverMsg || anyErr.message}`;
        }
        return input.message;
      }

      // If it's an object with an 'error' or 'message' field, prefer those
      if (typeof input === 'object' && input !== null) {
        const anyObj = input as any;
        if (typeof anyObj.error === 'string') return anyObj.error;
        if (typeof anyObj.message === 'string') return anyObj.message;
        if (anyObj.detail) return String(anyObj.detail);
        // If it's an ApiResponse-like object { error: '...' }
        if (anyObj?.error) return String(anyObj.error);
        // If it contains method/endpoint info
        if (anyObj.method || anyObj.endpoint || anyObj.url) {
          const method = anyObj.method ? String(anyObj.method).toUpperCase() + ' ' : '';
          const url = anyObj.endpoint || anyObj.url || '';
          const status = anyObj.status ? ` (${anyObj.status})` : '';
          const msg = anyObj.message || anyObj.error || anyObj.detail || '';
          return `${method}${url}${status}${msg ? ': ' + msg : ''}`;
        }

        // Fallback: stringify small objects
        try {
          const str = JSON.stringify(anyObj);
          return str.length > 0 ? str : 'An error occurred';
        } catch (e) {
          return 'An error occurred';
        }
      }

      return String(input ?? 'An error occurred');
    } catch (e) {
      return 'An error occurred';
    }
  };

  const showToast = (message: string | unknown, type: ToastData['type'] = 'info', duration?: number) => {
    const normalized = formatErrorLike(message);
    // Set longer duration for error messages, shorter for success
    const defaultDuration = type === 'error' ? 5000 : type === 'success' ? 2000 : 3000;
    const finalDuration = duration ?? defaultDuration;
    
    // Generate a truly unique ID using timestamp + counter + random
    toastIdCounter += 1;
    const id = `toast-${Date.now()}-${toastIdCounter}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: ToastData = {
      id,
      message: normalized,
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

  const showPersistentToast = (message: string | unknown, type: ToastData['type'] = 'info'): string => {
    // Generate a truly unique ID using timestamp + counter + random
    toastIdCounter += 1;
    const id = `toast-persistent-${Date.now()}-${toastIdCounter}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: ToastData = {
      id,
      message: formatErrorLike(message),
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
