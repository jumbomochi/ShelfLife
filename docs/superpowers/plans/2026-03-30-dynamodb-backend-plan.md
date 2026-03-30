# DynamoDB Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock storage with real AWS DynamoDB persistence via API Gateway + Lambda CRUD proxy, extending the existing CDK stack.

**Architecture:** Add 5 DynamoDB tables and a CRUD Lambda to the existing CDK stack. The Lambda handles all entity operations via route-based dispatch. The app's dynamoDBService switches from direct SDK calls to fetch calls against API Gateway. The syncService swaps mock imports for real imports. Mock fallback preserved when API_BASE_URL is not set.

**Tech Stack:** AWS CDK, DynamoDB, Lambda (Node.js 20.x), API Gateway REST, AWS SDK v3

---

## File Map

### New Files
- `backend/lambda/dynamodb-crud.ts` — CRUD Lambda handler for all 5 entities

### Modified Files (Backend)
- `backend/lib/shelflife-stack.ts` — Add DynamoDB tables, CRUD Lambda, API routes

### Modified Files (App)
- `src/services/dynamoDBService.ts` — Replace direct SDK with API Gateway fetch + mock fallback
- `src/services/syncService.ts` — Swap mock imports for real imports

---

### Task 1: Add DynamoDB Tables to CDK Stack

**Files:**
- Modify: `backend/lib/shelflife-stack.ts`

- [ ] **Step 1: Add DynamoDB table imports and table definitions**

In `backend/lib/shelflife-stack.ts`, add the dynamodb import at the top (after the existing imports):

```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
```

Then add the 5 tables inside the constructor, after the existing `spoonacularProxy` Lambda definition (after line 28). Add before the API Gateway section:

```typescript
    // ============ DynamoDB Tables ============

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'ShelfLife-Users',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const householdsTable = new dynamodb.Table(this, 'HouseholdsTable', {
      tableName: 'ShelfLife-Households',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    householdsTable.addGlobalSecondaryIndex({
      indexName: 'inviteCode-index',
      partitionKey: { name: 'inviteCode', type: dynamodb.AttributeType.STRING },
    });

    const inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      tableName: 'ShelfLife-Inventory',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    inventoryTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });
    inventoryTable.addGlobalSecondaryIndex({
      indexName: 'householdId-index',
      partitionKey: { name: 'householdId', type: dynamodb.AttributeType.STRING },
    });

    const shoppingListsTable = new dynamodb.Table(this, 'ShoppingListsTable', {
      tableName: 'ShelfLife-ShoppingLists',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    shoppingListsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });
    shoppingListsTable.addGlobalSecondaryIndex({
      indexName: 'householdId-index',
      partitionKey: { name: 'householdId', type: dynamodb.AttributeType.STRING },
    });

    const savedRecipesTable = new dynamodb.Table(this, 'SavedRecipesTable', {
      tableName: 'ShelfLife-SavedRecipes',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    savedRecipesTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });
```

- [ ] **Step 2: Add CRUD Lambda and grant table access**

After the table definitions, add the CRUD Lambda:

```typescript
    // ============ DynamoDB CRUD Lambda ============

    const dynamodbCrud = new lambda.Function(this, 'DynamoDBCrud', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'dynamodb-crud.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        USERS_TABLE: usersTable.tableName,
        HOUSEHOLDS_TABLE: householdsTable.tableName,
        INVENTORY_TABLE: inventoryTable.tableName,
        SHOPPING_LISTS_TABLE: shoppingListsTable.tableName,
        SAVED_RECIPES_TABLE: savedRecipesTable.tableName,
      },
    });

    usersTable.grantReadWriteData(dynamodbCrud);
    householdsTable.grantReadWriteData(dynamodbCrud);
    inventoryTable.grantReadWriteData(dynamodbCrud);
    shoppingListsTable.grantReadWriteData(dynamodbCrud);
    savedRecipesTable.grantReadWriteData(dynamodbCrud);
```

- [ ] **Step 3: Add API Gateway routes for all entities**

After the CRUD Lambda, add routes. Insert these before the existing `CfnOutput`:

