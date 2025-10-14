import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { apiService, API_BASE_URL, ComplianceSummaryResponse, Formula } from '../../services/api';
import { downloadFileFromApi, sanitizeDownloadFileName } from '../../services/downloads';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { on } from '../utils/EventBus';
import { getComplianceBadgeConfig, getComplianceSummaryMessage } from '../../utils/compliance';

type FormulaSortKey = 'recent' | 'created' | 'nameAsc';

const FORMULA_SORT_OPTIONS: Array<{ key: FormulaSortKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'recent', label: 'Recently Updated', icon: 'time-outline' },
  { key: 'created', label: 'Recently Created', icon: 'calendar-outline' },
  { key: 'nameAsc', label: 'Name (A → Z)', icon: 'text-outline' },
];

export const FormulasScreen: React.FC<any> = ({ navigation }) => {
  const { isGuestUser } = useAuth();
  const { showToast } = useToast();
  
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<FormulaSortKey>('recent');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
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

  const sortedFormulas = useMemo(() => {
    const copy = [...formulas];

    const getTime = (value: string) => new Date(value ?? 0).getTime();

    copy.sort((a, b) => {
      switch (sortBy) {
        case 'created':
          return getTime(b.created_at) - getTime(a.created_at);
        case 'nameAsc':
          return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
        case 'recent':
        default:
          return getTime(b.updated_at) - getTime(a.updated_at);
      }
    });

    return copy;
  }, [formulas, sortBy]);

  const currentSortLabel = useMemo(() => {
    const match = FORMULA_SORT_OPTIONS.find(option => option.key === sortBy);
    return match?.label ?? 'Sort';
  }, [sortBy]);

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
      // A newer fetch was kicked off; ignore this one
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
        loadComplianceSummaries(normalized);
      } else if (!response.isAuthError) {
        showToast(response.error || 'Failed to load formulas', 'error');
        setComplianceSummaries({});
      }
    } catch (error) {
      showToast(error, 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isGuestUser, loadComplianceSummaries]);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTargetFormula, setMenuTargetFormula] = useState<Formula | null>(null);
  const [exportingFormulaId, setExportingFormulaId] = useState<number | null>(null);
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
      void refreshComplianceSummary(newFormula.id);
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
      if (typeof payload?.formulaId === 'number') {
        void refreshComplianceSummary(payload.formulaId);
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
          showToast(error, 'error');
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
      showToast(error, 'error');
    }
  };

  const handleExportFormula = useCallback(async (formula: Formula) => {
    if (exportingFormulaId) {
      showToast('Already preparing an export…', 'info');
      return;
    }

    setMenuVisible(false);
    setExportingFormulaId(formula.id);

    try {
      const baseName = sanitizeDownloadFileName(formula.name ?? `formula-${formula.id}`);
      const fileName = `${baseName || `formula-${formula.id}`}-compliance-summary.pdf`;
      const endpoint = `${API_BASE_URL}/formulas/${formula.id}/export_summary/`;
      await downloadFileFromApi(endpoint, {
        fileName,
        mimeType: 'application/pdf',
      });
  showToast('Summary saved and ready to share.', 'success');
    } catch (error) {
      showToast(error, 'error');
    } finally {
      setExportingFormulaId(null);
    }
  }, [exportingFormulaId, showToast]);

  const handleFormulaOptions = (formula: Formula) => {
    setMenuTargetFormula(formula);
    setMenuVisible(true);
  };

  const renderFormula = ({ item }: { item: Formula }) => {
    const summary = complianceSummaries[item.id];
    const badgeConfig = getComplianceBadgeConfig(summary, { isLoading: isComplianceLoading });

    const summaryMessage = getComplianceSummaryMessage(summary, { isLoading: isComplianceLoading });
    let complianceSummaryDisplay: { text: string; style: any } | null = null;

    if (summaryMessage) {
      const styleByKind = {
        ready: styles.complianceSummaryText,
        hint: styles.complianceSummaryHintText,
        error: styles.complianceSummaryUnavailableText,
      } as const;

      complianceSummaryDisplay = {
        text: summaryMessage.message,
        style: styleByKind[summaryMessage.kind],
      };
    }

  const totalWeight = getTotalWeight(item);
  const ingredientCount = getIngredientCount(item);

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
              <Badge variant={badgeConfig.variant} size="small" style={styles.complianceBadge}>
                {badgeConfig.label}
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
            <Text style={styles.statText}>{ingredientCount} ingredients</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="scale" size={16} color={theme.colors.accent} />
            <Text style={styles.statText}>{( (item as any).total_weight_mg ?? totalWeight ).toFixed(0)} mg</Text>
          </View>
        </View>

            {complianceSummaryDisplay && (
              <Text style={complianceSummaryDisplay.style}>{complianceSummaryDisplay.text}</Text>
            )}
        
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
          onPress={() => setSortMenuVisible(true)}
        >
          <Ionicons name="swap-vertical" size={22} color={theme.colors.accent} />
          <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
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
            data={sortedFormulas}
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
        visible={sortMenuVisible}
        title="Sort formulas"
        items={FORMULA_SORT_OPTIONS.map(option => ({
          label: option.label,
          icon: option.key === sortBy ? 'checkmark' : option.icon,
          onPress: () => setSortBy(option.key),
        }))}
        onRequestClose={() => setSortMenuVisible(false)}
      />

      <ActionMenu
        visible={menuVisible}
        title={menuTargetFormula?.name}
        items={[
          { label: 'View Details', icon: 'document-text-outline', onPress: () => { setMenuVisible(false); navigation.navigate('FormulaDetail', { formulaId: menuTargetFormula?.id }); } },
          { label: 'Edit', icon: 'create-outline', onPress: () => { setMenuVisible(false); navigation.navigate('FormulaBuilder', { formulaId: menuTargetFormula?.id, initialName: menuTargetFormula?.name, initialDescription: menuTargetFormula?.description ?? '' }); } },
          { label: 'Duplicate', icon: 'copy-outline', onPress: () => { setMenuVisible(false); menuTargetFormula && handleDuplicateFormula(menuTargetFormula); } },
          { label: 'Check Compliance', icon: 'checkmark-done-outline', onPress: () => { setMenuVisible(false); if (menuTargetFormula) { navigation.navigate('ComplianceResults', { formulaId: menuTargetFormula.id, region: menuTargetFormula.region }); } } },
          {
            label: exportingFormulaId === menuTargetFormula?.id ? 'Preparing export…' : 'Export Summary',
            icon: exportingFormulaId === menuTargetFormula?.id ? 'time-outline' : 'share-outline',
            onPress: () => {
              if (menuTargetFormula) {
                void handleExportFormula(menuTargetFormula);
              } else {
                showToast('No formula selected for export.', 'error');
              }
            },
          },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sortButtonText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textSecondary,
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
