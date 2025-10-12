import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Badge, Button, Card, ConfirmDialog, Skeleton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService } from '../../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const { user, logout, isLoading, isGuestUser } = useAuth();
  const { showToast, clearAllToasts, toasts } = useToast();
  
  const [stats, setStats] = useState({
    totalFormulas: 0,
    accountCreated: '',
    lastLogin: '',
  });

  useEffect(() => {
    // Clear any existing toasts when entering profile screen
    clearAllToasts();
    
    // Only load stats for authenticated users (not guests)
    if (!isGuestUser && user) {
      loadStats();
    }
  }, [isGuestUser, user]);

  const loadStats = async () => {
    try {
      const response = await apiService.getFormulas();
      if (response.data) {
        setStats(prev => ({
          ...prev,
          totalFormulas: response.data?.length || 0,
        }));
      } else if (response.error) {
        showToast(response.error, 'error');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      showToast('Failed to load profile statistics', 'error');
    }
  };

  const handleLogout = () => {
    setConfirmState({
      visible: true,
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      onConfirm: async () => {
        await logout();
        showToast('Logged out successfully', 'success');
      },
    });
  };

  const [confirmState, setConfirmState] = useState<{ visible: boolean; title?: string; message?: string; onConfirm?: () => void }>({ visible: false });

  const handleEditProfile = () => {
    showToast('Profile editing coming soon!', 'info');
  };

  const handleChangePassword = () => {
    showToast('Password change coming soon!', 'info');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (isLoading) {
    return (
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.container}
      >
        <Skeleton />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Profile Section */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.accentBlue]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {isGuestUser ? 'G' : getInitials(user?.first_name, user?.last_name, user?.username)}
                </Text>
              </LinearGradient>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>
                {isGuestUser 
                  ? 'Guest User'
                  : user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : user?.username
                }
              </Text>
              <Text style={styles.username}>
                {isGuestUser ? '@guest' : `@${user?.username}`}
              </Text>
              <Text style={styles.email}>
                {isGuestUser ? 'Limited access - Create account for full features' : user?.email}
              </Text>
            </View>
          </View>
          
          {!isGuestUser && (
            <Button
              title="Edit Profile"
              variant="outline"
              size="medium"
              onPress={handleEditProfile}
              style={styles.editButton}
            />
          )}
          
          {isGuestUser && (
            <Button
              title="Create Account"
              variant="primary"
              size="medium"
              onPress={() => navigation.navigate('Register')}
              style={styles.editButton}
            />
          )}
        </Card>

        {/* Statistics */}
        <Card style={styles.statsCard}>
          <Text style={styles.cardTitle}>Statistics</Text>
          
          {!isGuestUser ? (
            <>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Ionicons name="document-text" size={24} color={theme.colors.accent} />
                  <View style={styles.statInfo}>
                    <Text style={styles.statValue}>{stats.totalFormulas}</Text>
                    <Text style={styles.statLabel}>Formulas Created</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Ionicons name="calendar" size={24} color={theme.colors.accent} />
                  <View style={styles.statInfo}>
                    <Text style={styles.statValue}>Member since</Text>
                    <Text style={styles.statLabel}>Account created</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.guestMessage}>
              <Ionicons name="information-circle" size={24} color={theme.colors.textMuted} />
              <Text style={styles.guestMessageText}>
                Create an account to track your formulas and statistics
              </Text>
            </View>
          )}
        </Card>

        {/* Account Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Account</Text>
          
          {!isGuestUser ? (
            <>
              <TouchableOpacity style={styles.actionItem} onPress={handleEditProfile}>
                <View style={styles.actionLeft}>
                  <Ionicons name="person" size={24} color={theme.colors.accent} />
                  <Text style={styles.actionText}>Update Profile</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={handleChangePassword}>
                <View style={styles.actionLeft}>
                  <Ionicons name="lock-closed" size={24} color={theme.colors.accent} />
                  <Text style={styles.actionText}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={() => navigation.navigate('Register')}
              >
                <View style={styles.actionLeft}>
                  <Ionicons name="person-add" size={24} color={theme.colors.accent} />
                  <Text style={styles.actionText}>Create Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={() => navigation.navigate('Login')}
              >
                <View style={styles.actionLeft}>
                  <Ionicons name="log-in" size={24} color={theme.colors.accent} />
                  <Text style={styles.actionText}>Sign In</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <View style={styles.actionLeft}>
              <Ionicons name="log-out" size={24} color={theme.colors.error} />
              <Text style={[styles.actionText, { color: theme.colors.error }]}>
                {isGuestUser ? 'Exit Guest Mode' : 'Logout'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* App Settings */}
        <Card style={styles.settingsCard}>
          <Text style={styles.cardTitle}>App Settings</Text>
          
          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Notifications settings coming soon!', 'info')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="notifications" size={24} color={theme.colors.textMuted} />
              <Text style={[styles.actionText, { color: theme.colors.textMuted }]}>
                Notifications
              </Text>
            </View>
            <Badge variant="neutral" size="small">
              Soon
            </Badge>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Dark mode coming soon!', 'info')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="moon" size={24} color={theme.colors.textMuted} />
              <Text style={[styles.actionText, { color: theme.colors.textMuted }]}>
                Dark Mode
              </Text>
            </View>
            <Badge variant="neutral" size="small">
              Soon
            </Badge>
          </TouchableOpacity>
        </Card>

        {/* Support */}
        <Card style={styles.supportCard}>
          <Text style={styles.cardTitle}>Support</Text>
          
          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Help center coming soon!', 'info')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="help-circle" size={24} color={theme.colors.accent} />
              <Text style={styles.actionText}>Help Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Documentation coming soon!', 'info')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="book" size={24} color={theme.colors.accent} />
              <Text style={styles.actionText}>API Documentation</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Report issue coming soon!', 'info')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="bug" size={24} color={theme.colors.accent} />
              <Text style={styles.actionText}>Report Issue</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Legal */}
        <Card style={styles.legalCard}>
          <Text style={styles.cardTitle}>Legal</Text>
          
          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Terms of service coming soon!', 'info')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="document" size={24} color={theme.colors.textMuted} />
              <Text style={styles.actionText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Privacy policy coming soon!', 'info')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="shield-checkmark" size={24} color={theme.colors.textMuted} />
              <Text style={styles.actionText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Vita Choice v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Emergency Clear Toasts Button - for debugging */}
      {toasts.length > 0 && (
        <TouchableOpacity
          style={styles.clearToastsButton}
          onPress={clearAllToasts}
        >
          <Ionicons name="close-circle" size={24} color={theme.colors.textPrimary} />
          <Text style={styles.clearToastsText}>Clear All ({toasts.length})</Text>
        </TouchableOpacity>
      )}
      <ConfirmDialog
        visible={confirmState.visible}
        title={confirmState.title}
        message={confirmState.message}
        actions={[
          { text: 'Cancel', style: 'cancel', onPress: () => setConfirmState(prev => ({ ...prev, visible: false })) },
          { text: 'Logout', style: 'destructive', onPress: confirmState.onConfirm },
        ]}
        onRequestClose={() => setConfirmState(prev => ({ ...prev, visible: false }))}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Space for bottom navigation
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
  },
  profileCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  avatarContainer: {
    marginRight: theme.spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...theme.getTextStyle('h3', 'bold'),
    color: theme.colors.textPrimary,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  username: {
    ...theme.getTextStyle('body'),
    color: theme.colors.accent,
    marginBottom: theme.spacing.xs,
  },
  email: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
  },
  editButton: {
    alignSelf: 'flex-start',
  },
  statsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  statRow: {
    marginBottom: theme.spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statInfo: {
    marginLeft: theme.spacing.md,
  },
  statValue: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
  },
  statLabel: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
  },
  actionsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  settingsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  supportCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  legalCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.md,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  versionText: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  guestMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  guestMessageText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  clearToastsButton: {
    position: 'absolute',
    bottom: 100,
    right: theme.spacing.md,
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.heavy,
  },
  clearToastsText: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.xs,
  },
});

export default ProfileScreen;