```typescript
    const crudIntegration = new apigateway.LambdaIntegration(dynamodbCrud);

    // --- Users ---
    const users = api.root.addResource('users');
    users.addMethod('POST', crudIntegration);
    const userById = users.addResource('{id}');
    userById.addMethod('GET', crudIntegration);
    userById.addMethod('PUT', crudIntegration);

    // --- Inventory ---
    const inventory = api.root.addResource('inventory');
    inventory.addMethod('POST', crudIntegration);
    inventory.addMethod('GET', crudIntegration);
    const inventoryById = inventory.addResource('{id}');
    inventoryById.addMethod('PUT', crudIntegration);
    inventoryById.addMethod('DELETE', crudIntegration);
    const inventoryHousehold = inventory.addResource('household');
    const inventoryByHousehold = inventoryHousehold.addResource('{householdId}');
    inventoryByHousehold.addMethod('GET', crudIntegration);

    // --- Shopping Lists ---
    const shoppingLists = api.root.addResource('shopping-lists');
    shoppingLists.addMethod('POST', crudIntegration);
    shoppingLists.addMethod('GET', crudIntegration);
    const shoppingListById = shoppingLists.addResource('{id}');
    shoppingListById.addMethod('PUT', crudIntegration);
    shoppingListById.addMethod('DELETE', crudIntegration);
    const shoppingListHousehold = shoppingLists.addResource('household');
    const shoppingListByHousehold = shoppingListHousehold.addResource('{householdId}');
    shoppingListByHousehold.addMethod('GET', crudIntegration);

    // --- Saved Recipes ---
    const savedRecipes = api.root.addResource('saved-recipes');
    savedRecipes.addMethod('POST', crudIntegration);
    savedRecipes.addMethod('GET', crudIntegration);
    const savedRecipeById = savedRecipes.addResource('{id}');
    savedRecipeById.addMethod('DELETE', crudIntegration);

    // --- Households ---
    const households = api.root.addResource('households');
    households.addMethod('POST', crudIntegration);
    const householdById = households.addResource('{id}');
    householdById.addMethod('GET', crudIntegration);
    householdById.addMethod('PUT', crudIntegration);
    const householdInvite = households.addResource('invite');
    const householdByInvite = householdInvite.addResource('{code}');
    householdByInvite.addMethod('GET', crudIntegration);
```

- [ ] **Step 4: Verify CDK synth**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | head -5`
Expected: YAML template output (no errors)

- [ ] **Step 5: Commit**

```bash
git add backend/lib/shelflife-stack.ts
git commit -m "feat: add DynamoDB tables and CRUD Lambda to CDK stack (#3)"
```

---

### Task 2: CRUD Lambda Handler

**Files:**
- Create: `backend/lambda/dynamodb-crud.ts`

- [ ] **Step 1: Create the CRUD Lambda handler**

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({});

const TABLES = {
  USERS: process.env.USERS_TABLE!,
  HOUSEHOLDS: process.env.HOUSEHOLDS_TABLE!,
  INVENTORY: process.env.INVENTORY_TABLE!,
  SHOPPING_LISTS: process.env.SHOPPING_LISTS_TABLE!,
  SAVED_RECIPES: process.env.SAVED_RECIPES_TABLE!,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function respond(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

// --- Generic DynamoDB helpers ---

async function putItem(table: string, item: Record<string, unknown>): Promise<void> {
  await client.send(new PutItemCommand({
    TableName: table,
    Item: marshall(item, { removeUndefinedValues: true }),
  }));
}

async function getItem(table: string, key: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const result = await client.send(new GetItemCommand({
    TableName: table,
    Key: marshall(key),
  }));
  return result.Item ? unmarshall(result.Item) : null;
}

async function queryByIndex(
  table: string,
  indexName: string,
  keyField: string,
  keyValue: string
): Promise<Record<string, unknown>[]> {
  const result = await client.send(new QueryCommand({
    TableName: table,
    IndexName: indexName,
    KeyConditionExpression: `${keyField} = :val`,
    ExpressionAttributeValues: marshall({ ':val': keyValue }),
  }));
  return (result.Items || []).map((item) => unmarshall(item));
}

async function deleteItemByKey(table: string, key: Record<string, unknown>): Promise<void> {
  await client.send(new DeleteItemCommand({
    TableName: table,
    Key: marshall(key),
  }));
}

async function updateItem(
  table: string,
  key: Record<string, unknown>,
  updates: Record<string, unknown>
): Promise<void> {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  Object.entries(updates).forEach(([field, value], i) => {
    if (value !== undefined) {
      expressions.push(`#f${i} = :v${i}`);
      names[`#f${i}`] = field;
      values[`:v${i}`] = value;
    }
  });

  if (expressions.length === 0) return;

  await client.send(new UpdateItemCommand({
    TableName: table,
    Key: marshall(key),
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: marshall(values),
  }));
}

