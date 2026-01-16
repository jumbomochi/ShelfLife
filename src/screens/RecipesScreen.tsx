import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRecipesStore, useInventoryStore } from '@/store';
import { RootStackParamList, Recipe } from '@/types';
import {
  searchRecipesMock,
  findRecipesByIngredientsMock,
  DIETARY_RESTRICTIONS,
  CUISINE_TYPES,
} from '@/services/spoonacularService';
import RecipeCard from '@/components/RecipeCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'search' | 'match' | 'saved';

export default function RecipesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedDiet, setSelectedDiet] = useState<string | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);

  const { items } = useInventoryStore();
  const {
    savedRecipes,
    searchResults,
    matchedRecipes,
    isLoading,
    setSearchResults,
    setMatchedRecipes,
    setLoading,
  } = useRecipesStore();

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const results = await searchRecipesMock(searchQuery, selectedDiet, selectedCuisine);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedDiet, selectedCuisine, setLoading, setSearchResults]);

  const handleClearFilters = () => {
    setSelectedDiet(null);
    setSelectedCuisine(null);
  };

  const activeFiltersCount =
    (selectedDiet ? 1 : 0) + (selectedCuisine ? 1 : 0);

  const handleFindByIngredients = useCallback(async () => {
    const ingredientNames = items.map((item) => item.name);
    if (ingredientNames.length === 0) return;

    setLoading(true);
    try {
      const results = await findRecipesByIngredientsMock(ingredientNames);
      setMatchedRecipes(results);
    } catch (error) {
      console.error('Match error:', error);
    } finally {
      setLoading(false);
    }
  }, [items, setLoading, setMatchedRecipes]);

  const handleRecipePress = (recipeId: number) => {
    navigation.navigate('RecipeDetail', { recipeId });
  };

  const renderTab = (tab: TabType, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderSearchTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search recipes..."
          placeholderTextColor="#999"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>
            {activeFiltersCount > 0 ? `Filters (${activeFiltersCount})` : 'Filters'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => handleRecipePress(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Search for recipes by name or ingredient
          </Text>
        </View>
      )}
    </View>
  );

  const renderMatchTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.matchButton}
        onPress={handleFindByIngredients}
        disabled={items.length === 0}
      >
        <Text style={styles.matchButtonText}>
          Find Recipes with My {items.length} Ingredients
        </Text>
      </TouchableOpacity>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : matchedRecipes.length > 0 ? (
        <FlatList
          data={matchedRecipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => handleRecipePress(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {items.length === 0
              ? 'Add items to your inventory first'
              : 'Tap the button above to find matching recipes'}
          </Text>
        </View>
      )}
    </View>
  );

  const renderSavedTab = () => (
    <View style={styles.tabContent}>
      {savedRecipes.length > 0 ? (
        <FlatList
          data={savedRecipes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item.recipeData}
              onPress={() => handleRecipePress(item.recipeId)}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No saved recipes yet. Tap the star on any recipe to save it.
          </Text>
        </View>
      )}
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Text style={styles.filterSectionTitle}>Dietary Restrictions</Text>
            <View style={styles.filterOptionsContainer}>
              {DIETARY_RESTRICTIONS.map((diet) => (
                <TouchableOpacity
                  key={diet.value}
                  style={[
                    styles.filterOption,
                    selectedDiet === diet.value && styles.filterOptionActive,
                  ]}
                  onPress={() =>
                    setSelectedDiet(selectedDiet === diet.value ? null : diet.value)
                  }
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedDiet === diet.value && styles.filterOptionTextActive,
                    ]}
                  >
                    {diet.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterSectionTitle}>Cuisine Type</Text>
            <View style={styles.filterOptionsContainer}>
              {CUISINE_TYPES.map((cuisine) => (
                <TouchableOpacity
                  key={cuisine.value}
                  style={[
                    styles.filterOption,
                    selectedCuisine === cuisine.value && styles.filterOptionActive,
                  ]}
                  onPress={() =>
                    setSelectedCuisine(
                      selectedCuisine === cuisine.value ? null : cuisine.value
                    )
                  }
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedCuisine === cuisine.value && styles.filterOptionTextActive,
                    ]}
                  >
                    {cuisine.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {activeFiltersCount > 0 && (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearFiltersText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {renderTab('search', 'Search')}
        {renderTab('match', 'Match')}
        {renderTab('saved', `Saved (${savedRecipes.length})`)}
      </View>

      {activeTab === 'search' && renderSearchTab()}
      {activeTab === 'match' && renderMatchTab()}
      {activeTab === 'saved' && renderSavedTab()}

      {renderFilterModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  filterButton: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#FF9500',
  },
  filterButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  matchButton: {
    backgroundColor: '#34C759',
    margin: 16,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  matchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  modalCloseText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalScroll: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 12,
  },
  filterOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#fff',
  },
  clearFiltersButton: {
    margin: 20,
    padding: 14,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    alignItems: 'center',
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
