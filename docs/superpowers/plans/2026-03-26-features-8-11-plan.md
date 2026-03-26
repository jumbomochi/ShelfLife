# Features #8-#11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add barcode scanning, household email invitations, role-based permissions, and shopping list auto-suggestions to ShelfLife.

**Architecture:** Four independent features, each with its own service file. Shared types added to `src/types/index.ts`. Permission checks enforced at both UI and store layers. All new services follow the existing mock-first pattern.

**Tech Stack:** React Native/Expo, TypeScript, Zustand, AsyncStorage, expo-camera (barcode), Open Food Facts API

---

## File Map

### New Files
- `src/services/barcodeService.ts` — Open Food Facts API client + mock
- `src/services/emailService.ts` — Mock email invitation service
- `src/services/permissionService.ts` — Pure permission check functions
- `src/services/suggestionService.ts` — Suggestion engine + purchase history
- `src/components/SuggestionCard.tsx` — Dismissible suggestion card UI

### Modified Files
- `src/types/index.ts` — New types for all 4 features
- `src/screens/CameraScreen.tsx` — Barcode scan mode
- `src/screens/AddItemScreen.tsx` — Accept pre-filled data via route params
- `src/screens/HouseholdScreen.tsx` — Email invitations + role management UI
- `src/screens/InventoryScreen.tsx` — Permission-gated edit/delete
- `src/screens/ShoppingListScreen.tsx` — Suggestions section
- `src/store/inventoryStore.ts` — Permission checks + purchase history logging
- `src/store/shoppingStore.ts` — Permission checks + suggestion selectors
- `src/store/authStore.ts` — Invitation management actions
- `src/components/index.ts` — Export SuggestionCard
- `App.tsx` — Update AddItem route params

---

### Task 1: Add New Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add all new types to src/types/index.ts**

Add the following after the existing `Household` interface (after line 28):

```typescript
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
```

Also update the `Household` interface to use the new members type. Replace lines 21-28:

```typescript
export interface Household {
  id: string;
  name: string;
  ownerId: string;
  members: HouseholdMember[];
  inviteCode: string;
  createdAt: string;
}
```

Update `RootStackParamList` to support pre-filled AddItem data. Replace lines 125-134:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit 2>&1 | head -20`

Expected: Type errors in HouseholdScreen.tsx (uses old `memberIds` format) — this is expected and will be fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add types for barcode, invitations, permissions, and suggestions (#8-#11)"
```

---

### Task 2: Barcode Service

**Files:**
- Create: `src/services/barcodeService.ts`

- [ ] **Step 1: Create barcodeService.ts**

```typescript
import { BarcodeProduct } from '@/types';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v2/product';

// Categories that suggest fridge storage
const FRIDGE_CATEGORIES = [
  'dairy', 'milk', 'cheese', 'yogurt', 'butter', 'cream',
  'meat', 'poultry', 'fish', 'seafood', 'eggs',
  'fresh', 'vegetables', 'fruits', 'salad', 'juice',
  'deli', 'tofu', 'sausage',
];

export function suggestLocation(categories: string[]): 'fridge' | 'pantry' {
  const lowerCategories = categories.map((c) => c.toLowerCase());
  const isFridge = lowerCategories.some((cat) =>
    FRIDGE_CATEGORIES.some((fc) => cat.includes(fc))
  );
  return isFridge ? 'fridge' : 'pantry';
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_API}/${barcode}.json`);
    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const product = data.product;
    return {
      barcode,
      name: product.product_name || product.product_name_en || '',
      quantity: product.quantity || undefined,
      brand: product.brands || undefined,
      categories: product.categories_tags || [],
      imageUrl: product.image_url || undefined,
    };
  } catch {
    return null;
  }
}

export async function lookupBarcodeMock(barcode: string): Promise<BarcodeProduct | null> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  const mockProducts: Record<string, BarcodeProduct> = {
    '4902430590990': {
      barcode: '4902430590990',
      name: 'Meiji Fresh Milk',
      quantity: '1L',
      brand: 'Meiji',
      categories: ['en:dairy', 'en:milk'],
      imageUrl: undefined,
    },
    '8888163100015': {
      barcode: '8888163100015',
      name: 'Yeo\'s Soy Bean Drink',
      quantity: '250ml',
      brand: 'Yeo\'s',
      categories: ['en:beverages', 'en:soy-drinks'],
      imageUrl: undefined,
    },
    default: {
      barcode,
      name: 'Sample Product',
      quantity: '500g',
      brand: 'Test Brand',
      categories: ['en:snacks'],
      imageUrl: undefined,
    },
  };

  return mockProducts[barcode] || mockProducts['default'];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/barcodeService.ts
git commit -m "feat: add barcode service with Open Food Facts API (#8)"
```

---

### Task 3: Barcode Scanning in CameraScreen

**Files:**
- Modify: `src/screens/CameraScreen.tsx`
- Modify: `src/screens/AddItemScreen.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Update CameraScreen to support barcode mode**

Replace the entire CameraScreen with the version that adds a Photo/Barcode toggle. The key changes:

Add imports at the top of `src/screens/CameraScreen.tsx`:

```typescript
import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { detectGroceryItemsMock, DetectedItem } from '@/services/rekognitionService';
import { lookupBarcodeMock, suggestLocation } from '@/services/barcodeService';
import { useInventoryStore } from '@/store';
import { RootStackParamList } from '@/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
```

