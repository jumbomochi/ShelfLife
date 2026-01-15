import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { processSyncQueue, fullSync } from '@/services/syncService';
import { useAuthStore, useInventoryStore, useRecipesStore, useShoppingStore } from '@/store';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useSync() {
  const appState = useRef(AppState.currentState);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { user, isAuthenticated } = useAuthStore();
  const { setItems: setInventoryItems } = useInventoryStore();
  const { setSavedRecipes } = useRecipesStore();
  const { setLists: setShoppingLists } = useShoppingStore();

  const performSync = async () => {
    if (!isAuthenticated || !user?.sub) return;

    try {
      // First, process any pending operations
      await processSyncQueue(user.sub);

      // Then do a full sync to pull latest data
      const data = await fullSync(user.sub);

      // Update stores with synced data
      setInventoryItems(data.inventory);
      setSavedRecipes(data.savedRecipes);
      setShoppingLists(data.shoppingLists);
    } catch (error) {
      console.error('Sync failed:', error);
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

    // Set up periodic sync
    syncIntervalRef.current = setInterval(performSync, SYNC_INTERVAL);

    // Initial sync when hook mounts
    performSync();

    return () => {
      subscription.remove();
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isAuthenticated, user?.sub]);

  return { performSync };
}
