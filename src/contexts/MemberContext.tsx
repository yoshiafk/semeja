import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';

export interface Member {
  id: number;
  name: string;
  role: 'superadmin' | 'admin' | 'member';
}

interface MemberContextType {
  member: Member | null;
  loading: boolean;
  loadMember: (name: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isSuperadmin: boolean;
}

const MemberContext = createContext<MemberContextType | undefined>(undefined);

export const MemberProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const STORAGE_KEY = 'meal_plan_user_name';

  const loadMember = useCallback(async (name: string) => {
    try {
      setLoading(true);
      const data = await api.post<Member>('/members', { name });
      setMember(data);
      localStorage.setItem(STORAGE_KEY, name);
    } catch (err) {
      console.error('Failed to load member:', err);
      // Fallback if server is down but we have a name
      setMember({ id: 0, name, role: 'member' });
      localStorage.setItem(STORAGE_KEY, name);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMember(null);
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_KEY);
    if (savedName) {
      loadMember(savedName);
    } else {
      setLoading(false);
    }
  }, [loadMember]);

  const isAdmin = member?.role === 'admin' || member?.role === 'superadmin';
  const isSuperadmin = member?.role === 'superadmin';

  const value = useMemo(() => ({
    member,
    loading,
    loadMember,
    logout,
    isAdmin,
    isSuperadmin
  }), [member, loading, loadMember, logout, isAdmin, isSuperadmin]);

  return (
    <MemberContext.Provider value={value}>
      {children}
    </MemberContext.Provider>
  );
};

export const useMemberContext = () => {
  const context = useContext(MemberContext);
  if (context === undefined) {
    throw new Error('useMemberContext must be used within a MemberProvider');
  }
  return context;
};
