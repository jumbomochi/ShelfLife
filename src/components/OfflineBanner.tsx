import { StyleSheet, Text, View } from 'react-native';
import { useSyncStore } from '@/store';

export default function OfflineBanner() {
  const { isOnline, pendingCount } = useSyncStore();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        You're offline. {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} will sync` : 'Changes will sync'} when connected.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FF9500',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