// --- Route handler ---

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;
  const pathParams = event.pathParameters || {};
  const queryParams = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : null;

  try {
    // --- Users ---
    if (resource === '/users' && method === 'POST') {
      await putItem(TABLES.USERS, body);
      return respond(201, { message: 'User created' });
    }
    if (resource === '/users/{id}' && method === 'GET') {
      const item = await getItem(TABLES.USERS, { id: pathParams.id });
      return item ? respond(200, item) : respond(404, { error: 'User not found' });
    }
    if (resource === '/users/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.USERS, { id: pathParams.id }, updates);
      return respond(200, { message: 'User updated' });
    }

    // --- Inventory ---
    if (resource === '/inventory' && method === 'POST') {
      await putItem(TABLES.INVENTORY, body);
      return respond(201, { message: 'Item created' });
    }
    if (resource === '/inventory' && method === 'GET') {
      const userId = queryParams.userId;
      if (!userId) return respond(400, { error: 'Missing userId query param' });
      const items = await queryByIndex(TABLES.INVENTORY, 'userId-index', 'userId', userId);
      return respond(200, items);
    }
    if (resource === '/inventory/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.INVENTORY, { id: pathParams.id }, updates);
      return respond(200, { message: 'Item updated' });
    }
    if (resource === '/inventory/{id}' && method === 'DELETE') {
      await deleteItemByKey(TABLES.INVENTORY, { id: pathParams.id });
      return respond(200, { message: 'Item deleted' });
    }
    if (resource === '/inventory/household/{householdId}' && method === 'GET') {
      const items = await queryByIndex(TABLES.INVENTORY, 'householdId-index', 'householdId', pathParams.householdId!);
      return respond(200, items);
    }

    // --- Shopping Lists ---
    if (resource === '/shopping-lists' && method === 'POST') {
      await putItem(TABLES.SHOPPING_LISTS, body);
      return respond(201, { message: 'List created' });
    }
    if (resource === '/shopping-lists' && method === 'GET') {
      const userId = queryParams.userId;
      if (!userId) return respond(400, { error: 'Missing userId query param' });
      const lists = await queryByIndex(TABLES.SHOPPING_LISTS, 'userId-index', 'userId', userId);
      return respond(200, lists);
    }
    if (resource === '/shopping-lists/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.SHOPPING_LISTS, { id: pathParams.id }, updates);
      return respond(200, { message: 'List updated' });
    }
    if (resource === '/shopping-lists/{id}' && method === 'DELETE') {
      await deleteItemByKey(TABLES.SHOPPING_LISTS, { id: pathParams.id });
      return respond(200, { message: 'List deleted' });
    }
    if (resource === '/shopping-lists/household/{householdId}' && method === 'GET') {
      const lists = await queryByIndex(TABLES.SHOPPING_LISTS, 'householdId-index', 'householdId', pathParams.householdId!);
      return respond(200, lists);
    }

    // --- Saved Recipes ---
    if (resource === '/saved-recipes' && method === 'POST') {
      await putItem(TABLES.SAVED_RECIPES, body);
      return respond(201, { message: 'Recipe saved' });
    }
    if (resource === '/saved-recipes' && method === 'GET') {
      const userId = queryParams.userId;
      if (!userId) return respond(400, { error: 'Missing userId query param' });
      const recipes = await queryByIndex(TABLES.SAVED_RECIPES, 'userId-index', 'userId', userId);
      return respond(200, recipes);
    }
    if (resource === '/saved-recipes/{id}' && method === 'DELETE') {
      await deleteItemByKey(TABLES.SAVED_RECIPES, { id: pathParams.id });
      return respond(200, { message: 'Recipe deleted' });
    }

    // --- Households ---
    if (resource === '/households' && method === 'POST') {
      await putItem(TABLES.HOUSEHOLDS, body);
      return respond(201, { message: 'Household created' });
    }
    if (resource === '/households/{id}' && method === 'GET') {
      const item = await getItem(TABLES.HOUSEHOLDS, { id: pathParams.id });
      return item ? respond(200, item) : respond(404, { error: 'Household not found' });
    }
    if (resource === '/households/{id}' && method === 'PUT') {
      const { id, ...updates } = body;
      await updateItem(TABLES.HOUSEHOLDS, { id: pathParams.id }, updates);
      return respond(200, { message: 'Household updated' });
    }
    if (resource === '/households/invite/{code}' && method === 'GET') {
      const households = await queryByIndex(TABLES.HOUSEHOLDS, 'inviteCode-index', 'inviteCode', pathParams.code!);
      return households.length > 0 ? respond(200, households[0]) : respond(404, { error: 'Household not found' });
    }

    return respond(400, { error: 'Unknown route', resource, method });
  } catch (error: any) {
    console.error('DynamoDB CRUD error:', error);
    return respond(500, { error: 'Internal server error', message: error.message });
  }
}
```

- [ ] **Step 2: Add AWS SDK dependencies to backend**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb`

