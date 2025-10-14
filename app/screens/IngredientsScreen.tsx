import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
  Modal,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
  ScrollView,
} from 'react-native';
import { Badge, Button, Card, Input, LoadingSpinner, Skeleton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService, Ingredient } from '../../services/api';
import { useToast } from '../contexts/ToastContext';

const CACHE_KEY = 'cached_ingredients';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

const SAFETY_LEVEL_OPTIONS: Array<{ value: '' | 'SAFE' | 'CAUTION' | 'RISK' | 'UNKNOWN'; label: string }> = [
  { value: '', label: 'All safety levels' },
  { value: 'SAFE', label: 'Safe' },
  { value: 'CAUTION', label: 'Caution' },
  { value: 'RISK', label: 'Risk' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const INGREDIENT_SORT_OPTIONS: Array<{ key: 'recent' | 'created' | 'nameAsc' | 'nameDesc' | 'category'; label: string; description: string; ordering: string }> = [
  { key: 'recent', label: 'Recently Updated', description: 'Newest updates first', ordering: '-updated_at' },
  { key: 'created', label: 'Recently Added', description: 'Newest ingredients first', ordering: '-created_at' },
  { key: 'nameAsc', label: 'A → Z', description: 'Alphabetical (A to Z)', ordering: 'name' },
  { key: 'nameDesc', label: 'Z → A', description: 'Alphabetical (Z to A)', ordering: '-name' },
  { key: 'category', label: 'By Category', description: 'Grouped by category name', ordering: 'category,name' },
];

interface IngredientsScreenProps {
  navigation: any;
}

export const IngredientsScreen: React.FC<any> = ({ navigation, route }) => {
  const { showToast } = useToast();
  
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({
    categories: [] as string[],
    sources: [] as string[],
    safety: '' as '' | 'SAFE' | 'CAUTION' | 'RISK' | 'UNKNOWN',
    safeOnly: false,
  });
  const [sortOption, setSortOption] = useState<'recent' | 'created' | 'nameAsc' | 'nameDesc' | 'category'>('recent');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Check if we're in selection mode
  const isSelectionMode = route?.params?.mode === 'select';

  // Load cached ingredients on mount
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
          setTotalCount(data.length);
          setIsLoading(false);
          // Load fresh data in background
          loadIngredients(1, debouncedSearch, false, true);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading cached ingredients:', error);
    }
  };

  const cacheIngredients = async (data: Ingredient[]) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() })
      );
    } catch (error) {
      console.error('Error caching ingredients:', error);
    }
  };

  const loadIngredients = useCallback(async (
    pageNum = 1,
    search = debouncedSearch,
    isRefresh = false,
    isSilent = false
  ) => {
    try {
      if (pageNum === 1 && !isSilent) {
        setIsLoading(true);
      }

      const selectedSort = INGREDIENT_SORT_OPTIONS.find(option => option.key === sortOption);
      const safetyValue = filters.safeOnly ? 'SAFE' : filters.safety;

      const params: Record<string, any> = {
        page: pageNum,
        page_size: 20,
        ...(search ? { search } : {}),
        ...(selectedSort?.ordering ? { ordering: selectedSort.ordering } : {}),
      };

      if (filters.categories.length) {
        params.category = filters.categories;
      }

      if (filters.sources.length) {
        params.source = filters.sources;
      }

      if (safetyValue) {
        params.safety_level = safetyValue;
      }

      const response = await apiService.getIngredients(params);
      
      if (response.data) {
        const newIngredients = response.data.results;
        const count = (response.data as any).count;
        if (typeof count === 'number') {
          setTotalCount(count);
        } else if (pageNum === 1 && !search && !filters.categories.length && !filters.sources.length && !safetyValue) {
          setTotalCount(newIngredients.length);
        }
        
        if (pageNum === 1 || isRefresh) {
          setIngredients(newIngredients);
          // Cache first page results when no filters/search applied
          if (!search && !filters.categories.length && !filters.sources.length && !safetyValue) {
            cacheIngredients(newIngredients);
          }
        } else {
          setIngredients(prev => [...prev, ...newIngredients]);
        }

        const totalAvailable = typeof count === 'number' ? count : undefined;
        if (typeof totalAvailable === 'number') {
          setHasMore(pageNum * 20 < totalAvailable);
        } else {
          setHasMore(newIngredients.length === 20);
        }
        setPage(pageNum);
      } else {
        if (!isSilent) {
          showToast(response.error || 'Failed to load ingredients', 'error');
        }
      }
    } catch (error) {
      if (!isSilent) {
        showToast(error, 'error');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filters, showToast, sortOption, debouncedSearch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadIngredients(1, debouncedSearch, true);
  }, [loadIngredients, debouncedSearch]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadIngredients(page + 1, debouncedSearch);
    }
  }, [isLoading, hasMore, page, debouncedSearch, loadIngredients]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setFilters(prev => {
      const exists = prev.categories.includes(category);
      const categories = exists
        ? prev.categories.filter(item => item !== category)
        : [...prev.categories, category];
      return { ...prev, categories };
    });
  }, []);

  const toggleSource = useCallback((source: string) => {
    setFilters(prev => {
      const exists = prev.sources.includes(source);
      const sources = exists
        ? prev.sources.filter(item => item !== source)
        : [...prev.sources, source];
      return { ...prev, sources };
    });
  }, []);

  const selectSafety = useCallback((value: '' | 'SAFE' | 'CAUTION' | 'RISK' | 'UNKNOWN') => {
    setFilters(prev => ({
      ...prev,
      safety: value,
      safeOnly: false,
    }));
  }, []);

  const toggleSafeOnly = useCallback(() => {
    setFilters(prev => {
      const nextSafeOnly = !prev.safeOnly;
      return {
        ...prev,
        safeOnly: nextSafeOnly,
        safety: nextSafeOnly ? 'SAFE' : prev.safety === 'SAFE' ? '' : prev.safety,
      };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({ categories: [], sources: [], safety: '', safeOnly: false });
  }, []);

  const removeCategory = useCallback((category: string) => {
    setFilters(prev => ({ ...prev, categories: prev.categories.filter(item => item !== category) }));
  }, []);

  const removeSource = useCallback((source: string) => {
    setFilters(prev => ({ ...prev, sources: prev.sources.filter(item => item !== source) }));
  }, []);

  const clearSafety = useCallback(() => {
    setFilters(prev => ({ ...prev, safety: '', safeOnly: false }));
  }, []);

  const selectedSort = useMemo(
    () => INGREDIENT_SORT_OPTIONS.find(option => option.key === sortOption) ?? INGREDIENT_SORT_OPTIONS[0],
    [sortOption]
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    filters.categories.forEach(category => {
      chips.push({ key: `category-${category}`, label: `Category: ${category}`, onRemove: () => removeCategory(category) });
    });

    filters.sources.forEach(source => {
      chips.push({ key: `source-${source}`, label: `Source: ${source}`, onRemove: () => removeSource(source) });
    });

    if (filters.safeOnly) {
      chips.push({ key: 'safe-only', label: 'Safe only', onRemove: () => toggleSafeOnly() });
    } else if (filters.safety) {
      const safetyLabel = SAFETY_LEVEL_OPTIONS.find(option => option.value === filters.safety)?.label ?? filters.safety;
      chips.push({ key: `safety-${filters.safety}`, label: `Safety: ${safetyLabel}`, onRemove: clearSafety });
    }

    return chips;
  }, [filters, removeCategory, removeSource, clearSafety, toggleSafeOnly]);

  const hasActiveFilters = activeFilterChips.length > 0;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    loadIngredients(1, debouncedSearch, true);
  }, [debouncedSearch, filters, sortOption, loadIngredients]);

  useEffect(() => {
    let isMounted = true;

    const fetchFilterOptions = async () => {
      try {
        setIsFilterOptionsLoading(true);
        const [categoriesResponse, sourcesResponse] = await Promise.all([
          apiService.getIngredientCategories(),
          apiService.getIngredientSources(),
        ]);

        if (!isMounted) {
          return;
        }

        if (categoriesResponse.data) {
          const categoryMap = new Map<string, string>();
          categoriesResponse.data.forEach((category) => {
            if (typeof category !== 'string') {
              return;
            }
            const trimmed = category.trim();
            if (!trimmed) {
              return;
            }
            const key = trimmed.toLowerCase();
            if (!categoryMap.has(key)) {
              categoryMap.set(key, trimmed);
            }
          });
          setCategoryOptions(Array.from(categoryMap.values()));
        } else if (categoriesResponse.error) {
          console.warn('Failed to load ingredient categories', categoriesResponse.error);
        }

        if (sourcesResponse.data) {
          const sourceMap = new Map<string, string>();
          sourcesResponse.data.forEach((source) => {
            if (typeof source !== 'string') {
              return;
            }
            const trimmed = source.trim();
            if (!trimmed) {
              return;
            }
            const key = trimmed.toLowerCase();
            if (!sourceMap.has(key)) {
              sourceMap.set(key, trimmed);
            }
          });
          setSourceOptions(Array.from(sourceMap.values()));
        } else if (sourcesResponse.error) {
          console.warn('Failed to load ingredient sources', sourcesResponse.error);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load filter options', error);
        }
      } finally {
        if (isMounted) {
        setIsFilterOptionsLoading(false);
        }
      }
    };

    fetchFilterOptions();

    return () => {
      isMounted = false;
    };
  }, []);

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
      onPress={() => {
        navigation.navigate('IngredientDetail', { 
          ingredientId: item.id,
          mode: isSelectionMode ? 'select' : undefined
        });
      }}
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
          {isSelectionMode && (
            <View style={styles.selectIndicator}>
              <Ionicons name="add-circle" size={20} color={theme.colors.accent} />
            </View>
          )}
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
        <Text style={styles.title}>
          {isSelectionMode ? 'Select Ingredient' : 'Ingredients'}
        </Text>
        {!isSelectionMode && (
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="options" size={24} color={theme.colors.accent} />
            {hasActiveFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterChips.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
      
      <Input
        placeholder={isSelectionMode ? "Search ingredients to add..." : "Search ingredients..."}
        value={searchQuery}
        onChangeText={handleSearchChange}
        leftIcon="search"
        rightIcon={searchQuery ? "close" : undefined}
        onRightIconPress={clearSearch}
        containerStyle={styles.searchContainer}
      />

      <View style={styles.headerMeta}>
        <Text style={styles.resultCountText}>
          {totalCount !== null
            ? `Showing ${ingredients.length} of ${totalCount} result${totalCount === 1 ? '' : 's'}`
            : `${ingredients.length} result${ingredients.length === 1 ? '' : 's'}`}
        </Text>
        <TouchableOpacity style={styles.sortPill} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="swap-vertical" size={18} color={theme.colors.textPrimary} />
          <Text style={styles.sortPillText}>{selectedSort.label}</Text>
        </TouchableOpacity>
      </View>

      {hasActiveFilters && (
        <View style={styles.activeFiltersContainer}>
          <View style={styles.chipRow}>
            {activeFilterChips.map(chip => (
              <TouchableOpacity key={chip.key} style={styles.filterChip} onPress={chip.onRemove}>
                <Text style={styles.filterChipText}>{chip.label}</Text>
                <Ionicons name="close" size={14} color={theme.colors.textPrimary} style={styles.filterChipIcon} />
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Clear All Filters"
            variant="outline"
            size="small"
            onPress={clearAllFilters}
            style={styles.clearFiltersButton}
          />
        </View>
      )}
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
          onPress={clearSearch}
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
      
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters &amp; Sort</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Quick Filters</Text>
                <TouchableOpacity
                  style={[styles.optionRow, filters.safeOnly && styles.optionRowActive]}
                  onPress={toggleSafeOnly}
                >
                  <Ionicons
                    name={filters.safeOnly ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={filters.safeOnly ? theme.colors.accent : theme.colors.textMuted}
                  />
                  <View style={styles.optionRowContent}>
                    <Text style={styles.optionRowTitle}>Safe ingredients only</Text>
                    <Text style={styles.optionRowSubtitle}>Hide caution and risk ingredients</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Safety Level</Text>
                <View style={styles.pillWrap}>
                  {SAFETY_LEVEL_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value || 'all'}
                      style={[styles.optionPill, filters.safety === option.value && !filters.safeOnly && styles.optionPillActive]}
                      onPress={() => selectSafety(option.value)}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          filters.safety === option.value && !filters.safeOnly && styles.optionPillTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <Text style={styles.modalSectionTitle}>Categories</Text>
                  {isFilterOptionsLoading && <LoadingSpinner size="small" />}
                </View>
                <View style={styles.pillWrap}>
                  {categoryOptions.map(category => {
                    const selected = filters.categories.includes(category);
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[styles.optionPill, selected && styles.optionPillActive]}
                        onPress={() => toggleCategory(category)}
                      >
                        <Text style={[styles.optionPillText, selected && styles.optionPillTextActive]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!isFilterOptionsLoading && categoryOptions.length === 0 && (
                    <Text style={styles.modalEmptyText}>No categories available.</Text>
                  )}
                </View>
              </View>

              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <Text style={styles.modalSectionTitle}>Sources</Text>
                  {isFilterOptionsLoading && <LoadingSpinner size="small" />}
                </View>
                <View style={styles.pillWrap}>
                  {sourceOptions.map(source => {
                    const selected = filters.sources.includes(source);
                    return (
                      <TouchableOpacity
                        key={source}
                        style={[styles.optionPill, selected && styles.optionPillActive]}
                        onPress={() => toggleSource(source)}
                      >
                        <Text style={[styles.optionPillText, selected && styles.optionPillTextActive]}>
                          {source}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!isFilterOptionsLoading && sourceOptions.length === 0 && (
                    <Text style={styles.modalEmptyText}>No sources available.</Text>
                  )}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Sort By</Text>
                <View style={styles.sortOptionList}>
                  {INGREDIENT_SORT_OPTIONS.map(option => {
                    const selected = sortOption === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.optionRow, selected && styles.optionRowActive]}
                        onPress={() => setSortOption(option.key)}
                      >
                        <Ionicons
                          name={selected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={selected ? theme.colors.accent : theme.colors.textMuted}
                        />
                        <View style={styles.optionRowContent}>
                          <Text style={styles.optionRowTitle}>{option.label}</Text>
                          <Text style={styles.optionRowSubtitle}>{option.description}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Clear All"
                variant="outline"
                size="medium"
                onPress={() => {
                  clearAllFilters();
                }}
                style={styles.modalActionButton}
              />
              <Button
                title="Apply"
                variant="primary"
                size="medium"
                onPress={() => setFilterModalVisible(false)}
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {isLoading && ingredients.length === 0 ? (
        <Skeleton />
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
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          stickyHeaderIndices={[0]}
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
    backgroundColor: theme.colors.secondary,
    zIndex: 10,         // 👈 ensure header is above rows (iOS)
    elevation: 10,
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
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    ...theme.getTextStyle('caption', 'bold'),
    color: theme.colors.primary,
    fontSize: 10,
  },
  headerMeta: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultCountText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textMuted,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  sortPillText: {
    ...theme.getTextStyle('bodySmall', 'medium'),
    color: theme.colors.textPrimary,
  },
  activeFiltersContainer: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  filterChipText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textPrimary,
  },
  filterChipIcon: {
    marginLeft: theme.spacing.xs,
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.secondary,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.screenPadding,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    ...theme.getTextStyle('h4', 'semibold'),
    color: theme.colors.textPrimary,
  },
  modalCloseButton: {
    padding: theme.spacing.sm,
  },
  modalScrollContent: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  modalSection: {
    gap: theme.spacing.sm,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  modalSectionTitle: {
    ...theme.getTextStyle('h5', 'semibold'),
    color: theme.colors.textPrimary,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  optionPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  optionPillActive: {
    backgroundColor: theme.colors.accent,
  },
  optionPillText: {
    ...theme.getTextStyle('bodySmall'),
    color: theme.colors.textPrimary,
  },
  optionPillTextActive: {
    color: theme.colors.primary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  optionRowActive: {
    backgroundColor: 'rgba(46,167,255,0.18)',
  },
  optionRowContent: {
    flex: 1,
    gap: 2,
  },
  optionRowTitle: {
    ...theme.getTextStyle('body', 'medium'),
    color: theme.colors.textPrimary,
  },
  optionRowSubtitle: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  modalEmptyText: {
    ...theme.getTextStyle('caption'),
    color: theme.colors.textMuted,
  },
  sortOptionList: {
    gap: theme.spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: theme.spacing.sm,
    rowGap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  modalActionButton: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 160,
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
  selectIndicator: {
    marginTop: theme.spacing.xs,
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