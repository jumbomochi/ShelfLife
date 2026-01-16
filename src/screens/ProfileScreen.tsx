import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuthStore } from '@/store';

interface ProfileScreenProps {
  onClose: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToHousehold?: () => void;
}

export default function ProfileScreen({
  onClose,
  onNavigateToSettings,
  onNavigateToHousehold,
}: ProfileScreenProps) {
  const { user, signOut, updateProfile, changePassword, isLoading, error, clearError } = useAuthStore();

  // Edit Profile Modal State
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [displayName, setDisplayName] = useState(user?.username || '');

  // Change Password Modal State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    try {
      await updateProfile(displayName.trim());
      setShowEditProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }

    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change password');
    }
  };

  const openEditProfile = () => {
    setDisplayName(user?.username || '');
    clearError();
    setShowEditProfile(true);
  };

  const openChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    clearError();
    setShowChangePassword(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.displayName}>{user?.username || 'User'}</Text>
          <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem} onPress={openEditProfile}>
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={openChangePassword}>
            <Text style={styles.menuItemText}>Change Password</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={onNavigateToSettings}>
            <Text style={styles.menuItemText}>Notification Settings</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Household</Text>

          <TouchableOpacity style={styles.menuItem} onPress={onNavigateToHousehold}>
            <Text style={styles.menuItemText}>Manage Household</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Invite Members</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>About ShelfLife</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Terms of Service</Text>
            <Text style={styles.menuItemArrow}>&rsaquo;</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FF3B30" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <Text style={styles.modalSaveButton}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your display name"
                placeholderTextColor="#999"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledInputText}>{user?.email}</Text>
              </View>
              <Text style={styles.inputHint}>Email cannot be changed</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePassword}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChangePassword(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChangePassword(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={handleChangePassword} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#007AFF" />
              ) : (
                <Text style={styles.modalSaveButton}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.textInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#999"
                secureTextEntry
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.textInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#999"
                secureTextEntry
              />
              <Text style={styles.inputHint}>At least 8 characters</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#999"
                secureTextEntry
              />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  placeholder: {
    width: 50,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  menuItemText: {
    fontSize: 16,
    color: '#000',
  },
  menuItemArrow: {
    fontSize: 20,
    color: '#C7C7CC',
  },
  signOutButton: {
    backgroundColor: '#fff',
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    marginTop: 10,
  },
  signOutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancelButton: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalSaveButton: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    color: '#000',
  },
  disabledInput: {
    padding: 12,
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
  },
  disabledInputText: {
    fontSize: 16,
    color: '#666',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginLeft: 4,
  },
});
