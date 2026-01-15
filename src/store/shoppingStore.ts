import { create } from 'zustand';
import { ShoppingList, ShoppingListItem } from '@/types';
import {
  saveShoppingListsLocal,
  loadShoppingListsLocal,
  addToSyncQueue,
} from '@/services/syncService';

interface ShoppingState {
  lists: ShoppingList[];
  activeListId: string | null;
  isLoading: boolean;
  isSyncing: boolean;

  // Actions
  createList: (name: string) => string;
  deleteList: (listId: string) => Promise<void>;
  setActiveList: (listId: string | null) => void;

  // Item actions
  addItem: (listId: string, item: Omit<ShoppingListItem, 'id' | 'checked'>) => Promise<void>;
  addItems: (listId: string, items: Omit<ShoppingListItem, 'id' | 'checked'>[]) => Promise<void>;
  updateItem: (listId: string, itemId: string, updates: Partial<ShoppingListItem>) => Promise<void>;
  removeItem: (listId: string, itemId: string) => Promise<void>;
  toggleItemChecked: (listId: string, itemId: string) => Promise<void>;
  clearCheckedItems: (listId: string) => Promise<void>;

  // Sync
  loadFromLocal: () => Promise<void>;
  setLists: (lists: ShoppingList[]) => void;

  // Selectors
  getActiveList: () => ShoppingList | undefined;
  getList: (listId: string) => ShoppingList | undefined;
  getCheckedCount: (listId: string) => number;
  getUncheckedCount: (listId: string) => number;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to save and sync
async function saveAndSync(lists: ShoppingList[], updatedList: ShoppingList, type: 'CREATE' | 'UPDATE' | 'DELETE') {
  await saveShoppingListsLocal(lists);
  await addToSyncQueue({
    type,
    entity: 'SHOPPING_LIST',
    data: type === 'DELETE' ? { id: updatedList.id } : updatedList,
  });
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  lists: [],
  activeListId: null,
  isLoading: false,
  isSyncing: false,

  createList: (name) => {
    const now = new Date().toISOString();
    const newList: ShoppingList = {
      id: generateId(),
      userId: 'current-user',
      name,
      items: [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      lists: [...state.lists, newList],
      activeListId: newList.id,
    }));

    // Async save (fire and forget for immediate response)
    const lists = get().lists;
    saveAndSync(lists, newList, 'CREATE');

    return newList.id;
  },

  deleteList: async (listId) => {
    const listToDelete = get().lists.find((l) => l.id === listId);

    set((state) => ({
      lists: state.lists.filter((l) => l.id !== listId),
      activeListId: state.activeListId === listId ? null : state.activeListId,
    }));

    if (listToDelete) {
      await saveAndSync(get().lists, listToDelete, 'DELETE');
    }
  },

  setActiveList: (listId) => set({ activeListId: listId }),

  addItem: async (listId, itemData) => {
    const newItem: ShoppingListItem = {
      ...itemData,
      id: generateId(),
      checked: false,
    };

    let updatedList: ShoppingList | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id === listId) {
          updatedList = {
            ...list,
            items: [...list.items, newItem],
            updatedAt: new Date().toISOString(),
          };
          return updatedList;
        }
        return list;
      }),
    }));

    if (updatedList) {
      await saveAndSync(get().lists, updatedList, 'UPDATE');
    }
  },

  addItems: async (listId, items) => {
    const newItems: ShoppingListItem[] = items.map((item) => ({
      ...item,
      id: generateId(),
      checked: false,
    }));

    let updatedList: ShoppingList | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id === listId) {
          updatedList = {
            ...list,
            items: [...list.items, ...newItems],
            updatedAt: new Date().toISOString(),
          };
          return updatedList;
        }
        return list;
      }),
    }));

    if (updatedList) {
      await saveAndSync(get().lists, updatedList, 'UPDATE');
    }
  },

  updateItem: async (listId, itemId, updates) => {
    let updatedList: ShoppingList | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id === listId) {
          updatedList = {
            ...list,
            items: list.items.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
            updatedAt: new Date().toISOString(),
          };
          return updatedList;
        }
        return list;
      }),
    }));

    if (updatedList) {
      await saveAndSync(get().lists, updatedList, 'UPDATE');
    }
  },

  removeItem: async (listId, itemId) => {
    let updatedList: ShoppingList | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id === listId) {
          updatedList = {
            ...list,
            items: list.items.filter((item) => item.id !== itemId),
            updatedAt: new Date().toISOString(),
          };
          return updatedList;
        }
        return list;
      }),
    }));

    if (updatedList) {
      await saveAndSync(get().lists, updatedList, 'UPDATE');
    }
  },

  toggleItemChecked: async (listId, itemId) => {
    let updatedList: ShoppingList | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id === listId) {
          updatedList = {
            ...list,
            items: list.items.map((item) =>
              item.id === itemId ? { ...item, checked: !item.checked } : item
            ),
            updatedAt: new Date().toISOString(),
          };
          return updatedList;
        }
        return list;
      }),
    }));

    if (updatedList) {
      await saveAndSync(get().lists, updatedList, 'UPDATE');
    }
  },

  clearCheckedItems: async (listId) => {
    let updatedList: ShoppingList | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id === listId) {
          updatedList = {
            ...list,
            items: list.items.filter((item) => !item.checked),
            updatedAt: new Date().toISOString(),
          };
          return updatedList;
        }
        return list;
      }),
    }));

    if (updatedList) {
      await saveAndSync(get().lists, updatedList, 'UPDATE');
    }
  },

  loadFromLocal: async () => {
    set({ isLoading: true });
    try {
      const lists = await loadShoppingListsLocal();
      set({
        lists,
        activeListId: lists.length > 0 ? lists[0].id : null,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  setLists: (lists) => set({ lists }),

  getActiveList: () => {
    const state = get();
    return state.lists.find((l) => l.id === state.activeListId);
  },

  getList: (listId) => {
    return get().lists.find((l) => l.id === listId);
  },

  getCheckedCount: (listId) => {
    const list = get().lists.find((l) => l.id === listId);
    return list?.items.filter((i) => i.checked).length || 0;
  },

  getUncheckedCount: (listId) => {
    const list = get().lists.find((l) => l.id === listId);
    return list?.items.filter((i) => !i.checked).length || 0;
  },
}));
