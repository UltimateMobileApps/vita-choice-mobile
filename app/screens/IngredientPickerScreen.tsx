import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { Badge, Button, Card, Input, Skeleton } from '../../components/ui';
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
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

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
    async (pageNum = 1, search = '', isRefresh = false) => {
      try {
        if (pageNum === 1) {
          setIsLoading(true);
        }

        const params = {
          page: pageNum,
          page_size: 20,
          ...(search && { search }),
        };

        const response = await apiService.getIngredients(params);

        if (response.data) {
          const results = response.data.results;

          if (pageNum === 1 || isRefresh) {
            setIngredients(results);
            if (!search) {
              cacheIngredients(results);
            }
          } else {
            setIngredients(prev => [...prev, ...results]);
          }

          setHasMore(results.length === 20);
          setPage(pageNum);
        } else {
          showToast(response.error || 'Failed to load ingredients', 'error');
        }
      } catch (error) {
        showToast('Network error', 'error');
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadIngredients(1, '', true);
  }, [loadIngredients]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIngredients(1, searchQuery, true);
  }, [loadIngredients, searchQuery]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadIngredients(page + 1, searchQuery);
    }
  }, [isLoading, hasMore, page, searchQuery, loadIngredients]);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (text.length === 0 || text.length >= 3) {
        loadIngredients(1, text, true);
      }
    },
    [loadIngredients]
  );

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
        onChangeText={handleSearch}
        leftIcon="search"
        rightIcon={searchQuery ? 'close' : undefined}
        onRightIconPress={() => handleSearch('')}
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

      {isLoading && page === 1 ? (
        <Skeleton />
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
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
});

export default IngredientPickerScreen;
