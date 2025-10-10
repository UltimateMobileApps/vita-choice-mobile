import { Ionicons } from '@expo/vector-icons';
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
import { Badge, Button, Card, Input, LoadingSpinner } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, Ingredient } from '../../services/api';
import { useToast } from '../contexts/ToastContext';

interface IngredientsScreenProps {
  navigation: any;
}

export const IngredientsScreen: React.FC<any> = ({ navigation }) => {
  const { showToast } = useToast();
  
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    source: '',
    safety: '',
  });

  const loadIngredients = useCallback(async (pageNum = 1, search = '', isRefresh = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true);
      }

      const params = {
        page: pageNum,
        page_size: 20,
        ...(search && { search }),
        ...(filters.category && { category: filters.category }),
        ...(filters.source && { source: filters.source }),
        ...(filters.safety && { safety: filters.safety }),
      };

      const response = await apiService.getIngredients(params);
      
      if (response.data) {
        const newIngredients = response.data.results;
        
        if (pageNum === 1 || isRefresh) {
          setIngredients(newIngredients);
        } else {
          setIngredients(prev => [...prev, ...newIngredients]);
        }

        setHasMore(newIngredients.length === 20);
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
  }, [filters, showToast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIngredients(1, searchQuery, true);
  }, [loadIngredients, searchQuery]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadIngredients(page + 1, searchQuery);
    }
  }, [isLoading, hasMore, page, searchQuery, loadIngredients]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.length === 0 || text.length >= 3) {
      loadIngredients(1, text, true);
    }
  }, [loadIngredients]);

  useEffect(() => {
    loadIngredients();
  }, [filters]);

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
    <Card
      style={styles.ingredientCard}
      onPress={() => navigation.navigate('IngredientDetail', { ingredientId: item.id })}
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
        </View>
      </View>
      
      <Text style={styles.safetyText} numberOfLines={2}>
        {item.safety}
      </Text>
    </Card>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Ingredients</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => showToast('Filter modal coming soon!', 'info')}
        >
          <Ionicons name="options" size={24} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>
      
      <Input
        placeholder="Search ingredients..."
        value={searchQuery}
        onChangeText={handleSearch}
        leftIcon="search"
        rightIcon={searchQuery ? "close" : undefined}
        onRightIconPress={() => handleSearch('')}
        containerStyle={styles.searchContainer}
      />
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.footer}>
        <LoadingSpinner size="small" />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color={theme.colors.textMuted} />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No ingredients found' : 'No ingredients available'}
      </Text>
      <Text style={styles.emptyText}>
        {searchQuery 
          ? `No ingredients match "${searchQuery}". Try different keywords.`
          : 'There are no ingredients to display at the moment.'
        }
      </Text>
      {searchQuery && (
        <Button
          title="Clear Search"
          variant="outline"
          size="medium"
          onPress={() => handleSearch('')}
          style={styles.clearButton}
        />
      )}
    </View>
  );

  return (
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      
      {isLoading && page === 1 ? (
        <LoadingSpinner overlay />
      ) : (
        <FlatList
          data={ingredients}
          renderItem={renderIngredient}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContainer}
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
  listContainer: {
    paddingBottom: 100, // Space for bottom navigation
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
    marginBottom: theme.spacing.lg,
  },
  title: {
    ...theme.getTextStyle('h2', 'bold'),
    color: theme.colors.textPrimary,
  },
  filterButton: {
    padding: theme.spacing.sm,
  },
  searchContainer: {
    marginBottom: 0,
  },
  ingredientCard: {
    marginHorizontal: theme.spacing.screenPadding,
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
    marginBottom: theme.spacing.sm,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sourceBadge: {
    marginLeft: theme.spacing.sm,
  },
  safetyIndicator: {
    alignItems: 'center',
  },
  safetyText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
  },
  footer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
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
  clearButton: {
    paddingHorizontal: theme.spacing.xl,
  },
});

export default IngredientsScreen;
