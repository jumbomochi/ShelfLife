import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRecipesStore } from '@/store';
import { RecipeDetail } from '@/types';
import { getRecipeDetailsMock } from '@/services/spoonacularService';

interface RecipeDetailScreenProps {
  recipeId: number;
  onClose: () => void;
  onAddToShoppingList?: (ingredients: { name: string; amount: number; unit: string }[]) => void;
}

export default function RecipeDetailScreen({
  recipeId,
  onClose,
  onAddToShoppingList,
}: RecipeDetailScreenProps) {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isSaved, saveRecipe, removeSavedRecipe } = useRecipesStore();

  const saved = recipe ? isSaved(recipe.id) : false;

  useEffect(() => {
    loadRecipeDetails();
  }, [recipeId]);

  const loadRecipeDetails = async () => {
    setIsLoading(true);
    try {
      const details = await getRecipeDetailsMock(recipeId);
      setRecipe(details);
    } catch (error) {
      Alert.alert('Error', 'Failed to load recipe details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToggle = () => {
    if (!recipe) return;

    if (saved) {
      removeSavedRecipe(recipe.id);
    } else {
      saveRecipe(recipe);
    }
  };

  const handleAddToShoppingList = () => {
    if (!recipe) return;

    const ingredients = recipe.extendedIngredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
    }));

    onAddToShoppingList?.(ingredients);
    Alert.alert(
      'Added to Shopping List',
      `${ingredients.length} ingredients added to your shopping list`
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Recipe not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image
          source={{ uri: recipe.image || 'https://via.placeholder.com/400x300' }}
          style={styles.image}
        />

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{recipe.title}</Text>
            <TouchableOpacity onPress={handleSaveToggle} style={styles.saveButton}>
              <Text style={[styles.saveIcon, saved && styles.saveIconActive]}>
                {saved ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{recipe.readyInMinutes}</Text>
              <Text style={styles.metaLabel}>minutes</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{recipe.servings}</Text>
              <Text style={styles.metaLabel}>servings</Text>
            </View>
          </View>

          {recipe.diets && recipe.diets.length > 0 && (
            <View style={styles.dietsContainer}>
              {recipe.diets.map((diet) => (
                <View key={diet} style={styles.dietBadge}>
                  <Text style={styles.dietText}>{diet}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.extendedIngredients.map((ing, index) => (
              <View key={`${ing.id}-${index}`} style={styles.ingredientRow}>
                <Text style={styles.ingredientBullet}>•</Text>
                <Text style={styles.ingredientText}>{ing.original}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.addToListButton}
            onPress={handleAddToShoppingList}
          >
            <Text style={styles.addToListButtonText}>
              Add Ingredients to Shopping List
            </Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.analyzedInstructions &&
            recipe.analyzedInstructions.length > 0 ? (
              recipe.analyzedInstructions[0].steps.map((step) => (
                <View key={step.number} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.number}</Text>
                  </View>
                  <Text style={styles.stepText}>{step.step}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.instructionsText}>
                {recipe.instructions || 'No instructions available'}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: 250,
    backgroundColor: '#E5E5EA',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    marginRight: 12,
  },
  saveButton: {
    padding: 4,
  },
  saveIcon: {
    fontSize: 32,
    color: '#C7C7CC',
  },
  saveIconActive: {
    color: '#FF9500',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  metaLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  dietsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  dietBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dietText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ingredientBullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 8,
    marginTop: 2,
  },
  ingredientText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 22,
  },
  addToListButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  addToListButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 24,
  },
  instructionsText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
});
