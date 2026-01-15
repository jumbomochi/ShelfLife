import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useShoppingStore, useInventoryStore } from '@/store';
import { ShoppingList } from '@/types';
import ShoppingListItemCard from '@/components/ShoppingListItemCard';

export default function ShoppingListScreen() {
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('pcs');

  const {
    lists,
    activeListId,
    createList,
    deleteList,
    setActiveList,
    addItem,
    removeItem,
    toggleItemChecked,
    clearCheckedItems,
    getCheckedCount,
  } = useShoppingStore();

  const { items: inventoryItems, getExpiringItems } = useInventoryStore();

  const activeList = lists.find((l) => l.id === activeListId);
  const checkedCount = activeListId ? getCheckedCount(activeListId) : 0;

  const handleCreateList = () => {
    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }
    createList(newListName.trim());
    setNewListName('');
    setShowNewListModal(false);
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !activeListId) return;

    addItem(activeListId, {
      name: newItemName.trim(),
      quantity: parseFloat(newItemQuantity) || 1,
      unit: newItemUnit,
    });

    setNewItemName('');
    setNewItemQuantity('1');
    setShowAddItemModal(false);
  };

  const handleDeleteList = (listId: string) => {
    Alert.alert('Delete List', 'Are you sure you want to delete this list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteList(listId),
      },
    ]);
  };

  const handleSuggestItems = () => {
    if (!activeListId) return;

    // Get expiring items (within 3 days)
    const expiringItems = getExpiringItems(3);

    // Get low stock items (quantity <= 1)
    const lowStockItems = inventoryItems.filter((item) => item.quantity <= 1);

    const suggestions = [...expiringItems, ...lowStockItems];
    const uniqueSuggestions = suggestions.filter(
      (item, index, self) => index === self.findIndex((i) => i.name === item.name)
    );

    if (uniqueSuggestions.length === 0) {
      Alert.alert('No Suggestions', 'No items are running low or expiring soon.');
      return;
    }

    Alert.alert(
      'Add Suggested Items',
      `Found ${uniqueSuggestions.length} items that are low or expiring. Add them to the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add All',
          onPress: () => {
            uniqueSuggestions.forEach((item) => {
              addItem(activeListId, {
                name: item.name,
                quantity: 1,
                unit: item.unit,
              });
            });
          },
        },
      ]
    );
  };

  const renderListSelector = () => (
    <View style={styles.listSelector}>
      <FlatList
        horizontal
        data={lists}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.listTab,
              activeListId === item.id && styles.listTabActive,
            ]}
            onPress={() => setActiveList(item.id)}
            onLongPress={() => handleDeleteList(item.id)}
          >
            <Text
              style={[
                styles.listTabText,
                activeListId === item.id && styles.listTabTextActive,
              ]}
            >
              {item.name}
            </Text>
            <Text style={styles.listTabCount}>{item.items.length}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.newListButton}
            onPress={() => setShowNewListModal(true)}
          >
            <Text style={styles.newListButtonText}>+ New List</Text>
          </TouchableOpacity>
        }
        contentContainerStyle={styles.listSelectorContent}
      />
    </View>
  );

  const renderActiveList = () => {
    if (!activeList) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No Lists Yet</Text>
          <Text style={styles.emptyStateText}>
            Create a shopping list to get started
          </Text>
          <TouchableOpacity
            style={styles.createListButton}
            onPress={() => setShowNewListModal(true)}
          >
            <Text style={styles.createListButtonText}>Create List</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const uncheckedItems = activeList.items.filter((i) => !i.checked);
    const checkedItems = activeList.items.filter((i) => i.checked);

    return (
      <View style={styles.listContent}>
        <View style={styles.listActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowAddItemModal(true)}
          >
            <Text style={styles.actionButtonText}>+ Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.suggestButton]}
            onPress={handleSuggestItems}
          >
            <Text style={styles.actionButtonText}>Suggest</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={[...uncheckedItems, ...checkedItems]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ShoppingListItemCard
              item={item}
              onToggle={() => toggleItemChecked(activeListId!, item.id)}
              onDelete={() => removeItem(activeListId!, item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyListState}>
              <Text style={styles.emptyListText}>No items in this list</Text>
            </View>
          }
          ListFooterComponent={
            checkedCount > 0 ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => clearCheckedItems(activeListId!)}
              >
                <Text style={styles.clearButtonText}>
                  Clear {checkedCount} checked item{checkedCount > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ) : null
          }
          contentContainerStyle={styles.itemsList}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderListSelector()}
      {renderActiveList()}

      {/* New List Modal */}
      <Modal
        visible={showNewListModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNewListModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Shopping List</Text>
            <TextInput
              style={styles.modalInput}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name (e.g., Weekly Groceries)"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowNewListModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCreateButton}
                onPress={handleCreateList}
              >
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItemModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Item</Text>
            <TextInput
              style={styles.modalInput}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Item name"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.quantityRow}>
              <TextInput
                style={[styles.modalInput, styles.quantityInput]}
                value={newItemQuantity}
                onChangeText={setNewItemQuantity}
                placeholder="Qty"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.modalInput, styles.unitInput]}
                value={newItemUnit}
                onChangeText={setNewItemUnit}
                placeholder="Unit"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddItemModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCreateButton}
                onPress={handleAddItem}
              >
                <Text style={styles.modalCreateText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  listSelector: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  listSelectorContent: {
    padding: 12,
    gap: 8,
  },
  listTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  listTabActive: {
    backgroundColor: '#007AFF',
  },
  listTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  listTabTextActive: {
    color: '#fff',
  },
  listTabCount: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  newListButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  newListButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  listContent: {
    flex: 1,
  },
  listActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  suggestButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  itemsList: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  createListButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  createListButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyListState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
  },
  clearButton: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityInput: {
    flex: 1,
  },
  unitInput: {
    flex: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalCreateButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalCreateText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
