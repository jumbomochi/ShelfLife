import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { processSyncQueue, fullSync } from '@/services/syncService';
import {
  useAuthStore,
  useInventoryStore,
  useRecipesStore,
  useShoppingStore,
  useConflictStore,
  useSyncStore,
} from '@/store';
import { getPendingSyncCount } from '@/services/syncService';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useSync() {
  const appState = useRef(AppState.currentState);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { user, isAuthenticated } = useAuthStore();
  const { setItems: setInventoryItems } = useInventoryStore();
  const { setSavedRecipes } = useRecipesStore();
  const { setLists: setShoppingLists } = useShoppingStore();
  const { refresh: refreshConflicts } = useConflictStore();
  const { setStatus, setLastSyncAt, setLastError, setPendingCount, setOnline, setTriggerSync } = useSyncStore();

  const updatePendingCount = async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
  };

  const performSync = async () => {
    if (!isAuthenticated || !user?.sub) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setStatus('offline');
      setOnline(false);
      await updatePendingCount();
      return;
    }
    setOnline(true);
    setStatus('syncing');

    try {
      await processSyncQueue(user.sub);
      const data = await fullSync(user.sub);

      setInventoryItems(data.inventory);
      setSavedRecipes(data.savedRecipes);
      setShoppingLists(data.shoppingLists);

      await refreshConflicts();
      await updatePendingCount();

      setLastSyncAt(new Date().toISOString());
      setLastError(null);
      setStatus('success');
    } catch (error: any) {
      console.error('Sync failed:', error);
      setLastError(error?.message ?? 'Sync failed');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // App came to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        performSync();
      }
      appState.current = nextAppState;
    });

    // Subscribe to network changes — auto-sync when coming back online
    const netUnsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true;
      setOnline(online);
      if (online) {
        performSync();
      } else {
        setStatus('offline');
      }
    });

    // Set up periodic sync
    syncIntervalRef.current = setInterval(performSync, SYNC_INTERVAL);

    // Expose manual sync trigger for UI retry
    setTriggerSync(performSync);

    // Initial sync when hook mounts
    performSync();

    return () => {
      subscription.remove();
      netUnsubscribe();
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      setTriggerSync(null);
    };
  }, [isAuthenticated, user?.sub]);

  return { performSync };
}
