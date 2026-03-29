# DynamoDB Backend Integration Design Spec

**Date:** 2026-03-30
**Scope:** Issue #3 — Replace mock storage with real AWS DynamoDB via API Gateway + Lambda
**Approach:** Extend existing CDK stack with DynamoDB tables + single CRUD Lambda, swap syncService to use API Gateway

---

## Architecture

```
Mobile App → AsyncStorage (local-first)
                ↓ (sync queue)
           API Gateway → Lambda (DynamoDB CRUD) → DynamoDB Tables
```

The app continues to write locally first (fast UX) and queues operations for background sync. The sync service processes the queue by calling API Gateway endpoints instead of mock functions. When `EXPO_PUBLIC_API_GATEWAY_URL` is not set, all functions fall back to mocks.

---

## CDK Stack — DynamoDB Tables

Added to the existing `ShelfLifeStack` in `backend/lib/shelflife-stack.ts`.

### Tables

| Table | Partition Key | GSIs |
|-------|--------------|------|
| `ShelfLife-Users` | `id` (S) | — |
| `ShelfLife-Households` | `id` (S) | `inviteCode-index` (inviteCode) |
| `ShelfLife-Inventory` | `id` (S) | `userId-index` (userId), `householdId-index` (householdId) |
| `ShelfLife-ShoppingLists` | `id` (S) | `userId-index` (userId), `householdId-index` (householdId) |
| `ShelfLife-SavedRecipes` | `id` (S) | `userId-index` (userId) |

All tables use PAY_PER_REQUEST billing. Table names passed to Lambda as environment variables.

---

## Lambda Handler — DynamoDB CRUD

**New file:** `backend/lambda/dynamodb-crud.ts`

Single Lambda with route-based dispatch using AWS SDK v3.

### API Routes

**Users:**
| Route | Method | Operation |
|-------|--------|-----------|
| `/users` | POST | Create user |
| `/users/{id}` | GET | Get user |
| `/users/{id}` | PUT | Update user |

**Inventory:**
| Route | Method | Operation |
|-------|--------|-----------|
| `/inventory` | POST | Create item |
| `/inventory` | GET | Get items by userId (query param) |
| `/inventory/{id}` | PUT | Update item |
| `/inventory/{id}` | DELETE | Delete item |
| `/inventory/household/{householdId}` | GET | Get items by household |

**Shopping Lists:**
| Route | Method | Operation |
|-------|--------|-----------|
| `/shopping-lists` | POST | Create list |
| `/shopping-lists` | GET | Get lists by userId (query param) |
| `/shopping-lists/{id}` | PUT | Update list |
| `/shopping-lists/{id}` | DELETE | Delete list |
| `/shopping-lists/household/{householdId}` | GET | Get lists by household |

**Saved Recipes:**
| Route | Method | Operation |
|-------|--------|-----------|
| `/saved-recipes` | POST | Create saved recipe |
| `/saved-recipes` | GET | Get by userId (query param) |
| `/saved-recipes/{id}` | DELETE | Delete saved recipe |

**Households:**
| Route | Method | Operation |
|-------|--------|-----------|
| `/households` | POST | Create household |
| `/households/{id}` | GET | Get household |
| `/households/{id}` | PUT | Update household |
| `/households/invite/{code}` | GET | Get by invite code |

### Lambda Details
- Runtime: Node.js 20.x
- Uses `@aws-sdk/client-dynamodb` + `@aws-sdk/util-dynamodb`
- Table names from environment variables
- CORS enabled
- Error handling: 400 for bad requests, 404 for not found, 500 for DynamoDB errors

### Auth
The userId for write operations comes from the request body or query params. Future iteration will extract from Cognito JWT token.

---

## Client-Side Changes

### `src/services/dynamoDBService.ts`
- Remove AWS SDK imports and direct DynamoDB client (lines 1-33)
- Add `API_BASE_URL` from `EXPO_PUBLIC_API_GATEWAY_URL`
- Replace every real function with `fetch` calls to API Gateway
- Each function checks `if (!API_BASE_URL)` and falls back to mock
- Keep all mock functions intact

### `src/services/syncService.ts`
- Replace mock function imports with real function imports
- `processInventoryOperation` calls `createInventoryItem` instead of `createInventoryItemMock`
- `fullSync` calls `getInventoryItemsByUser` instead of `getInventoryItemsByUserMock`
- No fallback logic needed — real functions already fall back to mocks

### Stores
No changes needed. Stores already write to AsyncStorage and queue operations for sync.

---

## Files Summary

### Modified Files (Backend)
- `backend/lib/shelflife-stack.ts` — Add DynamoDB tables + CRUD Lambda + API routes

### New Files (Backend)
- `backend/lambda/dynamodb-crud.ts` — CRUD Lambda handler

### Modified Files (App)
- `src/services/dynamoDBService.ts` — Replace direct DynamoDB calls with fetch
- `src/services/syncService.ts` — Swap mock imports for real imports

---

## Deployment

```bash
cd backend
npx cdk deploy --context spoonacularApiKey=YOUR_KEY
```

The same deploy command creates both the Spoonacular proxy and DynamoDB resources. The API Gateway URL remains the same — new routes are added to the existing API.
