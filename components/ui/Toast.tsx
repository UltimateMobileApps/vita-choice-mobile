import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../../constants/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type,
  onDismiss,
  autoHide = true,
  duration = 3000,
}) => {
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: theme.animations.standard,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: theme.animations.standard,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: theme.animations.standard,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: theme.animations.standard,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: theme.colors.success };
      case 'error':
        return { backgroundColor: theme.colors.error };
      case 'warning':
        return { backgroundColor: theme.colors.warning };
      case 'info':
      default:
        return { backgroundColor: theme.colors.accentBlue };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        getToastStyle(),
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={getIcon() as any}
          size={24}
          color={theme.colors.textPrimary}
          style={styles.icon}
        />
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
          <Ionicons
            name="close"
            size={20}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.medium,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  icon: {
    marginRight: theme.spacing.md,
  },
  message: {
    flex: 1,
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
});

export default Toast;
