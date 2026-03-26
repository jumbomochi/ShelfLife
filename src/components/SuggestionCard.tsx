import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ShoppingSuggestion } from '@/types';

const SOURCE_COLORS: Record<ShoppingSuggestion['source'], string> = {
  expiring: '#FF9500',
  low_stock: '#FF3B30',
  history: '#5856D6',
  recipe: '#34C759',
};

interface SuggestionCardProps {
  suggestion: ShoppingSuggestion;
  onAdd: (suggestion: ShoppingSuggestion) => void;
  onDismiss: (suggestion: ShoppingSuggestion) => void;
}

export default function SuggestionCard({
  suggestion,
  onAdd,
  onDismiss,
}: SuggestionCardProps) {
  const color = SOURCE_COLORS[suggestion.source];

  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <View style={styles.content}>
        <Text style={styles.name}>{suggestion.name}</Text>
        <Text style={styles.reason}>{suggestion.reason}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onAdd(suggestion)}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => onDismiss(suggestion)}
        >
          <Text style={styles.dismissButtonText}>x</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  reason: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
});
