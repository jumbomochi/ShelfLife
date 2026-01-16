import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { InventoryItem, ShoppingList, SavedRecipe, User, Household } from '@/types';

// AWS Configuration
const AWS_REGION = process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '';

// Table names
const TABLES = {
  USERS: process.env.EXPO_PUBLIC_DYNAMODB_USERS_TABLE || 'ShelfLife-Users',
  INVENTORY: process.env.EXPO_PUBLIC_DYNAMODB_INVENTORY_TABLE || 'ShelfLife-Inventory',
  SHOPPING_LISTS: process.env.EXPO_PUBLIC_DYNAMODB_SHOPPING_TABLE || 'ShelfLife-ShoppingLists',
  SAVED_RECIPES: process.env.EXPO_PUBLIC_DYNAMODB_RECIPES_TABLE || 'ShelfLife-SavedRecipes',
  HOUSEHOLDS: process.env.EXPO_PUBLIC_DYNAMODB_HOUSEHOLDS_TABLE || 'ShelfLife-Households',
};

const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// ============ Generic Helpers ============

async function putItem<T extends Record<string, any>>(tableName: string, item: T): Promise<void> {
  const command = new PutItemCommand({
    TableName: tableName,
    Item: marshall(item, { removeUndefinedValues: true }),
  });
  await dynamoClient.send(command);
}

async function getItem<T>(tableName: string, key: Record<string, any>): Promise<T | null> {
  const command = new GetItemCommand({
    TableName: tableName,
    Key: marshall(key),
  });
  const response = await dynamoClient.send(command);
  return response.Item ? (unmarshall(response.Item) as T) : null;
}

async function queryItems<T>(
  tableName: string,
  keyCondition: string,
  expressionValues: Record<string, any>,
  indexName?: string
): Promise<T[]> {
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: marshall(expressionValues),
  });
  const response = await dynamoClient.send(command);
  return (response.Items || []).map((item) => unmarshall(item) as T);
}

async function deleteItem(tableName: string, key: Record<string, any>): Promise<void> {
  const command = new DeleteItemCommand({
    TableName: tableName,
    Key: marshall(key),
  });
  await dynamoClient.send(command);
}

// ============ User Operations ============

export async function createUser(user: User): Promise<void> {
  await putItem(TABLES.USERS, user);
}

export async function getUser(userId: string): Promise<User | null> {
  return getItem<User>(TABLES.USERS, { id: userId });
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  const updateExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    if (value !== undefined && key !== 'id') {
      updateExpressions.push(`#field${index} = :value${index}`);
      expressionNames[`#field${index}`] = key;
      expressionValues[`:value${index}`] = value;
    }
  });

  if (updateExpressions.length === 0) return;

  const command = new UpdateItemCommand({
    TableName: TABLES.USERS,
    Key: marshall({ id: userId }),
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: marshall(expressionValues),
  });

  await dynamoClient.send(command);
}

// ============ Inventory Operations ============

export async function createInventoryItem(item: InventoryItem): Promise<void> {
  await putItem(TABLES.INVENTORY, item);
}

export async function getInventoryItem(itemId: string, userId: string): Promise<InventoryItem | null> {
  return getItem<InventoryItem>(TABLES.INVENTORY, { id: itemId, userId });
}

export async function getInventoryItemsByUser(userId: string): Promise<InventoryItem[]> {
  return queryItems<InventoryItem>(
    TABLES.INVENTORY,
    'userId = :userId',
    { ':userId': userId },
    'userId-index'
  );
}

export async function getInventoryItemsByHousehold(householdId: string): Promise<InventoryItem[]> {
  return queryItems<InventoryItem>(
    TABLES.INVENTORY,
    'householdId = :householdId',
    { ':householdId': householdId },
    'householdId-index'
  );
}

export async function updateInventoryItem(
  itemId: string,
  userId: string,
  updates: Partial<InventoryItem>
): Promise<void> {
  const updateExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    if (value !== undefined && key !== 'id' && key !== 'userId') {
      updateExpressions.push(`#field${index} = :value${index}`);
      expressionNames[`#field${index}`] = key;
      expressionValues[`:value${index}`] = value;
    }
  });

  if (updateExpressions.length === 0) return;

  const command = new UpdateItemCommand({
    TableName: TABLES.INVENTORY,
    Key: marshall({ id: itemId, userId }),
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: marshall(expressionValues),
  });

  await dynamoClient.send(command);
}

