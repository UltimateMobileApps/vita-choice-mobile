import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { apiService, API_BASE_URL, ComplianceResult, Formula } from '../../services/api';
import { downloadFileFromApi, sanitizeDownloadFileName } from '../../services/downloads';
import { useToast } from '../contexts/ToastContext';
import { emit } from '../utils/EventBus';
import { BadgeVariant } from '../../utils/compliance';

interface ComplianceResultScreenProps {
  navigation: any;
  route: any;
}

const STATUS_VARIANT_MAP: Record<ComplianceResult['status'], BadgeVariant> = {
  APPROVED: 'success',
  WARNING: 'warning',
  STOP: 'error',
  EMPTY: 'neutral',
};

const STATUS_ICON_MAP: Record<ComplianceResult['status'], keyof typeof Ionicons.glyphMap> = {
  APPROVED: 'checkmark-circle',
  WARNING: 'alert-circle',
  STOP: 'close-circle',
  EMPTY: 'information-circle',
};

const ISSUE_VARIANT_MAP: Record<'RISK' | 'CAUTION', BadgeVariant> = {
  RISK: 'error',
  CAUTION: 'warning',
};

const ISSUE_ICON_MAP: Record<'RISK' | 'CAUTION', keyof typeof Ionicons.glyphMap> = {
  RISK: 'warning',
  CAUTION: 'alert-circle',
};

const MIN_COMPLIANCE_LOADING_DURATION = 500;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const complianceCacheKey = (id: number) => `formula_compliance_result_${id}`;

