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

// Household Roles & Permissions (#10)
export type HouseholdRole = 'owner' | 'admin' | 'member';

export interface HouseholdMember {
  userId: string;
  role: HouseholdRole;
  name: string;
  email: string;
}

// Household Email Invitations (#9)
export interface HouseholdInvitation {
  id: string;
  householdId: string;
  householdName: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

// Barcode Lookup (#8)
export interface BarcodeProduct {
  barcode: string;
  name: string;
  quantity?: string;
  brand?: string;
  categories?: string[];
  imageUrl?: string;
}

// Shopping List Suggestions (#11)
export type SuggestionSource = 'expiring' | 'low_stock' | 'history' | 'recipe';

export interface ShoppingSuggestion {
  id: string;
  name: string;
  reason: string;
  source: SuggestionSource;
  quantity?: number;
  unit?: string;
}

export interface PurchaseHistoryEntry {
  itemName: string;
  removedAt: string;
  quantity: number;
  unit: string;
}

// Household
export interface Household {
  id: string;
  name: string;
  ownerId: string;
  members: HouseholdMember[];
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
  AddItem: {
    mode: 'camera' | 'manual';
    prefill?: {
      name?: string;
      quantity?: number;
      unit?: string;
      location?: ItemLocation;
    };
  };
  EditItem: { itemId: string };
  Camera: undefined;
  RecipeDetail: { recipeId: number };
  Profile: undefined;
  Settings: undefined;
  HouseholdManagement: undefined;
};
