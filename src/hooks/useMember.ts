import { useMemberContext } from '@/contexts/MemberContext';

export function useMember() {
  const { member, loading, hasHouseKey, needsPasswordSetup, loadMember, confirmHouseKey, logout, isAdmin, isSuperadmin } = useMemberContext();
  return { member, loading, hasHouseKey, needsPasswordSetup, loadMember, confirmHouseKey, logout, isAdmin, isSuperadmin };
}
