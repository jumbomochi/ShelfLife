import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRecipesStore, useInventoryStore } from '@/store';
import { RootStackParamList, Recipe } from '@/types';
import {
  searchRecipesMock,
  findRecipesByIngredientsMock,
} from '@/services/spoonacularService';
import RecipeCard from '@/components/RecipeCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'search' | 'match' | 'saved';

export default function RecipesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');

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
      const results = await searchRecipesMock(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, setLoading, setSearchResults]);

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
});
