import { useEffect, useRef } from 'react';
import { useInventoryStore, useAuthStore } from '@/store';
import {
  requestNotificationPermissions,
  scheduleExpirationNotifications,
  setBadgeCount,
  getNotificationSettings,
  registerPushToken,
  notifyLowStockItems,
} from '@/services/notificationService';
import * as Notifications from 'expo-notifications';
import { navigateIfReady } from '@/navigation/navigationRef';

function handleNotificationPayload(data: Record<string, any> | undefined): void {
  if (!data) return;

  switch (data.type) {
    case 'expiration':
    case 'expiration-warning':
      if (typeof data.itemId === 'string') {
        navigateIfReady('EditItem', { itemId: data.itemId });
      } else {
        navigateIfReady('MainTabs', { screen: 'Inventory' });
      }
      break;
    case 'low-stock':
      if (typeof data.itemId === 'string') {
        navigateIfReady('EditItem', { itemId: data.itemId });
      } else {
        navigateIfReady('MainTabs', { screen: 'Shopping' });
      }
      break;
    case 'daily-summary':
      navigateIfReady('MainTabs', { screen: 'Home' });
      break;
    case 'household':
      navigateIfReady('HouseholdManagement');
      break;
    default:
      break;
  }
}

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const hasRegistered = useRef(false);

  const { isAuthenticated, user } = useAuthStore();
  const { items, getExpiringItems, getLowStockItems } = useInventoryStore();

  // Request permissions and set up listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    const setup = async () => {
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      // Register push token with backend (once per session)
      if (!hasRegistered.current && user?.sub) {
        hasRegistered.current = true;
        registerPushToken(user.sub);
      }

      // Listen for notifications received while app is foregrounded
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        // Foreground delivery — handler in notificationService decides UI behavior
      });

      // Listen for user interaction with notification (foreground & background)
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, any> | undefined;
        handleNotificationPayload(data);
      });

      // Cold start: app was launched by tapping a notification
      const initialResponse = await Notifications.getLastNotificationResponseAsync();
      if (initialResponse) {
        const data = initialResponse.notification.request.content.data as Record<string, any> | undefined;
        handleNotificationPayload(data);
      }
    };

    setup();

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);

  // Schedule notifications when inventory changes
  useEffect(() => {
    if (!isAuthenticated || items.length === 0) return;

    const scheduleNotifications = async () => {
      const settings = await getNotificationSettings();
      if (!settings.enabled) return;

      await scheduleExpirationNotifications(items);

      // Low-stock check is event-driven (no scheduling) — fire if items are below threshold.
      await notifyLowStockItems(getLowStockItems());

      // Update badge with count of items expiring in 3 days plus low stock
      const expiringItems = getExpiringItems(3);
      const lowStock = getLowStockItems();
      await setBadgeCount(expiringItems.length + lowStock.length);
    };

    scheduleNotifications();
  }, [isAuthenticated, items]);

  return {
    requestPermissions: requestNotificationPermissions,
  };
}
