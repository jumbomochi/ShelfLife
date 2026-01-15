import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useInventoryStore } from '@/store';
import { ItemLocation, ItemOwnership } from '@/types';

interface AddItemScreenProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'dozen', 'pack', 'bottle', 'can', 'box'];

export default function AddItemScreen({ onClose, onSuccess }: AddItemScreenProps) {
  const { addItem } = useInventoryStore();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [location, setLocation] = useState<ItemLocation>('fridge');
  const [ownership, setOwnership] = useState<ItemOwnership>('personal');
  const [expirationDate, setExpirationDate] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    addItem({
      userId: 'current-user', // TODO: Replace with actual user ID from auth
      name: name.trim(),
      quantity: qty,
      unit,
      location,
      ownership,
      expirationDate: expirationDate || undefined,
    });

    onSuccess?.();
    onClose();
  };

  const renderToggleButton = <T extends string>(
    value: T,
    currentValue: T,
    onSelect: (value: T) => void,
    label: string
  ) => (
    <TouchableOpacity
      style={[
        styles.toggleButton,
        currentValue === value && styles.toggleButtonActive,
      ]}
      onPress={() => onSelect(value)}
    >
      <Text
        style={[
          styles.toggleButtonText,
          currentValue === value && styles.toggleButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Item</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Milk, Eggs, Bread"
            placeholderTextColor="#999"
            autoFocus
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.textInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor="#999"
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
            <Text style={styles.label}>Unit</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.unitPicker}
            >
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitButton, unit === u && styles.unitButtonActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      unit === u && styles.unitButtonTextActive,
                    ]}
                  >
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.toggleContainer}>
            {renderToggleButton('fridge', location, setLocation, 'Fridge')}
            {renderToggleButton('pantry', location, setLocation, 'Pantry')}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ownership</Text>
          <View style={styles.toggleContainer}>
            {renderToggleButton('personal', ownership, setOwnership, 'Personal')}
            {renderToggleButton('household', ownership, setOwnership, 'Household')}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Expiration Date (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={expirationDate}
            onChangeText={setExpirationDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  saveButton: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    color: '#000',
  },
  row: {
    flexDirection: 'row',
  },
  unitPicker: {
    flexDirection: 'row',
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginRight: 8,
  },
  unitButtonActive: {
    backgroundColor: '#007AFF',
  },
  unitButtonText: {
    fontSize: 14,
    color: '#666',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 16,
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
});
