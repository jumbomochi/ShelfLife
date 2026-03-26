import { HouseholdRole } from '@/types';

export function canDeleteHousehold(role: HouseholdRole): boolean {
  return role === 'owner';
}

export function canRemoveMember(role: HouseholdRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canChangeRoles(role: HouseholdRole): boolean {
  return role === 'owner';
}

export function canEditItem(
  role: HouseholdRole,
  itemOwnerId: string,
  currentUserId: string
): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return itemOwnerId === currentUserId;
}

export function canDeleteItem(
  role: HouseholdRole,
  itemOwnerId: string,
  currentUserId: string
): boolean {
  if (role === 'owner' || role === 'admin') return true;
  return itemOwnerId === currentUserId;
}

export function canManageInvitations(role: HouseholdRole): boolean {
  return role === 'owner' || role === 'admin';
}
