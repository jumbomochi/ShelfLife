import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSyncStore } from '@/store';

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SyncStatusIndicator() {
  const { status, lastSyncAt, lastError, pendingCount, triggerSync } = useSyncStore();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'syncing') {
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spin.stopAnimation();
      spin.setValue(0);
    }
  }, [status, spin]);

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const Body = (
    <View style={styles.container}>
      {status === 'syncing' && (
        <>
          <Animated.Text style={[styles.icon, { transform: [{ rotate: rotation }] }]}>↻</Animated.Text>
          <Text style={styles.text}>Syncing…</Text>
        </>
      )}
      {status === 'success' && (
        <>
          <Text style={[styles.icon, styles.successIcon]}>✓</Text>
          <Text style={styles.text}>Synced {formatRelativeTime(lastSyncAt)}</Text>
        </>
      )}
      {status === 'error' && (
        <>
          <Text style={[styles.icon, styles.errorIcon]}>⚠</Text>
          <Text style={styles.text}>{lastError ?? 'Sync failed'} · tap to retry</Text>
        </>
      )}
      {status === 'offline' && (
        <>
          <Text style={[styles.icon, styles.offlineIcon]}>◌</Text>
          <Text style={styles.text}>
            Offline{pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
          </Text>
        </>
      )}
      {status === 'idle' && lastSyncAt && (
        <>
          <Text style={styles.icon}>·</Text>
          <Text style={styles.text}>Last sync {formatRelativeTime(lastSyncAt)}</Text>
        </>
      )}
      {pendingCount > 0 && status !== 'offline' && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      )}
    </View>
  );

  if (status === 'error' && triggerSync) {
    return (
      <TouchableOpacity onPress={() => triggerSync()} style={styles.touchable}>
        {Body}
      </TouchableOpacity>
    );
  }

  return Body;
}

const styles = StyleSheet.create({
  touchable: {},
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  icon: {
    fontSize: 14,
    color: '#666',
  },
  successIcon: {
    color: '#34C759',
  },
  errorIcon: {
    color: '#FF3B30',
  },
  offlineIcon: {
    color: '#8E8E93',
  },
  text: {
    fontSize: 12,
    color: '#666',
  },
  badge: {
    marginLeft: 4,
    backgroundColor: '#FF9500',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
});