Replace the `CameraScreenProps` interface and component signature (lines 17-29) with:

```typescript
interface CameraScreenProps {
  onClose: () => void;
  onItemsAdded?: () => void;
}

type ScanMode = 'photo' | 'barcode';

export default function CameraScreen({ onClose, onItemsAdded }: CameraScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<ScanMode>('photo');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(true);
  const cameraRef = useRef<CameraView>(null);
  const { addItem } = useInventoryStore();
```

Add the barcode handler after `resetCapture` (after line 110):

```typescript
  const handleBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (!isScanning) return;
    setIsScanning(false);

    const barcode = result.data;
    setIsAnalyzing(true);

    try {
      const product = await lookupBarcodeMock(barcode);

      if (product && product.name) {
        const location = product.categories ? suggestLocation(product.categories) : 'fridge';

        // Parse quantity from product.quantity string (e.g., "1L" -> 1, "L")
        let qty = 1;
        let unit = 'pcs';
        if (product.quantity) {
          const match = product.quantity.match(/^([\d.]+)\s*(.+)$/);
          if (match) {
            qty = parseFloat(match[1]) || 1;
            unit = match[2].trim();
          }
        }

        Alert.alert(
          'Product Found',
          `${product.name}${product.brand ? ` (${product.brand})` : ''}`,
          [
            {
              text: 'Add Directly',
              onPress: () => {
                addItem({
                  userId: 'current-user',
                  name: product.name,
                  quantity: qty,
                  unit,
                  location,
                  ownership: 'personal',
                });
                Alert.alert('Success', `Added "${product.name}" to inventory`);
                onItemsAdded?.();
                onClose();
              },
            },
            {
              text: 'Edit First',
              onPress: () => {
                onClose();
                navigation.navigate('AddItem', {
                  mode: 'manual',
                  prefill: { name: product.name, quantity: qty, unit, location },
                });
              },
            },
            {
              text: 'Scan Again',
              style: 'cancel',
              onPress: () => setIsScanning(true),
            },
          ]
        );
      } else {
        Alert.alert(
          'Product Not Found',
          'This barcode was not recognized. Would you like to add the item manually?',
          [
            { text: 'Scan Again', style: 'cancel', onPress: () => setIsScanning(true) },
            {
              text: 'Add Manually',
              onPress: () => {
                onClose();
                navigation.navigate('AddItem', { mode: 'manual' });
              },
            },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to look up barcode');
      setIsScanning(true);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isScanning, addItem, navigation, onClose, onItemsAdded]);
```

Replace the camera view section (the final return block starting at line 211) with:

```typescript
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        ref={cameraRef}
        facing="back"
        barcodeScannerSettings={
          scanMode === 'barcode'
            ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }
            : undefined
        }
        onBarcodeScanned={scanMode === 'barcode' ? handleBarcodeScanned : undefined}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'photo' && styles.modeButtonActive]}
                onPress={() => { setScanMode('photo'); setIsScanning(true); }}
              >
                <Text style={[styles.modeButtonText, scanMode === 'photo' && styles.modeButtonTextActive]}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'barcode' && styles.modeButtonActive]}
                onPress={() => { setScanMode('barcode'); setIsScanning(true); }}
              >
                <Text style={[styles.modeButtonText, scanMode === 'barcode' && styles.modeButtonTextActive]}>Barcode</Text>
              </TouchableOpacity>
            </View>
          </View>

          {scanMode === 'barcode' ? (
            <View style={styles.barcodeOverlay}>
              {isAnalyzing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Text style={styles.barcodeHint}>Point camera at a barcode</Text>
              )}
            </View>
          ) : (
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                <Text style={styles.galleryButtonText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <View style={styles.placeholder} />
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
```

Add new styles to the StyleSheet:

```typescript
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 2,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  barcodeOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeHint: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
```

- [ ] **Step 2: Update AddItemScreen to accept prefill params**

In `src/screens/AddItemScreen.tsx`, update the props interface and add route params support. Replace lines 1-31:

```typescript
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useInventoryStore } from '@/store';
import { ItemLocation, ItemOwnership, RootStackParamList } from '@/types';

type AddItemRouteProp = RouteProp<RootStackParamList, 'AddItem'>;

interface AddItemScreenProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'dozen', 'pack', 'bottle', 'can', 'box'];

export default function AddItemScreen({ onClose, onSuccess }: AddItemScreenProps) {
  const { addItem } = useInventoryStore();
  const route = useRoute<AddItemRouteProp>();
  const prefill = route.params?.prefill;

  const [name, setName] = useState(prefill?.name || '');
  const [quantity, setQuantity] = useState(prefill?.quantity?.toString() || '1');
  const [unit, setUnit] = useState(prefill?.unit || 'pcs');
  const [location, setLocation] = useState<ItemLocation>(prefill?.location || 'fridge');
  const [ownership, setOwnership] = useState<ItemOwnership>('personal');
  const [expirationDate, setExpirationDate] = useState('');
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/screens/CameraScreen.tsx src/screens/AddItemScreen.tsx
git commit -m "feat: add barcode scanning mode to camera screen (#8)"
```

---

### Task 4: Permission Service

**Files:**
- Create: `src/services/permissionService.ts`

- [ ] **Step 1: Create permissionService.ts**