- [ ] **Step 3: Verify backend TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/lambda/dynamodb-crud.ts backend/package.json backend/package-lock.json
git commit -m "feat: add DynamoDB CRUD Lambda handler (#3)"
```

---

### Task 3: Replace dynamoDBService with API Gateway Fetch

**Files:**
- Modify: `src/services/dynamoDBService.ts`

- [ ] **Step 1: Replace the entire file**

Replace `/Users/huiliang/GitHub/ShelfLife/src/services/dynamoDBService.ts` with the API Gateway fetch version. Remove all AWS SDK imports and direct client code (lines 1-76). Replace real functions with fetch calls. Keep all mock functions and mock storage intact.

Replace lines 1-76 (everything before the User Operations section through the generic helpers) with:

```typescript
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
```

Replace the User Operations section (lines 78-112) with:

```typescript
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
```

Replace the Inventory Operations section (lines 114-174) with:

```typescript
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
```

Replace the Shopping List Operations section (lines 176-236) with:

```typescript
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
```

Replace the Saved Recipes Operations section (lines 238-255) with:

```typescript
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
```

Replace the Household Operations section (lines 257-304) with:

```typescript
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
```

Keep the entire Mock Functions section (lines 306-421) completely unchanged.

- [ ] **Step 2: Verify app TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/dynamoDBService.ts
git commit -m "feat: replace direct DynamoDB calls with API Gateway fetch (#3)"
```

---

### Task 4: Swap syncService from Mocks to Real Functions

**Files:**
- Modify: `src/services/syncService.ts`

- [ ] **Step 1: Replace mock imports with real imports**

In `src/services/syncService.ts`, replace lines 3-15 (the mock imports) with:

```typescript
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryItemsByUser,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  getShoppingListsByUser,
  createSavedRecipe,
  deleteSavedRecipe,
  getSavedRecipesByUser,
} from './dynamoDBService';
```

- [ ] **Step 2: Replace mock calls in processInventoryOperation**

Replace lines 152-164 with:

```typescript
async function processInventoryOperation(operation: SyncOperation): Promise<void> {
  switch (operation.type) {
    case 'CREATE':
      await createInventoryItem(operation.data);
      break;
    case 'UPDATE':
      await updateInventoryItem(operation.data.id, operation.data.userId, operation.data);
      break;
    case 'DELETE':
      await deleteInventoryItem(operation.data.id, operation.data.userId || '');
      break;
  }
}
```

- [ ] **Step 3: Replace mock calls in processShoppingListOperation**

Replace lines 166-178 with:

```typescript
async function processShoppingListOperation(operation: SyncOperation): Promise<void> {
  switch (operation.type) {
    case 'CREATE':
      await createShoppingList(operation.data);
      break;
    case 'UPDATE':
      await updateShoppingList(operation.data.id, operation.data.userId, operation.data);
      break;
    case 'DELETE':
      await deleteShoppingList(operation.data.id, operation.data.userId || '');
      break;
  }
}
```

- [ ] **Step 4: Replace mock calls in processSavedRecipeOperation**

Replace lines 180-189 with:

```typescript
async function processSavedRecipeOperation(operation: SyncOperation): Promise<void> {
  switch (operation.type) {
    case 'CREATE':
      await createSavedRecipe(operation.data);
      break;
    case 'DELETE':
      await deleteSavedRecipe(operation.data.id, operation.data.userId || '');
      break;
  }
}
```

- [ ] **Step 5: Replace mock calls in fullSync**

Replace lines 214-218 with:

```typescript
    const [inventory, shoppingLists, savedRecipes] = await Promise.all([
      getInventoryItemsByUser(userId),
      getShoppingListsByUser(userId),
      getSavedRecipesByUser(userId),
    ]);
```

- [ ] **Step 6: Verify app TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/services/syncService.ts
git commit -m "feat: swap syncService from mock to real API calls (#3)"
```

---

### Task 5: Verification and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full app TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Backend TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify CDK synth with all resources**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | grep -c "AWS::"`
Expected: A count of AWS resources (should be > 20 including tables, Lambda, API Gateway)

- [ ] **Step 4: Verify Expo bundler**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx expo export --platform ios --output-dir /tmp/shelflife-export-test-3 2>&1 | tail -3`
Expected: Exported successfully

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any remaining type errors for DynamoDB integration (#3)"
```
