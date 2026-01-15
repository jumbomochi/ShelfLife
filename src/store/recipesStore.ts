import { create } from 'zustand';
import { Recipe, SavedRecipe } from '@/types';
import {
  saveSavedRecipesLocal,
  loadSavedRecipesLocal,
  addToSyncQueue,
} from '@/services/syncService';

interface RecipesState {
  savedRecipes: SavedRecipe[];
  searchResults: Recipe[];
  matchedRecipes: (Recipe & { usedIngredientCount?: number; missedIngredientCount?: number; missedIngredients?: string[] })[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions
  saveRecipe: (recipe: Recipe) => Promise<void>;
  removeSavedRecipe: (recipeId: number) => Promise<void>;
  isSaved: (recipeId: number) => boolean;
  setSearchResults: (recipes: Recipe[]) => void;
  setMatchedRecipes: (recipes: (Recipe & { usedIngredientCount?: number; missedIngredientCount?: number; missedIngredients?: string[] })[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearResults: () => void;

  // Sync
  loadFromLocal: () => Promise<void>;
  setSavedRecipes: (recipes: SavedRecipe[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useRecipesStore = create<RecipesState>((set, get) => ({
  savedRecipes: [],
  searchResults: [],
  matchedRecipes: [],
  isLoading: false,
  isSyncing: false,
  error: null,

  saveRecipe: async (recipe) => {
    const existing = get().savedRecipes.find((r) => r.recipeId === recipe.id);
    if (existing) return;

    const savedRecipe: SavedRecipe = {
      id: generateId(),
      userId: 'current-user', // TODO: Replace with actual user ID
      recipeId: recipe.id,
      recipeData: recipe,
      savedAt: new Date().toISOString(),
    };

    set((state) => ({
      savedRecipes: [...state.savedRecipes, savedRecipe],
    }));

    // Save to local storage
    await saveSavedRecipesLocal(get().savedRecipes);

    // Add to sync queue
    await addToSyncQueue({
      type: 'CREATE',
      entity: 'SAVED_RECIPE',
      data: savedRecipe,
    });
  },

  removeSavedRecipe: async (recipeId) => {
    const recipeToRemove = get().savedRecipes.find((r) => r.recipeId === recipeId);

    set((state) => ({
      savedRecipes: state.savedRecipes.filter((r) => r.recipeId !== recipeId),
    }));

    // Save to local storage
    await saveSavedRecipesLocal(get().savedRecipes);

    // Add to sync queue
    if (recipeToRemove) {
      await addToSyncQueue({
        type: 'DELETE',
        entity: 'SAVED_RECIPE',
        data: { id: recipeToRemove.id },
      });
    }
  },

  isSaved: (recipeId) => {
    return get().savedRecipes.some((r) => r.recipeId === recipeId);
  },

  setSearchResults: (recipes) => set({ searchResults: recipes }),
  setMatchedRecipes: (recipes) => set({ matchedRecipes: recipes }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearResults: () => set({ searchResults: [], matchedRecipes: [] }),

  loadFromLocal: async () => {
    set({ isLoading: true });
    try {
      const savedRecipes = await loadSavedRecipesLocal();
      set({ savedRecipes, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load saved recipes', isLoading: false });
    }
  },

  setSavedRecipes: (recipes) => set({ savedRecipes: recipes }),
}));