```typescript
import { HouseholdRole } from '@/types';

export function canDeleteHousehold(role: HouseholdRole): boolean {
  return role === 'owner';
}

export function canRemoveMember(role: HouseholdRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canChangeRoles(role: HouseholdRole): boolean {
  return role === 'owner';
}

export function canEditItem(
  role: HouseholdRole,
  itemOwnerId: string,
  currentUserId: string
): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return itemOwnerId === currentUserId;
}

export function canDeleteItem(
  role: HouseholdRole,
  itemOwnerId: string,
  currentUserId: string
): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return itemOwnerId === currentUserId;
}

export function canManageInvitations(role: HouseholdRole): boolean {
  return role === 'owner' || role === 'admin';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/permissionService.ts
git commit -m "feat: add permission service with role-based checks (#10)"
```

---

### Task 5: Permission Enforcement in Stores

**Files:**
- Modify: `src/store/inventoryStore.ts`
- Modify: `src/store/shoppingStore.ts`

- [ ] **Step 1: Add permission checks to inventoryStore**

In `src/store/inventoryStore.ts`, add import at line 2:

```typescript
import { InventoryItem, ItemLocation, ItemOwnership, HouseholdRole } from '@/types';
import { canEditItem, canDeleteItem } from '@/services/permissionService';
```

Replace the `updateItem` action (lines 74-100) with:

```typescript
  updateItem: async (id, updates) => {
    const now = new Date().toISOString();
    const item = get().items.find((i) => i.id === id)
      || get().householdItems.find((i) => i.id === id);

    // Permission check for household items
    if (item?.ownership === 'household' && item.userId) {
      const { userRole, currentUserId } = get();
      if (userRole && currentUserId && !canEditItem(userRole, item.userId, currentUserId)) {
        throw new Error('You do not have permission to edit this item');
      }
    }

    let updatedItem: InventoryItem | null = null;

    set((state) => ({
      items: state.items.map((i) => {
        if (i.id === id) {
          updatedItem = { ...i, ...updates, updatedAt: now };
          return updatedItem;
        }
        return i;
      }),
    }));

    const updatedItems = get().items;
    await saveInventoryLocal(updatedItems);

    if (updatedItem) {
      await addToSyncQueue({
        type: 'UPDATE',
        entity: 'INVENTORY',
        data: updatedItem,
      });
    }
  },
```

Replace the `deleteItem` action (lines 102-121) with:

```typescript
  deleteItem: async (id) => {
    const itemToDelete = get().items.find((item) => item.id === id);

    // Permission check for household items
    if (itemToDelete?.ownership === 'household' && itemToDelete.userId) {
      const { userRole, currentUserId } = get();
      if (userRole && currentUserId && !canDeleteItem(userRole, itemToDelete.userId, currentUserId)) {
        throw new Error('You do not have permission to delete this item');
      }
    }

    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));

    const updatedItems = get().items;
    await saveInventoryLocal(updatedItems);

    if (itemToDelete) {
      await addToSyncQueue({
        type: 'DELETE',
        entity: 'INVENTORY',
        data: { id },
      });
    }
  },
```

Add `userRole` and `currentUserId` to the state interface and initial state:

```typescript
interface InventoryState {
  items: InventoryItem[];
  householdItems: InventoryItem[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  userRole: HouseholdRole | null;
  currentUserId: string | null;

  // ... existing actions ...
  setUserContext: (userId: string, role: HouseholdRole | null) => void;
```

Add to initial state:

```typescript
  userRole: null,
  currentUserId: null,
```

Add the action:

```typescript
  setUserContext: (userId, role) => set({ currentUserId: userId, userRole: role }),
```

- [ ] **Step 2: Add permission checks to shoppingStore**

In `src/store/shoppingStore.ts`, add import:

```typescript
import { ShoppingList, ShoppingListItem, ItemOwnership, HouseholdRole } from '@/types';
import { canEditItem, canDeleteItem } from '@/services/permissionService';
```

Add `userRole` and `currentUserId` to the state interface and initial state (same pattern as inventoryStore):

```typescript
  userRole: HouseholdRole | null;
  currentUserId: string | null;
  setUserContext: (userId: string, role: HouseholdRole | null) => void;
```

Initial state:

```typescript
  userRole: null,
  currentUserId: null,
```

Action:

```typescript
  setUserContext: (userId, role) => set({ currentUserId: userId, userRole: role }),
```

Add permission check to `deleteList` (before the set call):

```typescript
  deleteList: async (listId) => {
    const listToDelete = get().lists.find((l) => l.id === listId);

    if (listToDelete?.ownership === 'household') {
      const { userRole, currentUserId } = get();
      if (userRole && currentUserId && !canDeleteItem(userRole, listToDelete.userId, currentUserId)) {
        throw new Error('You do not have permission to delete this list');
      }
    }

    // ... rest unchanged
  },
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/store/inventoryStore.ts src/store/shoppingStore.ts
git commit -m "feat: enforce role-based permissions in inventory and shopping stores (#10)"
```

---

### Task 6: Email Invitation Service

**Files:**
- Create: `src/services/emailService.ts`

- [ ] **Step 1: Create emailService.ts**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HouseholdInvitation } from '@/types';

const INVITATIONS_KEY = '@shelflife_invitations';

const generateId = () => Math.random().toString(36).substring(2, 15);