const ComplianceResultScreen: React.FC<ComplianceResultScreenProps> = ({ navigation, route }) => {
  const { showToast } = useToast();
  const formulaId: number | undefined = route?.params?.formulaId;
  const initialRegion: string | undefined = route?.params?.region;

  const [formula, setFormula] = useState<Formula | null>(null);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (options: { silent?: boolean } = {}) => {
    const { silent = false } = options;
    if (!formulaId) {
      showToast('No formula specified for compliance check', 'error');
      navigation.goBack();
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    const startedAt = Date.now();
    setErrorMessage(null);

    try {
      const [formulaResponse, complianceResponse] = await Promise.all([
        apiService.getFormula(formulaId),
        apiService.checkCompliance(formulaId, { region: initialRegion }),
      ]);

      if (formulaResponse.data) {
        const data = formulaResponse.data as any;
        const normalized = {
          ...data,
          ingredients: data.items ?? data.ingredients ?? [],
        } as Formula;
        setFormula(normalized);
      } else if (!formulaResponse.isAuthError) {
        setErrorMessage(formulaResponse.error || 'Unable to load formula details');
      }

      if (complianceResponse.data) {
        setResult(complianceResponse.data);
        try {
          await AsyncStorage.setItem(complianceCacheKey(formulaId), JSON.stringify(complianceResponse.data));
        } catch (storageError) {
          console.warn('Failed to persist compliance result', storageError);
        }
        emit('formula:compliance_checked', {
          formulaId,
          result: complianceResponse.data,
        });
      } else if (!complianceResponse.isAuthError) {
        const message = complianceResponse.error || 'Compliance check failed';
        setErrorMessage(message);
        showToast(message, 'error');
        setResult(null);
      }
    } catch (error) {
      setErrorMessage(typeof error === 'string' ? error : 'Failed to load compliance results');
      showToast(error, 'error');
      setResult(null);
    } finally {
      if (!silent) {
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_COMPLIANCE_LOADING_DURATION) {
          await sleep(MIN_COMPLIANCE_LOADING_DURATION - elapsed);
        }
      }
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [formulaId, initialRegion, navigation, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData({ silent: true });
  }, [loadData]);

  const handleExport = useCallback(async () => {
    if (isExporting) {
      showToast('Already preparing an export…', 'info');
      return;
    }

    if (!formulaId) return;
    setIsExporting(true);
    try {
      const baseName = sanitizeDownloadFileName(
        formula?.name ?? result?.formula_name ?? `formula-${formulaId}`
      );
      const fileName = `${baseName || `formula-${formulaId}`}-compliance-summary.pdf`;
      const endpoint = `${API_BASE_URL}/formulas/${formulaId}/export_summary/`;
      await downloadFileFromApi(endpoint, {
        fileName,
        mimeType: 'application/pdf',
      });
  showToast('Compliance report saved and ready to share.', 'success');
    } catch (error) {
      showToast(error, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [formulaId, formula?.name, result?.formula_name, isExporting, showToast]);

  const handleShare = useCallback(async () => {
    if (!result || !formula) return;

    const issuesSummary = result.issues && result.issues.length > 0
      ? result.issues
          .map((issue) => `• ${issue.ingredient_name ?? issue.ingredient}: ${issue.message}`)
          .join('\n')
      : 'No issues found';

    const message = `${formula.name} — Compliance Check\nStatus: ${result.status}\nMessage: ${result.status_message}\nRegion: ${result.region}\nChecked: ${new Date(result.checked_at).toLocaleString()}\n\nSummary: Safe ${result.summary.safe} • Caution ${result.summary.caution} • Risk ${result.summary.risk}\n\nIssues:\n${issuesSummary}`;

    try {
      await Share.share({ title: `${formula.name} Compliance`, message });
    } catch (error) {
      showToast(error, 'error');
    }
  }, [formula, result, showToast]);

  const badgeVariant = useMemo(() => {
    return result ? STATUS_VARIANT_MAP[result.status] : 'neutral';
  }, [result]);

  const formatDateTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleString();
  };

  const formulaTotalWeight = result?.total_weight_mg ?? 0;

  if (isLoading) {
    return (
      <LinearGradient colors={[theme.colors.primary, theme.colors.secondary]} style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Skeleton />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[theme.colors.primary, theme.colors.secondary]} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Compliance Results</Text>
          <View style={styles.headerSpacer} />
        </View>

        {formula && (
          <View style={styles.formulaHeader}>
            <Text style={styles.formulaName}>{formula.name}</Text>
            <View style={styles.formulaMeta}>
              <Badge variant="info" size="small">{formula.region}</Badge>
              <Text style={styles.formulaUpdated}>Updated {new Date(formula.updated_at).toLocaleDateString()}</Text>
            </View>
          </View>
        )}

        {errorMessage && !result && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Compliance check failed</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <View style={styles.errorActions}>
              <Button
                title="Back to Formula"
                variant="outline"
                size="medium"
                onPress={() => navigation.goBack()}
                style={styles.errorActionButton}
                leftIcon="arrow-back"
              />
              <Button
                title="Try Again"
                variant="primary"
                size="medium"
                onPress={() => loadData()}
                style={styles.errorActionButton}
                leftIcon="refresh"
              />
            </View>
          </Card>
        )}

        {result && (
          <>
            <Card style={styles.statusCard}>
              <LinearGradient
                colors={theme.colors.gradientSecondary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statusGradient}
              >
                <View style={styles.statusHeader}>
                  <View style={styles.statusIconWrapper}>
                    <Ionicons name={STATUS_ICON_MAP[result.status]} size={36} color={theme.colors.surface} />
                  </View>
                  <View style={styles.statusContent}>
                    <Badge variant={badgeVariant} size="medium">{result.status}</Badge>
                    <Text style={styles.statusTitle}>{result.status_message}</Text>
                    <Text style={styles.statusTimestamp}>Checked {formatDateTime(result.checked_at)}</Text>
                  </View>
                </View>

                <View style={styles.statusMetaRow}>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaLabel}>Region</Text>
                    <Text style={styles.metaValue}>{result.region}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaLabel}>Ingredients</Text>
                    <Text style={styles.metaValue}>{result.total_ingredients}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaLabel}>Total Weight</Text>
                    <Text style={styles.metaValue}>{formulaTotalWeight.toFixed(0)} mg</Text>
                  </View>
                </View>
              </LinearGradient>
            </Card>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={[styles.sectionTitle, styles.summaryTitle]}>Breakdown</Text>
                <Text style={styles.sectionSubtitle}>Safety distribution across this formula</Text>
              </View>

              <View style={styles.summaryChipRow}>
                <View style={[styles.summaryChip, styles.safeChip]}>
                  <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
                  <View style={styles.summaryChipText}>
                    <Text style={styles.summaryChipLabel}>Safe</Text>
                    <Text style={styles.summaryChipValue}>{result.summary.safe}</Text>
                  </View>
                </View>
                <View style={[styles.summaryChip, styles.cautionChip]}>
                  <Ionicons name="alert" size={20} color={theme.colors.warning} />
                  <View style={styles.summaryChipText}>
                    <Text style={styles.summaryChipLabel}>Caution</Text>
                    <Text style={styles.summaryChipValue}>{result.summary.caution}</Text>
                  </View>
                </View>
                <View style={[styles.summaryChip, styles.riskChip]}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                  <View style={styles.summaryChipText}>
                    <Text style={styles.summaryChipLabel}>Risk</Text>
                    <Text style={styles.summaryChipValue}>{result.summary.risk}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.summaryHint}>Totals include all ingredients in this compliance snapshot.</Text>
            </Card>

            <Card style={styles.actionsCard}>
              <Text style={styles.sectionTitle}>Next Steps</Text>
              <View style={styles.actionsRow}>
                <Button
                  title="Share Results"
                  variant="outline"
                  size="medium"
                  onPress={handleShare}
                  style={styles.actionButton}
                  fullWidth
                  leftIcon="share-outline"
                />
                <Button
                  title={isExporting ? 'Exporting…' : 'Export Report'}
                  variant="primary"
                  size="medium"
                  onPress={handleExport}
                  loading={isExporting}
                  style={styles.actionButton}
                  fullWidth
                  leftIcon="document-text-outline"
                />
              </View>
            </Card>

            <Card style={styles.issuesCard}>
              <Text style={styles.sectionTitle}>Issues</Text>
              {result.issues && result.issues.length > 0 ? (
                <View style={styles.issuesList}>
                  {result.issues.map((issue, index) => {
                    const doseText = issue.dose
                      ?? (typeof issue.dose_value === 'number' && issue.dose_unit
                        ? `${issue.dose_value} ${issue.dose_unit}`
                        : undefined);

                    return (
                      <View key={`${issue.ingredient}_${index}`} style={styles.issueItem}>
                        <View style={styles.issueHeader}>
                          <Badge variant={ISSUE_VARIANT_MAP[issue.severity]} size="small">
                            {issue.severity === 'RISK' ? 'High Risk' : 'Caution'}
                          </Badge>
                          <Text style={styles.issueIngredient}>{issue.ingredient_name ?? issue.ingredient}</Text>
                        </View>
                        <View style={styles.issueDetails}>
                          <Ionicons
                            name={ISSUE_ICON_MAP[issue.severity]}
                            size={20}
                            color={issue.severity === 'RISK' ? theme.colors.error : theme.colors.warning}
                            style={styles.issueIcon}
                          />
                          <View style={styles.issueContent}>
                            <Text style={styles.issueMessage}>{issue.message}</Text>
                            {issue.action && <Text style={styles.issueAction}>Recommended: {issue.action}</Text>}
                            {doseText && <Text style={styles.issueDose}>Dose: {doseText}</Text>}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.allClear}>
                  <Ionicons name="checkmark-circle" size={36} color={theme.colors.success} />
                  <Text style={styles.allClearTitle}>All Clear</Text>
                  <Text style={styles.allClearMessage}>
                    No compliance issues were detected for this formula. Keep maintaining these standards!
                  </Text>
                </View>
              )}
            </Card>

            <Card style={styles.disclaimerCard}>
              <Text style={styles.disclaimerTitle}>Regulatory Disclaimer</Text>
              <Text style={styles.disclaimerText}>
                Vita Choice compliance checks are based on available guidance from major regulatory bodies. Always consult with a regulatory specialist before taking products to market. Regional regulations may change without notice.
              </Text>
            </Card>
          </>
        )}

        <View style={styles.footerSpacer} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: 60,
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
  headerTitle: {
    ...theme.getTextStyle('h4', 'bold'),
    color: theme.colors.textPrimary,
  },
  headerSpacer: {
    width: 44,
  },
  formulaHeader: {
    paddingHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  formulaName: {
    ...theme.getTextStyle('h3', 'bold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  formulaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  formulaUpdated: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  statusCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statusIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 8,
  },
  statusContent: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  statusTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
  },
  statusTimestamp: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  statusMetaRow: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  metaPill: {
    flexDirection: 'column',
    backgroundColor: 'rgba(12, 16, 20, 0.45)',
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minWidth: 100,
    flex: 1,
  },
  metaLabel: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaValue: {
    ...theme.getTextStyle('body', 'semibold'),
    color: theme.colors.textPrimary,
  },
  summaryCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  summaryHeader: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  summaryTitle: {
    marginBottom: 0,
  },
  sectionSubtitle: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
  },
  summaryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    flexGrow: 1,
    minWidth: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(20,22,26,0.6)',
  },
  summaryChipText: {
    flexDirection: 'column',
    gap: 2,
  },
  summaryChipLabel: {
    ...theme.getTextStyle('caption', 'medium'),
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryChipValue: {
    ...theme.getTextStyle('h4', 'bold'),
    color: theme.colors.textPrimary,
  },
  safeChip: {
    borderColor: 'rgba(16,185,129,0.35)',
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  cautionChip: {
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  riskChip: {
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  summaryHint: {
    marginTop: theme.spacing.lg,
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  actionsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  actionsRow: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    alignItems: 'stretch',
  },
  actionButton: {
    width: '100%',
  },
  issuesCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  issuesList: {
    gap: theme.spacing.md,
  },
  issueItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  issueIngredient: {
    ...theme.getTextStyle('body', 'semibold'),
    color: theme.colors.textPrimary,
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  issueDetails: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  issueIcon: {
    marginTop: theme.spacing.xs,
  },
  issueContent: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  issueMessage: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
  },
  issueAction: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.accent,
  },
  issueDose: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  allClear: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  allClearTitle: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
  },
  allClearMessage: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  disclaimerCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  disclaimerTitle: {
    ...theme.getTextStyle('body', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  disclaimerText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  footerSpacer: {
    height: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  loadingText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textPrimary,
  },
  errorCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  errorTitle: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
  errorMessage: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  errorActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  errorActionButton: {
    flex: 1,
  },
});

export default ComplianceResultScreen;
