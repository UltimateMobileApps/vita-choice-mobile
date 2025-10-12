import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Button, Card, Skeleton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, ComplianceResult, Formula } from '../../services/api';
import { useToast } from '../contexts/ToastContext';

interface FormulaDetailScreenProps {
  navigation: any;
  route: any;
}

export const FormulaDetailScreen: React.FC<FormulaDetailScreenProps> = ({ navigation, route }) => {
  const { showToast } = useToast();
  const formulaId = route?.params?.formulaId;

  const [formula, setFormula] = useState<Formula | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadFormula = useCallback(async () => {
    try {
      const response = await apiService.getFormula(formulaId);
      if (response.data) {
        const data = response.data as any;
        // Server returns `items` for ingredients. Normalize to `ingredients` and parse dose values.
        const rawItems = data.items ?? data.ingredients ?? [];
        const normalizedItems = (rawItems || []).map((it: any) => ({
          ...it,
          dose_value: typeof it.dose_value === 'string' ? parseFloat(it.dose_value) : it.dose_value,
          dose_unit: it.dose_unit ?? 'mg',
        }));

        setFormula({
          ...data,
          ingredients: normalizedItems,
        });
      } else {
        showToast(response.error || 'Failed to load formula', 'error');
        navigation.goBack();
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [formulaId, showToast, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFormula();
  }, [loadFormula]);

  const checkCompliance = async () => {
    if (!formula) return;

    setIsCheckingCompliance(true);
    try {
      const response = await apiService.checkCompliance(formula.id, formula.region);
      if (response.data) {
        setCompliance(response.data);
        showToast('Compliance check completed', 'success');
      } else {
        showToast(response.error || 'Failed to check compliance', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsCheckingCompliance(false);
    }
  };

  const handleEdit = () => {
    if (!formula) return;

    navigation.navigate('FormulaBuilder', {
      formulaId: formula.id,
      initialName: formula.name,
      initialDescription: formula.description ?? '',
    });
  };

  const handleAddIngredient = () => {
    if (!formula) return;

    navigation.navigate('FormulaBuilder', {
      formulaId: formula.id,
      initialName: formula.name,
      initialDescription: formula.description ?? '',
      openIngredientPicker: true,
    });
  };

  const handleDuplicate = async () => {
    if (!formula) return;

    try {
      const response = await apiService.duplicateFormula(formula.id);
      if (response.data) {
        showToast('Formula duplicated successfully!', 'success');
        navigation.goBack();
      } else {
        showToast(response.error || 'Failed to duplicate formula', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleDelete = () => {
    if (!formula) return;

    Alert.alert(
      'Delete Formula',
      `Are you sure you want to delete "${formula.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const response = await apiService.deleteFormula(formula.id);
              if (response.data) {
                showToast('Formula deleted successfully', 'success');
                navigation.goBack();
              } else {
                showToast(response.error || 'Failed to delete formula', 'error');
              }
            } catch (error) {
              showToast('Network error', 'error');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
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

  const handleShare = async () => {
    if (!formula) return;

    const totalWeight = getTotalWeight();
    const ingredients = formula.ingredients ?? [];
    const ingredientsList = ingredients
      .map((ing) => `• ${ing.ingredient.name}: ${normalizeDoseValue(ing.dose_value)} ${ing.dose_unit ?? 'mg'}`)
      .join('\n');

    const message = `${formula.name}\n\n${formula.description || ''}\n\nIngredients:\n${ingredientsList}\n\nTotal: ${totalWeight.toFixed(1)} mg\nRegion: ${formula.region}`;

    try {
      await Share.share({
        message,
        title: formula.name,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleExport = () => {
    Alert.alert(
      'Export Formula',
      'Choose export format',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Supplement Label',
          onPress: async () => {
            try {
              const response = await apiService.exportSupplementLabel(formulaId);
              if (response.data) {
                showToast('Export successful!', 'success');
                // TODO: Handle download
              } else {
                showToast(response.error || 'Export failed', 'error');
              }
            } catch (error) {
              showToast('Network error', 'error');
            }
          },
        },
        {
          text: 'CSV',
          onPress: async () => {
            try {
              const response = await apiService.exportFormulaCSV(formulaId);
              if (response.data) {
                showToast('Export successful!', 'success');
                // TODO: Handle download
              } else {
                showToast(response.error || 'Export failed', 'error');
              }
            } catch (error) {
              showToast('Network error', 'error');
            }
          },
        },
        {
          text: 'Summary PDF',
          onPress: async () => {
            try {
              const response = await apiService.exportFormulaSummary(formulaId);
              if (response.data) {
                showToast('Export successful!', 'success');
                // TODO: Handle download
              } else {
                showToast(response.error || 'Export failed', 'error');
              }
            } catch (error) {
              showToast('Network error', 'error');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (formulaId) {
      loadFormula();
    }
  }, [formulaId, loadFormula]);

  useFocusEffect(
    useCallback(() => {
      if (formulaId) {
        loadFormula();
      }
    }, [formulaId, loadFormula])
  );

  const getTotalWeight = () => {
    if (!formula?.ingredients) return 0;
    return formula.ingredients.reduce((total, ing) => {
      const doseValue = normalizeDoseValue(ing.dose_value);
      const unit = ing.dose_unit?.toLowerCase?.() ?? 'mg';

      if (unit === 'g') {
        return total + doseValue * 1000;
      }
      if (unit === 'mcg') {
        return total + doseValue / 1000;
      }

      return total + doseValue;
    }, 0);
  };

  const getComplianceStatus = () => {
    if (!formula?.ingredients) return { status: 'EMPTY', variant: 'neutral' as const };
    const count = formula.ingredients.length;
    if (count === 0) return { status: 'EMPTY', variant: 'neutral' as const };
    if (count > 10) return { status: 'RISK', variant: 'error' as const };
    if (count > 5) return { status: 'WARNING', variant: 'warning' as const };
    return { status: 'APPROVED', variant: 'success' as const };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading || !formula) {
    return (
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.container}
      >
        <Skeleton />
      </LinearGradient>
    );
  }

  const complianceStatus = getComplianceStatus();
  const totalWeight = getTotalWeight();

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Formula Title */}
        <View style={styles.titleSection}>
          <View style={styles.titleHeader}>
            <Text style={styles.title}>{formula.name}</Text>
            <Badge variant={complianceStatus.variant} size="medium">
              {complianceStatus.status}
            </Badge>
          </View>
          {formula.description && (
            <Text style={styles.description}>{formula.description}</Text>
          )}
          <View style={styles.metadata}>
            <View style={styles.metadataItem}>
              <Ionicons name="globe-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.metadataText}>{formula.region}</Text>
            </View>
            <View style={styles.metadataItem}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.textMuted} />
              <Text style={styles.metadataText}>Created {formatDate(formula.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <Card style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="flask" size={24} color={theme.colors.accent} />
              <Text style={styles.statNumber}>{formula.ingredients?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Ingredients</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="scale" size={24} color={theme.colors.accent} />
              <Text style={styles.statNumber}>{totalWeight.toFixed(0)}</Text>
              <Text style={styles.statLabel}>mg Total</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="shield-checkmark" size={24} color={theme.colors.accent} />
              <Text style={styles.statNumber}>{compliance ? 'Checked' : 'N/A'}</Text>
              <Text style={styles.statLabel}>Compliance</Text>
            </View>
          </View>
        </Card>

        {/* Ingredients List */}
        <Card style={styles.ingredientsCard}>
          <Text style={styles.sectionTitle}>Ingredients</Text>

          {formula.ingredients && formula.ingredients.length > 0 ? (
            formula.ingredients.map((item, index) => (
              <View key={item.id} style={styles.ingredientItem}>
                <View style={styles.ingredientHeader}>
                  <Text style={styles.ingredientNumber}>{index + 1}.</Text>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{item.ingredient.name}</Text>
                    <View style={styles.ingredientMeta}>
                      <Badge variant="neutral" size="small">
                        {item.ingredient.category}
                      </Badge>
                      <Text style={styles.ingredientDose}>
                        {item.dose_value} {item.dose_unit}
                      </Text>
                    </View>
                    {item.notes && (
                      <Text style={styles.ingredientNotes}>{item.notes}</Text>
                    )}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No ingredients added</Text>
          )}
        </Card>

        {/* Compliance Check */}
        <Card style={styles.complianceCard}>
          <View style={styles.complianceHeader}>
            <Text style={styles.sectionTitle}>Compliance Check</Text>
            <Button
              title={isCheckingCompliance ? 'Checking...' : 'Check Now'}
              variant="outline"
              size="small"
              onPress={checkCompliance}
              loading={isCheckingCompliance}
            />
          </View>

          {compliance ? (
            <View style={styles.complianceResults}>
              <View style={styles.complianceStatus}>
                <Badge
                  variant={
                    compliance.status === 'APPROVED'
                      ? 'success'
                      : compliance.status === 'WARNING'
                        ? 'warning'
                        : 'error'
                  }
                  size="medium"
                >
                  {compliance.status}
                </Badge>
                <Text style={styles.complianceMessage}>{compliance.status_message}</Text>
              </View>

              {compliance.issues && compliance.issues.length > 0 && (
                <View style={styles.issuesList}>
                  <Text style={styles.issuesTitle}>Issues Found:</Text>
                  {compliance.issues.map((issue, index) => (
                    <View key={index} style={styles.issueItem}>
                      <Ionicons
                        name={issue.severity === 'RISK' ? 'warning' : 'information-circle'}
                        size={20}
                        color={issue.severity === 'RISK' ? theme.colors.error : theme.colors.warning}
                      />
                      <View style={styles.issueContent}>
                        <Text style={styles.issueName}>{issue.ingredient_name}</Text>
                        <Text style={styles.issueMessage}>{issue.message}</Text>
                        {issue.action && (
                          <Text style={styles.issueAction}>Action: {issue.action}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.complianceDate}>
                Checked on {formatDate(compliance.checked_at)}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No compliance check performed yet. Click "Check Now" to analyze this formula.
            </Text>
          )}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <Button
            title="Add Ingredient"
            variant="primary"
            size="large"
            fullWidth
            onPress={handleAddIngredient}
            style={styles.actionButton}
            leftIcon="add-outline"
          />
          <Button
            title="Edit Formula Details"
            variant="outline"
            size="large"
            fullWidth
            onPress={handleEdit}
            style={styles.actionButton}
            leftIcon="create-outline"
          />
          <Button
            title="Duplicate Formula"
            variant="outline"
            size="large"
            fullWidth
            onPress={handleDuplicate}
            style={styles.actionButton}
            leftIcon="copy-outline"
          />
          <Button
            title="Export"
            variant="primary"
            size="large"
            fullWidth
            onPress={handleExport}
            style={styles.actionButton}
            leftIcon="download-outline"
          />
          <Button
            title="Delete Formula"
            variant="outline"
            size="large"
            fullWidth
            onPress={handleDelete}
            loading={isDeleting}
            style={[styles.actionButton, styles.deleteButton]}
            leftIcon="trash-outline"
          />
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
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titleSection: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xl,
  },
  titleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  description: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  metadata: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metadataText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
  },
  statsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    ...theme.getTextStyle('h3', 'bold'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  statLabel: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  ingredientsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  ingredientItem: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  ingredientHeader: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  ingredientNumber: {
    ...theme.getTextStyle('body', 'semibold'),
    color: theme.colors.textMuted,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    ...theme.getTextStyle('body', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  ingredientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  ingredientDose: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.accent,
  },
  ingredientNotes: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  complianceCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  complianceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  complianceResults: {
    gap: theme.spacing.md,
  },
  complianceStatus: {
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  complianceMessage: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
  },
  issuesList: {
    marginTop: theme.spacing.md,
  },
  issuesTitle: {
    ...theme.getTextStyle('body', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  issueItem: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.md,
  },
  issueContent: {
    flex: 1,
  },
  issueName: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  issueMessage: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  issueAction: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.accent,
  },
  complianceDate: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
  emptyText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  actionsSection: {
    paddingHorizontal: theme.spacing.screenPadding,
    gap: theme.spacing.md,
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
  },
  deleteButton: {
    borderColor: theme.colors.error,
  },
});

export default FormulaDetailScreen;
