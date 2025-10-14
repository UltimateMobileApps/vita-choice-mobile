import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Button, Card, Input, LoadingSpinner } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, Ingredient } from '../../services/api';
import { useToast } from '../contexts/ToastContext';

type IngredientPickerScreenProps = {
  navigation: any;
};

const CACHE_KEY = 'cached_ingredients_picker';
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes for picker freshness

const IngredientPickerScreen: React.FC<IngredientPickerScreenProps> = ({ navigation }) => {
  const { showToast } = useToast();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const initialDebounceSkipRef = useRef(true);

  useEffect(() => {
    loadCachedIngredients();
  }, []);

  const loadCachedIngredients = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_EXPIRY;
        if (!isExpired && data.length > 0) {
          setIngredients(data);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading cached picker ingredients:', error);
    }
  };

  const cacheIngredients = async (data: Ingredient[]) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error caching picker ingredients:', error);
    }
  };

  const loadIngredients = useCallback(
    async ({ page: targetPage = 1, search = '', append = false }: { page?: number; search?: string; append?: boolean } = {}) => {
      const pageSize = 40;
      const isFirstPageLoad = !append || targetPage === 1;

      try {
        if (append) {
          setIsLoadingMore(true);
        } else if (!refreshing) {
          setIsLoading(true);
        }

        const params = {
          page: targetPage,
          page_size: pageSize,
          ...(search && { search }),
        };

        const response = await apiService.getIngredients(params);

        if (!response.data) {
          showToast(response.error || 'Failed to load ingredients', 'error');
          return;
        }

        const { results = [], count, next } = response.data as unknown as {
          results?: Ingredient[];
          count?: number;
          next?: string | null;
        };

        setActiveSearch(search);
        setPage(targetPage);

        if (append) {
          setIngredients(prev => {
            // Avoid duplicates by id when API returns overlapping data
            const existingIds = new Set(prev.map(item => item.id));
            const merged = [...prev];
            results.forEach(item => {
              if (!existingIds.has(item.id)) {
                merged.push(item);
              }
            });
            return merged;
          });
        } else {
          setIngredients(results);
          if (!search) {
            cacheIngredients(results);
          }
        }

        const pageHasMore = Boolean(next) || (typeof count === 'number' ? targetPage * pageSize < count : results.length === pageSize);
        setHasMore(pageHasMore);
      } catch (error) {
        showToast(error, 'error');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setRefreshing(false);
      }
    },
    [showToast, refreshing]
  );

  useEffect(() => {
    loadIngredients({ page: 1, search: '' });
  }, [loadIngredients]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIngredients({ page: 1, search: activeSearch });
  }, [loadIngredients, activeSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (initialDebounceSkipRef.current) {
      initialDebounceSkipRef.current = false;
      return;
    }

    if (debouncedSearch.length === 0 || debouncedSearch.length >= 3) {
      loadIngredients({ page: 1, search: debouncedSearch });
    }
  }, [debouncedSearch, loadIngredients]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    loadIngredients({ page: page + 1, search: activeSearch, append: true });
  }, [isLoading, isLoadingMore, hasMore, page, activeSearch, loadIngredients]);

  const handleSearchInput = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSelect = (ingredient: Ingredient) => {
    navigation.navigate('FormulaBuilder', {
      selectedIngredient: ingredient,
      timestamp: Date.now(),
    });
  };

  const handleViewDetails = (ingredient: Ingredient) => {
    navigation.navigate('IngredientPickerDetail', {
      ingredientId: ingredient.id,
      mode: 'select',
    });
  };

  const getSafetyColor = (safety: string) => {
    const safetyLower = safety.toLowerCase();
    if (safetyLower.includes('safe') || safetyLower.includes('general')) {
      return theme.colors.safe;
    }
    if (safetyLower.includes('caution') || safetyLower.includes('warning')) {
      return theme.colors.caution;
    }
    if (safetyLower.includes('risk') || safetyLower.includes('avoid')) {
      return theme.colors.risk;
    }
    return theme.colors.unknown;
  };

  const getSafetyIcon = (safety: string) => {
    const safetyLower = safety.toLowerCase();
    if (safetyLower.includes('safe') || safetyLower.includes('general')) {
      return 'checkmark-circle';
    }
    if (safetyLower.includes('caution') || safetyLower.includes('warning')) {
      return 'warning';
    }
    if (safetyLower.includes('risk') || safetyLower.includes('avoid')) {
      return 'close-circle';
    }
    return 'help-circle';
  };

  const renderIngredient = ({ item }: { item: Ingredient }) => (
    <Card style={styles.ingredientCard}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => handleSelect(item)}
        activeOpacity={0.85}
      >
        <View style={styles.ingredientHeader}>
          <View style={styles.ingredientInfo}>
            <Text style={styles.ingredientName}>{item.name}</Text>
            <View style={styles.categoryContainer}>
              <Badge variant="neutral" size="small">
                {item.category}
              </Badge>
              <Badge variant="info" size="small" style={styles.sourceBadge}>
                {item.source}
              </Badge>
            </View>
          </View>
          <View style={styles.safetyIndicator}>
            <Ionicons
              name={getSafetyIcon(item.safety) as any}
              size={24}
              color={getSafetyColor(item.safety)}
            />
            <Text style={styles.safetyText} numberOfLines={1}>
              {item.safety}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Button
            title="Select"
            size="small"
            variant="primary"
            leftIcon={<Ionicons name="checkmark" size={16} color={theme.colors.textPrimary} />}
            onPress={() => handleSelect(item)}
          />
          <Button
            title="Details"
            size="small"
            variant="outline"
            onPress={() => handleViewDetails(item)}
          />
        </View>
      </TouchableOpacity>
    </Card>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>Select Ingredients</Text>

      <View style={styles.headerSpacer} />

      <Input
        placeholder="Search ingredients..."
        value={searchQuery}
        onChangeText={handleSearchInput}
        leftIcon="search"
        rightIcon={searchQuery ? 'close' : undefined}
        onRightIconPress={() => setSearchQuery('')}
        containerStyle={styles.searchContainer}
      />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="flask-outline" size={64} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>No ingredients found</Text>
      <Text style={styles.emptyText}>
        Try adjusting your search terms or check back later for more ingredients.
      </Text>
    </View>
  );

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      {isLoading && ingredients.length === 0 ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="small" />
        </View>
      ) : (
        <FlatList
          data={ingredients}
          keyExtractor={item => item.id.toString()}
          renderItem={renderIngredient}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!isLoading ? renderEmpty : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footer}>
                {isLoadingMore ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <Button
                    title="Load more"
                    variant="outline"
                    onPress={handleLoadMore}
                    size="medium"
                  />
                )}
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  footer: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  headerSpacer: {
    height: theme.spacing.md,
  },
  title: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  searchContainer: {
    marginBottom: 0,
  },
  ingredientCard: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.md,
  },
  cardContent: {
    gap: theme.spacing.md,
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  sourceBadge: {
    marginLeft: theme.spacing.xs,
  },
  safetyIndicator: {
    alignItems: 'flex-end',
    maxWidth: 120,
  },
  safetyText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: theme.spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.screenPadding,
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxxl,
  },
});

export default IngredientPickerScreen;
