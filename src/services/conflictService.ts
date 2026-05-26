import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem, ShoppingList, SyncConflict, ConflictEntity } from '@/types';

const CONFLICT_QUEUE_KEY = '@shelflife_conflict_queue';

// Fields that can be safely merged when both sides changed independently.
// If both sides changed the SAME field to DIFFERENT values, it's a conflict.
const INVENTORY_MERGEABLE_FIELDS: (keyof InventoryItem)[] = [
  'name',
  'quantity',
  'unit',
  'location',
  'minQuantity',
  'expirationDate',
  'imageUrl',
];

const SHOPPING_LIST_MERGEABLE_FIELDS: (keyof ShoppingList)[] = ['name', 'items'];

export function detectInventoryConflict(
  local: InventoryItem,
  remote: InventoryItem
): { conflictingFields: string[]; merged: InventoryItem } {
  const conflictingFields: string[] = [];
  const merged: InventoryItem = { ...remote };
  const localNewer = new Date(local.updatedAt) > new Date(remote.updatedAt);

  for (const field of INVENTORY_MERGEABLE_FIELDS) {
    const localVal = local[field];
    const remoteVal = remote[field];
    if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) continue;

    // Field differs. If only one side changed (vs. baseline we'd need), use the changed one.
    // Without a baseline, we treat both sides as "changed" and flag as conflict when
    // local has been edited since remote.updatedAt.
    if (localNewer) {
      conflictingFields.push(field as string);
      (merged[field] as any) = localVal;
    }
  }

  // Bump version to whichever is highest
  merged.version = Math.max(local.version ?? 0, remote.version ?? 0) + 1;
  merged.updatedAt = new Date().toISOString();

  return { conflictingFields, merged };
}

export function detectShoppingListConflict(
  local: ShoppingList,
  remote: ShoppingList
): { conflictingFields: string[]; merged: ShoppingList } {
  const conflictingFields: string[] = [];
  const merged: ShoppingList = { ...remote };
  const localNewer = new Date(local.updatedAt) > new Date(remote.updatedAt);

  for (const field of SHOPPING_LIST_MERGEABLE_FIELDS) {
    if (JSON.stringify(local[field]) === JSON.stringify(remote[field])) continue;
    if (localNewer) {
      conflictingFields.push(field as string);
      (merged[field] as any) = local[field];
    }
  }

  merged.version = Math.max(local.version ?? 0, remote.version ?? 0) + 1;
  merged.updatedAt = new Date().toISOString();

  return { conflictingFields, merged };
}

// ============ Conflict Queue ============

export async function getConflictQueue(): Promise<SyncConflict[]> {
  const data = await AsyncStorage.getItem(CONFLICT_QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

async function saveConflictQueue(queue: SyncConflict[]): Promise<void> {
  await AsyncStorage.setItem(CONFLICT_QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueConflict(
  entity: ConflictEntity,
  entityId: string,
  local: any,
  remote: any,
  conflictingFields: string[]
): Promise<void> {
  const queue = await getConflictQueue();
  // Replace any existing conflict for the same entity to avoid duplicates
  const filtered = queue.filter((c) => !(c.entity === entity && c.entityId === entityId));
  filtered.push({
    id: `${entity}-${entityId}-${Date.now()}`,
    entity,
    entityId,
    local,
    remote,
    conflictingFields,
    detectedAt: new Date().toISOString(),
  });
  await saveConflictQueue(filtered);
}

export async function resolveConflict(
  conflictId: string,
  choice: 'local' | 'remote' | 'merge',
  mergedData?: any
): Promise<any | null> {
  const queue = await getConflictQueue();
  const conflict = queue.find((c) => c.id === conflictId);
  if (!conflict) return null;

  let resolved: any;
  if (choice === 'local') {
    resolved = { ...conflict.local, version: (conflict.remote?.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  } else if (choice === 'remote') {
    resolved = conflict.remote;
  } else {
    resolved = mergedData ?? conflict.local;
  }

  await saveConflictQueue(queue.filter((c) => c.id !== conflictId));
  return resolved;
}

export async function clearConflictQueue(): Promise<void> {
  await AsyncStorage.removeItem(CONFLICT_QUEUE_KEY);
}
