import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { Recipe } from '@/types';
import { useRecipesStore } from '@/store';

interface RecipeCardProps {
  recipe: Recipe & {
    usedIngredientCount?: number;
    missedIngredientCount?: number;
    missedIngredients?: string[];
  };
  onPress?: () => void;
}

export default function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const { isSaved, saveRecipe, removeSavedRecipe } = useRecipesStore();
  const saved = isSaved(recipe.id);

  const handleSaveToggle = () => {
    if (saved) {
      removeSavedRecipe(recipe.id);
    } else {
      saveRecipe(recipe);
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={{ uri: recipe.image || 'https://via.placeholder.com/312x231' }}
        style={styles.image}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {recipe.title}
          </Text>
          <TouchableOpacity onPress={handleSaveToggle} style={styles.saveButton}>
            <Text style={[styles.saveIcon, saved && styles.saveIconActive]}>
              {saved ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.meta}>
          {recipe.readyInMinutes > 0 && (
            <Text style={styles.metaText}>{recipe.readyInMinutes} min</Text>
          )}
          {recipe.servings > 0 && (
            <Text style={styles.metaText}>{recipe.servings} servings</Text>
          )}
        </View>

        {recipe.usedIngredientCount !== undefined && (
          <View style={styles.ingredientMatch}>
            <Text style={styles.matchText}>
              {recipe.usedIngredientCount} ingredients you have
            </Text>
            {recipe.missedIngredientCount !== undefined && recipe.missedIngredientCount > 0 && (
              <Text style={styles.missingText}>
                Missing: {recipe.missedIngredients?.join(', ') || recipe.missedIngredientCount}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#E5E5EA',
  },
  content: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 8,
  },
  saveButton: {
    padding: 4,
  },
  saveIcon: {
    fontSize: 24,
    color: '#C7C7CC',
  },
  saveIconActive: {
    color: '#FF9500',
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
  },
  ingredientMatch: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  matchText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '500',
  },
  missingText: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 4,
  },
});
