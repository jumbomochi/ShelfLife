import AsyncStorage from '@react-native-async-storage/async-storage';
import { HouseholdInvitation } from '@/types';

const INVITATIONS_KEY = '@shelflife_invitations';

const generateId = () => Math.random().toString(36).substring(2, 15);

async function getStoredInvitations(): Promise<HouseholdInvitation[]> {
  const stored = await AsyncStorage.getItem(INVITATIONS_KEY);
  if (!stored) return [];
  const invitations: HouseholdInvitation[] = JSON.parse(stored);

  // Auto-expire old invitations
  const now = new Date().toISOString();
  return invitations.map((inv) => {
    if (inv.status === 'pending' && inv.expiresAt < now) {
      return { ...inv, status: 'expired' as const };
    }
    return inv;
  });
}

async function saveInvitations(invitations: HouseholdInvitation[]): Promise<void> {
  await AsyncStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations));
}

export async function sendInvitation(
  householdId: string,
  householdName: string,
  email: string,
  invitedBy: string
): Promise<HouseholdInvitation> {
  const invitations = await getStoredInvitations();

  // Check for existing pending invitation to same email for same household
  const existing = invitations.find(
    (inv) => inv.email === email && inv.householdId === householdId && inv.status === 'pending'
  );
  if (existing) {
    throw new Error('An invitation has already been sent to this email');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation: HouseholdInvitation = {
    id: generateId(),
    householdId,
    householdName,
    email: email.toLowerCase(),
    status: 'pending',
    invitedBy,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };

  invitations.push(invitation);
  await saveInvitations(invitations);

  return invitation;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const invitations = await getStoredInvitations();
  const updated = invitations.map((inv) =>
    inv.id === invitationId && inv.status === 'pending'
      ? { ...inv, status: 'revoked' as const }
      : inv
  );
  await saveInvitations(updated);
}

export async function getInvitationsForHousehold(
  householdId: string
): Promise<HouseholdInvitation[]> {
  const invitations = await getStoredInvitations();
  return invitations.filter((inv) => inv.householdId === householdId);
}

export async function getPendingInvitationsForEmail(
  email: string
): Promise<HouseholdInvitation[]> {
  const invitations = await getStoredInvitations();
  return invitations.filter(
    (inv) => inv.email === email.toLowerCase() && inv.status === 'pending'
  );
}

export async function acceptInvitation(
  invitationId: string,
  userId: string
): Promise<HouseholdInvitation> {
  const invitations = await getStoredInvitations();
  let accepted: HouseholdInvitation | null = null;

  const updated = invitations.map((inv) => {
    if (inv.id === invitationId && inv.status === 'pending') {
      accepted = { ...inv, status: 'accepted' as const };
      return accepted;
    }
    return inv;
  });

  if (!accepted) {
    throw new Error('Invitation not found or no longer valid');
  }

  await saveInvitations(updated);
  return accepted;
}

export async function declineInvitation(invitationId: string): Promise<void> {
  const invitations = await getStoredInvitations();
  const updated = invitations.map((inv) =>
    inv.id === invitationId && inv.status === 'pending'
      ? { ...inv, status: 'declined' as const }
      : inv
  );
  await saveInvitations(updated);
}