async function getStoredInvitations(): Promise<HouseholdInvitation[]> {
  const stored = await AsyncStorage.getItem(INVITATIONS_KEY);
  if (!stored) return [];
  const invitations: HouseholdInvitation[] = JSON.parse(stored);

  // Auto-expire old invitations
  const now = new Date().toISOString();
  return invitations.map((inv) => {
    if (inv.status === 'pending' && inv.expiresAt < now) {
      return { ...inv, status: 'expired' as const };
    }
    return inv;
  });
}

async function saveInvitations(invitations: HouseholdInvitation[]): Promise<void> {
  await AsyncStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations));
}

export async function sendInvitation(
  householdId: string,
  householdName: string,
  email: string,
  invitedBy: string
): Promise<HouseholdInvitation> {
  const invitations = await getStoredInvitations();

  // Check for existing pending invitation to same email for same household
  const existing = invitations.find(
    (inv) => inv.email === email && inv.householdId === householdId && inv.status === 'pending'
  );
  if (existing) {
    throw new Error('An invitation has already been sent to this email');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation: HouseholdInvitation = {
    id: generateId(),
    householdId,
    householdName,
    email: email.toLowerCase(),
    status: 'pending',
    invitedBy,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };

  invitations.push(invitation);
  await saveInvitations(invitations);

  // In production, this would trigger AWS SES via Lambda
  // For now, the invitation is stored locally
  return invitation;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const invitations = await getStoredInvitations();
  const updated = invitations.map((inv) =>
    inv.id === invitationId && inv.status === 'pending'
      ? { ...inv, status: 'revoked' as const }
      : inv
  );
  await saveInvitations(updated);
}

export async function getInvitationsForHousehold(
  householdId: string
): Promise<HouseholdInvitation[]> {
  const invitations = await getStoredInvitations();
  return invitations.filter((inv) => inv.householdId === householdId);
}

export async function getPendingInvitationsForEmail(
  email: string
): Promise<HouseholdInvitation[]> {
  const invitations = await getStoredInvitations();
  return invitations.filter(
    (inv) => inv.email === email.toLowerCase() && inv.status === 'pending'
  );
}

export async function acceptInvitation(
  invitationId: string,
  userId: string
): Promise<HouseholdInvitation> {
  const invitations = await getStoredInvitations();
  let accepted: HouseholdInvitation | null = null;

  const updated = invitations.map((inv) => {
    if (inv.id === invitationId && inv.status === 'pending') {
      accepted = { ...inv, status: 'accepted' as const };
      return accepted;
    }
    return inv;
  });

  if (!accepted) {
    throw new Error('Invitation not found or no longer valid');
  }

  await saveInvitations(updated);
  return accepted;
}

export async function declineInvitation(invitationId: string): Promise<void> {
  const invitations = await getStoredInvitations();
  const updated = invitations.map((inv) =>
    inv.id === invitationId && inv.status === 'pending'
      ? { ...inv, status: 'declined' as const }
      : inv
  );
  await saveInvitations(updated);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/emailService.ts
git commit -m "feat: add mock email invitation service (#9)"
```

---

### Task 7: Suggestion Service and Purchase History

**Files:**
- Create: `src/services/suggestionService.ts`

- [ ] **Step 1: Create suggestionService.ts**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem, SavedRecipe, ShoppingSuggestion, PurchaseHistoryEntry } from '@/types';

const PURCHASE_HISTORY_KEY = '@shelflife_purchase_history';
const DISMISSED_SUGGESTIONS_KEY = '@shelflife_dismissed_suggestions';
const HISTORY_RETENTION_DAYS = 90;

const generateId = () => Math.random().toString(36).substring(2, 15);

// --- Purchase History ---

export async function logPurchaseRemoval(item: InventoryItem): Promise<void> {
  const history = await getPurchaseHistory();
  history.push({
    itemName: item.name,
    removedAt: new Date().toISOString(),
    quantity: item.quantity,
    unit: item.unit,
  });
  await AsyncStorage.setItem(PURCHASE_HISTORY_KEY, JSON.stringify(history));
}

export async function getPurchaseHistory(): Promise<PurchaseHistoryEntry[]> {
  const stored = await AsyncStorage.getItem(PURCHASE_HISTORY_KEY);
  if (!stored) return [];

  const history: PurchaseHistoryEntry[] = JSON.parse(stored);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HISTORY_RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString();

  // Prune old entries
  const pruned = history.filter((entry) => entry.removedAt >= cutoffStr);
  if (pruned.length !== history.length) {
    await AsyncStorage.setItem(PURCHASE_HISTORY_KEY, JSON.stringify(pruned));
  }

  return pruned;
}

// --- Dismissed Suggestions ---

export async function getDismissedSuggestionIds(): Promise<Set<string>> {
  const stored = await AsyncStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
  if (!stored) return new Set();

  const { ids, resetAt } = JSON.parse(stored);

  // Reset weekly
  const resetDate = new Date(resetAt);
  const now = new Date();
  if (now.getTime() - resetDate.getTime() > 7 * 24 * 60 * 60 * 1000) {
    await AsyncStorage.removeItem(DISMISSED_SUGGESTIONS_KEY);
    return new Set();
  }

  return new Set(ids);
}

export async function dismissSuggestion(suggestionId: string): Promise<void> {
  const dismissed = await getDismissedSuggestionIds();
  dismissed.add(suggestionId);
  await AsyncStorage.setItem(
    DISMISSED_SUGGESTIONS_KEY,
    JSON.stringify({ ids: Array.from(dismissed), resetAt: new Date().toISOString() })
  );
}

// --- Suggestion Generation ---

export function generateSuggestions(
  inventoryItems: InventoryItem[],
  purchaseHistory: PurchaseHistoryEntry[],
  savedRecipes: SavedRecipe[],
  dismissedIds: Set<string>
): ShoppingSuggestion[] {
  const suggestions: ShoppingSuggestion[] = [];
  const addedNames = new Set<string>();

  const addSuggestion = (
    name: string,
    reason: string,
    source: ShoppingSuggestion['source'],
    quantity?: number,
    unit?: string
  ) => {
    const lowerName = name.toLowerCase();
    if (addedNames.has(lowerName)) return;
    const id = `${source}-${lowerName}`;
    if (dismissedIds.has(id)) return;
    addedNames.add(lowerName);
    suggestions.push({ id, name, reason, source, quantity, unit });
  };

  // 1. Expiring soon
  const now = new Date();
  for (const item of inventoryItems) {
    if (!item.expirationDate) continue;
    const expDate = new Date(item.expirationDate);
    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft >= 0 && daysLeft <= 7) {
      addSuggestion(
        item.name,
        daysLeft === 0 ? `${item.name} expires today` : `${item.name} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        'expiring',
        1,
        item.unit
      );
    }
  }

  // 2. Low stock
  for (const item of inventoryItems) {
    if (item.quantity <= 1) {
      addSuggestion(
        item.name,
        `Running low on ${item.name}`,
        'low_stock',
        1,
        item.unit
      );
    }
  }

  // 3. Purchase history — items removed 2+ times in last 30 days, not in inventory
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentHistory = purchaseHistory.filter(
    (entry) => new Date(entry.removedAt) >= thirtyDaysAgo
  );

  const frequencyMap = new Map<string, { count: number; unit: string }>();
  for (const entry of recentHistory) {
    const key = entry.itemName.toLowerCase();
    const existing = frequencyMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      frequencyMap.set(key, { count: 1, unit: entry.unit });
    }
  }

  const inventoryNames = new Set(inventoryItems.map((i) => i.name.toLowerCase()));

  for (const [name, data] of frequencyMap) {
    if (data.count >= 2 && !inventoryNames.has(name)) {
      // Capitalize first letter
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      addSuggestion(
        displayName,
        `You frequently buy ${displayName}`,
        'history',
        1,
        data.unit
      );
    }
  }

  // 4. Recipe-based — missing ingredients from saved recipes
  for (const saved of savedRecipes.slice(0, 5)) {
    // Simple name match against inventory
    const recipe = saved.recipeData;
    // We don't have extendedIngredients on Recipe (only on RecipeDetail),
    // so we skip this source unless we have more data.
    // This is a placeholder for when RecipeDetail data is available.
  }

  return suggestions.slice(0, 5);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/suggestionService.ts
