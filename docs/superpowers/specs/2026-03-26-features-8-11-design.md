# Features #8-#11 Design Spec

**Date:** 2026-03-26
**Scope:** Barcode Scanning, Household Email Invitations, Role-Based Permissions, Shopping List Auto-Suggestions
**Approach:** Feature-isolated — each feature gets its own service with minimal cross-feature coupling

---

## Feature #8: Barcode Scanning for Item Entry

### New Files
- `src/services/barcodeService.ts` — Open Food Facts API client + mock fallback

### Modified Files
- `src/screens/CameraScreen.tsx` — Add barcode scan mode toggle (photo vs barcode)
- `src/screens/AddItemScreen.tsx` — Accept pre-filled data from barcode scan
- No new dependencies — `expo-camera` already supports barcode scanning natively

### Flow
1. CameraScreen gets a toggle: "Photo" mode (existing) vs "Barcode" mode (new)
2. In barcode mode, camera scans for UPC/EAN barcodes
3. On scan, `barcodeService.lookupBarcode(code)` calls Open Food Facts API (`https://world.openfoodfacts.org/api/v2/product/{barcode}.json`)
4. If found: extract product name, quantity, and category -> navigate to AddItemScreen with fields pre-filled
5. If not found: show "Product not found" alert with option to enter manually
6. Mock version returns fake product data for development

### API Response Mapping
- `product.product_name` -> item name
- `product.quantity` -> quantity string (parsed)
- `product.categories_tags` -> suggest fridge vs pantry location

