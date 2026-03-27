# Spoonacular API Backend Integration Design Spec

**Date:** 2026-03-27
**Scope:** Issue #7 — Replace mock recipe data with real Spoonacular API via API Gateway + Lambda proxy
**Approach:** CDK infrastructure + single Lambda proxy + on-device caching

---

## Architecture

```
Mobile App → API Gateway (REST) → Lambda (SpoonacularProxy) → Spoonacular API
                                        ↑
                                  API key in env var
```

The Lambda is a thin proxy — no data transformation. The API key stays server-side. The app caches responses locally via AsyncStorage.

---

## CDK Infrastructure

### Directory Structure

```
backend/
  bin/shelflife-backend.ts     — CDK app entry point
  lib/shelflife-stack.ts       — Stack definition (API Gateway + Lambda)
  lambda/spoonacular.ts        — Lambda handler
  package.json                 — CDK + AWS Lambda dependencies
  tsconfig.json                — TypeScript config for backend
  cdk.json                     — CDK configuration
```

### Stack Resources

- **API Gateway REST API** (`ShelfLifeApi`)
  - CORS enabled for all origins (mobile app)
- **Lambda Function** (`SpoonacularProxy`)
  - Runtime: Node.js 20.x
  - Environment variable: `SPOONACULAR_API_KEY`
  - Memory: 128 MB
  - Timeout: 10 seconds

### API Routes

| Route | Method | Spoonacular Endpoint |
|-------|--------|---------------------|
| `/recipes/search` | GET | `recipes/complexSearch` |
| `/recipes/findByIngredients` | GET | `recipes/findByIngredients` |
| `/recipes/{id}` | GET | `recipes/{id}/information` |

All routes forward query parameters from the client, append `apiKey`, and return the Spoonacular response.

### Deployment

```bash
cd backend
npm install
npx cdk deploy --context spoonacularApiKey=YOUR_KEY
```

The API Gateway URL is output after deployment and set as `EXPO_PUBLIC_API_GATEWAY_URL` in the app's environment.

---

## Lambda Handler

**File:** `backend/lambda/spoonacular.ts`

**Behavior:**
1. Read `SPOONACULAR_API_KEY` from `process.env`
2. Parse API Gateway event — determine route and extract query parameters
3. Map route to Spoonacular endpoint:
   - `/recipes/search` → `https://api.spoonacular.com/recipes/complexSearch`
   - `/recipes/findByIngredients` → `https://api.spoonacular.com/recipes/findByIngredients`
   - `/recipes/{id}` → `https://api.spoonacular.com/recipes/{id}/information`
4. Forward all client query parameters + append `apiKey`
5. Return Spoonacular JSON response with CORS headers

**Error handling:**
- Upstream Spoonacular failure → `{ statusCode: 502, body: "Spoonacular API error" }`
- Unknown route → `{ statusCode: 400, body: "Unknown route" }`
- Missing API key → `{ statusCode: 500, body: "Server configuration error" }`

---

## Client-Side Changes

### Modified File

`src/services/spoonacularService.ts`

### API Gateway Integration

- `API_BASE_URL` read from `EXPO_PUBLIC_API_GATEWAY_URL` env var
- If `API_BASE_URL` is not set, fall back to existing mock functions (dev-friendly)
- Replace mock calls in the real functions:
  - `searchRecipes(params)` → `GET ${API_BASE_URL}/recipes/search?query=...&diet=...&cuisine=...&number=...`
  - `findRecipesByIngredients(ingredients, number)` → `GET ${API_BASE_URL}/recipes/findByIngredients?ingredients=...&number=...`
  - `getRecipeDetail(recipeId)` → `GET ${API_BASE_URL}/recipes/${recipeId}`
- Keep all mock functions intact as named exports

### On-Device Caching

- **Storage key pattern:** `@shelflife_recipe_cache_{endpoint}_{params_hash}`
- **TTL:** 1 hour for search results, 24 hours for recipe details
- **Lookup flow:** Check cache → if hit and not expired, return cached → else fetch from API, cache response, return
- **Max entries:** 50 — evict oldest on overflow
- **Hash function:** Simple string hash of sorted query parameters

### Screens

No screen changes needed — `RecipesScreen.tsx` and `RecipeDetailScreen.tsx` already call the service functions. Swapping mock for real is transparent.

---

## Environment Variables

### Backend (Lambda)

- `SPOONACULAR_API_KEY` — Spoonacular API key (passed via CDK context at deploy time)

### App (Expo)

- `EXPO_PUBLIC_API_GATEWAY_URL` — API Gateway base URL (set after `cdk deploy`)

---

## Files Summary

### New Files
- `backend/bin/shelflife-backend.ts`
- `backend/lib/shelflife-stack.ts`
- `backend/lambda/spoonacular.ts`
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/cdk.json`

### Modified Files
- `src/services/spoonacularService.ts` — Replace mock with real API calls + caching
