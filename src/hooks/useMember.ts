import { useMemberContext } from '@/contexts/MemberContext';

export function useMember() {
  const { member, loading, hasHouseKey, needsPasswordSetup, pendingPasswordName, loadMember, confirmHouseKey, clearPasswordSetup, logout, isAdmin, isSuperadmin } = useMemberContext();
  return { member, loading, hasHouseKey, needsPasswordSetup, pendingPasswordName, loadMember, confirmHouseKey, clearPasswordSetup, logout, isAdmin, isSuperadmin };
}
