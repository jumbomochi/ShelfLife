import { create } from 'zustand';
import { InventoryItem, ItemLocation, ItemOwnership } from '@/types';
import {
  saveInventoryLocal,
  loadInventoryLocal,
  addToSyncQueue,
} from '@/services/syncService';

interface InventoryState {
  items: InventoryItem[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  // Actions
  addItem: (item: Omit<InventoryItem, 'id' | 'addedAt' | 'updatedAt'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setItems: (items: InventoryItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Sync
  loadFromLocal: () => Promise<void>;
  syncToCloud: () => Promise<void>;

  // Selectors
  getItemsByLocation: (location: ItemLocation) => InventoryItem[];
  getExpiringItems: (daysThreshold: number) => InventoryItem[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
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

  getItemsByLocation: (location) => {
    return get().items.filter((item) => item.location === location);
  },

  getExpiringItems: (daysThreshold) => {
    const now = new Date();
    const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

    return get().items.filter((item) => {
      if (!item.expirationDate) return false;
      const expDate = new Date(item.expirationDate);
      return expDate <= threshold && expDate >= now;
    });
  },
}));