### Barcode Formats
UPC-A, UPC-E, EAN-8, EAN-13 (via expo-camera's built-in barcode scanning)

---

## Feature #9: Household Email Invitations

### New Files
- `src/services/emailService.ts` — Mock email service (simulates SES, manages pending invitations)

### Modified Files
- `src/types/index.ts` — Add `HouseholdInvitation` type
- `src/screens/HouseholdScreen.tsx` — Invite-by-email form, pending invitations list, revoke button
- `src/store/authStore.ts` — Invitation management actions

### Types
```typescript
interface HouseholdInvitation {
  id: string;
  householdId: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}
```

### Flow
1. Household owner/admin enters email and taps "Send Invitation"
2. `emailService.sendInvitation(householdId, email, invitedBy)` creates invitation record with 7-day expiry, stores in AsyncStorage
3. Pending invitations shown on HouseholdScreen with status badges
4. Owner can revoke pending invitations
5. Recipient: on login, `emailService.getPendingInvitationsForEmail(email)` checks for invitations -> shows accept/decline UI

### Mock Behavior
- Invitation created and stored locally (no actual email sent)
- Toast: "Invitation sent to {email}"
- Both sender and receiver see invitation in local state

### Storage
- AsyncStorage key: `household_invitations` — array of `HouseholdInvitation`

### Service Interface (designed for SES migration)
- `sendInvitation(householdId, email, invitedBy)`
- `revokeInvitation(invitationId)`
- `getInvitationsForHousehold(householdId)`
- `getPendingInvitationsForEmail(email)`
- `acceptInvitation(invitationId, userId)`
- `declineInvitation(invitationId)`

---

## Feature #10: Role-Based Permissions for Households

### New Files
- `src/services/permissionService.ts` — Pure functions for permission checks

### Modified Files
- `src/types/index.ts` — Add `HouseholdRole`, change `Household.memberIds` to `Household.members`
- `src/store/authStore.ts` — Role management actions
- `src/store/inventoryStore.ts` — Permission checks before household item mutations
- `src/store/shoppingStore.ts` — Permission checks before household list mutations
- `src/screens/HouseholdScreen.tsx` — Role badges, role management UI, transfer ownership
- `src/screens/InventoryScreen.tsx` — Conditionally disable edit/delete based on role
- `src/screens/ShoppingListScreen.tsx` — Same permission gating

### Types
```typescript
type HouseholdRole = 'owner' | 'admin' | 'member';

interface HouseholdMember {
  userId: string;
  role: HouseholdRole;
}

// Household.memberIds: string[] becomes Household.members: HouseholdMember[]
```

### Permission Matrix

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Delete household | Y | N | N |
| Remove members | Y | Y | N |
| Change roles | Y | N | N |
| Add items | Y | Y | Y |
| Edit any item | Y | Y | N |
| Edit own items | Y | Y | Y |

### Permission Service
```typescript
canDeleteHousehold(role: HouseholdRole): boolean
canRemoveMember(role: HouseholdRole): boolean
canChangeRoles(role: HouseholdRole): boolean
canEditItem(role: HouseholdRole, itemOwnerId: string, currentUserId: string): boolean
canDeleteItem(role: HouseholdRole, itemOwnerId: string, currentUserId: string): boolean
```

### Enforcement
- **Store layer:** Checks permissions before executing mutations, returns error if denied
- **UI layer:** Calls same functions to hide/disable controls
- Defense in depth — both layers enforce independently

### Migration
Existing `Household.memberIds: string[]` converts to `members: HouseholdMember[]` on load. All existing members become `'member'` role, `ownerId` gets `'owner'`.

---

## Feature #11: Auto-Suggestions for Shopping List

### New Files
- `src/components/SuggestionCard.tsx` — Dismissible card with one-tap add
- `src/services/suggestionService.ts` — Suggestion engine + purchase history tracking

### Modified Files
- `src/types/index.ts` — Add `ShoppingSuggestion`, `PurchaseHistoryEntry` types
- `src/screens/ShoppingListScreen.tsx` — Collapsible suggestions section above list
- `src/store/inventoryStore.ts` — Log item removals to purchase history
- `src/store/shoppingStore.ts` — `getSuggestions()` selector, `dismissSuggestion()` action

### Types
```typescript
interface ShoppingSuggestion {
  id: string;
  name: string;
  reason: string;
  source: 'expiring' | 'low_stock' | 'history' | 'recipe';
  quantity?: number;
  unit?: string;
}

interface PurchaseHistoryEntry {
  itemName: string;
  removedAt: string;
  quantity: number;
  unit: string;
}
```

### Suggestion Sources (priority order)
1. **Expiring soon** — Items expiring within user's configured warning days -> "Replace {item} - expires in {n} days"
2. **Low stock** — Items with quantity <= 1 -> "Running low on {item}"
3. **Purchase history** — Items removed 2+ times in last 30 days not in inventory -> "You frequently buy {item}"
4. **Recipe-based** — Missing ingredients from saved recipes -> "Needed for {recipe name}"

### Purchase History Tracking
- On `inventoryStore.deleteItem()`, log `{ itemName, removedAt, quantity, unit }` to AsyncStorage key `purchase_history`
- Keep last 90 days of history, prune older entries on load
- Simple frequency counting

### Suggestion UX
- Collapsible "Suggestions" section at top of ShoppingListScreen
- Each SuggestionCard shows: item name, reason text, source icon, "Add" / "Dismiss" buttons
- "Add" creates shopping list item and removes suggestion
- "Dismiss" hides suggestion (stored in AsyncStorage `dismissed_suggestions`, resets weekly)
- Max 5 suggestions shown at a time

### Service Interface
```typescript
generateSuggestions(inventoryItems, purchaseHistory, savedRecipes, dismissedIds): ShoppingSuggestion[]
logPurchaseRemoval(item): void
getPurchaseHistory(): PurchaseHistoryEntry[]
pruneHistory(daysToKeep): void
```

---

## Cross-Cutting Concerns

### No new dependencies required
- Barcode scanning uses existing `expo-camera`
- All other features use existing AsyncStorage + Zustand patterns

### Feature independence
- Each feature can be implemented and tested independently
- Only cross-feature dependency: suggestions (#11) reads from inventory store (already exists), permissions (#10) is checked in household-related screens

### Mock-first development
- All new services include mock implementations matching existing codebase patterns
- Real backend integrations (SES, DynamoDB permission enforcement) deferred to backend Lambda work