export async function deleteInventoryItem(itemId: string, userId: string): Promise<void> {
  await deleteItem(TABLES.INVENTORY, { id: itemId, userId });
}

// ============ Shopping List Operations ============

export async function createShoppingList(list: ShoppingList): Promise<void> {
  await putItem(TABLES.SHOPPING_LISTS, list);
}

export async function getShoppingList(listId: string, userId: string): Promise<ShoppingList | null> {
  return getItem<ShoppingList>(TABLES.SHOPPING_LISTS, { id: listId, userId });
}

export async function getShoppingListsByUser(userId: string): Promise<ShoppingList[]> {
  return queryItems<ShoppingList>(
    TABLES.SHOPPING_LISTS,
    'userId = :userId',
    { ':userId': userId },
    'userId-index'
  );
}

export async function getShoppingListsByHousehold(householdId: string): Promise<ShoppingList[]> {
  return queryItems<ShoppingList>(
    TABLES.SHOPPING_LISTS,
    'householdId = :householdId',
    { ':householdId': householdId },
    'householdId-index'
  );
}

export async function updateShoppingList(
  listId: string,
  userId: string,
  updates: Partial<ShoppingList>
): Promise<void> {
  const updateExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    if (value !== undefined && key !== 'id' && key !== 'userId') {
      updateExpressions.push(`#field${index} = :value${index}`);
      expressionNames[`#field${index}`] = key;
      expressionValues[`:value${index}`] = value;
    }
  });

  if (updateExpressions.length === 0) return;

  const command = new UpdateItemCommand({
    TableName: TABLES.SHOPPING_LISTS,
    Key: marshall({ id: listId, userId }),
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: marshall(expressionValues),
  });

  await dynamoClient.send(command);
}

export async function deleteShoppingList(listId: string, userId: string): Promise<void> {
  await deleteItem(TABLES.SHOPPING_LISTS, { id: listId, userId });
}

// ============ Saved Recipes Operations ============

export async function createSavedRecipe(recipe: SavedRecipe): Promise<void> {
  await putItem(TABLES.SAVED_RECIPES, recipe);
}

export async function getSavedRecipesByUser(userId: string): Promise<SavedRecipe[]> {
  return queryItems<SavedRecipe>(
    TABLES.SAVED_RECIPES,
    'userId = :userId',
    { ':userId': userId },
    'userId-index'
  );
}

export async function deleteSavedRecipe(recipeId: string, userId: string): Promise<void> {
  await deleteItem(TABLES.SAVED_RECIPES, { id: recipeId, userId });
}

// ============ Household Operations ============

export async function createHousehold(household: Household): Promise<void> {
  await putItem(TABLES.HOUSEHOLDS, household);
}

export async function getHousehold(householdId: string): Promise<Household | null> {
  return getItem<Household>(TABLES.HOUSEHOLDS, { id: householdId });
}

export async function getHouseholdByInviteCode(inviteCode: string): Promise<Household | null> {
  const results = await queryItems<Household>(
    TABLES.HOUSEHOLDS,
    'inviteCode = :inviteCode',
    { ':inviteCode': inviteCode },
    'inviteCode-index'
  );
  return results[0] || null;
}

export async function updateHousehold(
  householdId: string,
  updates: Partial<Household>
): Promise<void> {
  const updateExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    if (value !== undefined && key !== 'id') {
      updateExpressions.push(`#field${index} = :value${index}`);
      expressionNames[`#field${index}`] = key;
      expressionValues[`:value${index}`] = value;
    }
  });

  if (updateExpressions.length === 0) return;

  const command = new UpdateItemCommand({
    TableName: TABLES.HOUSEHOLDS,
    Key: marshall({ id: householdId }),
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: marshall(expressionValues),
  });

  await dynamoClient.send(command);
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