git commit -m "feat: add suggestion service with purchase history tracking (#11)"
```

---

### Task 8: SuggestionCard Component

**Files:**
- Create: `src/components/SuggestionCard.tsx`
- Modify: `src/components/index.ts`

- [ ] **Step 1: Create SuggestionCard.tsx**

```typescript
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ShoppingSuggestion } from '@/types';

const SOURCE_ICONS: Record<ShoppingSuggestion['source'], string> = {
  expiring: '⏰',
  low_stock: '📦',
  history: '🔄',
  recipe: '🍳',
};

const SOURCE_COLORS: Record<ShoppingSuggestion['source'], string> = {
  expiring: '#FF9500',
  low_stock: '#FF3B30',
  history: '#5856D6',
  recipe: '#34C759',
};

interface SuggestionCardProps {
  suggestion: ShoppingSuggestion;
  onAdd: (suggestion: ShoppingSuggestion) => void;
  onDismiss: (suggestion: ShoppingSuggestion) => void;
}

export default function SuggestionCard({
  suggestion,
  onAdd,
  onDismiss,
}: SuggestionCardProps) {
  const color = SOURCE_COLORS[suggestion.source];

  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <Text style={styles.icon}>{SOURCE_ICONS[suggestion.source]}</Text>
      <View style={styles.content}>
        <Text style={styles.name}>{suggestion.name}</Text>
        <Text style={styles.reason}>{suggestion.reason}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onAdd(suggestion)}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => onDismiss(suggestion)}
        >
          <Text style={styles.dismissButtonText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  icon: {
    fontSize: 20,
    marginRight: 10,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  reason: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '600',
    lineHeight: 20,
  },
});
```

- [ ] **Step 2: Update components index**

In `src/components/index.ts`, add:

```typescript
export { default as SuggestionCard } from './SuggestionCard';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SuggestionCard.tsx src/components/index.ts
git commit -m "feat: add SuggestionCard component (#11)"
```

---

### Task 9: Purchase History Logging in Inventory Store

**Files:**
- Modify: `src/store/inventoryStore.ts`

- [ ] **Step 1: Add purchase history logging to deleteItem**

In `src/store/inventoryStore.ts`, add import:

```typescript
import { logPurchaseRemoval } from '@/services/suggestionService';
```

In the `deleteItem` action, add the logging call right after `const itemToDelete = ...`:

```typescript
  deleteItem: async (id) => {
    const itemToDelete = get().items.find((item) => item.id === id);

    // Log removal for purchase history suggestions
    if (itemToDelete) {
      logPurchaseRemoval(itemToDelete);
    }

    // Permission check for household items
    // ... rest of existing code
```

- [ ] **Step 2: Commit**

```bash
git add src/store/inventoryStore.ts
git commit -m "feat: log item removals for purchase history suggestions (#11)"
```

---

### Task 10: Suggestions UI in ShoppingListScreen

**Files:**
- Modify: `src/screens/ShoppingListScreen.tsx`

- [ ] **Step 1: Add suggestions section to ShoppingListScreen**

Add imports at top of `src/screens/ShoppingListScreen.tsx`:

```typescript
import { useRecipesStore } from '@/store';
import { ShoppingSuggestion } from '@/types';
import SuggestionCard from '@/components/SuggestionCard';
import {
  generateSuggestions,
  getPurchaseHistory,
  getDismissedSuggestionIds,
  dismissSuggestion as dismissSuggestionService,
} from '@/services/suggestionService';
```

Add state and effect for suggestions inside the component (after the existing useEffect):

```typescript
  const { savedRecipes } = useRecipesStore();
  const [suggestions, setSuggestions] = useState<ShoppingSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Load suggestions
  useEffect(() => {
    async function loadSuggestions() {
      const history = await getPurchaseHistory();
      const dismissed = await getDismissedSuggestionIds();
      const allItems = [...inventoryItems, ...(useInventoryStore.getState().householdItems)];
      const result = generateSuggestions(allItems, history, savedRecipes, dismissed);
      setSuggestions(result);
    }
    loadSuggestions();
  }, [inventoryItems, savedRecipes]);

  const handleAddSuggestion = (suggestion: ShoppingSuggestion) => {
    if (!activeListId) {
      Alert.alert('No List', 'Please select or create a shopping list first');
      return;
    }
    addItem(activeListId, {
      name: suggestion.name,
      quantity: suggestion.quantity || 1,
      unit: suggestion.unit || 'pcs',
    });
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };

  const handleDismissSuggestion = async (suggestion: ShoppingSuggestion) => {
    await dismissSuggestionService(suggestion.id);
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  };
```

Replace the `handleSuggestItems` function (lines 102-140) — it's now replaced by the persistent suggestions section. Remove the old function and the "Suggest" button in `renderActiveList`. Instead, add the suggestions section. In `renderActiveList`, right after the `listActions` View, add:

```typescript
        {/* Suggestions Section */}
        {suggestions.length > 0 && showSuggestions && (
          <View style={styles.suggestionsSection}>
            <TouchableOpacity
              style={styles.suggestionsHeader}
              onPress={() => setShowSuggestions(!showSuggestions)}
            >
              <Text style={styles.suggestionsTitle}>
                Suggestions ({suggestions.length})
              </Text>
              <Text style={styles.suggestionsToggle}>Hide</Text>
            </TouchableOpacity>
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAdd={handleAddSuggestion}
                onDismiss={handleDismissSuggestion}
              />
            ))}
          </View>
        )}

        {suggestions.length > 0 && !showSuggestions && (
          <TouchableOpacity
            style={styles.showSuggestionsButton}
            onPress={() => setShowSuggestions(true)}
          >
            <Text style={styles.showSuggestionsText}>
              Show {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
```

Remove the old "Suggest" button from `listActions`. Replace the `listActions` View:

```typescript
        <View style={styles.listActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowAddItemModal(true)}
          >
            <Text style={styles.actionButtonText}>+ Add Item</Text>
          </TouchableOpacity>
        </View>
```

Add new styles:

```typescript
  suggestionsSection: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6D6D72',
    textTransform: 'uppercase',
  },
  suggestionsToggle: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  showSuggestionsButton: {
    padding: 12,
    marginHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    marginBottom: 8,
  },
  showSuggestionsText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
```

Also remove the unused `suggestButton` style.

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/screens/ShoppingListScreen.tsx
git commit -m "feat: add auto-suggestions section to shopping list screen (#11)"
```

---

### Task 11: Household Screen — Email Invitations and Role Management

**Files:**
- Modify: `src/screens/HouseholdScreen.tsx`

- [ ] **Step 1: Rewrite HouseholdScreen with invitations and roles**

This is the largest change. The HouseholdScreen needs:
1. Email invitation form and pending invitations list (when user has a household)
2. Incoming invitations section (when user has no household)
3. Role badges (Owner/Admin/Member) on member list
4. Role management dropdown for owner
5. Transfer ownership option

Replace the entire `src/screens/HouseholdScreen.tsx` with the updated version.

Key additions to imports:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '@/store';
import { HouseholdRole, HouseholdMember, HouseholdInvitation } from '@/types';
import {
  canDeleteHousehold,
  canRemoveMember,
  canChangeRoles,
  canManageInvitations,
} from '@/services/permissionService';
import {
  sendInvitation,
  revokeInvitation,
  getInvitationsForHousehold,
  getPendingInvitationsForEmail,
  acceptInvitation,
  declineInvitation,
} from '@/services/emailService';
```

Replace the local `HouseholdMember` and `Household` interfaces (lines 21-33) with ones that use the global types:

```typescript
interface LocalHousehold {
  id: string;
  name: string;
  inviteCode: string;
  members: HouseholdMember[];
}
```

In the component, add new state:

```typescript
  const [inviteEmail, setInviteEmail] = useState('');
  const [householdInvitations, setHouseholdInvitations] = useState<HouseholdInvitation[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<HouseholdInvitation[]>([]);
```

Add a `getCurrentUserRole` helper:

```typescript
  const getCurrentUserRole = (): HouseholdRole => {
    if (!household) return 'member';
    const member = household.members.find(
      (m) => m.userId === (user?.sub || 'current-user')
    );
    return member?.role || 'member';
  };

  const currentRole = getCurrentUserRole();
```

Add `useEffect` to load invitations:

```typescript
  useEffect(() => {
    if (household) {
      getInvitationsForHousehold(household.id).then(setHouseholdInvitations);
    }
    if (user?.email) {
      getPendingInvitationsForEmail(user.email).then(setIncomingInvitations);
    }
  }, [household?.id, user?.email]);
```

Update `handleCreateHousehold` to use `HouseholdMember` with roles:

```typescript
  const handleCreateHousehold = async () => {
    // ... existing validation ...

    const newHousehold: LocalHousehold = {
      id: Math.random().toString(36).substring(2, 10),
      name: householdName.trim(),
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      members: [
        {
          userId: user?.sub || 'current-user',
          role: 'owner',
          name: user?.username || 'You',
          email: user?.email || 'user@example.com',
        },
      ],
    };

    // ... rest unchanged
  };
```

Update `handleJoinHousehold` similarly (joined member gets `role: 'member'`).

Add email invitation handler:

```typescript
  const handleSendInvitation = async () => {
    if (!inviteEmail.trim() || !household) return;

    if (!canManageInvitations(currentRole)) {
      Alert.alert('Error', 'You do not have permission to send invitations');
      return;
    }

    try {
      setIsLoading(true);
      await sendInvitation(
        household.id,
        household.name,
        inviteEmail.trim(),
        user?.sub || 'current-user'
      );
      Alert.alert('Success', `Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      const updated = await getInvitationsForHousehold(household.id);
      setHouseholdInvitations(updated);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revokeInvitation(invitationId);
      const updated = await getInvitationsForHousehold(household!.id);
      setHouseholdInvitations(updated);
    } catch {
      Alert.alert('Error', 'Failed to revoke invitation');
    }
  };

  const handleAcceptInvitation = async (invitation: HouseholdInvitation) => {
    try {
      setIsLoading(true);
      await acceptInvitation(invitation.id, user?.sub || 'current-user');

      // Mock: create household from invitation data
      const joinedHousehold: LocalHousehold = {
        id: invitation.householdId,
        name: invitation.householdName,
        inviteCode: '',
        members: [
          {
            userId: user?.sub || 'current-user',
            role: 'member',
            name: user?.username || 'You',
            email: user?.email || 'user@example.com',
          },
        ],
      };
      setHousehold(joinedHousehold);
      setIncomingInvitations([]);
      Alert.alert('Success', `Joined ${invitation.householdName}!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await declineInvitation(invitationId);
      setIncomingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch {
      Alert.alert('Error', 'Failed to decline invitation');
    }
  };
```

Add role management handler:

```typescript
  const handleChangeRole = (memberId: string, newRole: HouseholdRole) => {
    if (!canChangeRoles(currentRole)) {
      Alert.alert('Error', 'Only the owner can change roles');
      return;
    }

    if (newRole === 'owner') {
      Alert.alert(
        'Transfer Ownership',
        'This will make this member the new owner and change your role to admin. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Transfer',
            style: 'destructive',
            onPress: () => {
              if (household) {
                setHousehold({
                  ...household,
                  members: household.members.map((m) => {
                    if (m.userId === memberId) return { ...m, role: 'owner' };
                    if (m.userId === (user?.sub || 'current-user')) return { ...m, role: 'admin' };
                    return m;
                  }),
                });
              }
            },
          },
        ]
      );
      return;
    }

    if (household) {
      setHousehold({
        ...household,
        members: household.members.map((m) =>
          m.userId === memberId ? { ...m, role: newRole } : m
        ),
      });
    }
  };
```

In the "Has household" render section, update the member row to show role badges and management:

```typescript
  {household.members.map((member) => (
    <View key={member.userId} style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {member.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {member.name}
          {member.userId === (user?.sub || 'current-user') && ' (You)'}
        </Text>
        <Text style={styles.memberEmail}>{member.email}</Text>
      </View>
      <View style={styles.roleBadge(member.role)}>
        <Text style={styles.roleBadgeText}>{member.role.charAt(0).toUpperCase() + member.role.slice(1)}</Text>
      </View>
      {canChangeRoles(currentRole) &&
        member.userId !== (user?.sub || 'current-user') && (
          <TouchableOpacity
            style={styles.roleChangeButton}
            onPress={() => {
              const nextRole: HouseholdRole =
                member.role === 'member' ? 'admin' : 'member';
              handleChangeRole(member.userId, nextRole);
            }}
          >
            <Text style={styles.roleChangeText}>
              {member.role === 'member' ? '↑' : '↓'}
            </Text>
          </TouchableOpacity>
        )}
      {canRemoveMember(currentRole) &&
        member.userId !== (user?.sub || 'current-user') && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveMember(member.userId)}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        )}
    </View>
  ))}
```

Add the email invitation section after the invite code section:

```typescript
  {/* Email Invitations */}
  {canManageInvitations(currentRole) && (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Invite by Email</Text>
      <View style={styles.inviteEmailRow}>
        <TextInput
          style={styles.inviteEmailInput}
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="Enter email address"
          placeholderTextColor="#8E8E93"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.inviteSendButton, !inviteEmail.trim() && styles.buttonDisabled]}
          onPress={handleSendInvitation}
          disabled={!inviteEmail.trim() || isLoading}
        >
          <Text style={styles.inviteSendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Pending Invitations */}
      {householdInvitations.filter((i) => i.status === 'pending').length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Pending Invitations</Text>
          {householdInvitations
            .filter((i) => i.status === 'pending')
            .map((invitation) => (
              <View key={invitation.id} style={styles.invitationRow}>
                <View style={styles.invitationInfo}>
                  <Text style={styles.invitationEmail}>{invitation.email}</Text>
                  <Text style={styles.invitationDate}>
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRevokeInvitation(invitation.id)}
                >
                  <Text style={styles.revokeText}>Revoke</Text>
                </TouchableOpacity>
              </View>
            ))}
        </>
      )}
    </View>
  )}
