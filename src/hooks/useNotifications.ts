import { useEffect, useRef } from 'react';
import { useInventoryStore, useAuthStore } from '@/store';
import {
  requestNotificationPermissions,
  scheduleExpirationNotifications,
  setBadgeCount,
  getNotificationSettings,
  registerPushToken,
} from '@/services/notificationService';
import * as Notifications from 'expo-notifications';

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const hasRegistered = useRef(false);

  const { isAuthenticated, user } = useAuthStore();
  const { items, getExpiringItems } = useInventoryStore();

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
      notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notification received:', notification);
      });

      // Listen for user interaction with notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log('Notification response:', data);

        // Handle navigation based on notification type
        if (data?.type === 'expiration' || data?.type === 'expiration-warning') {
          // Could navigate to inventory screen here
        }
      });
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

      // Update badge with count of items expiring in 3 days
      const expiringItems = getExpiringItems(3);
      await setBadgeCount(expiringItems.length);
    };

    scheduleNotifications();
  }, [isAuthenticated, items]);

  return {
    requestPermissions: requestNotificationPermissions,
  };
}
