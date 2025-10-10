import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: any;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  style,
  value = '',
  onChangeText,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedBorder = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(animatedBorder, {
      toValue: 1,
      duration: theme.animations.standard,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    Animated.timing(animatedBorder, {
      toValue: 0,
      duration: theme.animations.standard,
      useNativeDriver: false,
    }).start(() => setIsFocused(false));
  };

  const borderColor = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.accent],
  });

  const shadowOpacity = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Platform.OS === 'ios' ? 0.35 : 0.25],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor,
            shadowOpacity,
            shadowColor: theme.colors.accent,
          },
          error && styles.error,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isFocused ? theme.colors.accent : theme.colors.textMuted}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          {...props}
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          underlineColorAndroid="transparent"
          selectionColor={theme.colors.accent}
          cursorColor={theme.colors.accent}
          autoCapitalize={props.autoCapitalize || 'none'}
          autoCorrect={props.autoCorrect ?? false}
          textContentType={props.secureTextEntry ? 'password' : props.textContentType}
          keyboardAppearance="dark"
        />

        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            activeOpacity={0.7}
            style={styles.rightIcon}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={isFocused ? theme.colors.accent : theme.colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </Animated.View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.lg },
  label: {
    ...theme.getTextStyle('label', 'medium'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  error: {
    borderColor: theme.colors.error,
    shadowColor: theme.colors.error,
  },
  input: {
    flex: 1,
    height: 48,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  leftIcon: { marginRight: theme.spacing.sm },
  rightIcon: { padding: theme.spacing.xs, marginLeft: theme.spacing.sm },
  inputWithLeftIcon: { marginLeft: theme.spacing.sm },
  inputWithRightIcon: { marginRight: theme.spacing.sm },
  errorText: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
});

export default Input;
