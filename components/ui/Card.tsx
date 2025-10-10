import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { theme } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'default' | 'elevated';
  padding?: keyof typeof theme.spacing;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'default',
  padding = 'lg',
}) => {
  const cardStyle = [
    styles.base,
    styles[variant],
    { padding: theme.spacing[padding] },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.9}>
        <LinearGradient
          colors={[theme.colors.secondary, theme.colors.surface]}
          style={styles.gradient}
        >
          {children}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle}>
      <LinearGradient
        colors={[theme.colors.secondary, theme.colors.surface]}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  default: {
    ...theme.shadows.medium,
  },
  elevated: {
    ...theme.shadows.heavy,
  },
  gradient: {
    flex: 1,
    padding: theme.spacing.lg,
  },
});

export default Card;
