# Spoonacular API Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock recipe data with real Spoonacular API calls routed through API Gateway + Lambda, with on-device caching.

**Architecture:** CDK stack deploys API Gateway + single Lambda proxy. Lambda holds the API key and forwards requests to Spoonacular. App's spoonacularService calls our API Gateway instead of Spoonacular directly. AsyncStorage caches responses with TTL.

**Tech Stack:** AWS CDK (TypeScript), Lambda (Node.js 20.x), API Gateway REST, AsyncStorage for caching

---

## File Map

### New Files (Backend)
- `backend/package.json` — CDK + Lambda dependencies
- `backend/tsconfig.json` — TypeScript config
- `backend/cdk.json` — CDK app config
- `backend/bin/shelflife-backend.ts` — CDK app entry point
- `backend/lib/shelflife-stack.ts` — Stack: API Gateway + Lambda
- `backend/lambda/spoonacular.ts` — Lambda proxy handler

### New Files (App)
- `src/services/recipeCacheService.ts` — AsyncStorage cache with TTL

### Modified Files (App)
- `src/services/spoonacularService.ts` — Route through API Gateway + cache, keep mocks as fallback
- `src/screens/RecipesScreen.tsx` — Switch from mock to real functions
- `src/screens/RecipeDetailScreen.tsx` — Switch from mock to real function

---

### Task 1: CDK Project Scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/cdk.json`

- [ ] **Step 1: Create backend/package.json**

```json
{
  "name": "shelflife-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "cdk": "cdk",
    "deploy": "cdk deploy",
    "synth": "cdk synth"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.170.0",
    "constructs": "^10.4.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "~5.7.0",
    "aws-cdk": "^2.170.0"
  }
}
```

- [ ] **Step 2: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "outDir": "dist",
    "rootDir": ".",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["bin/**/*.ts", "lib/**/*.ts", "lambda/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create backend/cdk.json**

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/shelflife-backend.ts",
  "watch": {
    "include": ["**"],
    "exclude": ["node_modules", "dist", "cdk.out"]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true
  }
}
```

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npm install`
Expected: `node_modules` created, no errors

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/cdk.json backend/package-lock.json
git commit -m "chore: scaffold CDK backend project (#7)"
```

---

### Task 2: CDK Stack Definition

**Files:**
- Create: `backend/bin/shelflife-backend.ts`
- Create: `backend/lib/shelflife-stack.ts`

- [ ] **Step 1: Create backend/bin/shelflife-backend.ts**

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ShelfLifeStack } from '../lib/shelflife-stack';

const app = new cdk.App();

new ShelfLifeStack(app, 'ShelfLifeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-1',
  },
});
```

- [ ] **Step 2: Create backend/lib/shelflife-stack.ts**

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';

export class ShelfLifeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const spoonacularApiKey = this.node.tryGetContext('spoonacularApiKey');
    if (!spoonacularApiKey) {
      throw new Error(
        'Missing spoonacularApiKey context. Deploy with: cdk deploy --context spoonacularApiKey=YOUR_KEY'
      );
    }

    // Lambda function
    const spoonacularProxy = new lambda.Function(this, 'SpoonacularProxy', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'spoonacular.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        SPOONACULAR_API_KEY: spoonacularApiKey,
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'ShelfLifeApi', {
      restApiName: 'ShelfLife API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(spoonacularProxy);

    // Routes
    const recipes = api.root.addResource('recipes');

    // GET /recipes/search
    const search = recipes.addResource('search');
    search.addMethod('GET', lambdaIntegration);

    // GET /recipes/findByIngredients
    const findByIngredients = recipes.addResource('findByIngredients');
    findByIngredients.addMethod('GET', lambdaIntegration);

    // GET /recipes/{id}
    const recipeById = recipes.addResource('{id}');
    recipeById.addMethod('GET', lambdaIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL — set as EXPO_PUBLIC_API_GATEWAY_URL',
    });
  }
}
```

- [ ] **Step 3: Verify CDK synth works**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx cdk synth --context spoonacularApiKey=test 2>&1 | head -5`
Expected: Output starts with YAML template (no errors)

- [ ] **Step 4: Commit**

```bash
git add backend/bin/shelflife-backend.ts backend/lib/shelflife-stack.ts
git commit -m "feat: add CDK stack with API Gateway + Lambda for Spoonacular proxy (#7)"
```

---

### Task 3: Lambda Handler

**Files:**
- Create: `backend/lambda/spoonacular.ts`