```

In the "No household" section, add incoming invitations before the create/join options:

```typescript
  {/* Incoming Invitations */}
  {incomingInvitations.length > 0 && (
    <View style={styles.incomingSection}>
      <Text style={styles.incomingSectionTitle}>Pending Invitations</Text>
      {incomingInvitations.map((invitation) => (
        <View key={invitation.id} style={styles.incomingCard}>
          <Text style={styles.incomingHousehold}>{invitation.householdName}</Text>
          <Text style={styles.incomingExpiry}>
            Expires {new Date(invitation.expiresAt).toLocaleDateString()}
          </Text>
          <View style={styles.incomingActions}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAcceptInvitation(invitation)}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => handleDeclineInvitation(invitation.id)}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  )}
```

Use `canDeleteHousehold(currentRole)` to guard the delete button:

```typescript
  <TouchableOpacity
    style={styles.leaveButton}
    onPress={handleLeaveHousehold}
  >
    <Text style={styles.leaveButtonText}>
      {canDeleteHousehold(currentRole) ? 'Delete Household' : 'Leave Household'}
    </Text>
  </TouchableOpacity>
```

Add new styles for email invitations and role management:

```typescript
  roleBadge: (role: HouseholdRole) => ({
    backgroundColor: role === 'owner' ? '#34C759' : role === 'admin' ? '#007AFF' : '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  }),
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  roleChangeButton: {
    padding: 8,
    marginRight: 4,
  },
  roleChangeText: {
    fontSize: 16,
    color: '#007AFF',
  },
  inviteEmailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteEmailInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  inviteSendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  inviteSendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  invitationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 15,
    color: '#000',
  },
  invitationDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  revokeText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  incomingSection: {
    padding: 16,
    marginBottom: 16,
  },
  incomingSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  incomingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  incomingHousehold: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  incomingExpiry: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 12,
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#E5E5EA',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
  },
```

Note: `roleBadge` uses a function, which StyleSheet.create doesn't support. Instead, make it an inline style or create separate styles for each role:

```typescript
  roleBadgeOwner: {
    backgroundColor: '#34C759',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  roleBadgeAdmin: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  roleBadgeMember: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
```

And use them as:

```typescript
  const ROLE_BADGE_STYLES: Record<HouseholdRole, object> = {
    owner: styles.roleBadgeOwner,
    admin: styles.roleBadgeAdmin,
    member: styles.roleBadgeMember,
  };

  // In JSX:
  <View style={ROLE_BADGE_STYLES[member.role]}>
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/screens/HouseholdScreen.tsx
git commit -m "feat: add email invitations and role-based management to household screen (#9, #10)"
```

---

### Task 12: Permission Gating in Inventory and Shopping Screens

**Files:**
- Modify: `src/screens/InventoryScreen.tsx`

- [ ] **Step 1: Add permission-based edit/delete gating in InventoryScreen**

In `src/screens/InventoryScreen.tsx`, add imports:

```typescript
import { canEditItem, canDeleteItem } from '@/services/permissionService';
import { HouseholdRole } from '@/types';
```

Add a mock role state (in production this would come from the household store):

```typescript
  // For now, derive role from household data
  // In production, this comes from the household membership data
  const userRole: HouseholdRole = 'owner'; // TODO: Get from household membership
  const currentUserId = user?.sub || 'current-user';
```

Update the `handleEdit` and `handleDelete` functions:

```typescript
  const handleEdit = (item: InventoryItem) => {
    if (item.ownership === 'household' && !canEditItem(userRole, item.userId, currentUserId)) {
      Alert.alert('Permission Denied', 'You can only edit your own items in this household');
      return;
    }
    navigation.navigate('EditItem', { itemId: item.id });
  };

  const handleDelete = (item: InventoryItem) => {
    if (item.ownership === 'household' && !canDeleteItem(userRole, item.userId, currentUserId)) {
      Alert.alert('Permission Denied', 'You can only delete your own items in this household');
      return;
    }
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteItem(item.id),
        },
      ]
    );
  };
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/InventoryScreen.tsx
git commit -m "feat: add permission gating for inventory edit/delete (#10)"
```

---

### Task 13: Final Verification and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx tsc --noEmit`

Fix any remaining type errors.

- [ ] **Step 2: Run the app to verify it starts**

Run: `cd /Users/huiliang/GitHub/ShelfLife && npx expo start --no-dev --minify 2>&1 | head -30`

Verify no bundler errors.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type errors and cleanup for features #8-#11"
```
