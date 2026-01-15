import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import {
  getNotificationSettings,
  saveNotificationSettings,
  NotificationSettings,
  requestNotificationPermissions,
} from '@/services/notificationService';
import { clearAllLocalData } from '@/services/syncService';
import { useAuthStore } from '@/store';

interface SettingsScreenProps {
  onClose: () => void;
}

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { signOut } = useAuthStore();
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    expirationWarningDays: [1, 3, 7],
    dailyReminderTime: '09:00',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await getNotificationSettings();
    setSettings(loaded);
    setIsLoading(false);
  };

  const updateSetting = async <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  const toggleWarningDay = async (day: number) => {
    const currentDays = settings.expirationWarningDays;
    let newDays: number[];

    if (currentDays.includes(day)) {
      newDays = currentDays.filter((d) => d !== day);
    } else {
      newDays = [...currentDays, day].sort((a, b) => a - b);
    }

    await updateSetting('expirationWarningDays', newDays);
  };

  const handleEnableNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permissions Required',
          'Please enable notifications in your device settings to receive expiration alerts.'
        );
        return;
      }
    }
    await updateSetting('enabled', enabled);
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your local data including inventory, shopping lists, and saved recipes. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            await clearAllLocalData();
            await signOut();
          },
        },
      ]
    );
  };

  const warningDayOptions = [1, 3, 5, 7, 14];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive alerts for expiring items
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleEnableNotifications}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#fff"
            />
          </View>

          {settings.enabled && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Warning Days</Text>
                  <Text style={styles.settingDescription}>
                    Days before expiration to notify
                  </Text>
                </View>
              </View>

              <View style={styles.warningDaysContainer}>
                {warningDayOptions.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.warningDayButton,
                      settings.expirationWarningDays.includes(day) &&
                        styles.warningDayButtonActive,
                    ]}
                    onPress={() => toggleWarningDay(day)}
                  >
                    <Text
                      style={[
                        styles.warningDayText,
                        settings.expirationWarningDays.includes(day) &&
                          styles.warningDayTextActive,
                      ]}
                    >
                      {day} {day === 1 ? 'day' : 'days'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Daily Reminder Time</Text>
                  <Text style={styles.settingDescription}>
                    When to send daily notifications
                  </Text>
                </View>
                <Text style={styles.timeValue}>{settings.dailyReminderTime}</Text>
              </View>
            </>
          )}
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>

          <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
            <Text style={styles.dangerButtonText}>Clear All Local Data</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>

          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Build</Text>
            <Text style={styles.aboutValue}>1</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 50,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6D6D72',
    textTransform: 'uppercase',
    marginLeft: 16,
    marginTop: -20,
    marginBottom: 8,
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 17,
    color: '#000',
  },
  settingDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  warningDaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  warningDayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
  },
  warningDayButtonActive: {
    backgroundColor: '#007AFF',
  },
  warningDayText: {
    fontSize: 15,
    color: '#000',
  },
  warningDayTextActive: {
    color: '#fff',
  },
  timeValue: {
    fontSize: 17,
    color: '#8E8E93',
  },
  dangerButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerButtonText: {
    fontSize: 17,
    color: '#FF3B30',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  aboutLabel: {
    fontSize: 17,
    color: '#000',
  },
  aboutValue: {
    fontSize: 17,
    color: '#8E8E93',
  },
});
