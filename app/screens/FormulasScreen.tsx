import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Badge, Button, Card, LoadingSpinner } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, Formula } from '../../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

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
        setFormulas(response.data);
      } else {
        showToast(response.error || 'Failed to load formulas', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [showToast, isGuestUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFormulas();
  }, [loadFormulas]);

  useEffect(() => {
    loadFormulas();
  }, [loadFormulas]);

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
    if (formula.ingredients.length === 0) return { status: 'EMPTY', variant: 'neutral' as const };
    if (formula.ingredients.length > 10) return { status: 'STOP', variant: 'error' as const };
    if (formula.ingredients.length > 5) return { status: 'WARNING', variant: 'warning' as const };
    return { status: 'APPROVED', variant: 'success' as const };
  };

  const getTotalWeight = (formula: Formula) => {
    return formula.ingredients.reduce((total, ing) => total + ing.dose_value, 0);
  };

  const handleDeleteFormula = (formula: Formula) => {
    Alert.alert(
      'Delete Formula',
      `Are you sure you want to delete "${formula.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.deleteFormula(formula.id);
              if (response.data) {
                showToast('Formula deleted successfully', 'success');
                loadFormulas();
              } else {
                showToast(response.error || 'Failed to delete formula', 'error');
              }
            } catch (error) {
              showToast('Network error', 'error');
            }
          }
        },
      ]
    );
  };

  const handleDuplicateFormula = async (formula: Formula) => {
    try {
      const response = await apiService.duplicateFormula(formula.id);
      if (response.data) {
        showToast('Formula duplicated successfully', 'success');
        loadFormulas();
      } else {
        showToast(response.error || 'Failed to duplicate formula', 'error');
      }
    } catch (error) {
      showToast('Network error', 'error');
    }
  };

  const handleFormulaOptions = (formula: Formula) => {
    Alert.alert(
      formula.name,
      'Choose an action:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'View Details', 
          onPress: () => navigation.navigate('FormulaDetail', { formulaId: formula.id })
        },
        { 
          text: 'Edit', 
          onPress: () => showToast('Formula editor coming soon!', 'info')
        },
        { 
          text: 'Duplicate', 
          onPress: () => handleDuplicateFormula(formula)
        },
        { 
          text: 'Check Compliance', 
          onPress: () => showToast('Compliance check coming soon!', 'info')
        },
        { 
          text: 'Export', 
          onPress: () => showToast('Export feature coming soon!', 'info')
        },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => handleDeleteFormula(formula)
        },
      ]
    );
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
            <Text style={styles.statText}>{item.ingredients.length} ingredients</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="scale" size={16} color={theme.colors.accent} />
            <Text style={styles.statText}>{totalWeight.toFixed(0)} mg</Text>
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
        onPress={() => showToast('Formula builder coming soon!', 'info')}
        style={styles.createButton}
      />
    </View>
  );

  const renderFloatingButton = () => (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={() => showToast('Formula builder coming soon!', 'info')}
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
        <LoadingSpinner overlay />
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
