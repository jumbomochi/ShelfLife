import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { InventoryItem } from '@/types';

interface InventoryItemCardProps {
  item: InventoryItem;
  onPress?: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
}

const getExpirationStatus = (expirationDate?: string) => {
  if (!expirationDate) return null;

  const now = new Date();
  const expDate = new Date(expirationDate);
  const daysUntilExpiration = Math.ceil(
    (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiration < 0) {
    return { label: 'Expired', color: '#FF3B30' };
  } else if (daysUntilExpiration <= 3) {
    return { label: `${daysUntilExpiration}d left`, color: '#FF9500' };
  } else if (daysUntilExpiration <= 7) {
    return { label: `${daysUntilExpiration}d left`, color: '#FFCC00' };
  }
  return { label: `${daysUntilExpiration}d left`, color: '#34C759' };
};

export default function InventoryItemCard({
  item,
  onPress,
  onDelete,
}: InventoryItemCardProps) {
  const expirationStatus = getExpirationStatus(item.expirationDate);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(item)}
      activeOpacity={0.7}
    >
      <View style={styles.leftContent}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.details}>
          {item.quantity} {item.unit} • {item.location}
        </Text>
      </View>

      <View style={styles.rightContent}>
        {expirationStatus && (
          <View
            style={[
              styles.expirationBadge,
              { backgroundColor: expirationStatus.color },
            ]}
          >
            <Text style={styles.expirationText}>{expirationStatus.label}</Text>
          </View>
        )}
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(item)}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  leftContent: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#666',
  },
  rightContent: {
    alignItems: 'flex-end',
    gap: 8,
  },
  expirationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expirationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    padding: 4,
  },
  deleteText: {
    fontSize: 12,
    color: '#FF3B30',
  },
});
