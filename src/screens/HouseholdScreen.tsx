import React, { useState, useEffect } from 'react';
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
import { HouseholdRole, HouseholdMember, HouseholdInvitation } from '@/types';
import {
  canDeleteHousehold,
  canRemoveMember,
  canChangeRoles,
  canManageInvitations,
} from '@/services/permissionService';
import {
  sendInvitation,
  revokeInvitation,
  getInvitationsForHousehold,
  getPendingInvitationsForEmail,
  acceptInvitation,
  declineInvitation,
} from '@/services/emailService';

interface HouseholdScreenProps {
  onClose: () => void;
}

interface LocalHousehold {
  id: string;
  name: string;
  inviteCode: string;
  members: HouseholdMember[];
}

export function HouseholdScreen({ onClose }: HouseholdScreenProps) {
  const { user } = useAuthStore();
  const [household, setHousehold] = useState<LocalHousehold | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [householdInvitations, setHouseholdInvitations] = useState<HouseholdInvitation[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<HouseholdInvitation[]>([]);

  const getCurrentUserRole = (): HouseholdRole => {
    if (!household) return 'member';
    const member = household.members.find(
      (m) => m.userId === (user?.sub || 'current-user')
    );
    return member?.role || 'member';
  };
  const currentRole = getCurrentUserRole();

  useEffect(() => {
    if (household) {
      getInvitationsForHousehold(household.id).then(setHouseholdInvitations);
    }
    if (user?.email) {
      getPendingInvitationsForEmail(user.email).then(setIncomingInvitations);
    }
  }, [household?.id, user?.email]);

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newHousehold: LocalHousehold = {
        id: Math.random().toString(36).substring(2, 10),
        name: householdName.trim(),
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        members: [
          {
            userId: user?.sub || 'current-user',
            role: 'owner',
            name: user?.username || 'You',
            email: user?.email || 'user@example.com',
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
      const joinedHousehold: LocalHousehold = {
        id: Math.random().toString(36).substring(2, 10),
        name: 'Smith Family',
        inviteCode: inviteCode.trim().toUpperCase(),
        members: [
          {
            userId: 'owner-123',
            role: 'owner',
            name: 'John Smith',
            email: 'john@example.com',
          },
          {
            userId: user?.sub || 'current-user',
            role: 'member',
            name: user?.username || 'You',
            email: user?.email || 'user@example.com',
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
    const message = canDeleteHousehold(currentRole)
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
    if (!canRemoveMember(currentRole)) {
      Alert.alert('Error', 'You do not have permission to remove members');
      return;
    }

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
                members: household.members.filter((m) => m.userId !== memberId),
              });
            }
          },
        },
      ]
    );
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim() || !household) return;
    if (!canManageInvitations(currentRole)) {
      Alert.alert('Error', 'You do not have permission to send invitations');
      return;
    }
    try {
      setIsLoading(true);
      await sendInvitation(household.id, household.name, inviteEmail.trim(), user?.sub || 'current-user');
      Alert.alert('Success', `Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      const updated = await getInvitationsForHousehold(household.id);
      setHouseholdInvitations(updated);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revokeInvitation(invitationId);
      const updated = await getInvitationsForHousehold(household!.id);
      setHouseholdInvitations(updated);
    } catch {
      Alert.alert('Error', 'Failed to revoke invitation');
    }
  };

  const handleAcceptInvitation = async (invitation: HouseholdInvitation) => {
    try {
      setIsLoading(true);
      await acceptInvitation(invitation.id, user?.sub || 'current-user');
      const joinedHousehold: LocalHousehold = {
        id: invitation.householdId,
        name: invitation.householdName,
        inviteCode: '',
        members: [{
          userId: user?.sub || 'current-user',
          role: 'member',
          name: user?.username || 'You',
          email: user?.email || 'user@example.com',
        }],
      };
      setHousehold(joinedHousehold);
      setIncomingInvitations([]);
      Alert.alert('Success', `Joined ${invitation.householdName}!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await declineInvitation(invitationId);
      setIncomingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch {
      Alert.alert('Error', 'Failed to decline invitation');
    }
  };

  const handleChangeRole = (memberId: string, newRole: HouseholdRole) => {
    if (!canChangeRoles(currentRole)) {
      Alert.alert('Error', 'Only the owner can change roles');
      return;
    }
    if (newRole === 'owner') {
      Alert.alert('Transfer Ownership',
        'This will make this member the new owner and change your role to admin. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Transfer', style: 'destructive',
            onPress: () => {
              if (household) {
                setHousehold({
                  ...household,
                  members: household.members.map((m) => {
                    if (m.userId === memberId) return { ...m, role: 'owner' };
                    if (m.userId === (user?.sub || 'current-user')) return { ...m, role: 'admin' };
                    return m;
                  }),
                });
              }
            },
          },
        ]
      );
      return;
    }
    if (household) {
      setHousehold({
        ...household,
        members: household.members.map((m) =>
          m.userId === memberId ? { ...m, role: newRole } : m
        ),
      });
    }
  };

  const getRoleBadgeStyle = (role: HouseholdRole) => {
    switch (role) {
      case 'owner': return styles.roleBadgeOwner;
      case 'admin': return styles.roleBadgeAdmin;
      case 'member': return styles.roleBadgeMember;
    }
  };

  const getRoleBadgeTextStyle = (role: HouseholdRole) => {
    if (role === 'member') return [styles.ownerBadgeText, { color: '#666' }];
    return styles.ownerBadgeText;
  };

  const getRoleLabel = (role: HouseholdRole) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getNextRole = (role: HouseholdRole): HouseholdRole => {
    switch (role) {
      case 'member': return 'admin';
      case 'admin': return 'owner';
      default: return role;
    }
  };

  const getPreviousRole = (role: HouseholdRole): HouseholdRole => {
    switch (role) {
      case 'admin': return 'member';
      default: return role;
    }
  };

  const pendingInvitations = householdInvitations.filter((i) => i.status === 'pending');

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
          {incomingInvitations.length > 0 && (
            <View style={styles.incomingSection}>
              <Text style={styles.incomingSectionTitle}>Pending Invitations</Text>
              {incomingInvitations.map((invitation) => (
                <View key={invitation.id} style={styles.incomingCard}>
                  <Text style={styles.incomingHousehold}>{invitation.householdName}</Text>
                  <Text style={styles.incomingExpiry}>
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.incomingActions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptInvitation(invitation)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleDeclineInvitation(invitation.id)}
                    >
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

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

        {/* Invite by Email Section */}
        {canManageInvitations(currentRole) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invite by Email</Text>
            <View style={styles.inviteEmailRow}>
              <TextInput
                style={styles.inviteEmailInput}
                placeholder="Email address"
                placeholderTextColor="#8E8E93"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.inviteSendButton, isLoading && styles.buttonDisabled]}
                onPress={handleSendInvitation}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.inviteSendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>

            {pendingInvitations.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Pending Invitations</Text>
                {pendingInvitations.map((invitation) => (
                  <View key={invitation.id} style={styles.invitationRow}>
                    <View style={styles.invitationInfo}>
                      <Text style={styles.invitationEmail}>{invitation.email}</Text>
                      <Text style={styles.invitationDate}>
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRevokeInvitation(invitation.id)}>
                      <Text style={styles.revokeText}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {household.members.map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.name}
                  {member.userId === (user?.sub || 'current-user') && ' (You)'}
                </Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>
              <View style={getRoleBadgeStyle(member.role)}>
                <Text style={getRoleBadgeTextStyle(member.role)}>
                  {getRoleLabel(member.role)}
                </Text>
              </View>
              {canChangeRoles(currentRole) &&
                member.userId !== (user?.sub || 'current-user') && (
                  <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                    {member.role !== 'owner' && (
                      <TouchableOpacity
                        style={styles.roleChangeButton}
                        onPress={() => handleChangeRole(member.userId, getNextRole(member.role))}
                      >
                        <Text style={styles.roleChangeText}>&#9650;</Text>
                      </TouchableOpacity>
                    )}
                    {member.role === 'admin' && (
                      <TouchableOpacity
                        style={styles.roleChangeButton}
                        onPress={() => handleChangeRole(member.userId, getPreviousRole(member.role))}
                      >
                        <Text style={styles.roleChangeText}>&#9660;</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              {canRemoveMember(currentRole) &&
                member.userId !== (user?.sub || 'current-user') &&
                member.role !== 'owner' && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(member.userId)}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
            </View>
          ))}
        </View>

        {/* Leave Household */}
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveHousehold}>
          <Text style={styles.leaveButtonText}>
            {canDeleteHousehold(currentRole) ? 'Delete Household' : 'Leave Household'}
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
  roleBadgeOwner: {
    backgroundColor: '#34C759',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeAdmin: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeMember: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
  inviteEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteEmailInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginRight: 8,
  },
  inviteSendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  inviteSendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  invitationInfo: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 15,
    color: '#000',
  },
  invitationDate: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  revokeText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  incomingSection: {
    padding: 16,
    marginBottom: 8,
  },
  incomingSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  incomingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  incomingHousehold: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  incomingExpiry: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 12,
  },
  incomingActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 12,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  declineButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  roleChangeButton: {
    padding: 4,
    marginHorizontal: 2,
  },
  roleChangeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
});
