import { create } from 'zustand';
import { InventoryItem, ItemLocation, ItemOwnership } from '@/types';
import {
  saveInventoryLocal,
  loadInventoryLocal,
  addToSyncQueue,
} from '@/services/syncService';
import {
  getInventoryItemsByUserMock,
  getInventoryItemsByHouseholdMock,
} from '@/services/dynamoDBService';

interface InventoryState {
  items: InventoryItem[];
  householdItems: InventoryItem[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions
  addItem: (item: Omit<InventoryItem, 'id' | 'addedAt' | 'updatedAt'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setItems: (items: InventoryItem[]) => void;
  setHouseholdItems: (items: InventoryItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Sync
  loadFromLocal: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  syncHouseholdItems: (userId: string, householdId?: string) => Promise<void>;

  // Selectors
  getAllItems: () => InventoryItem[];
  getItemsByLocation: (location: ItemLocation) => InventoryItem[];
  getItemsByOwnership: (ownership: ItemOwnership) => InventoryItem[];
  getExpiringItems: (daysThreshold: number) => InventoryItem[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  householdItems: [],
  isLoading: false,
  isSyncing: false,
  error: null,

  addItem: async (itemData) => {
    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      ...itemData,
      id: generateId(),
      addedAt: now,
      updatedAt: now,
    };

    // Update local state
    set((state) => ({ items: [...state.items, newItem] }));

    // Save to local storage
    const updatedItems = get().items;
    await saveInventoryLocal(updatedItems);

    // Add to sync queue
    await addToSyncQueue({
      type: 'CREATE',
      entity: 'INVENTORY',
      data: newItem,
    });
  },

  updateItem: async (id, updates) => {
    const now = new Date().toISOString();
    let updatedItem: InventoryItem | null = null;

    set((state) => ({
      items: state.items.map((item) => {
        if (item.id === id) {
          updatedItem = { ...item, ...updates, updatedAt: now };
          return updatedItem;
        }
        return item;
      }),
    }));

    // Save to local storage
    const updatedItems = get().items;
    await saveInventoryLocal(updatedItems);

    // Add to sync queue
    if (updatedItem) {
      await addToSyncQueue({
        type: 'UPDATE',
        entity: 'INVENTORY',
        data: updatedItem,
      });
    }
  },

  deleteItem: async (id) => {
    const itemToDelete = get().items.find((item) => item.id === id);

    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));

    // Save to local storage
    const updatedItems = get().items;
    await saveInventoryLocal(updatedItems);

    // Add to sync queue
    if (itemToDelete) {
      await addToSyncQueue({
        type: 'DELETE',
        entity: 'INVENTORY',
        data: { id },
      });
    }
  },

  setItems: (items) => set({ items }),
  setHouseholdItems: (householdItems) => set({ householdItems }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  loadFromLocal: async () => {
    set({ isLoading: true });
    try {
      const items = await loadInventoryLocal();
      set({ items, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load inventory', isLoading: false });
    }
  },

  syncToCloud: async () => {
    set({ isSyncing: true });
    try {
      // Save current state to local storage
      await saveInventoryLocal(get().items);
      set({ isSyncing: false });
    } catch (error) {
      set({ error: 'Failed to sync inventory', isSyncing: false });
    }
  },

  syncHouseholdItems: async (userId, householdId) => {
    if (!householdId) {
      set({ householdItems: [] });
      return;
    }

    set({ isSyncing: true });
    try {
      // Fetch household items from mock DB
      const householdItems = await getInventoryItemsByHouseholdMock(householdId);

      // Filter out items that belong to current user (avoid duplicates)
      const otherMembersItems = householdItems.filter(item => item.userId !== userId);

      set({ householdItems: otherMembersItems, isSyncing: false });
    } catch (error) {
      set({ error: 'Failed to sync household inventory', isSyncing: false });
    }
  },

  getAllItems: () => {
    const state = get();
    return [...state.items, ...state.householdItems];
  },

  getItemsByLocation: (location) => {
    const allItems = get().getAllItems();
    return allItems.filter((item) => item.location === location);
  },

  getItemsByOwnership: (ownership) => {
    const allItems = get().getAllItems();
    return allItems.filter((item) => item.ownership === ownership);
  },

  getExpiringItems: (daysThreshold) => {
    const now = new Date();
    const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
    const allItems = get().getAllItems();

    return allItems.filter((item) => {
      if (!item.expirationDate) return false;
      const expDate = new Date(item.expirationDate);
      return expDate <= threshold && expDate >= now;
    });
  },
}));
