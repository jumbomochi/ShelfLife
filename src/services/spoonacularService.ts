import { Recipe, RecipeDetail, RecipeIngredient } from '@/types';

const SPOONACULAR_API_KEY = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY || '';
const BASE_URL = 'https://api.spoonacular.com';

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
  const queryParams = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    number: String(params.number || 10),
    offset: String(params.offset || 0),
    addRecipeInformation: 'true',
  });

  if (params.query) queryParams.append('query', params.query);
  if (params.diet) queryParams.append('diet', params.diet);
  if (params.cuisine) queryParams.append('cuisine', params.cuisine);
  if (params.maxReadyTime) queryParams.append('maxReadyTime', String(params.maxReadyTime));

  const response = await fetch(`${BASE_URL}/recipes/complexSearch?${queryParams}`);

  if (!response.ok) {
    throw new Error('Failed to search recipes');
  }

  return response.json();
}

/**
 * Find recipes by available ingredients
 */
export async function findRecipesByIngredients(
  ingredients: string[],
  number: number = 10
): Promise<Recipe[]> {
  const queryParams = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    ingredients: ingredients.join(','),
    number: String(number),
    ranking: '2', // Maximize used ingredients
    ignorePantry: 'false',
  });

  const response = await fetch(`${BASE_URL}/recipes/findByIngredients?${queryParams}`);

  if (!response.ok) {
    throw new Error('Failed to find recipes by ingredients');
  }

  const results = await response.json();

  // Transform to our Recipe format
  return results.map((r: any) => ({
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
}

/**
 * Get detailed recipe information
 */
export async function getRecipeDetails(recipeId: number): Promise<RecipeDetail> {
  const queryParams = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
  });

  const response = await fetch(`${BASE_URL}/recipes/${recipeId}/information?${queryParams}`);

  if (!response.ok) {
    throw new Error('Failed to get recipe details');
  }

  return response.json();
}

/**
 * Get random recipes
 */
export async function getRandomRecipes(number: number = 5, tags?: string[]): Promise<Recipe[]> {
  const queryParams = new URLSearchParams({
    apiKey: SPOONACULAR_API_KEY,
    number: String(number),
  });

  if (tags && tags.length > 0) {
    queryParams.append('tags', tags.join(','));
  }

  const response = await fetch(`${BASE_URL}/recipes/random?${queryParams}`);

  if (!response.ok) {
    throw new Error('Failed to get random recipes');
  }

  const data = await response.json();
  return data.recipes;
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
export async function searchRecipesMock(query: string): Promise<Recipe[]> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (!query) return MOCK_RECIPES;

  return MOCK_RECIPES.filter((r) =>
    r.title.toLowerCase().includes(query.toLowerCase())
  );
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
