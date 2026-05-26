import { create } from 'zustand';
import { SyncConflict } from '@/types';
import {
  getConflictQueue,
  resolveConflict as resolveConflictInQueue,
} from '@/services/conflictService';

interface ConflictState {
  conflicts: SyncConflict[];
  isLoading: boolean;

  refresh: () => Promise<void>;
  resolve: (
    conflictId: string,
    choice: 'local' | 'remote' | 'merge',
    mergedData?: any
  ) => Promise<any | null>;
  dismissAll: () => void;
}

export const useConflictStore = create<ConflictState>((set, get) => ({
  conflicts: [],
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    const conflicts = await getConflictQueue();
    set({ conflicts, isLoading: false });
  },

  resolve: async (conflictId, choice, mergedData) => {
    const resolved = await resolveConflictInQueue(conflictId, choice, mergedData);
    await get().refresh();
    return resolved;
  },

  dismissAll: () => set({ conflicts: [] }),
}));
