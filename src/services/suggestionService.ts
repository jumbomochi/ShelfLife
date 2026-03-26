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

  // 4. Recipe-based — skip for now since Recipe type doesn't include ingredients
  // Will be enabled when RecipeDetail data is stored with saved recipes

  return suggestions.slice(0, 5);
}
