// Core type definitions for ShelfLife

// User & Authentication
export interface User {
  id: string;
  email: string;
  name: string;
  householdId?: string;
  notificationSettings: NotificationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  expirationWarningDays: number[]; // e.g., [1, 3, 7] for 1, 3, 7 days before
  lowStockAlerts: boolean;
}

// Household
export interface Household {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  inviteCode: string;
  createdAt: string;
}

// Inventory
export type ItemLocation = 'fridge' | 'pantry';
export type ItemOwnership = 'personal' | 'household';

export interface InventoryItem {
  id: string;
  userId: string;
  householdId?: string;
  ownership: ItemOwnership;
  name: string;
  location: ItemLocation;
  quantity: number;
  unit: string;
  expirationDate?: string;
  imageUrl?: string;
  addedAt: string;
  updatedAt: string;
}

// Recipes (Spoonacular integration)
export interface Recipe {
  id: number; // Spoonacular recipe ID
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  summary: string;
}

export interface RecipeDetail extends Recipe {
  extendedIngredients: RecipeIngredient[];
  instructions: string;
  analyzedInstructions: AnalyzedInstruction[];
  diets: string[];
  dishTypes: string[];
}

export interface RecipeIngredient {
  id: number;
  name: string;
  amount: number;
  unit: string;
  original: string;
}

export interface AnalyzedInstruction {
  name: string;
  steps: InstructionStep[];
}

export interface InstructionStep {
  number: number;
  step: string;
  ingredients: { id: number; name: string }[];
}

// Saved Recipes
export interface SavedRecipe {
  id: string;
  userId: string;
  recipeId: number; // Spoonacular ID
  recipeData: Recipe;
  savedAt: string;
}

// Shopping List
export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  recipeId?: number; // If added from a recipe
}

export interface ShoppingList {
  id: string;
  userId: string;
  householdId?: string;
  ownership: ItemOwnership; // 'personal' or 'household'
  name: string;
  items: ShoppingListItem[];
  createdAt: string;
  updatedAt: string;
}

// Navigation Types
export type RootTabParamList = {
  Home: undefined;
  Inventory: undefined;
  Recipes: undefined;
  Shopping: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  AddItem: { mode: 'camera' | 'manual' };
  EditItem: { itemId: string };
  Camera: undefined;
  RecipeDetail: { recipeId: number };
  Profile: undefined;
  Settings: undefined;
  HouseholdManagement: undefined;
};
