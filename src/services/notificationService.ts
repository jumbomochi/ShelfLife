import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem } from '@/types';

const NOTIFICATION_SETTINGS_KEY = '@shelflife_notification_settings';

export interface NotificationSettings {
  enabled: boolean;
  expirationWarningDays: number[]; // Days before expiration to notify
  dailyReminderTime: string; // HH:MM format
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  expirationWarningDays: [1, 3, 7],
  dailyReminderTime: '09:00',
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============ Permission Handling ============

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiration-alerts', {
      name: 'Expiration Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });
  }

  return true;
}

// ============ Settings Management ============

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load notification settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}

// ============ Notification Scheduling ============

export async function scheduleExpirationNotifications(items: InventoryItem[]): Promise<void> {
  const settings = await getNotificationSettings();

  if (!settings.enabled) {
    return;
  }

  // Cancel all existing expiration notifications
  await cancelAllExpirationNotifications();

  const now = new Date();

  for (const item of items) {
    if (!item.expirationDate) continue;

    const expirationDate = new Date(item.expirationDate);
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Schedule notifications for each warning day
    for (const warningDays of settings.expirationWarningDays) {
      if (daysUntilExpiration === warningDays) {
        // Item expires in exactly warningDays days - schedule for today
        await scheduleNotification(item, warningDays, now);
      } else if (daysUntilExpiration > warningDays) {
        // Schedule for future date
        const notificationDate = new Date(expirationDate);
        notificationDate.setDate(notificationDate.getDate() - warningDays);

        // Set notification time from settings
        const [hours, minutes] = settings.dailyReminderTime.split(':').map(Number);
        notificationDate.setHours(hours, minutes, 0, 0);

        if (notificationDate > now) {
          await scheduleNotification(item, warningDays, notificationDate);
        }
      }
    }

    // Schedule notification for day of expiration
    if (daysUntilExpiration >= 0) {
      const expirationNotifDate = new Date(expirationDate);
      const [hours, minutes] = settings.dailyReminderTime.split(':').map(Number);
      expirationNotifDate.setHours(hours, minutes, 0, 0);

      if (expirationNotifDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Item Expiring Today!',
            body: `${item.name} expires today. Use it or lose it!`,
            data: { itemId: item.id, type: 'expiration' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: expirationNotifDate,
          },
          identifier: `expiration-${item.id}-0`,
        });
      }
    }
  }
}

async function scheduleNotification(
  item: InventoryItem,
  daysUntilExpiration: number,
  date: Date
): Promise<void> {
  const dayText = daysUntilExpiration === 1 ? 'day' : 'days';
  const emoji = daysUntilExpiration <= 1 ? '🚨' : daysUntilExpiration <= 3 ? '⚠️' : '📅';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${emoji} Expiring Soon: ${item.name}`,
      body: `${item.name} will expire in ${daysUntilExpiration} ${dayText}. Location: ${item.location}`,
      data: { itemId: item.id, type: 'expiration-warning', daysUntilExpiration },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
    identifier: `expiration-${item.id}-${daysUntilExpiration}`,
  });
}

export async function cancelAllExpirationNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduled) {
    if (notification.identifier.startsWith('expiration-')) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

// ============ Immediate Notifications ============

export async function sendImmediateNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Immediate
  });
}

// ============ Daily Summary ============

export async function scheduleDailySummary(
  expiringCount: number,
  expiredCount: number
): Promise<void> {
  const settings = await getNotificationSettings();

  if (!settings.enabled || (expiringCount === 0 && expiredCount === 0)) {
    return;
  }

  // Cancel existing daily summary
  await Notifications.cancelScheduledNotificationAsync('daily-summary');

  const [hours, minutes] = settings.dailyReminderTime.split(':').map(Number);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours, minutes, 0, 0);

  let body = '';
  if (expiredCount > 0 && expiringCount > 0) {
    body = `${expiredCount} item(s) have expired and ${expiringCount} item(s) are expiring soon.`;
  } else if (expiredCount > 0) {
    body = `${expiredCount} item(s) have expired. Time to check your inventory!`;
  } else {
    body = `${expiringCount} item(s) are expiring soon. Plan your meals accordingly!`;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📦 Daily Inventory Summary',
      body,
      data: { type: 'daily-summary' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
    identifier: 'daily-summary',
  });
}

// ============ Badge Management ============

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
