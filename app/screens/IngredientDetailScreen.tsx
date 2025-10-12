import { Ionicons } from '@expo/vector-icons';
import { StackActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Button, Card, Skeleton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, Ingredient } from '../../services/api';
import { useToast } from '../contexts/ToastContext';

interface IngredientDetailScreenProps {
  navigation: any;
  route: {
    params: {
      ingredientId: number;
      mode?: string;
    };
  };
}

export const IngredientDetailScreen: React.FC<any> = ({ 
  navigation, 
  route 
}) => {
  const { ingredientId, mode } = route.params;
  const isSelectionMode = mode === 'select';
  const { showToast } = useToast();
  
  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadIngredient();
  }, [ingredientId]);

  const loadIngredient = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getIngredient(ingredientId);
      
      if (response.data) {
        setIngredient(response.data);
      } else {
        showToast(response.error || 'Failed to load ingredient', 'error');
        navigation.goBack();
      }
    } catch (error) {
      showToast('Network error', 'error');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToFormula = () => {
    if (isSelectionMode) {
      if (!ingredient) {
        showToast('Ingredient not loaded yet', 'error');
        return;
      }

      navigation.navigate({
        name: 'FormulaBuilder',
        params: {
          selectedIngredient: ingredient,
          timestamp: Date.now(),
        },
        merge: true,
      });

      const routesLength = navigation.getState()?.routes?.length ?? 1;
      const popCount = Math.min(2, Math.max(routesLength - 1, 0));
      if (popCount > 0) {
        navigation.dispatch(StackActions.pop(popCount));
      }
    } else {
      Alert.alert(
        'Add to Formula',
        'This feature will allow you to add this ingredient to an existing formula or create a new one.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Coming Soon', style: 'default' },
        ]
      );
    }
  };

  const getSafetyInfo = (safety: string) => {
    const safetyLower = safety.toLowerCase();
    
    if (safetyLower.includes('safe') || safetyLower.includes('general')) {
      return {
        level: 'SAFE',
        color: theme.colors.safe,
        icon: 'checkmark-circle',
        backgroundColor: `${theme.colors.safe}20`,
      };
    }
    
    if (safetyLower.includes('caution') || safetyLower.includes('warning')) {
      return {
        level: 'CAUTION',
        color: theme.colors.caution,
        icon: 'warning',
        backgroundColor: `${theme.colors.caution}20`,
      };
    }
    
    if (safetyLower.includes('risk') || safetyLower.includes('avoid')) {
      return {
        level: 'RISK',
        color: theme.colors.risk,
        icon: 'close-circle',
        backgroundColor: `${theme.colors.risk}20`,
      };
    }
    
    return {
      level: 'UNKNOWN',
      color: theme.colors.unknown,
      icon: 'help-circle',
      backgroundColor: `${theme.colors.unknown}20`,
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading || !ingredient) {
    return (
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.container}
      >
        <Skeleton />
      </LinearGradient>
    );
  }

  const safetyInfo = getSafetyInfo(ingredient.safety);

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ingredient.name}
        </Text>
        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={() => showToast('Bookmarks coming soon!', 'info')}
        >
          <Ionicons name="bookmark-outline" size={24} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Safety Status Card */}
        <View style={[styles.safetyCard, { backgroundColor: safetyInfo.backgroundColor }]}>
          <LinearGradient
            colors={[theme.colors.secondary, theme.colors.surface]}
            style={styles.cardGradient}
          >
            <View style={styles.safetyHeader}>
            <Ionicons
              name={safetyInfo.icon as any}
              size={32}
              color={safetyInfo.color}
            />
            <View style={styles.safetyInfo}>
              <Text style={[styles.safetyLevel, { color: safetyInfo.color }]}>
                {safetyInfo.level}
              </Text>
              <Text style={styles.safetyDescription}>
                {ingredient.safety}
              </Text>
            </View>
          </View>
          </LinearGradient>
        </View>

        {/* Basic Information Card */}
        <Card style={styles.infoCard}>
          <Text style={styles.cardTitle}>Basic Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="pricetag" size={20} color={theme.colors.accent} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{ingredient.category}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="leaf" size={20} color={theme.colors.accent} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Source</Text>
                <Text style={styles.infoValue}>{ingredient.source}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar" size={20} color={theme.colors.accent} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{formatDate(ingredient.created_at)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="refresh" size={20} color={theme.colors.accent} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Last Updated</Text>
                <Text style={styles.infoValue}>{formatDate(ingredient.updated_at)}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Evidence & Notes Card */}
        {ingredient.evidence && (
          <Card style={styles.evidenceCard}>
            <Text style={styles.cardTitle}>Scientific Evidence</Text>
            <Text style={styles.evidenceText}>
              {ingredient.evidence}
            </Text>
          </Card>
        )}

        {!ingredient.evidence && (
          <Card style={styles.evidenceCard}>
            <Text style={styles.cardTitle}>Scientific Evidence</Text>
            <View style={styles.noEvidenceContainer}>
              <Ionicons name="document-outline" size={32} color={theme.colors.textMuted} />
              <Text style={styles.noEvidenceText}>
                No evidence notes available for this ingredient.
              </Text>
            </View>
          </Card>
        )}

        {/* Regulatory Status Card */}
        <Card style={styles.regulatoryCard}>
          <Text style={styles.cardTitle}>Regulatory Status</Text>
          <View style={styles.regulatoryContainer}>
            <Ionicons name="shield-checkmark" size={32} color={theme.colors.accent} />
            <View style={styles.regulatoryText}>
              <Text style={styles.regulatoryTitle}>General Safety Assessment</Text>
              <Text style={styles.regulatoryDescription}>
                Safety status applies across all supported regions. 
                Consult local regulations for specific compliance requirements.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          title={isSelectionMode ? "Select Ingredient" : "Add to Formula"}
          variant="primary"
          size="large"
          fullWidth
          onPress={handleAddToFormula}
          disabled={isSelectionMode && !ingredient}
          leftIcon={<Ionicons name={isSelectionMode ? "checkmark" : "add"} size={20} color={theme.colors.textPrimary} />}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  headerTitle: {
    flex: 1,
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: 120, // Space for bottom bar
  },
  safetyCard: {
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: theme.spacing.lg,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  safetyInfo: {
    marginLeft: theme.spacing.lg,
    flex: 1,
  },
  safetyLevel: {
    ...theme.getTextStyle('h4', 'bold'),
    marginBottom: theme.spacing.xs,
  },
  safetyDescription: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
  },
  infoCard: {
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  infoRow: {
    marginBottom: theme.spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  infoLabel: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  infoValue: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textPrimary,
  },
  evidenceCard: {
    marginBottom: theme.spacing.lg,
  },
  evidenceText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  noEvidenceContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  noEvidenceText: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  regulatoryCard: {
    marginBottom: theme.spacing.lg,
  },
  regulatoryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  regulatoryText: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },
  regulatoryTitle: {
    ...theme.getTextStyle('h5', 'medium'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  regulatoryDescription: {
    ...theme.getTextStyle('body'),
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.secondary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingVertical: theme.spacing.lg,
    paddingBottom: 34, // Safe area
  },
});

export default IngredientDetailScreen;
