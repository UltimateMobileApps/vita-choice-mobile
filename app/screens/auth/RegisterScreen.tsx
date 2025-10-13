import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { theme } from '../../../constants/theme';
import { apiService } from '../../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export const RegisterScreen: React.FC<any> = ({ navigation }) => {
  const { register, isLoading } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password2: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak'|'medium'|'strong'|'empty'>('empty');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.password2) {
      newErrors.password2 = 'Please confirm your password';
    } else if (formData.password !== formData.password2) {
      newErrors.password2 = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = useCallback((field: string, text: string) => {
    setFormData(prev => ({ ...prev, [field]: text }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  }, [errors]);

  // Debounced email availability check
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const email = formData.email.trim();
    setEmailAvailable(null);

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailAvailable(null);
      return;
    }

    setCheckingEmail(true);
    timeout = setTimeout(async () => {
      try {
        const res = await apiService.checkEmailAvailability(email);
        if (res.data && typeof res.data.available === 'boolean') {
          setEmailAvailable(res.data.available);
        } else {
          setEmailAvailable(null);
        }
      } catch (e) {
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [formData.email]);

  // Password strength simple heuristic
  useEffect(() => {
    const pw = formData.password || '';
    if (!pw) return setPasswordStrength('empty');
    if (pw.length < 6) return setPasswordStrength('weak');
    const hasMixed = /(?=.*[a-z])(?=.*[A-Z])/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSymbol = /[^A-Za-z0-9]/.test(pw);

    if (pw.length >= 10 && hasMixed && hasNumber && hasSymbol) setPasswordStrength('strong');
    else if (pw.length >= 8 && (hasMixed || hasNumber)) setPasswordStrength('medium');
    else setPasswordStrength('weak');
  }, [formData.password]);

  const handleRegister = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await register({
        email: formData.email,
        password: formData.password,
        password2: formData.password2,
        first_name: formData.firstName,
        last_name: formData.lastName,
      });

      if (result.success) {
        showToast('Account created successfully!', 'success');
      } else {
        showToast(result.error || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showToast(
        error instanceof Error ? error.message : 'Registration failed',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, register, showToast, navigation, validateForm]);

  return (
    <LinearGradient
      colors={theme.colors.gradientBackground as [string, string]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                // If can't go back, navigate to Welcome screen
                navigation.navigate('Welcome');
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          <Image
            source={require('../../../assets/images/splash-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Vita Choice today</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.nameRow}>
            <Input
              label="First Name"
              placeholder="First name"
              value={formData.firstName}
              onChangeText={(text) => handleInputChange('firstName', text)}
              error={errors.firstName}
              containerStyle={styles.nameInput}
            />

            <Input
              label="Last Name"
              placeholder="Last name"
              value={formData.lastName}
              onChangeText={(text) => handleInputChange('lastName', text)}
              error={errors.lastName}
              containerStyle={styles.nameInput}
            />
          </View>

          <Input
            label="Email"
            placeholder="Enter your email"
            value={formData.email}
            onChangeText={(text) => handleInputChange('email', text)}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
            {checkingEmail ? (
              <Text style={{ ...theme.getTextStyle('caption'), color: theme.colors.textMuted }}>Checking email…</Text>
            ) : emailAvailable === true ? (
              <Text style={{ ...theme.getTextStyle('caption'), color: theme.colors.success }}>Email available</Text>
            ) : emailAvailable === false ? (
              <Text style={{ ...theme.getTextStyle('caption'), color: theme.colors.error }}>Email already in use</Text>
            ) : null}
          </View>

          <Input
            label="Password"
            placeholder="Create a password"
            value={formData.password}
            onChangeText={(text) => handleInputChange('password', text)}
            error={errors.password}
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />
          <View style={{ marginTop: theme.spacing.xs }}>
            {passwordStrength === 'empty' ? null : (
              <Text style={{ ...theme.getTextStyle('caption'), color: passwordStrength === 'strong' ? theme.colors.success : passwordStrength === 'medium' ? theme.colors.accent : theme.colors.error }}>
                Password strength: {passwordStrength}
              </Text>
            )}
          </View>

          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={formData.password2}
            onChangeText={(text) => handleInputChange('password2', text)}
            error={errors.password2}
            secureTextEntry={!showConfirmPassword}
            rightIcon={showConfirmPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
          />

          <Button
            title="Create Account"
            variant="primary"
            size="large"
            fullWidth
            onPress={handleRegister}
            loading={isSubmitting}
            style={styles.registerButton}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text
              style={styles.linkText}
              onPress={() => navigation.navigate('Login')}
            >
              Sign in
            </Text>
          </Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.getTextStyle('bodyLarge'),
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  nameInput: {
    flex: 1,
  },
  registerButton: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  linkText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.medium,
  },
});

export default RegisterScreen;
