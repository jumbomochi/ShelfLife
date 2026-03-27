import { Recipe, RecipeDetail, RecipeIngredient } from '@/types';
import {
  getCached,
  setCache,
  SEARCH_CACHE_TTL,
  DETAIL_CACHE_TTL,
} from '@/services/recipeCacheService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || '';

// Dietary Restrictions (from Spoonacular API)
export const DIETARY_RESTRICTIONS = [
  { value: 'glutenFree', label: 'Gluten Free' },
  { value: 'ketogenic', label: 'Ketogenic' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescetarian', label: 'Pescetarian' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'primal', label: 'Primal' },
  { value: 'lowFodmap', label: 'Low FODMAP' },
  { value: 'whole30', label: 'Whole30' },
];

// Cuisine Types (from Spoonacular API)
export const CUISINE_TYPES = [
  { value: 'african', label: 'African' },
  { value: 'asian', label: 'Asian' },
  { value: 'american', label: 'American' },
  { value: 'british', label: 'British' },
  { value: 'cajun', label: 'Cajun' },
  { value: 'caribbean', label: 'Caribbean' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'eastern european', label: 'Eastern European' },
  { value: 'european', label: 'European' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'greek', label: 'Greek' },
  { value: 'indian', label: 'Indian' },
  { value: 'irish', label: 'Irish' },
  { value: 'italian', label: 'Italian' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'jewish', label: 'Jewish' },
  { value: 'korean', label: 'Korean' },
  { value: 'latin american', label: 'Latin American' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'mexican', label: 'Mexican' },
  { value: 'middle eastern', label: 'Middle Eastern' },
  { value: 'nordic', label: 'Nordic' },
  { value: 'southern', label: 'Southern' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'thai', label: 'Thai' },
  { value: 'vietnamese', label: 'Vietnamese' },
];

interface SearchRecipesParams {
  query?: string;
  ingredients?: string[];
  diet?: string;
  cuisine?: string;
  maxReadyTime?: number;
  number?: number;
  offset?: number;
}

interface SpoonacularSearchResult {
  results: Recipe[];
  offset: number;
  number: number;
  totalResults: number;
}

/**
 * Search recipes by query string
 */
export async function searchRecipes(params: SearchRecipesParams): Promise<SpoonacularSearchResult> {
  if (!API_BASE_URL) {
    const results = await searchRecipesMock(params.query || '', params.diet, params.cuisine);
    return { results, offset: 0, number: results.length, totalResults: results.length };
  }

  const queryParams: Record<string, string | undefined> = {
    query: params.query,
    diet: params.diet,
    cuisine: params.cuisine,
    maxReadyTime: params.maxReadyTime?.toString(),
    number: String(params.number || 10),
    offset: String(params.offset || 0),
    addRecipeInformation: 'true',
  };

  const cached = await getCached<SpoonacularSearchResult>('search', queryParams);
  if (cached) return cached;

  const urlParams = new URLSearchParams();
  Object.entries(queryParams).forEach(([k, v]) => { if (v) urlParams.append(k, v); });

  const response = await fetch(`${API_BASE_URL}/recipes/search?${urlParams}`);
  if (!response.ok) throw new Error('Failed to search recipes');

  const data: SpoonacularSearchResult = await response.json();
  await setCache('search', queryParams, data, SEARCH_CACHE_TTL);
  return data;
}

/**
 * Find recipes by available ingredients
 */
export async function findRecipesByIngredients(
  ingredients: string[],
  number: number = 10
): Promise<Recipe[]> {
  if (!API_BASE_URL) {
    return findRecipesByIngredientsMock(ingredients);
  }

  const queryParams: Record<string, string | undefined> = {
    ingredients: ingredients.join(','),
    number: String(number),
    ranking: '2',
    ignorePantry: 'false',
  };

  const cached = await getCached<Recipe[]>('findByIngredients', queryParams);
  if (cached) return cached;

  const urlParams = new URLSearchParams();
  Object.entries(queryParams).forEach(([k, v]) => { if (v) urlParams.append(k, v); });

  const response = await fetch(`${API_BASE_URL}/recipes/findByIngredients?${urlParams}`);
  if (!response.ok) throw new Error('Failed to find recipes by ingredients');

  const results = await response.json();
  const recipes: Recipe[] = results.map((r: any) => ({
    id: r.id,
    title: r.title,
    image: r.image,
    readyInMinutes: 0,
    servings: 0,
    sourceUrl: '',
    summary: '',
    usedIngredientCount: r.usedIngredientCount,
    missedIngredientCount: r.missedIngredientCount,
    missedIngredients: r.missedIngredients?.map((i: any) => i.name) || [],
  }));

  await setCache('findByIngredients', queryParams, recipes, SEARCH_CACHE_TTL);
  return recipes;
}

/**
 * Get detailed recipe information
 */
export async function getRecipeDetails(recipeId: number): Promise<RecipeDetail> {
  if (!API_BASE_URL) {
    return getRecipeDetailsMock(recipeId);
  }

  const queryParams = { id: String(recipeId) };

  const cached = await getCached<RecipeDetail>('recipeDetail', queryParams);
  if (cached) return cached;

  const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}`);
  if (!response.ok) throw new Error('Failed to get recipe details');

  const data: RecipeDetail = await response.json();
  await setCache('recipeDetail', queryParams, data, DETAIL_CACHE_TTL);
  return data;
}

// Mock data for development without API key
export const MOCK_RECIPES: Recipe[] = [
  {
    id: 1,
    title: 'Spaghetti Carbonara',
    image: 'https://spoonacular.com/recipeImages/716429-312x231.jpg',
    readyInMinutes: 30,
    servings: 4,
    sourceUrl: 'https://example.com/carbonara',
    summary: 'A classic Italian pasta dish with eggs, cheese, and pancetta.',
  },
  {
    id: 2,
    title: 'Chicken Stir Fry',
    image: 'https://spoonacular.com/recipeImages/716426-312x231.jpg',
    readyInMinutes: 25,
    servings: 4,
    sourceUrl: 'https://example.com/stirfry',
    summary: 'Quick and healthy chicken stir fry with vegetables.',
  },
  {
    id: 3,
    title: 'Vegetable Soup',
    image: 'https://spoonacular.com/recipeImages/716406-312x231.jpg',
    readyInMinutes: 45,
    servings: 6,
    sourceUrl: 'https://example.com/soup',
    summary: 'Hearty vegetable soup perfect for cold days.',
  },
  {
    id: 4,
    title: 'Grilled Salmon',
    image: 'https://spoonacular.com/recipeImages/716432-312x231.jpg',
    readyInMinutes: 20,
    servings: 2,
    sourceUrl: 'https://example.com/salmon',
    summary: 'Simple grilled salmon with lemon and herbs.',
  },
  {
    id: 5,
    title: 'Caesar Salad',
    image: 'https://spoonacular.com/recipeImages/716437-312x231.jpg',
    readyInMinutes: 15,
    servings: 2,
    sourceUrl: 'https://example.com/caesar',
    summary: 'Classic Caesar salad with homemade dressing.',
  },
];

export const MOCK_RECIPE_DETAIL: RecipeDetail = {
  id: 1,
  title: 'Spaghetti Carbonara',
  image: 'https://spoonacular.com/recipeImages/716429-312x231.jpg',
  readyInMinutes: 30,
  servings: 4,
  sourceUrl: 'https://example.com/carbonara',
  summary: 'A classic Italian pasta dish made with eggs, cheese, pancetta, and black pepper. This Roman specialty is creamy without using cream.',
  extendedIngredients: [
    { id: 1, name: 'spaghetti', amount: 400, unit: 'g', original: '400g spaghetti' },
    { id: 2, name: 'pancetta', amount: 200, unit: 'g', original: '200g pancetta' },
    { id: 3, name: 'eggs', amount: 4, unit: '', original: '4 large eggs' },
    { id: 4, name: 'parmesan cheese', amount: 100, unit: 'g', original: '100g parmesan, grated' },
    { id: 5, name: 'black pepper', amount: 1, unit: 'tsp', original: '1 tsp black pepper' },
    { id: 6, name: 'salt', amount: 1, unit: 'pinch', original: 'Salt to taste' },
  ],
  instructions: 'Cook pasta according to package directions. Meanwhile, cook pancetta until crispy. Beat eggs with cheese. Toss hot pasta with pancetta, then quickly stir in egg mixture. Season with pepper.',
  analyzedInstructions: [
    {
      name: '',
      steps: [
        { number: 1, step: 'Bring a large pot of salted water to boil.', ingredients: [] },
        { number: 2, step: 'Cook spaghetti according to package directions until al dente.', ingredients: [{ id: 1, name: 'spaghetti' }] },
        { number: 3, step: 'While pasta cooks, cut pancetta into small cubes and cook in a large pan until crispy.', ingredients: [{ id: 2, name: 'pancetta' }] },
        { number: 4, step: 'In a bowl, beat eggs with grated parmesan and black pepper.', ingredients: [{ id: 3, name: 'eggs' }, { id: 4, name: 'parmesan' }] },
        { number: 5, step: 'Drain pasta, reserving 1 cup of pasta water.', ingredients: [] },
        { number: 6, step: 'Add hot pasta to the pan with pancetta, remove from heat.', ingredients: [] },
        { number: 7, step: 'Quickly pour egg mixture over pasta and toss vigorously.', ingredients: [] },
        { number: 8, step: 'Add pasta water as needed to create a creamy sauce.', ingredients: [] },
        { number: 9, step: 'Serve immediately with extra parmesan and black pepper.', ingredients: [] },
      ],
    },
  ],
  diets: [],
  dishTypes: ['lunch', 'main course', 'dinner'],
};

/**
 * Mock function for searching recipes (development)
 */
export async function searchRecipesMock(
  query: string,
  diet?: string | null,
  cuisine?: string | null
): Promise<Recipe[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  let results = MOCK_RECIPES;

  // Filter by query
  if (query) {
    results = results.filter((r) =>
      r.title.toLowerCase().includes(query.toLowerCase())
    );
  }

  // Mock diet filtering - in real implementation this would come from API
  if (diet) {
    // For mock purposes, just return a subset based on diet
    results = results.slice(0, Math.max(2, Math.floor(results.length / 2)));
  }

  // Mock cuisine filtering
  if (cuisine) {
    // For mock purposes, just return a subset based on cuisine
    results = results.slice(0, Math.max(2, Math.floor(results.length / 2)));
  }

  return results;
}

/**
 * Mock function for finding recipes by ingredients (development)
 */
export async function findRecipesByIngredientsMock(ingredients: string[]): Promise<(Recipe & { usedIngredientCount: number; missedIngredientCount: number; missedIngredients: string[] })[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simulate ingredient matching
  return MOCK_RECIPES.map((recipe) => ({
    ...recipe,
    usedIngredientCount: Math.floor(Math.random() * 5) + 1,
    missedIngredientCount: Math.floor(Math.random() * 3),
    missedIngredients: ['onion', 'garlic'].slice(0, Math.floor(Math.random() * 2)),
  }));
}

/**
 * Mock function for getting recipe details (development)
 */
export async function getRecipeDetailsMock(recipeId: number): Promise<RecipeDetail> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { ...MOCK_RECIPE_DETAIL, id: recipeId };
}
