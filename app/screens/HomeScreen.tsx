import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { apiService, ComplianceSummaryResponse, Formula } from '../../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { on } from '../utils/EventBus';
import { computeComplianceCounters, getComplianceBadgeConfig, getComplianceSummaryMessage } from '../../utils/compliance';

interface HomeScreenProps {
  navigation: any;
}

interface Stats {
  totalFormulas: number;
  approved: number;
  warning: number;
  risk: number;
  empty: number;
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
    empty: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complianceSummaries, setComplianceSummaries] = useState<Record<number, ComplianceSummaryResponse | null | undefined>>({});
  const [isComplianceLoading, setIsComplianceLoading] = useState(false);
  const complianceFetchIdRef = useRef(0);
  const hasShownComplianceSummaryErrorRef = useRef(false);

  useEffect(() => {
    return () => {
      complianceFetchIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (isGuestUser) {
      setComplianceSummaries({});
      setIsComplianceLoading(false);
    }
  }, [isGuestUser]);

  const loadComplianceSummaries = useCallback(async (formulaList: Formula[]) => {
    if (isGuestUser) {
      setComplianceSummaries({});
      setIsComplianceLoading(false);
      return;
    }

    if (!formulaList.length) {
      setComplianceSummaries({});
      setIsComplianceLoading(false);
      return;
    }

    const fetchId = ++complianceFetchIdRef.current;
    setIsComplianceLoading(true);

    setComplianceSummaries(() => {
      const initial: Record<number, undefined> = {};
      formulaList.forEach(formula => {
        initial[formula.id] = undefined;
      });
      return initial;
    });

    const responses = await Promise.allSettled(
      formulaList.map((formula) => apiService.getComplianceSummary(formula.id))
    );

    if (complianceFetchIdRef.current !== fetchId) {
      return;
    }

    const nextSummaries: Record<number, ComplianceSummaryResponse | null> = {};
    let failureCount = 0;

    responses.forEach((result, index) => {
      const formulaId = formulaList[index].id;
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response.data) {
          nextSummaries[formulaId] = response.data;
        } else {
          nextSummaries[formulaId] = null;
          failureCount += 1;
          if (response.error) {
            console.warn(`Compliance summary error for formula ${formulaId}:`, response.error);
          }
        }
      } else {
        nextSummaries[formulaId] = null;
        failureCount += 1;
        console.warn(`Compliance summary request failed for formula ${formulaId}:`, result.reason);
      }
    });

    setComplianceSummaries(nextSummaries);
    setIsComplianceLoading(false);

    if (failureCount === 0) {
      hasShownComplianceSummaryErrorRef.current = false;
    } else if (!hasShownComplianceSummaryErrorRef.current) {
      showToast('Some compliance summaries could not be loaded', 'warning');
      hasShownComplianceSummaryErrorRef.current = true;
    }
  }, [isGuestUser, showToast]);

  const refreshComplianceSummary = useCallback(async (formulaId: number) => {
    if (isGuestUser) {
      return;
    }

    setComplianceSummaries(prev => ({
      ...prev,
      [formulaId]: undefined,
    }));

    try {
      const response = await apiService.getComplianceSummary(formulaId);
      setComplianceSummaries(prev => ({
        ...prev,
        [formulaId]: response.data ?? null,
      }));

      if (response.data) {
        hasShownComplianceSummaryErrorRef.current = false;
      }

      if (!response.data && response.error && !hasShownComplianceSummaryErrorRef.current) {
        showToast(response.error, 'warning');
        hasShownComplianceSummaryErrorRef.current = true;
      }
    } catch (error) {
      console.error('Failed to refresh compliance summary', error);
      setComplianceSummaries(prev => ({
        ...prev,
        [formulaId]: null,
      }));
    }
  }, [isGuestUser, showToast]);

  useEffect(() => {
    if (isGuestUser) {
      setStats({
        totalFormulas: 0,
        approved: 0,
        warning: 0,
        risk: 0,
        empty: 0,
      });
      return;
    }

    const counters = computeComplianceCounters(complianceSummaries);
    setStats({
      totalFormulas: formulas.length,
      approved: counters.approved,
      warning: counters.warning,
      risk: counters.stop,
      empty: counters.empty,
    });
  }, [complianceSummaries, formulas.length, isGuestUser]);

  const loadData = useCallback(async () => {
    // Don't load formulas for guest users
    if (isGuestUser) {
      setIsLoading(false);
      setComplianceSummaries({});
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
        loadComplianceSummaries(normalized);
      } else if (!response.isAuthError) {
        showToast(response.error || 'Failed to load formulas', 'error');
        setComplianceSummaries({});
      }
    } catch (error) {
      showToast(error, 'error');
      setComplianceSummaries({});
    } finally {
      setIsLoading(false);
    }
  }, [showToast, isGuestUser, loadComplianceSummaries]);

  // Event listeners for immediate updates
  useEffect(() => {
    const offCreate = on('formula:created', (payload) => {
      // Prepend the new formula (server response) to the list for immediate feedback
      try {
        const newFormula = { ...payload, ingredients: payload.items ?? payload.ingredients ?? [] } as Formula;
        setFormulas(prev => [newFormula, ...prev]);
        void refreshComplianceSummary(newFormula.id);
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
      if (typeof formulaId === 'number') {
        void refreshComplianceSummary(formulaId);
      }
    });

    const offComplianceChecked = on('formula:compliance_checked', (payload) => {
      if (typeof payload?.formulaId === 'number') {
        void refreshComplianceSummary(payload.formulaId);
      }
    });

    return () => {
      offCreate();
      offIngredient();
      offComplianceChecked();
    };
  }, [refreshComplianceSummary]);

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

  // Use ONLY useFocusEffect for tab screens to prevent duplicate API calls
  // It handles both initial mount and screen focus
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

  const getIngredientCount = (formula: Formula): number => {
    const fromMeta = (formula as any).total_ingredients
      ?? (formula as any).ingredient_count
      ?? (formula as any).ingredients_count
      ?? (formula as any).ingredientCount;

    if (typeof fromMeta === 'number' && Number.isFinite(fromMeta)) {
      return fromMeta;
    }

    const items = (formula as any).items ?? formula.ingredients;
    if (Array.isArray(items)) {
      return items.length;
    }

    return 0;
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
                {stats.empty > 0 && (
                  <Text style={styles.statSubLabel}>{stats.empty} empty</Text>
                )}
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
            {isComplianceLoading && (
              <Text style={styles.statsHint}>Updating compliance summaries…</Text>
            )}
          </Card>
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
              const summary = complianceSummaries[formula.id];
              const badgeConfig = getComplianceBadgeConfig(summary, { isLoading: isComplianceLoading });
              const summaryMessage = getComplianceSummaryMessage(summary, { isLoading: isComplianceLoading });
              const totalWeight = getTotalWeight(formula);

              let summaryDisplay: { text: string; style: any } | null = null;
              if (summaryMessage) {
                const styleByKind = {
                  ready: styles.complianceSummaryText,
                  hint: styles.complianceSummaryHintText,
                  error: styles.complianceSummaryUnavailableText,
                } as const;
                summaryDisplay = {
                  text: summaryMessage.message,
                  style: styleByKind[summaryMessage.kind],
                };
              }
              
              const ingredientCount = getIngredientCount(formula);

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
                    <Badge variant={badgeConfig.variant} size="small">
                      {badgeConfig.label}
                    </Badge>
                  </View>
                  
                  <Text style={styles.formulaDescription} numberOfLines={2}>
                    {formula.description || 'No description'}
                  </Text>

                  {summaryDisplay && (
                    <Text style={summaryDisplay.style}>{summaryDisplay.text}</Text>
                  )}
                  
                  <View style={styles.formulaStats}>
                    <Text style={styles.formulaStatText}>
                      {ingredientCount} ingredients
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
  statSubLabel: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  statsHint: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    textAlign: 'center',
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
  complianceSummaryText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  complianceSummaryHintText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    fontStyle: 'italic',
  },
  complianceSummaryUnavailableText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
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
