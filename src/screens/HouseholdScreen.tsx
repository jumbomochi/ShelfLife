import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '@/store';

interface HouseholdScreenProps {
  onClose: () => void;
}

// Mock household data for development
interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

interface Household {
  id: string;
  name: string;
  inviteCode: string;
  members: HouseholdMember[];
}

export function HouseholdScreen({ onClose }: HouseholdScreenProps) {
  const { user } = useAuthStore();
  const [household, setHousehold] = useState<Household | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newHousehold: Household = {
        id: Math.random().toString(36).substring(2, 10),
        name: householdName.trim(),
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        members: [
          {
            id: user?.sub || 'current-user',
            name: user?.username || 'You',
            email: user?.email || 'user@example.com',
            isOwner: true,
          },
        ],
      };

      setHousehold(newHousehold);
      setShowCreateForm(false);
      setHouseholdName('');
      Alert.alert('Success', 'Household created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create household');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock: pretend we found and joined a household
      const joinedHousehold: Household = {
        id: Math.random().toString(36).substring(2, 10),
        name: 'Smith Family',
        inviteCode: inviteCode.trim().toUpperCase(),
        members: [
          {
            id: 'owner-123',
            name: 'John Smith',
            email: 'john@example.com',
            isOwner: true,
          },
          {
            id: user?.sub || 'current-user',
            name: user?.username || 'You',
            email: user?.email || 'user@example.com',
            isOwner: false,
          },
        ],
      };

      setHousehold(joinedHousehold);
      setShowJoinForm(false);
      setInviteCode('');
      Alert.alert('Success', 'Joined household successfully!');
    } catch (error) {
      Alert.alert('Error', 'Invalid invite code or household not found');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveHousehold = () => {
    const isOwner = household?.members.find(
      (m) => m.id === (user?.sub || 'current-user')
    )?.isOwner;

    const message = isOwner
      ? 'As the owner, leaving will delete the household for all members. Are you sure?'
      : 'Are you sure you want to leave this household?';

    Alert.alert('Leave Household', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setIsLoading(true);
          await new Promise((resolve) => setTimeout(resolve, 500));
          setHousehold(null);
          setIsLoading(false);
          Alert.alert('Success', 'You have left the household');
        },
      },
    ]);
  };

  const handleShareInviteCode = async () => {
    if (!household) return;

    try {
      await Share.share({
        message: `Join my household on ShelfLife! Use invite code: ${household.inviteCode}`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the household?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (household) {
              setHousehold({
                ...household,
                members: household.members.filter((m) => m.id !== memberId),
              });
            }
          },
        },
      ]
    );
  };

  const isCurrentUserOwner = household?.members.find(
    (m) => m.id === (user?.sub || 'current-user')
  )?.isOwner;

  // No household - show create/join options
  if (!household) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Household</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.centeredContent}>
          {!showCreateForm && !showJoinForm ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Household</Text>
              <Text style={styles.emptyDescription}>
                Create a household to share your inventory and shopping lists with family
                members, or join an existing one.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowCreateForm(true)}
              >
                <Text style={styles.primaryButtonText}>Create Household</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowJoinForm(true)}
              >
                <Text style={styles.secondaryButtonText}>Join with Code</Text>
              </TouchableOpacity>
            </View>
          ) : showCreateForm ? (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Create Household</Text>

              <TextInput
                style={styles.input}
                placeholder="Household Name"
                placeholderTextColor="#8E8E93"
                value={householdName}
                onChangeText={setHouseholdName}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleCreateHousehold}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateForm(false);
                  setHouseholdName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Join Household</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter Invite Code"
                placeholderTextColor="#8E8E93"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                autoFocus
              />

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleJoinHousehold}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Join</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowJoinForm(false);
                  setInviteCode('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Has household - show household details
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Household</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Household Info */}
        <View style={styles.section}>
          <View style={styles.householdInfo}>
            <Text style={styles.householdName}>{household.name}</Text>
            <Text style={styles.memberCount}>
              {household.members.length} member{household.members.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Invite Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Code</Text>
          <View style={styles.inviteCodeContainer}>
            <Text style={styles.inviteCode}>{household.inviteCode}</Text>
            <TouchableOpacity style={styles.shareButton} onPress={handleShareInviteCode}>
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inviteHint}>
            Share this code with family members to invite them
          </Text>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {household.members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.name}
                  {member.id === (user?.sub || 'current-user') && ' (You)'}
                </Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>
              {member.isOwner ? (
                <View style={styles.ownerBadge}>
                  <Text style={styles.ownerBadgeText}>Owner</Text>
                </View>
              ) : (
                isCurrentUserOwner &&
                member.id !== (user?.sub || 'current-user') && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(member.id)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          ))}
        </View>

        {/* Leave Household */}
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveHousehold}>
          <Text style={styles.leaveButtonText}>
            {isCurrentUserOwner ? 'Delete Household' : 'Leave Household'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  formContainer: {
    padding: 32,
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 16,
    fontSize: 17,
    width: '100%',
    marginBottom: 16,
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 17,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6D6D72',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  householdInfo: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  householdName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 15,
    color: '#8E8E93',
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 2,
  },
  shareButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  inviteHint: {
    fontSize: 13,
    color: '#8E8E93',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500',
  },
  memberEmail: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  ownerBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 15,
  },
  leaveButton: {
    margin: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  leaveButtonText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '600',
  },
});
