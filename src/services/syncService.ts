import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  createInventoryItemMock,
  updateInventoryItemMock,
  deleteInventoryItemMock,
  getInventoryItemsByUserMock,
  createShoppingListMock,
  updateShoppingListMock,
  deleteShoppingListMock,
  getShoppingListsByUserMock,
  createSavedRecipeMock,
  deleteSavedRecipeMock,
  getSavedRecipesByUserMock,
} from './dynamoDBService';
import { InventoryItem, ShoppingList, SavedRecipe } from '@/types';

// Storage keys
const STORAGE_KEYS = {
  INVENTORY: '@shelflife_inventory',
  SHOPPING_LISTS: '@shelflife_shopping_lists',
  SAVED_RECIPES: '@shelflife_saved_recipes',
  SYNC_QUEUE: '@shelflife_sync_queue',
  LAST_SYNC: '@shelflife_last_sync',
};

// Sync operation types
type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';
type SyncEntityType = 'INVENTORY' | 'SHOPPING_LIST' | 'SAVED_RECIPE';

interface SyncOperation {
  id: string;
  type: SyncOperationType;
  entity: SyncEntityType;
  data: any;
  timestamp: string;
}

// ============ Local Storage Operations ============

export async function saveInventoryLocal(items: InventoryItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(items));
}

export async function loadInventoryLocal(): Promise<InventoryItem[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.INVENTORY);
  return data ? JSON.parse(data) : [];
}

export async function saveShoppingListsLocal(lists: ShoppingList[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SHOPPING_LISTS, JSON.stringify(lists));
}

export async function loadShoppingListsLocal(): Promise<ShoppingList[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.SHOPPING_LISTS);
  return data ? JSON.parse(data) : [];
}

export async function saveSavedRecipesLocal(recipes: SavedRecipe[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SAVED_RECIPES, JSON.stringify(recipes));
}

export async function loadSavedRecipesLocal(): Promise<SavedRecipe[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_RECIPES);
  return data ? JSON.parse(data) : [];
}

// ============ Sync Queue Management ============

async function getSyncQueue(): Promise<SyncOperation[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
  return data ? JSON.parse(data) : [];
}

async function saveSyncQueue(queue: SyncOperation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
}

export async function addToSyncQueue(operation: Omit<SyncOperation, 'id' | 'timestamp'>): Promise<void> {
  const queue = await getSyncQueue();

  // Remove any existing operations for the same entity and data id
  const filteredQueue = queue.filter(
    (op) => !(op.entity === operation.entity && op.data?.id === operation.data?.id)
  );

  // Add new operation
  filteredQueue.push({
    ...operation,
    id: Math.random().toString(36).substring(2, 15),
    timestamp: new Date().toISOString(),
  });

  await saveSyncQueue(filteredQueue);
}

export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
}

// ============ Network Status ============

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

// ============ Sync Operations ============

export async function processSyncQueue(userId: string): Promise<{ success: number; failed: number }> {
  const online = await isOnline();
  if (!online) {
    return { success: 0, failed: 0 };
  }

  const queue = await getSyncQueue();
  let success = 0;
  let failed = 0;
  const remainingQueue: SyncOperation[] = [];

  for (const operation of queue) {
    try {
      await processOperation(operation, userId);
      success++;
    } catch (error) {
      console.error('Sync operation failed:', error);
      remainingQueue.push(operation);
      failed++;
    }
  }

  await saveSyncQueue(remainingQueue);
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

  return { success, failed };
}

async function processOperation(operation: SyncOperation, userId: string): Promise<void> {
  switch (operation.entity) {
    case 'INVENTORY':
      await processInventoryOperation(operation);
      break;
    case 'SHOPPING_LIST':
      await processShoppingListOperation(operation);
      break;
    case 'SAVED_RECIPE':
      await processSavedRecipeOperation(operation);
      break;
  }
}

async function processInventoryOperation(operation: SyncOperation): Promise<void> {
  switch (operation.type) {
    case 'CREATE':
      await createInventoryItemMock(operation.data);
      break;
    case 'UPDATE':
      await updateInventoryItemMock(operation.data.id, operation.data);
      break;
    case 'DELETE':
      await deleteInventoryItemMock(operation.data.id);
      break;
  }
}

async function processShoppingListOperation(operation: SyncOperation): Promise<void> {
  switch (operation.type) {
    case 'CREATE':
      await createShoppingListMock(operation.data);
      break;
    case 'UPDATE':
      await updateShoppingListMock(operation.data.id, operation.data);
      break;
    case 'DELETE':
      await deleteShoppingListMock(operation.data.id);
      break;
  }
}

async function processSavedRecipeOperation(operation: SyncOperation): Promise<void> {
  switch (operation.type) {
    case 'CREATE':
      await createSavedRecipeMock(operation.data);
      break;
    case 'DELETE':
      await deleteSavedRecipeMock(operation.data.id);
      break;
  }
}

// ============ Full Sync (Pull from Server) ============

export async function fullSync(userId: string): Promise<{
  inventory: InventoryItem[];
  shoppingLists: ShoppingList[];
  savedRecipes: SavedRecipe[];
}> {
  const online = await isOnline();

  if (!online) {
    // Return local data if offline
    return {
      inventory: await loadInventoryLocal(),
      shoppingLists: await loadShoppingListsLocal(),
      savedRecipes: await loadSavedRecipesLocal(),
    };
  }

  try {
    // First, push any pending changes
    await processSyncQueue(userId);

    // Then pull from server
    const [inventory, shoppingLists, savedRecipes] = await Promise.all([
      getInventoryItemsByUserMock(userId),
      getShoppingListsByUserMock(userId),
      getSavedRecipesByUserMock(userId),
    ]);

    // Save to local storage
    await Promise.all([
      saveInventoryLocal(inventory),
      saveShoppingListsLocal(shoppingLists),
      saveSavedRecipesLocal(savedRecipes),
    ]);

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

    return { inventory, shoppingLists, savedRecipes };
  } catch (error) {
    console.error('Full sync failed:', error);
    // Fall back to local data
    return {
      inventory: await loadInventoryLocal(),
      shoppingLists: await loadShoppingListsLocal(),
      savedRecipes: await loadSavedRecipesLocal(),
    };
  }
}

// ============ Last Sync Time ============

export async function getLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
}

// ============ Clear All Local Data ============

export async function clearAllLocalData(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.INVENTORY),
    AsyncStorage.removeItem(STORAGE_KEYS.SHOPPING_LISTS),
    AsyncStorage.removeItem(STORAGE_KEYS.SAVED_RECIPES),
    AsyncStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE),
    AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
  ]);
}
