import { useMemberContext } from '@/contexts/MemberContext';

export function useMember() {
  const { member, loading, loadMember, logout, isAdmin, isSuperadmin } = useMemberContext();
  return { member, loading, loadMember, logout, isAdmin, isSuperadmin };
}
