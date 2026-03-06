import { useMemberContext } from '@/contexts/MemberContext';

export function useMember() {
  const { member, loading, hasHouseKey, loadMember, confirmHouseKey, logout, isAdmin, isSuperadmin } = useMemberContext();
  return { member, loading, hasHouseKey, loadMember, confirmHouseKey, logout, isAdmin, isSuperadmin };
}
