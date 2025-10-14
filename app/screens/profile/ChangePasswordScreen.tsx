import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { Button, Card, Input, Skeleton } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import { apiService } from '../../../services/api';
import { useToast } from '../../contexts/ToastContext';

export const ChangePasswordScreen: React.FC<any> = ({ navigation }) => {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [logoutAll, setLogoutAll] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const togglePasswordVisibility = (field: 'old' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.old_password) {
      newErrors.old_password = 'Current password is required';
    }

    if (!formData.new_password) {
      newErrors.new_password = 'New password is required';
    } else if (formData.new_password.length < 8) {
      newErrors.new_password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.new_password)) {
      newErrors.new_password = 'Password must contain uppercase, lowercase, and number';
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = 'Please confirm your password';
    } else if (formData.new_password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }

    if (formData.old_password === formData.new_password && formData.old_password) {
      newErrors.new_password = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.changePassword({
        old_password: formData.old_password,
        new_password: formData.new_password,
        // pass logout_all to backend (boolean)
        logout_all: logoutAll,
      } as any);

      if (response.data) {
        showToast('Password changed successfully', 'success');
        navigation.goBack();
      } else if (response.error) {
        // Check if it's an old password error
        if (response.error.toLowerCase().includes('old') || 
            response.error.toLowerCase().includes('current') ||
            response.error.toLowerCase().includes('incorrect')) {
          setErrors({ old_password: 'Current password is incorrect' });
        }
        showToast(response.error, 'error');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showToast('Failed to change password', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Change Password</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <Text style={styles.description}>
              Choose a strong password to keep your account secure
            </Text>

            {/* Current Password */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.passwordContainer}>
                <Input
                  placeholder="Enter current password"
                  value={formData.old_password}
                  onChangeText={(value) => handleChange('old_password', value)}
                  error={errors.old_password}
                  secureTextEntry={!showPasswords.old}
                  autoCapitalize="none"
                  editable={!isLoading}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => togglePasswordVisibility('old')}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPasswords.old ? 'eye-off' : 'eye'}
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordContainer}>
                <Input
                  placeholder="Enter new password"
                  value={formData.new_password}
                  onChangeText={(value) => handleChange('new_password', value)}
                  error={errors.new_password}
                  secureTextEntry={!showPasswords.new}
                  autoCapitalize="none"
                  editable={!isLoading}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => togglePasswordVisibility('new')}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPasswords.new ? 'eye-off' : 'eye'}
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.passwordContainer}>
                <Input
                  placeholder="Re-enter new password"
                  value={formData.confirm_password}
                  onChangeText={(value) => handleChange('confirm_password', value)}
                  error={errors.confirm_password}
                  secureTextEntry={!showPasswords.confirm}
                  autoCapitalize="none"
                  editable={!isLoading}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => togglePasswordVisibility('confirm')}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPasswords.confirm ? 'eye-off' : 'eye'}
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Requirements */}
            <View style={styles.requirementsCard}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={formData.new_password.length >= 8 ? 'checkmark-circle' : 'radio-button-off'}
                  size={16}
                  color={formData.new_password.length >= 8 ? theme.colors.success : theme.colors.textMuted}
                />
                <Text style={styles.requirementText}>At least 8 characters</Text>
              </View>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={/[A-Z]/.test(formData.new_password) ? 'checkmark-circle' : 'radio-button-off'}
                  size={16}
                  color={/[A-Z]/.test(formData.new_password) ? theme.colors.success : theme.colors.textMuted}
                />
                <Text style={styles.requirementText}>One uppercase letter</Text>
              </View>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={/[a-z]/.test(formData.new_password) ? 'checkmark-circle' : 'radio-button-off'}
                  size={16}
                  color={/[a-z]/.test(formData.new_password) ? theme.colors.success : theme.colors.textMuted}
                />
                <Text style={styles.requirementText}>One lowercase letter</Text>
              </View>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={/\d/.test(formData.new_password) ? 'checkmark-circle' : 'radio-button-off'}
                  size={16}
                  color={/\d/.test(formData.new_password) ? theme.colors.success : theme.colors.textMuted}
                />
                <Text style={styles.requirementText}>One number</Text>
              </View>
            </View>

            {/* Logout all sessions option */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                onPress={() => setLogoutAll(prev => !prev)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: logoutAll }}
                style={styles.checkboxTouch}
              >
                <View style={[styles.checkboxBox, logoutAll && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }]}>
                  {logoutAll ? <Ionicons name="checkmark" size={14} color={theme.colors.textPrimary} /> : null}
                </View>
                <Text style={styles.checkboxLabel}>Logout of all sessions</Text>
              </TouchableOpacity>

              <Pressable
                onPress={() => setShowTooltip(prev => !prev)}
                onHoverIn={() => setShowTooltip(true)}
                onHoverOut={() => setShowTooltip(false)}
                onLongPress={() => setShowTooltip(prev => !prev)}
                style={styles.infoTouch}
              >
                <Ionicons name="information-circle" size={18} color={theme.colors.textMuted} />
              </Pressable>

              {showTooltip && (
                <View style={styles.tooltipContainer}>
                  <Text style={styles.tooltipText}>Also signs out other devices and sessions. Default is off.</Text>
                </View>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={isLoading ? 'Changing...' : 'Change Password'}
                variant="primary"
                size="large"
                onPress={handleSubmit}
                disabled={isLoading}
                style={styles.submitButton}
              />
            </View>

            {isLoading && (
              <View style={styles.skeletonOverlay} pointerEvents="none">
                <Skeleton />
              </View>
            )}
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark" size={20} color={theme.colors.accent} />
              <Text style={styles.infoText}>
                For your security, you will remain logged in after changing your password.
              </Text>
            </View>
          </Card>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...theme.getTextStyle('h3', 'bold'),
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  formCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
    position: 'relative',
  },
  description: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    padding: 5,
  },
  requirementsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  requirementsTitle: {
    ...theme.getTextStyle('bodySmall', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  requirementText: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  infoCard: {
    marginHorizontal: theme.spacing.screenPadding,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  skeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: theme.borderRadius.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPadding,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  checkboxTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    backgroundColor: 'transparent',
  },
  checkboxLabel: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textPrimary,
  },
  infoTouch: {
    marginLeft: theme.spacing.sm,
    padding: 6,
  },
  tooltipContainer: {
    position: 'absolute',
    top: -36,
    right: theme.spacing.screenPadding,
    backgroundColor: '#111',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    zIndex: 20,
    maxWidth: 260,
  },
  tooltipText: {
    ...theme.getTextStyle('caption'),
    color: '#fff',
  },
});

export default ChangePasswordScreen;