- [ ] **Step 1: Create the Lambda handler**

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function buildResponse(statusCode: number, body: string): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return buildResponse(500, JSON.stringify({ error: 'Server configuration error' }));
  }

  const path = event.resource;
  const queryParams = event.queryStringParameters || {};
  const pathParams = event.pathParameters || {};

  let spoonacularUrl: string;

  switch (path) {
    case '/recipes/search': {
      const params = new URLSearchParams({ ...queryParams, apiKey });
      spoonacularUrl = `${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params}`;
      break;
    }
    case '/recipes/findByIngredients': {
      const params = new URLSearchParams({ ...queryParams, apiKey });
      spoonacularUrl = `${SPOONACULAR_BASE_URL}/recipes/findByIngredients?${params}`;
      break;
    }
    case '/recipes/{id}': {
      const recipeId = pathParams.id;
      if (!recipeId) {
        return buildResponse(400, JSON.stringify({ error: 'Missing recipe ID' }));
      }
      const params = new URLSearchParams({ apiKey });
      spoonacularUrl = `${SPOONACULAR_BASE_URL}/recipes/${recipeId}/information?${params}`;
      break;
    }
    default:
      return buildResponse(400, JSON.stringify({ error: 'Unknown route' }));
  }

  try {
    const response = await fetch(spoonacularUrl);
    const data = await response.text();

    if (!response.ok) {
      return buildResponse(502, JSON.stringify({
        error: 'Spoonacular API error',
        status: response.status,
      }));
    }

    return buildResponse(200, data);
  } catch (error) {
    return buildResponse(502, JSON.stringify({ error: 'Failed to reach Spoonacular API' }));
  }
}
```

- [ ] **Step 2: Add @types/aws-lambda to backend**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npm install --save-dev @types/aws-lambda`

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/lambda/spoonacular.ts backend/package.json backend/package-lock.json
git commit -m "feat: add Lambda handler for Spoonacular API proxy (#7)"
```

---

### Task 4: Recipe Cache Service

**Files:**
- Create: `src/services/recipeCacheService.ts`

- [ ] **Step 1: Create the cache service**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@shelflife_recipe_cache_';
const CACHE_INDEX_KEY = '@shelflife_recipe_cache_index';
const MAX_CACHE_ENTRIES = 50;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheIndexEntry {
  key: string;
  createdAt: number;
}

function hashParams(params: Record<string, string | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildCacheKey(endpoint: string, params: Record<string, string | undefined>): string {
  return `${CACHE_PREFIX}${endpoint}_${hashParams(params)}`;
}

async function getCacheIndex(): Promise<CacheIndexEntry[]> {
  const stored = await AsyncStorage.getItem(CACHE_INDEX_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function evictOldest(): Promise<void> {
  const index = await getCacheIndex();
  if (index.length <= MAX_CACHE_ENTRIES) return;

  // Sort by createdAt ascending (oldest first)
  index.sort((a, b) => a.createdAt - b.createdAt);

  const toRemove = index.splice(0, index.length - MAX_CACHE_ENTRIES);
  await Promise.all(toRemove.map((entry) => AsyncStorage.removeItem(entry.key)));
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

export async function getCached<T>(
  endpoint: string,
  params: Record<string, string | undefined>
): Promise<T | null> {
  const key = buildCacheKey(endpoint, params);

  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  endpoint: string,
  params: Record<string, string | undefined>,
  data: T,
  ttlMs: number
): Promise<void> {
  const key = buildCacheKey(endpoint, params);

  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));

    // Update index
    const index = await getCacheIndex();
    const existing = index.findIndex((e) => e.key === key);
    if (existing >= 0) {
      index[existing].createdAt = Date.now();
    } else {
      index.push({ key, createdAt: Date.now() });
    }
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));

    await evictOldest();
  } catch {
    // Cache write failure is non-critical
  }
}

// TTL constants
export const SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour
export const DETAIL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
```

- [ ] **Step 2: Commit**

```bash
git add src/services/recipeCacheService.ts
git commit -m "feat: add recipe cache service with TTL and eviction (#7)"
```

---

### Task 5: Update Spoonacular Service

**Files:**
- Modify: `src/services/spoonacularService.ts`

- [ ] **Step 1: Update spoonacularService to use API Gateway + caching**

Replace lines 1-5 (the imports and constants) with:

```typescript
import { Recipe, RecipeDetail, RecipeIngredient } from '@/types';
import {
  getCached,
  setCache,
  SEARCH_CACHE_TTL,
  DETAIL_CACHE_TTL,
} from '@/services/recipeCacheService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_GATEWAY_URL || '';
```

Replace the `searchRecipes` function (lines 70-90) with:

```typescript
export async function searchRecipes(params: SearchRecipesParams): Promise<SpoonacularSearchResult> {
  if (!API_BASE_URL) {
    // Fallback to mock for development without backend
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

  // Check cache
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
```

Replace the `findRecipesByIngredients` function (lines 95-128) with:

```typescript
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
```

Replace the `getRecipeDetails` function (lines 133-145) with:

```typescript
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
```

Remove the `getRandomRecipes` function (lines 150-168) — it's not used anywhere and not proxied.

Remove the old direct-to-Spoonacular `SPOONACULAR_API_KEY` constant (the old line 3). The API key is now only in the Lambda.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`
Expected: No errors (screens still import mocks, which still exist)

- [ ] **Step 3: Commit**

```bash
git add src/services/spoonacularService.ts
git commit -m "feat: route Spoonacular calls through API Gateway with caching (#7)"
```

---

### Task 6: Update RecipesScreen

**Files:**
- Modify: `src/screens/RecipesScreen.tsx`

- [ ] **Step 1: Switch from mock to real functions**

In `src/screens/RecipesScreen.tsx`, replace the import (lines 17-22):

```typescript
import {
  searchRecipes,
  findRecipesByIngredients,
  DIETARY_RESTRICTIONS,
  CUISINE_TYPES,
} from '@/services/spoonacularService';
```

Replace `handleSearch` (lines 47-59):

```typescript
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const result = await searchRecipes({
        query: searchQuery,
        diet: selectedDiet || undefined,
        cuisine: selectedCuisine || undefined,
        number: 10,
      });
      setSearchResults(result.results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedDiet, selectedCuisine, setLoading, setSearchResults]);
```

Replace `handleFindByIngredients` (lines 69-82):

```typescript
  const handleFindByIngredients = useCallback(async () => {
    const ingredientNames = items.map((item) => item.name);
    if (ingredientNames.length === 0) return;

    setLoading(true);
    try {
      const results = await findRecipesByIngredients(ingredientNames, 10);
      setMatchedRecipes(results);
    } catch (error) {
      console.error('Match error:', error);
    } finally {
      setLoading(false);
    }
  }, [items, setLoading, setMatchedRecipes]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/screens/RecipesScreen.tsx
git commit -m "feat: switch RecipesScreen to real Spoonacular API calls (#7)"
```

---

### Task 7: Update RecipeDetailScreen

**Files:**
- Modify: `src/screens/RecipeDetailScreen.tsx`

- [ ] **Step 1: Switch from mock to real function**

In `src/screens/RecipeDetailScreen.tsx`, replace line 14:

```typescript
import { getRecipeDetails } from '@/services/spoonacularService';
```

Replace the `loadRecipeDetails` function (lines 37-47):

```typescript
  const loadRecipeDetails = async () => {
    setIsLoading(true);
    try {
      const details = await getRecipeDetails(recipeId);
      setRecipe(details);
    } catch (error) {
      Alert.alert('Error', 'Failed to load recipe details');
    } finally {
      setIsLoading(false);
    }
  };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/screens/RecipeDetailScreen.tsx
git commit -m "feat: switch RecipeDetailScreen to real Spoonacular API calls (#7)"
```

---

### Task 8: Verification and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Backend TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify Expo bundler works**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx expo export --platform ios --output-dir /tmp/shelflife-export-test-2 2>&1 | tail -5`
Expected: Exported successfully

- [ ] **Step 4: Add backend to .gitignore**

Add to root `.gitignore`:

```
# CDK
backend/cdk.out/
backend/dist/
backend/node_modules/
```

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add .gitignore
git commit -m "chore: add backend build artifacts to gitignore (#7)"
```

---

## Deployment Instructions (Not a Task — Reference)

After implementation, deploy the backend:

```bash
cd backend
npm install
npx cdk bootstrap  # first time only
npx cdk deploy --context spoonacularApiKey=dc1242dd7bad4c2196837c722052e15b
```

The deploy output will show the API Gateway URL. Set it in the app:

```bash
# In .env or environment config
EXPO_PUBLIC_API_GATEWAY_URL=https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod
```

Without the env var set, the app falls back to mock data automatically.
