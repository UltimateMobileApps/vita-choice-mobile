import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActionMenu, Badge, Button, Card, ConfirmDialog, Skeleton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, Formula } from '../../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { on } from '../utils/EventBus';

export const FormulasScreen: React.FC<any> = ({ navigation }) => {
  const { isGuestUser } = useAuth();
  const { showToast } = useToast();
  
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('recently_updated');

  const loadFormulas = useCallback(async () => {
    // Don't load formulas for guest users
    if (isGuestUser) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.getFormulas();

      if (response.data) {
        const normalized = response.data.map((f: any) => ({
          ...f,
          ingredients: f.items ?? f.ingredients ?? [],
        }));
        setFormulas(normalized);
      } else if (!response.isAuthError) {
        showToast(response.error || 'Failed to load formulas', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isGuestUser]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTargetFormula, setMenuTargetFormula] = useState<Formula | null>(null);
  const [confirmState, setConfirmState] = useState<{ visible: boolean; title?: string; message?: string; onConfirm?: () => void }>({ visible: false });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFormulas();
  }, [loadFormulas]);

  // Use ONLY useFocusEffect for tab screens to prevent duplicate API calls
  // It handles both initial mount and screen focus
  useFocusEffect(
    useCallback(() => {
      loadFormulas();
    }, [loadFormulas])
  );

  useEffect(() => {
    const offCreate = on('formula:created', (payload) => {
      const newFormula = { ...payload, ingredients: payload.items ?? payload.ingredients ?? [] } as Formula;
      setFormulas(prev => [newFormula, ...prev]);
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
  }, []);

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
    const ingredientCount = (formula as any).ingredient_count ?? formula.ingredients?.length ?? 0;
    if (ingredientCount === 0) return { status: 'EMPTY', variant: 'neutral' as const };
    if (ingredientCount > 10) return { status: 'STOP', variant: 'error' as const };
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
    // Prefer server-provided total if available
    const serverTotal = (formula as any).total_weight_mg;
    if (typeof serverTotal === 'number') return serverTotal;

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

  const handleDeleteFormula = (formula: Formula) => {
    setConfirmState({
      visible: true,
      title: 'Delete Formula',
      message: `Are you sure you want to delete "${formula.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, visible: false }));
        try {
          const response = await apiService.deleteFormula(formula.id);
          if (response.data) {
            showToast('Formula deleted successfully', 'success');
            loadFormulas();
          } else if (!response.isAuthError) {
            showToast(response.error || 'Failed to delete formula', 'error');
          }
        } catch (error) {
          showToast('Network error', 'error');
        }
      },
    });
  };

  const handleDuplicateFormula = async (formula: Formula) => {
    try {
      const response = await apiService.duplicateFormula(formula.id);
      if (response.data) {
        showToast('Formula duplicated successfully', 'success');
        loadFormulas();
      } else if (!response.isAuthError) {
        showToast(response.error || 'Failed to duplicate formula', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleFormulaOptions = (formula: Formula) => {
    setMenuTargetFormula(formula);
    setMenuVisible(true);
  };

  const renderFormula = ({ item }: { item: Formula }) => {
    const compliance = getComplianceStatus(item);
    const totalWeight = getTotalWeight(item);

    return (
      <Card
        style={styles.formulaCard}
        onPress={() => navigation.navigate('FormulaDetail', { formulaId: item.id })}
      >
        <View style={styles.formulaHeader}>
          <View style={styles.formulaInfo}>
            <Text style={styles.formulaName}>{item.name}</Text>
            <View style={styles.badgeContainer}>
              <Badge variant="info" size="small">
                {item.region}
              </Badge>
              <Badge variant={compliance.variant} size="small" style={styles.complianceBadge}>
                {compliance.status}
              </Badge>
            </View>
          </View>
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => handleFormulaOptions(item)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.formulaDescription} numberOfLines={2}>
          {item.description || 'No description provided'}
        </Text>
        
            <View style={styles.formulaStats}>
          <View style={styles.statItem}>
            <Ionicons name="flask" size={16} color={theme.colors.accent} />
            <Text style={styles.statText}>{(item as any).ingredient_count ?? item.ingredients?.length ?? 0} ingredients</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="scale" size={16} color={theme.colors.accent} />
            <Text style={styles.statText}>{( (item as any).total_weight_mg ?? totalWeight ).toFixed(0)} mg</Text>
          </View>
        </View>
        
        <View style={styles.formulaFooter}>
          <Text style={styles.updateTime}>
            Updated {formatTimeAgo(item.updated_at)}
          </Text>
        </View>
      </Card>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>My Formulas</Text>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => showToast('Sort options coming soon!', 'info')}
        >
          <Ionicons name="funnel" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={64} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>No formulas yet</Text>
      <Text style={styles.emptyText}>
        Create your first supplement formula to get started
      </Text>
      <Button
        title="Create Formula"
        variant="primary"
        size="medium"
        onPress={() => navigation.navigate('FormulaBuilder')}
        style={styles.createButton}
      />
    </View>
  );

  const renderFloatingButton = () => (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={() => navigation.navigate('FormulaBuilder')}
    >
      <LinearGradient
        colors={[theme.colors.accent, theme.colors.accentBlue]}
        style={styles.floatingButtonGradient}
      >
        <Ionicons name="add" size={28} color={theme.colors.textPrimary} />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      
      {isGuestUser ? (
        <View style={styles.guestContainer}>
          <View style={styles.guestContent}>
            <Ionicons name="document-text-outline" size={80} color={theme.colors.textMuted} />
            <Text style={styles.guestTitle}>Formula Builder</Text>
            <Text style={styles.guestSubtitle}>
              Create and manage your supplement formulas
            </Text>
            <Text style={styles.guestDescription}>
              Build custom supplement formulas with our extensive ingredient database. 
              Check compliance for different regions and export professional documentation.
            </Text>
            <View style={styles.guestActions}>
              <Button
                title="Create Account"
                variant="primary"
                size="large"
                fullWidth
                onPress={() => navigation.navigate('Register')}
                style={styles.guestActionButton}
              />
              <Button
                title="Sign In"
                variant="outline"
                size="large"
                fullWidth
                onPress={() => navigation.navigate('Login')}
                style={styles.guestActionButton}
              />
            </View>
          </View>
        </View>
      ) : isLoading ? (
        <Skeleton />
      ) : (
        <>
          <FlatList
            data={formulas}
            renderItem={renderFormula}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
          
          {formulas.length > 0 && renderFloatingButton()}
        </>
      )}
      <ActionMenu
        visible={menuVisible}
        title={menuTargetFormula?.name}
        items={[
          { label: 'View Details', icon: 'document-text-outline', onPress: () => { setMenuVisible(false); navigation.navigate('FormulaDetail', { formulaId: menuTargetFormula?.id }); } },
          { label: 'Edit', icon: 'create-outline', onPress: () => { setMenuVisible(false); navigation.navigate('FormulaBuilder', { formulaId: menuTargetFormula?.id, initialName: menuTargetFormula?.name, initialDescription: menuTargetFormula?.description ?? '' }); } },
          { label: 'Duplicate', icon: 'copy-outline', onPress: () => { setMenuVisible(false); menuTargetFormula && handleDuplicateFormula(menuTargetFormula); } },
          { label: 'Check Compliance', icon: 'checkmark-done-outline', onPress: () => { setMenuVisible(false); showToast('Compliance check coming soon!', 'info'); } },
          { label: 'Export', icon: 'share-outline', onPress: () => { setMenuVisible(false); showToast('Export feature coming soon!', 'info'); } },
          { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => { setMenuVisible(false); menuTargetFormula && handleDeleteFormula(menuTargetFormula); } },
        ]}
        onRequestClose={() => setMenuVisible(false)}
      />

      <ConfirmDialog
        visible={confirmState.visible}
        title={confirmState.title}
        message={confirmState.message}
        actions={[
          { text: 'Cancel', style: 'cancel', onPress: () => setConfirmState(prev => ({ ...prev, visible: false })) },
          { text: 'Delete', style: 'destructive', onPress: confirmState.onConfirm },
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
  listContainer: {
    paddingBottom: 120, // Space for bottom navigation + floating button
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
  },
  sortButton: {
    padding: theme.spacing.sm,
  },
  formulaCard: {
    marginHorizontal: theme.spacing.screenPadding,
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
    marginRight: theme.spacing.md,
  },
  formulaName: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  complianceBadge: {
    marginLeft: theme.spacing.sm,
  },
  optionsButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  formulaDescription: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  formulaStats: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  statText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  formulaFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  updateTime: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.screenPadding,
    paddingVertical: theme.spacing.xxxl,
  },
  emptyTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  createButton: {
    paddingHorizontal: theme.spacing.xl,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100, // Above bottom navigation
    right: theme.spacing.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...theme.shadows.heavy,
  },
  floatingButtonGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPadding,
  },
  guestContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  guestTitle: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  guestSubtitle: {
    ...theme.getTextStyle('h5', 'medium'),
    color: theme.colors.accent,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  guestDescription: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
  },
  guestActions: {
    width: '100%',
    gap: theme.spacing.md,
  },
  guestActionButton: {
    marginBottom: theme.spacing.sm,
  },
});

export default FormulasScreen;
