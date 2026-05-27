import { create } from 'zustand';
import { SyncStatus } from '@/types';

interface SyncStoreState {
  status: SyncStatus;
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  triggerSync: (() => Promise<void>) | null;

  setStatus: (status: SyncStatus) => void;
  setOnline: (isOnline: boolean) => void;
  setPendingCount: (count: number) => void;
  setLastSyncAt: (timestamp: string | null) => void;
  setLastError: (error: string | null) => void;
  setTriggerSync: (trigger: (() => Promise<void>) | null) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  status: 'idle',
  isOnline: true,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  triggerSync: null,

  setStatus: (status) => set({ status }),
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setLastError: (lastError) => set({ lastError }),
  setTriggerSync: (triggerSync) => set({ triggerSync }),
}));
