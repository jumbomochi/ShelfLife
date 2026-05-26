import { useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useConflictStore } from '@/store';
import { SyncConflict } from '@/types';

function formatValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ConflictRow({ field, localVal, remoteVal }: { field: string; localVal: any; remoteVal: any }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldName}>{field}</Text>
      <View style={styles.valueComparison}>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>This device</Text>
          <Text style={styles.valueText}>{formatValue(localVal)}</Text>
        </View>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Server</Text>
          <Text style={styles.valueText}>{formatValue(remoteVal)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ConflictResolutionModal() {
  const { conflicts, refresh, resolve } = useConflictStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const current: SyncConflict | undefined = conflicts[0];
  const visible = !!current;

  if (!current) {
    return null;
  }

  const entityLabel = current.entity === 'INVENTORY' ? 'Item' : 'Shopping List';
  const name = current.local?.name ?? current.remote?.name ?? 'this entry';

  const handleChoice = async (choice: 'local' | 'remote') => {
    await resolve(current.id, choice);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Sync Conflict</Text>
          <Text style={styles.subtitle}>
            {entityLabel}: {name}
          </Text>
        </View>

        <ScrollView style={styles.body}>
          <Text style={styles.intro}>
            This {entityLabel.toLowerCase()} was changed on another device while you were editing.
            Pick which version to keep.
          </Text>

          {current.conflictingFields.map((field) => (
            <ConflictRow
              key={field}
              field={field}
              localVal={current.local?.[field]}
              remoteVal={current.remote?.[field]}
            />
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => handleChoice('remote')}
          >
            <Text style={styles.buttonSecondaryText}>Use Server Version</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => handleChoice('local')}
          >
            <Text style={styles.buttonPrimaryText}>Keep My Changes</Text>
          </TouchableOpacity>
        </View>

        {conflicts.length > 1 && (
          <Text style={styles.queueIndicator}>
            {conflicts.length - 1} more conflict{conflicts.length - 1 === 1 ? '' : 's'} pending
          </Text>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  intro: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  fieldRow: {
    marginBottom: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 12,
  },
  fieldName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  valueComparison: {
    flexDirection: 'row',
    gap: 8,
  },
  valueBox: {
    flex: 1,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  valueLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 14,
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonSecondary: {
    backgroundColor: '#F2F2F7',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  queueIndicator: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
    paddingBottom: 12,
  },
});
