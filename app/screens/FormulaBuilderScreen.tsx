import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { emit } from '../../app/utils/EventBus';
import { Badge, Button, Card, ConfirmDialog, Input, LoadingSpinner, Skeleton } from '../../components/ui';
import IngredientCard from '../../components/ui/IngredientCard';
import { theme } from '../../constants/theme';
import { apiService, FormulaIngredient, Ingredient } from '../../services/api';
import { useToast } from '../contexts/ToastContext';

interface FormulaBuilderProps {
  navigation: any;
  route?: any;
}

type PendingIngredient = {
  ingredient: Ingredient;
  doseValue: string;
  doseUnit: string;
  notes: string;
};

const parseDoseValue = (value: number | string | null | undefined): number => {
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return value ?? 0;
};

const convertToMg = (dose: number, unit: string): number => {
  const normalizedUnit = unit?.toLowerCase?.() ?? 'mg';
  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') {
    return dose * 1000;
  }
  if (normalizedUnit === 'mcg' || normalizedUnit === 'µg') {
    return dose / 1000;
  }
  return dose;
};

export const FormulaBuilderScreen: React.FC<FormulaBuilderProps> = ({ navigation, route }) => {
  const { showToast } = useToast();

  const initialFormulaId: number | null = route?.params?.formulaId ?? null;
  const [formulaId, setFormulaId] = useState<number | null>(initialFormulaId);
  const [formulaName, setFormulaName] = useState<string>(route?.params?.initialName ?? '');
  const [formulaDescription, setFormulaDescription] = useState<string>(route?.params?.initialDescription ?? '');
  const region = 'US';

  const [formulaItems, setFormulaItems] = useState<FormulaIngredient[]>([]);
  const [isLoadingFormula, setIsLoadingFormula] = useState<boolean>(!!initialFormulaId);
  const [isSavingFormula, setIsSavingFormula] = useState<boolean>(false);
  const [isSubmittingIngredient, setIsSubmittingIngredient] = useState<boolean>(false);
  const [removingItemIds, setRemovingItemIds] = useState<number[]>([]);
  const [hasOpenedPickerFromParams, setHasOpenedPickerFromParams] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  // Cart for pending ingredients
  const [pendingIngredients, setPendingIngredients] = useState<PendingIngredient[]>([]);
  const [pendingErrors, setPendingErrors] = useState<Record<number, Record<string, string>>>({});
  const [submissionProgress, setSubmissionProgress] = useState<{
    current: number;
    total: number;
    running: boolean;
    failures: number[];
  }>({ current: 0, total: 0, running: false, failures: [] });
  // Modal-based multi-select picker state
  const [isPickerModalVisible, setIsPickerModalVisible] = useState(false);
  const [modalIngredients, setModalIngredients] = useState<Ingredient[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalPage, setModalPage] = useState(1);
  const [modalHasMore, setModalHasMore] = useState(true);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSelectedIds, setModalSelectedIds] = useState<number[]>([]);

  const normalizeItems = useCallback((items: FormulaIngredient[] | undefined | null) => {
    if (!items || !Array.isArray(items)) {
      return [];
    }
    return items.map(item => ({
      ...item,
      dose_value: parseDoseValue(item?.dose_value),
      dose_unit: item?.dose_unit ?? 'mg',
      notes: item?.notes ?? '',
    }));
  }, []);

  const loadFormula = useCallback(
    async (id: number) => {
      setIsLoadingFormula(true);
      const response = await apiService.getFormula(id);

      if (response.data) {
        setFormulaName(response.data.name ?? '');
        setFormulaDescription(response.data.description ?? '');
        const rawItems = response.data.ingredients ?? (response.data as any)?.items;
        setFormulaItems(normalizeItems(rawItems));
      } else if (response.error) {
        showToast(response.error, 'error');
      }

      setIsLoadingFormula(false);
    },
    [normalizeItems, showToast]
  );

  useEffect(() => {
    if (initialFormulaId) {
      loadFormula(initialFormulaId);
    }
  }, [initialFormulaId, loadFormula]);

  const validateFormula = () => {
    const nextErrors: Record<string, string> = {};

    if (!formulaName.trim()) {
      nextErrors.name = 'Formula name is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateOrUpdateFormula = async () => {
    if (!validateFormula()) {
      showToast('Please fix the errors before continuing', 'error');
      return;
    }

    setIsSavingFormula(true);
    try {
      if (formulaId) {
        const response = await apiService.updateFormula(formulaId, {
          name: formulaName.trim(),
          description: formulaDescription.trim() || undefined,
          region,
        });

        if (response.data) {
          setFormulaName(response.data.name ?? formulaName);
          setFormulaDescription(response.data.description ?? '');
          showToast('Formula details updated', 'success');
        } else if (response.error) {
          showToast(response.error, 'error');
        }
      } else {
        const response = await apiService.createFormula({
          name: formulaName.trim(),
          description: formulaDescription.trim() || undefined,
          region,
        });

        if (response.data) {
          setFormulaId(response.data.id);
          const rawItems = response.data.ingredients ?? (response.data as any)?.items;
          setFormulaItems(normalizeItems(rawItems));
          showToast('Formula created! You can now add ingredients.', 'success');
          // Notify other screens immediately
          emit('formula:created', response.data);
        } else if (response.error) {
          showToast(response.error, 'error');
        }
      }
    } catch (error) {
      showToast('Network error occurred', 'error');
    } finally {
      setIsSavingFormula(false);
    }
  };

  const handleNavigateToPicker = useCallback(() => {
    if (!formulaId) {
      showToast('Create the formula first, then add ingredients.', 'info');
      return;
    }

    // Open the bottom modal picker within the builder
    setModalSelectedIds(pendingIngredients.map(p => p.ingredient.id));
    setIsPickerModalVisible(true);
  }, [formulaId, navigation, showToast]);

  useEffect(() => {
    if (route?.params?.openIngredientPicker && formulaId && !hasOpenedPickerFromParams) {
      setHasOpenedPickerFromParams(true);
      navigation.setParams({ openIngredientPicker: undefined });
      handleNavigateToPicker();
    }
  }, [route?.params?.openIngredientPicker, formulaId, handleNavigateToPicker, navigation, hasOpenedPickerFromParams]);

  useEffect(() => {
    if (route?.params?.selectedIngredient) {
      if (!formulaId) {
        showToast('Create the formula before adding ingredients', 'error');
        navigation.setParams({ selectedIngredient: undefined, timestamp: undefined });
        return;
      }

      const ingredient = route.params.selectedIngredient as Ingredient;
      const alreadyAdded = formulaItems.some(item => item.ingredient.id === ingredient.id) ||
        pendingIngredients.some(item => item.ingredient.id === ingredient.id);

      if (alreadyAdded) {
        showToast('This ingredient is already in the formula or cart', 'info');
      } else {
        setPendingIngredients(prev => [
          ...prev,
          {
            ingredient,
            doseValue: '',
            doseUnit: 'mg',
            notes: '',
          }
        ]);
      }

      navigation.setParams({ selectedIngredient: undefined, timestamp: undefined });
    }
  }, [route?.params?.selectedIngredient, route?.params?.timestamp, navigation, showToast, formulaItems, formulaId, pendingIngredients]);

  const validatePendingIngredient = (pending: PendingIngredient) => {
    const nextErrors: Record<string, string> = {};
    const doseNumber = parseFloat(pending.doseValue);

    if (!pending.doseValue.trim() || Number.isNaN(doseNumber) || doseNumber <= 0) {
      nextErrors.doseValue = 'Enter a valid dose greater than 0';
    }

    if (!pending.doseUnit.trim()) {
      nextErrors.doseUnit = 'Unit is required';
    }

    return { isValid: Object.keys(nextErrors).length === 0, doseNumber, nextErrors };
  };

  const handleUpdatePendingIngredient = (index: number, changes: Partial<PendingIngredient>) => {
    setPendingIngredients(prev => prev.map((item, i) => i === index ? { ...item, ...changes } : item));
  };

  const handleRemovePendingIngredient = (index: number) => {
    setPendingIngredients(prev => prev.filter((_, i) => i !== index));
    setPendingErrors(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const handleSubmitAllPendingIngredients = async () => {
    if (!formulaId || pendingIngredients.length === 0) return;

    setIsSubmittingIngredient(true);
    setSubmissionProgress({ current: 0, total: pendingIngredients.length, running: true, failures: [] });
    let anyError = false;
    let errors: Record<number, Record<string, string>> = {};
    const failedIndexes: number[] = [];

    for (let i = 0; i < pendingIngredients.length; i++) {
      const pending = pendingIngredients[i];
      const { isValid, doseNumber, nextErrors } = validatePendingIngredient(pending);
      if (!isValid) {
        errors[i] = nextErrors;
        anyError = true;
        failedIndexes.push(i);
        setSubmissionProgress(prev => ({ ...prev, current: i + 1, failures: [...prev.failures, i] }));
        continue;
      }
      try {
        const response = await apiService.addIngredientToFormula(formulaId, {
          ingredient_id: pending.ingredient.id,
          dose_value: doseNumber,
          dose_unit: pending.doseUnit.trim(),
          notes: pending.notes.trim() || undefined,
        });
        const newItem = response.data;
        if (newItem) {
          setFormulaItems(prev => [...prev, newItem]);
          // Notify subscribers an ingredient was added
          emit('formula:ingredient_added', { formulaId, item: newItem });
        } else if (response.error) {
    errors[i] = { api: response.error ?? 'Unknown error' };
          anyError = true;
          failedIndexes.push(i);
        }
      } catch (error) {
        errors[i] = { api: 'Network error' };
        anyError = true;
        failedIndexes.push(i);
      } finally {
        setSubmissionProgress(prev => ({ ...prev, current: i + 1 }));
      }
    }

    setPendingErrors(errors);
    setSubmissionProgress(prev => ({ ...prev, running: false, failures: failedIndexes }));

    if (!anyError) {
      setPendingIngredients([]);
      setPendingErrors({});
      showToast('All ingredients added!', 'success');
    } else {
      showToast('Some ingredients failed to add. Please fix errors and retry.', 'error');
    }

    setIsSubmittingIngredient(false);
  };

  const shiftPendingErrorsAfterRemoval = (removedIndex: number, prevErrors: Record<number, Record<string, string>>) => {
    const newErrors: Record<number, Record<string, string>> = {};
    Object.keys(prevErrors).forEach(k => {
      const idx = parseInt(k as any, 10);
      if (idx === removedIndex) return; // drop removed
      if (idx > removedIndex) {
        newErrors[idx - 1] = prevErrors[idx];
      } else {
        newErrors[idx] = prevErrors[idx];
      }
    });
    return newErrors;
  };

  const shiftFailuresAfterRemoval = (removedIndex: number, failures: number[]) => {
    return failures
      .filter(i => i !== removedIndex)
      .map(i => (i > removedIndex ? i - 1 : i));
  };

  const handleRetryPendingIngredient = async (index: number) => {
    if (!formulaId) return;
    const pending = pendingIngredients[index];
    if (!pending) return;

    setIsSubmittingIngredient(true);
    setSubmissionProgress(prev => ({ ...prev, running: true }));

    const { isValid, doseNumber, nextErrors } = validatePendingIngredient(pending);
    if (!isValid) {
      setPendingErrors(prev => ({ ...prev, [index]: nextErrors }));
      setIsSubmittingIngredient(false);
      setSubmissionProgress(prev => ({ ...prev, running: false }));
      showToast('Fix validation errors before retrying', 'error');
      return;
    }

    try {
      const response = await apiService.addIngredientToFormula(formulaId, {
        ingredient_id: pending.ingredient.id,
        dose_value: doseNumber,
        dose_unit: pending.doseUnit.trim(),
        notes: pending.notes.trim() || undefined,
      });
      if (response.data) {
        const newItem = response.data;
        setFormulaItems(prev => [...prev, newItem]);
        emit('formula:ingredient_added', { formulaId, item: newItem });

        // Remove this pending entry and shift errors/failures indexes
        setPendingIngredients(prev => prev.filter((_, i) => i !== index));
        setPendingErrors(prev => shiftPendingErrorsAfterRemoval(index, prev));
        setSubmissionProgress(prev => ({ ...prev, failures: shiftFailuresAfterRemoval(index, prev.failures || []) }));
        showToast('Ingredient added', 'success');
      } else if (response.error) {
        setPendingErrors(prev => ({ ...prev, [index]: { api: response.error ?? 'Unknown error' } }));
        setSubmissionProgress(prev => ({ ...prev, failures: Array.from(new Set([...(prev.failures || []), index])) }));
      }
    } catch (e) {
      setPendingErrors(prev => ({ ...prev, [index]: { api: 'Network error' } }));
      setSubmissionProgress(prev => ({ ...prev, failures: Array.from(new Set([...(prev.failures || []), index])) }));
    } finally {
      setIsSubmittingIngredient(false);
      setSubmissionProgress(prev => ({ ...prev, running: false }));
    }
  };

  const handleRetryAllFailed = async () => {
    if (!submissionProgress.failures || submissionProgress.failures.length === 0) return;
    // Make a snapshot of failures to avoid mutation issues while we remove successful ones
    const failuresSnapshot = [...submissionProgress.failures];
    for (let i = 0; i < failuresSnapshot.length; i++) {
      const idx = failuresSnapshot[i];
      // If this index no longer exists in pendingIngredients (maybe removed), skip
      if (idx < 0 || idx >= pendingIngredients.length) continue;
      // Retry sequentially
      // eslint-disable-next-line no-await-in-loop
      await handleRetryPendingIngredient(idx);
    }
  };

  /* Modal ingredient loader */
  const loadModalIngredients = useCallback(async (pageNum = 1, search = '') => {
    setIsModalLoading(true);
    try {
      const params: any = { page: pageNum, page_size: 30 };
      if (search && search.length >= 1) params.search = search;
      const response = await apiService.getIngredients(params);
      if (response.data) {
        const results: Ingredient[] = response.data.results ?? response.data;
        if (pageNum === 1) {
          setModalIngredients(results);
        } else {
          setModalIngredients(prev => [...prev, ...results]);
        }
        setModalHasMore((results?.length ?? 0) >= 30);
        setModalPage(pageNum);
      } else {
        showToast(response.error || 'Failed to load ingredients', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    } finally {
      setIsModalLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isPickerModalVisible) {
      loadModalIngredients(1, modalSearch);
    }
  }, [isPickerModalVisible, loadModalIngredients, modalSearch]);

  const toggleModalSelect = (id: number) => {
    setModalSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  };

  const handleModalDone = () => {
    // Add selected ingredients to pendingIngredients (avoid duplicates vs formulaItems and existing pending)
    const selected = modalIngredients.filter(i => modalSelectedIds.includes(i.id));
    const existingIds = new Set<number>([...formulaItems.map(fi => fi.ingredient.id), ...pendingIngredients.map(p => p.ingredient.id)]);
    const toAdd = selected.filter(s => !existingIds.has(s.id)).map(s => ({ ingredient: s, doseValue: '', doseUnit: 'mg', notes: '' } as PendingIngredient));
    if (toAdd.length > 0) {
      setPendingIngredients(prev => [...prev, ...toAdd]);
    }
    // Close modal
    setIsPickerModalVisible(false);
  };

  const handleOpenEditPicker = () => {
    // Preselect current pending ingredient ids in modal when editing
    setModalSelectedIds(pendingIngredients.map(p => p.ingredient.id));
    setIsPickerModalVisible(true);
  };

  // No longer needed

  const handleRemoveIngredient = (item: FormulaIngredient) => {
    if (!formulaId) return;
    // show confirm dialog
    setConfirmState({
      visible: true,
      title: 'Remove Ingredient',
      message: `Remove ${item.ingredient.name} from this formula?`,
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, visible: false }));
        setRemovingItemIds(prev => [...prev, item.id]);
        try {
          const response = await apiService.removeIngredientFromFormula(formulaId, item.id);
          if (!response.error) {
            setFormulaItems(prev => prev.filter(existing => existing.id !== item.id));
            showToast('Ingredient removed', 'success');
          } else {
            showToast(response.error, 'error');
          }
        } catch (error) {
          showToast('Unable to remove ingredient', 'error');
        } finally {
          setRemovingItemIds(prev => prev.filter(id => id !== item.id));
        }
      },
    });
  };

  const [confirmState, setConfirmState] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    onConfirm?: () => void;
  }>({ visible: false });

  const isRemoveLoading = useCallback(
    (id: number) => removingItemIds.includes(id),
    [removingItemIds]
  );

  const totalWeightMg = useMemo(() => {
    return formulaItems.reduce((total, item) => {
      const dose = convertToMg(parseDoseValue(item.dose_value), item.dose_unit);
      return total + dose;
    }, 0);
  }, [formulaItems]);

  const compliance = useMemo(() => {
    if (formulaItems.length === 0) return { status: 'EMPTY', variant: 'neutral' as const };
    if (formulaItems.length > 10) return { status: 'RISK', variant: 'error' as const };
    if (formulaItems.length > 5) return { status: 'WARNING', variant: 'warning' as const };
    return { status: 'APPROVED', variant: 'success' as const };
  }, [formulaItems.length]);

  const renderPendingIngredientsCart = () => {
    if (!pendingIngredients.length) return null;

    return (
      <View style={styles.pendingCard}>
        {submissionProgress.running && (
          <View style={styles.progressRow}>
            <Text style={styles.sectionSubtitle}>Submitting ingredients: {submissionProgress.current}/{submissionProgress.total}</Text>
            {submissionProgress.failures.length > 0 && (
              <Text style={{ color: theme.colors.error }}>{submissionProgress.failures.length} failed</Text>
            )}
          </View>
        )}
        <Text style={styles.sectionSubtitle}>Pending Ingredients</Text>
        {pendingIngredients.map((pending, idx) => (
          <View key={pending.ingredient.id} style={styles.pendingHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingName}>{pending.ingredient.name}</Text>
              <Badge variant="neutral" size="small">
                {pending.ingredient.category}
              </Badge>
              <View style={styles.pendingInputsRow}>
                <View style={styles.pendingDoseInput}>
                  <Input
                    label="Dose"
                    placeholder="0"
                    value={pending.doseValue}
                    onChangeText={text => handleUpdatePendingIngredient(idx, { doseValue: text })}
                    keyboardType="numeric"
                    error={pendingErrors[idx]?.doseValue}
                  />
                </View>
                <View style={styles.pendingUnitInput}>
                  <Input
                    label="Unit"
                    placeholder="mg"
                    value={pending.doseUnit}
                    onChangeText={text => handleUpdatePendingIngredient(idx, { doseUnit: text })}
                    error={pendingErrors[idx]?.doseUnit}
                  />
                </View>
              </View>
              <Input
                label="Notes (Optional)"
                placeholder="Enter any notes for this ingredient"
                value={pending.notes}
                onChangeText={text => handleUpdatePendingIngredient(idx, { notes: text })}
                multiline
                numberOfLines={2}
              />
              {pendingErrors[idx]?.api && (
                <Text style={{ color: theme.colors.error }}>{pendingErrors[idx].api}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => handleRemovePendingIngredient(idx)}>
              <Ionicons name="close" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
        <Button
          title="Submit All Ingredients"
          variant="primary"
          size="medium"
          onPress={handleSubmitAllPendingIngredients}
          loading={isSubmittingIngredient}
          disabled={isSubmittingIngredient}
          leftIcon={<Ionicons name="checkmark" size={20} color={theme.colors.textPrimary} />}
        />
        {submissionProgress.failures && submissionProgress.failures.length > 0 && (
          <Button
            title="Retry All Failed"
            variant="outline"
            size="large"
            onPress={handleRetryAllFailed}
            disabled={isSubmittingIngredient}
            style={{ marginTop: theme.spacing.md }}
            leftIcon={<Ionicons name="refresh" size={18} color={theme.colors.accent} />}
          />
        )}
      </View>
    );
  };

  const renderIngredientList = () => {
    if (!formulaId) {
      return (
        <View style={styles.createNotice}>
          <Ionicons name="information-circle" size={32} color={theme.colors.textMuted} />
          <Text style={styles.createNoticeText}>
            Create the formula first to start adding ingredients.
          </Text>
        </View>
      );
    }

    if (isLoadingFormula) {
      // show a compact single-block skeleton for the small ingredients section
      return <Skeleton variant="small" lines={1} />;
    }

    return (
      <>
        {renderPendingIngredientsCart()}

        {formulaItems.length === 0 && pendingIngredients.length === 0 ? (
          <View style={styles.emptyIngredients}>
            <Ionicons name="flask-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>No ingredients added yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Add Ingredient" to start building your formula.
            </Text>
          </View>
        ) : (
          <>
            {pendingIngredients.map((pending, idx) => (
              <IngredientCard
                key={`pending-${pending.ingredient.id}`}
                pending={pending}
                index={idx}
                editable={true}
                onChangePending={handleUpdatePendingIngredient}
                onRemovePending={handleRemovePendingIngredient}
              />
            ))}

            {formulaItems.map(item => (
              <IngredientCard
                key={item.id}
                item={item}
                editable={false}
                onUpdateItem={async (itemId: number, data: any) => {
                  try {
                    const response = await apiService.updateFormulaIngredient(formulaId as number, itemId, data as any);
                    if (response.data) {
                      setFormulaItems(prev => prev.map(p => p.id === itemId ? response.data as any : p));
                      showToast('Ingredient updated', 'success');
                    } else {
                      showToast(response.error || 'Failed to update ingredient', 'error');
                    }
                  } catch (e) {
                    showToast('Network error', 'error');
                  }
                }}
                onRemoveItem={async (itemId: number) => {
                  try {
                    const response = await apiService.removeIngredientFromFormula(formulaId as number, itemId);
                    if (!response.error) {
                      setFormulaItems(prev => prev.filter(p => p.id !== itemId));
                      showToast('Ingredient removed', 'success');
                    } else {
                      showToast(response.error, 'error');
                    }
                  } catch (e) {
                    showToast('Network error', 'error');
                  }
                }}
              />
            ))}
          </>
        )}
      </>
    );
  };

  const renderSummaryCard = () => {
    if (!formulaId || formulaItems.length === 0) {
      return null;
    }

    return (
      <Card style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Formula Summary</Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Ionicons name="flask" size={20} color={theme.colors.accent} />
            <Text style={styles.statText}>{formulaItems.length} ingredients</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="scale" size={20} color={theme.colors.accent} />
            <Text style={styles.statText}>{totalWeightMg.toFixed(1)} mg total</Text>
          </View>
          <Badge variant={compliance.variant} size="small">
            {compliance.status}
          </Badge>
        </View>
      </Card>
    );
  };

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>

            <Text style={styles.title}>{formulaId ? 'Edit Formula' : 'Create Formula'}</Text>

            <TouchableOpacity
              style={[styles.saveButton, isSavingFormula && styles.saveButtonDisabled]}
              onPress={handleCreateOrUpdateFormula}
              disabled={isSavingFormula}
            >
              {isSavingFormula ? (
                <LoadingSpinner size="small" />
              ) : (
                <Ionicons name="checkmark" size={24} color={theme.colors.textPrimary} />
              )}
            </TouchableOpacity>
          </View>

          <Card style={styles.formulaCard}>
            <Text style={styles.sectionTitle}>Formula Information</Text>

            <Input
              label="Formula Name"
              placeholder="Enter formula name"
              value={formulaName}
              onChangeText={setFormulaName}
              error={errors.name}
            />

            <Input
              label="Description (Optional)"
              placeholder="Enter formula description"
              value={formulaDescription}
              onChangeText={setFormulaDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.regionContainer}>
              <Text style={styles.regionLabel}>Target Region</Text>
              <View style={styles.regionDisplay}>
                <Badge variant="info" size="medium">
                  United States (US)
                </Badge>
                <Text style={styles.regionNote}>
                  Currently only US regulations are supported
                </Text>
              </View>
            </View>

            {!formulaId && (
              <Button
                title="Create Formula"
                variant="primary"
                size="large"
                onPress={handleCreateOrUpdateFormula}
                loading={isSavingFormula}
                disabled={isSavingFormula}
                leftIcon={<Ionicons name="save" size={20} color={theme.colors.textPrimary} />}
              />
            )}
          </Card>

          <Card style={styles.ingredientsCard}>
            <View style={styles.ingredientsHeaderCompact}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.headerActionsRow}>
                <TouchableOpacity
                  accessibilityLabel="Edit pending ingredients"
                  style={[styles.simpleAction, !formulaId && styles.simpleActionDisabled]}
                  onPress={handleOpenEditPicker}
                  disabled={!formulaId}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={16} color={theme.colors.accent} />
                  <Text style={styles.simpleActionText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityLabel="Add ingredient"
                  style={[styles.simpleAction, (!formulaId || isSubmittingIngredient) && styles.simpleActionDisabled, styles.addAction]}
                  onPress={handleNavigateToPicker}
                  disabled={!formulaId || isSubmittingIngredient}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color={theme.colors.accent} />
                  <Text style={[styles.simpleActionText, { fontWeight: '600' }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* removed extra row; header now contains Edit + Add compact controls */}

            {renderIngredientList()}
          </Card>

          {renderSummaryCard()}

          {/* Bottom modal for multi-select ingredient picking */}
          <Modal visible={isPickerModalVisible} animationType="slide" onRequestClose={() => setIsPickerModalVisible(false)}>
            <LinearGradient colors={[theme.colors.primary, theme.colors.secondary]} style={styles.container}>
              <StatusBar barStyle="light-content" />
              <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => setIsPickerModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>Select Ingredients</Text>
                <View style={{ width: 44 }} />
              </View>

              <View style={{ paddingHorizontal: theme.spacing.screenPadding }}>
                <Input placeholder="Search..." value={modalSearch} onChangeText={setModalSearch} leftIcon="search" />
              </View>

              {isModalLoading ? (
                <Skeleton variant="modalFull" />
              ) : (
                <ScrollView contentContainerStyle={{ padding: theme.spacing.screenPadding }}>
                  {modalIngredients.map(ing => (
                    <TouchableOpacity key={ing.id} style={styles.modalItem} onPress={() => toggleModalSelect(ing.id)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ingredientName}>{ing.name}</Text>
                        <Badge variant="neutral" size="small">{ing.category}</Badge>
                      </View>
                      <View>
                        <Ionicons name={modalSelectedIds.includes(ing.id) ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={modalSelectedIds.includes(ing.id) ? theme.colors.accent : theme.colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                  {modalHasMore && (
                    <Button title="Load more" variant="outline" onPress={() => loadModalIngredients(modalPage + 1, modalSearch)} />
                  )}
                </ScrollView>
              )}

              <View style={{ padding: theme.spacing.screenPadding }}>
                <Button title="Done" variant="primary" onPress={handleModalDone} />
              </View>
            </LinearGradient>
          </Modal>
          <ConfirmDialog
            visible={confirmState.visible}
            title={confirmState.title}
            message={confirmState.message}
            actions={[
              { text: 'Cancel', style: 'cancel', onPress: () => setConfirmState(prev => ({ ...prev, visible: false })) },
              { text: 'Remove', style: 'destructive', onPress: confirmState.onConfirm },
            ]}
            onRequestClose={() => setConfirmState(prev => ({ ...prev, visible: false }))}
          />
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
  title: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  formulaCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  ingredientsCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  summaryCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  sectionSubtitle: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  regionContainer: {
    marginTop: theme.spacing.md,
  },
  regionLabel: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  regionDisplay: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  regionNote: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  ingredientsHeaderCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  addAction: {
    marginLeft: theme.spacing.sm,
  },
  createNotice: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: `${theme.colors.surface}80`,
    borderRadius: theme.borderRadius.lg,
  },
  createNoticeText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  emptyIngredients: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    ...theme.getTextStyle('h5', 'medium'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  ingredientItem: {
    marginBottom: theme.spacing.md,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  ingredientInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  ingredientName: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  ingredientDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.surface}90`,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  detailText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  removeButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  pendingCard: {
    marginBottom: theme.spacing.lg,
  },
  simpleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
  },
  simpleActionDisabled: {
    opacity: 0.5,
  },
  simpleActionText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.accent,
    marginLeft: theme.spacing.xs,
  },
  // removed unused filled action styles
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  pendingName: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  pendingInputsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  pendingDoseInput: {
    flex: 2,
  },
  pendingUnitInput: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
});

export default FormulaBuilderScreen;