import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Button, Card, Skeleton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, Formula } from '../../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { on } from '../utils/EventBus';

interface HomeScreenProps {
  navigation: any;
}

interface Stats {
  totalFormulas: number;
  approved: number;
  warning: number;
  risk: number;
}

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const { user, isGuestUser } = useAuth();
  const { showToast } = useToast();
  
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalFormulas: 0,
    approved: 0,
    warning: 0,
    risk: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    // Don't load formulas for guest users
    if (isGuestUser) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiService.getFormulas();
      if (response.data) {
        // Normalize server `items` into `ingredients` for UI consistency
        const normalized = response.data.map((f: any) => ({
          ...f,
          ingredients: f.items ?? f.ingredients ?? [],
        }));
        setFormulas(normalized);
        calculateStats(normalized);
      } else if (!response.isAuthError) {
        showToast(response.error || 'Failed to load formulas', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, isGuestUser]);

  // Event listeners for immediate updates
  useEffect(() => {
    const offCreate = on('formula:created', (payload) => {
      // Prepend the new formula (server response) to the list for immediate feedback
      try {
        const newFormula = { ...payload, ingredients: payload.items ?? payload.ingredients ?? [] } as Formula;
        setFormulas(prev => [newFormula, ...prev]);
        calculateStats([newFormula, ...formulas]);
      } catch (e) {
        console.error('Error handling formula:created', e);
      }
    });

    const offIngredient = on('formula:ingredient_added', (payload) => {
      const { formulaId, item } = payload || {};
      setFormulas(prev => prev.map(f => {
        if (f.id === formulaId) {
          const ingredients = [...(f.ingredients ?? []), item];
          return { ...f, ingredients } as Formula;
        }
        return f;
      }));
    });

    return () => {
      offCreate();
      offIngredient();
    };
  }, [formulas]);

  const calculateStats = (formulaList: Formula[]) => {
    const newStats = {
      totalFormulas: formulaList.length,
      approved: 0,
      warning: 0,
      risk: 0,
    };

    // Note: In real implementation, you'd check compliance status
    // For now, we'll simulate some stats
    newStats.approved = Math.floor(formulaList.length * 0.7);
    newStats.warning = Math.floor(formulaList.length * 0.2);
    newStats.risk = Math.floor(formulaList.length * 0.1);

    setStats(newStats);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCreateFormula = () => {
    if (isGuestUser) {
      showToast('Create an account to build formulas', 'info');
      navigation.navigate('Register');
    } else {
      navigation.navigate('FormulaBuilder');
    }
  };

  const handleFormulaDetail = (formulaId: number) => {
    if (isGuestUser) {
      showToast('Create an account to view formula details', 'info');
      navigation.navigate('Register');
    } else {
      navigation.navigate('FormulaDetail', { formulaId });
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  const getComplianceStatus = (formula: Formula) => {
    // Simulate compliance status based on formula data
    const ingredientCount = formula.ingredients?.length ?? 0;
    if (ingredientCount === 0) return { status: 'EMPTY', variant: 'neutral' as const };
    if (ingredientCount > 10) return { status: 'RISK', variant: 'error' as const };
    if (ingredientCount > 5) return { status: 'WARNING', variant: 'warning' as const };
    return { status: 'APPROVED', variant: 'success' as const };
  };

  const normalizeDoseValue = (value: number | string | null | undefined): number => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  };

  const getTotalWeight = (formula: Formula) => {
    if (!formula.ingredients || !Array.isArray(formula.ingredients)) return 0;
    return formula.ingredients.reduce((total, ing) => {
      const doseValue = normalizeDoseValue(ing?.dose_value);
      const unit = ing?.dose_unit?.toLowerCase?.() ?? 'mg';

      if (unit === 'g') {
        return total + doseValue * 1000;
      }
      if (unit === 'mcg') {
        return total + doseValue / 1000;
      }

      return total + doseValue;
    }, 0);
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>
                {isGuestUser 
                  ? 'Hello, Guest'
                  : `Hello, ${user?.first_name || user?.username}`
                }
              </Text>
              <Text style={styles.welcomeText}>
                {isGuestUser 
                  ? 'Exploring Vita Choice' 
                  : 'Welcome back to Vita Choice'
                }
              </Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person-circle" size={40} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Guest Welcome Section */}
        {isGuestUser && (
          <Card style={styles.guestWelcomeCard}>
            <View style={styles.guestWelcome}>
              <Ionicons name="leaf" size={32} color={theme.colors.accent} />
              <Text style={styles.guestWelcomeTitle}>Welcome to Vita Choice!</Text>
              <Text style={styles.guestWelcomeText}>
                Explore our ingredient database and create an account to build and save your own supplement formulas.
              </Text>
              <View style={styles.guestActions}>
                <Button
                  title="Create Account"
                  variant="primary"
                  size="medium"
                  onPress={() => navigation.navigate('Register')}
                  style={styles.guestActionButton}
                />
                <Button
                  title="Sign In"
                  variant="outline"
                  size="medium"
                  onPress={() => navigation.navigate('Login')}
                  style={styles.guestActionButton}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Quick Stats Card */}
        {!isGuestUser && (
          <Card style={styles.statsCard}>
          <Text style={styles.cardTitle}>Your Formulas</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalFormulas}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.success }]}>
                {stats.approved}
              </Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.warning }]}>
                {stats.warning}
              </Text>
              <Text style={styles.statLabel}>Warning</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.error }]}>
                {stats.risk}
              </Text>
              <Text style={styles.statLabel}>Risk</Text>
            </View>
          </View>
        </Card>
        )}

        {/* Recent Formulas */}
        {!isGuestUser && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Formulas</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Formulas')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {formulas.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={48} color={theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>No formulas yet</Text>
                <Text style={styles.emptyText}>
                  Create your first supplement formula to get started
                </Text>
                <Button
                  title="Create Formula"
                  variant="primary"
                  size="medium"
                  onPress={handleCreateFormula}
                  style={styles.emptyButton}
                />
              </View>
            </Card>
          ) : (
            formulas.slice(0, 5).map((formula) => {
              const compliance = getComplianceStatus(formula);
              const totalWeight = getTotalWeight(formula);
              
              return (
                <Card
                  key={formula.id}
                  style={styles.formulaCard}
                  onPress={() => handleFormulaDetail(formula.id)}
                >
                  <View style={styles.formulaHeader}>
                    <View style={styles.formulaInfo}>
                      <Text style={styles.formulaName}>{formula.name}</Text>
                      <Badge variant="info" size="small">
                        {formula.region}
                      </Badge>
                    </View>
                    <Badge variant={compliance.variant} size="small">
                      {compliance.status}
                    </Badge>
                  </View>
                  
                  <Text style={styles.formulaDescription} numberOfLines={2}>
                    {formula.description || 'No description'}
                  </Text>
                  
                  <View style={styles.formulaStats}>
                    <Text style={styles.formulaStatText}>
                      {formula.ingredients?.length ?? 0} ingredients
                    </Text>
                    <Text style={styles.formulaStatText}>
                      {totalWeight.toFixed(0)} mg
                    </Text>
                    <Text style={styles.formulaStatText}>
                      Updated {formatTimeAgo(formula.updated_at)}
                    </Text>
                  </View>
                </Card>
              );
            })
          )}
        </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCreateFormula}
            >
              <Ionicons name="add-circle" size={32} color={theme.colors.accent} />
              <Text style={styles.actionText}>Create Formula</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Ingredients')}
            >
              <Ionicons name="search" size={32} color={theme.colors.accent} />
              <Text style={styles.actionText}>Browse Ingredients</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => showToast('Import feature coming soon!', 'info')}
            >
              <Ionicons name="cloud-upload" size={32} color={theme.colors.textMuted} />
              <Text style={[styles.actionText, { color: theme.colors.textMuted }]}>
                Import Formula
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 100, // Space for bottom navigation
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    ...theme.getTextStyle('h3', 'bold'),
    color: theme.colors.textPrimary,
  },
  welcomeText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  profileButton: {
    padding: theme.spacing.xs,
  },
  statsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  guestWelcomeCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  guestWelcome: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  guestWelcomeTitle: {
    ...theme.getTextStyle('h4', 'bold'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  guestWelcomeText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  guestActions: {
    width: '100%',
    gap: theme.spacing.md,
  },
  guestActionButton: {
    width: '100%',
  },
  cardTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
  },
  statLabel: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  section: {
    paddingHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
  },
  viewAllText: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.accent,
  },
  emptyCard: {
    padding: theme.spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: theme.spacing.xl,
  },
  formulaCard: {
    marginBottom: theme.spacing.md,
  },
  formulaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  formulaInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  formulaName: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.md,
    flex: 1,
  },
  formulaDescription: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  formulaStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formulaStatText: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  quickActions: {
    paddingHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.xl,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionText: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
});

export default HomeScreen;
