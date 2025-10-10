import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import { theme } from '../../constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  onPress,
  ...props
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    if (!disabled && !loading && onPress) {
      onPress({} as any);
    }
  };

  const textColor =
    variant === 'primary'
      ? theme.colors.textPrimary
      : variant === 'secondary'
      ? theme.colors.accent
      : theme.colors.textMuted;

  const textStyle = [
    styles.text,
    { color: textColor },
    size === 'large' && { fontSize: 18 },
    size === 'small' && { fontSize: 14 },
  ];

  const baseStyle: ViewStyle[] = [
    styles.base,
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style as any,
  ];

  const renderContent = () => (
    <>
      {leftIcon && !loading && <>{leftIcon}</>}
      {loading ? (
        <>
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? theme.colors.textPrimary : theme.colors.accent}
            style={styles.loader}
          />
          <Text style={textStyle}>Loading...</Text>
        </>
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
      {rightIcon && !loading && <>{rightIcon}</>}
    </>
  );

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {variant === 'primary' ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          disabled={disabled || loading}
          style={baseStyle}
          {...props}
        >
          <LinearGradient
            colors={theme.colors.gradientButton as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, theme.shadows.medium]}
          >
            {renderContent()}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          disabled={disabled || loading}
          style={[
            ...baseStyle,
            variant === 'secondary' && styles.secondary,
            variant === 'outline' && styles.outline,
          ]}
          {...props}
        >
          {renderContent()}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // ✅ ensures text is centered
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.buttonPadding,
    width: '100%',
  },
  text: {
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  fullWidth: {
    width: '100%',
  },
  secondary: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(46,230,214,0.08)', // ✅ faint accent background
    ...theme.shadows.light,
  },
  outline: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  loader: {
    marginHorizontal: theme.spacing.sm,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default Button;
