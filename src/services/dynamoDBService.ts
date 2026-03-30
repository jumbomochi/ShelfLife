import { InventoryItem, ShoppingList, SavedRecipe, User, Household } from '@/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || '';

// ============ API Helpers ============

async function apiPost<T>(path: string, body: T): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${path} failed: ${response.status}`);
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return response.json();
}

async function apiGetOrNull<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return response.json();
}

async function apiPut<T>(path: string, body: T): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`PUT ${path} failed: ${response.status}`);
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`DELETE ${path} failed: ${response.status}`);
}

// ============ User Operations ============

export async function createUser(user: User): Promise<void> {
  if (!API_BASE_URL) return createUserMock(user);
  await apiPost('/users', user);
}

export async function getUser(userId: string): Promise<User | null> {
  if (!API_BASE_URL) return getUserMock(userId);
  return apiGetOrNull<User>(`/users/${userId}`);
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  if (!API_BASE_URL) return;
  await apiPut(`/users/${userId}`, { id: userId, ...updates });
}

// ============ Inventory Operations ============

export async function createInventoryItem(item: InventoryItem): Promise<void> {
  if (!API_BASE_URL) return createInventoryItemMock(item);
  await apiPost('/inventory', item);
}

export async function getInventoryItem(itemId: string, userId: string): Promise<InventoryItem | null> {
  if (!API_BASE_URL) return null;
  return apiGetOrNull<InventoryItem>(`/inventory/${itemId}`);
}

export async function getInventoryItemsByUser(userId: string): Promise<InventoryItem[]> {
  if (!API_BASE_URL) return getInventoryItemsByUserMock(userId);
  return apiGet<InventoryItem[]>(`/inventory?userId=${encodeURIComponent(userId)}`);
}

export async function getInventoryItemsByHousehold(householdId: string): Promise<InventoryItem[]> {
  if (!API_BASE_URL) return getInventoryItemsByHouseholdMock(householdId);
  return apiGet<InventoryItem[]>(`/inventory/household/${encodeURIComponent(householdId)}`);
}

export async function updateInventoryItem(
  itemId: string,
  userId: string,
  updates: Partial<InventoryItem>
): Promise<void> {
  if (!API_BASE_URL) return updateInventoryItemMock(itemId, updates);
  await apiPut(`/inventory/${itemId}`, { id: itemId, userId, ...updates });
}

export async function deleteInventoryItem(itemId: string, userId: string): Promise<void> {
  if (!API_BASE_URL) return deleteInventoryItemMock(itemId);
  await apiDelete(`/inventory/${itemId}`);
}

// ============ Shopping List Operations ============

export async function createShoppingList(list: ShoppingList): Promise<void> {
  if (!API_BASE_URL) return createShoppingListMock(list);
  await apiPost('/shopping-lists', list);
}

export async function getShoppingList(listId: string, userId: string): Promise<ShoppingList | null> {
  if (!API_BASE_URL) return null;
  return apiGetOrNull<ShoppingList>(`/shopping-lists/${listId}`);
}

export async function getShoppingListsByUser(userId: string): Promise<ShoppingList[]> {
  if (!API_BASE_URL) return getShoppingListsByUserMock(userId);
  return apiGet<ShoppingList[]>(`/shopping-lists?userId=${encodeURIComponent(userId)}`);
}

export async function getShoppingListsByHousehold(householdId: string): Promise<ShoppingList[]> {
  if (!API_BASE_URL) return getShoppingListsByHouseholdMock(householdId);
  return apiGet<ShoppingList[]>(`/shopping-lists/household/${encodeURIComponent(householdId)}`);
}

export async function updateShoppingList(
  listId: string,
  userId: string,
  updates: Partial<ShoppingList>
): Promise<void> {
  if (!API_BASE_URL) return updateShoppingListMock(listId, updates);
  await apiPut(`/shopping-lists/${listId}`, { id: listId, userId, ...updates });
}

export async function deleteShoppingList(listId: string, userId: string): Promise<void> {
  if (!API_BASE_URL) return deleteShoppingListMock(listId);
  await apiDelete(`/shopping-lists/${listId}`);
}

// ============ Saved Recipes Operations ============

export async function createSavedRecipe(recipe: SavedRecipe): Promise<void> {
  if (!API_BASE_URL) return createSavedRecipeMock(recipe);
  await apiPost('/saved-recipes', recipe);
}

export async function getSavedRecipesByUser(userId: string): Promise<SavedRecipe[]> {
  if (!API_BASE_URL) return getSavedRecipesByUserMock(userId);
  return apiGet<SavedRecipe[]>(`/saved-recipes?userId=${encodeURIComponent(userId)}`);
}

export async function deleteSavedRecipe(recipeId: string, userId: string): Promise<void> {
  if (!API_BASE_URL) return deleteSavedRecipeMock(recipeId);
  await apiDelete(`/saved-recipes/${recipeId}`);
}

// ============ Household Operations ============

export async function createHousehold(household: Household): Promise<void> {
  if (!API_BASE_URL) return;
  await apiPost('/households', household);
}

export async function getHousehold(householdId: string): Promise<Household | null> {
  if (!API_BASE_URL) return null;
  return apiGetOrNull<Household>(`/households/${householdId}`);
}

export async function getHouseholdByInviteCode(inviteCode: string): Promise<Household | null> {
  if (!API_BASE_URL) return null;
  return apiGetOrNull<Household>(`/households/invite/${encodeURIComponent(inviteCode)}`);
}

export async function updateHousehold(
  householdId: string,
  updates: Partial<Household>
): Promise<void> {
  if (!API_BASE_URL) return;
  await apiPut(`/households/${householdId}`, { id: householdId, ...updates });
}

// ============ Mock Functions for Development ============

// In-memory storage for mock
const mockStorage: {
  users: Map<string, User>;
  inventory: Map<string, InventoryItem>;
  shoppingLists: Map<string, ShoppingList>;
  savedRecipes: Map<string, SavedRecipe>;
  households: Map<string, Household>;
} = {
  users: new Map(),
  inventory: new Map(),
  shoppingLists: new Map(),
  savedRecipes: new Map(),
  households: new Map(),
};

// Mock User Operations
export async function createUserMock(user: User): Promise<void> {
  await simulateDelay();
  mockStorage.users.set(user.id, user);
}

export async function getUserMock(userId: string): Promise<User | null> {
  await simulateDelay();
  return mockStorage.users.get(userId) || null;
}

// Mock Inventory Operations
export async function createInventoryItemMock(item: InventoryItem): Promise<void> {
  await simulateDelay();
  mockStorage.inventory.set(item.id, item);
}

export async function getInventoryItemsByUserMock(userId: string): Promise<InventoryItem[]> {
  await simulateDelay();
  return Array.from(mockStorage.inventory.values()).filter((item) => item.userId === userId);
}

export async function getInventoryItemsByHouseholdMock(householdId: string): Promise<InventoryItem[]> {
  await simulateDelay();
  return Array.from(mockStorage.inventory.values()).filter(
    (item) => item.householdId === householdId && item.ownership === 'household'
  );
}

export async function updateInventoryItemMock(
  itemId: string,
  updates: Partial<InventoryItem>
): Promise<void> {
  await simulateDelay();
  const existing = mockStorage.inventory.get(itemId);
  if (existing) {
    mockStorage.inventory.set(itemId, { ...existing, ...updates });
  }
}

export async function deleteInventoryItemMock(itemId: string): Promise<void> {
  await simulateDelay();
  mockStorage.inventory.delete(itemId);
}

// Mock Shopping List Operations
export async function createShoppingListMock(list: ShoppingList): Promise<void> {
  await simulateDelay();
  mockStorage.shoppingLists.set(list.id, list);
}

export async function getShoppingListsByUserMock(userId: string): Promise<ShoppingList[]> {
  await simulateDelay();
  return Array.from(mockStorage.shoppingLists.values()).filter((list) => list.userId === userId);
}

export async function getShoppingListsByHouseholdMock(householdId: string): Promise<ShoppingList[]> {
  await simulateDelay();
  return Array.from(mockStorage.shoppingLists.values()).filter(
    (list) => list.householdId === householdId && list.ownership === 'household'
  );
}

export async function updateShoppingListMock(
  listId: string,
  updates: Partial<ShoppingList>
): Promise<void> {
  await simulateDelay();
  const existing = mockStorage.shoppingLists.get(listId);
  if (existing) {
    mockStorage.shoppingLists.set(listId, { ...existing, ...updates });
  }
}

export async function deleteShoppingListMock(listId: string): Promise<void> {
  await simulateDelay();
  mockStorage.shoppingLists.delete(listId);
}

// Mock Saved Recipes Operations
export async function createSavedRecipeMock(recipe: SavedRecipe): Promise<void> {
  await simulateDelay();
  mockStorage.savedRecipes.set(recipe.id, recipe);
}

export async function getSavedRecipesByUserMock(userId: string): Promise<SavedRecipe[]> {
  await simulateDelay();
  return Array.from(mockStorage.savedRecipes.values()).filter((r) => r.userId === userId);
}

export async function deleteSavedRecipeMock(recipeId: string): Promise<void> {
  await simulateDelay();
  mockStorage.savedRecipes.delete(recipeId);
}

// Helper
function simulateDelay(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
