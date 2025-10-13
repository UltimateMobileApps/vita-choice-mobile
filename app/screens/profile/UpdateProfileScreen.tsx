import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Card, Input } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import { apiService } from '../../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export const UpdateProfileScreen: React.FC<any> = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsFetching(true);
      const response = await apiService.getUserProfile();
      
      if (response.data) {
        setFormData({
          first_name: response.data.first_name || '',
          last_name: response.data.last_name || '',
          email: response.data.email || '',
        });
      } else if (response.error) {
        showToast(response.error, 'error');
        // Fallback to local user data
        if (user) {
          setFormData({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showToast('Failed to load profile data', 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
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
      const response = await apiService.updateProfile(formData);

      if (response.data) {
        showToast('Profile updated successfully', 'success');
        await refreshUser();
        navigation.goBack();
      } else if (response.error) {
        showToast(response.error, 'error');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.container}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </LinearGradient>
    );
  }

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
        <Text style={styles.title}>Update Profile</Text>
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
          <Card style={styles.formCard}>
            <Text style={styles.description}>
              Update your personal information below
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>First Name</Text>
              <Input
                placeholder="Enter your first name"
                value={formData.first_name}
                onChangeText={(value) => handleChange('first_name', value)}
                error={errors.first_name}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Last Name</Text>
              <Input
                placeholder="Enter your last name"
                value={formData.last_name}
                onChangeText={(value) => handleChange('last_name', value)}
                error={errors.last_name}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <Input
                placeholder="Enter your email"
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title="Cancel"
                variant="outline"
                size="large"
                onPress={() => navigation.goBack()}
                disabled={isLoading}
                style={styles.cancelButton}
              />
              <Button
                title={isLoading ? 'Updating...' : 'Update Profile'}
                variant="primary"
                size="large"
                onPress={handleSubmit}
                disabled={isLoading}
                style={styles.submitButton}
              />
            </View>
          </Card>

          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={20} color={theme.colors.accent} />
              <Text style={styles.infoText}>
                Your username cannot be changed. If you need to update it, please contact support.
              </Text>
            </View>
          </Card>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  formCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
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
});

export default UpdateProfileScreen;
