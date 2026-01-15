import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ShoppingListItem } from '@/types';

interface ShoppingListItemCardProps {
  item: ShoppingListItem;
  onToggle: () => void;
  onDelete: () => void;
}

export default function ShoppingListItemCard({
  item,
  onToggle,
  onDelete,
}: ShoppingListItemCardProps) {
  return (
    <TouchableOpacity
      style={[styles.container, item.checked && styles.containerChecked]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
        {item.checked && <Text style={styles.checkmark}>✓</Text>}
      </View>

      <View style={styles.content}>
        <Text style={[styles.name, item.checked && styles.nameChecked]}>
          {item.name}
        </Text>
        <Text style={[styles.quantity, item.checked && styles.quantityChecked]}>
          {item.quantity} {item.unit}
        </Text>
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerChecked: {
    backgroundColor: '#F2F2F7',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: '#000',
  },
  nameChecked: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  quantity: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  quantityChecked: {
    color: '#8E8E93',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteText: {
    fontSize: 24,
    color: '#C7C7CC',
    fontWeight: '300',
  },
});
