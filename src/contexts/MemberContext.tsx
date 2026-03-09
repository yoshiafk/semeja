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
  hasHouseKey: boolean;
  needsPasswordSetup: boolean;
  pendingPasswordName: string | null;
  loadMember: (name: string, password?: string) => Promise<void>;
  confirmHouseKey: (key: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isSuperadmin: boolean;
}

const MemberContext = createContext<MemberContextType | undefined>(undefined);

export const MemberProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasHouseKey, setHasHouseKey] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [pendingPasswordName, setPendingPasswordName] = useState<string | null>(null);

  const STORAGE_KEY = 'meal_plan_user_name';
  const HOUSE_KEY_STORAGE = 'semeja_house_key';

  const loadMember = useCallback(async (name: string, password?: string) => {
    try {
      setLoading(true);
      const data = await api.post<any>('/members', { name, password });
      
      // Handle the robust 200-level signal
      if (data.needsPassword) {
        throw new Error('PASSWORD_REQUIRED');
      }

      if (data.needsPasswordSetup) {
        setNeedsPasswordSetup(true);
      } else {
        setNeedsPasswordSetup(false);
      }

      setMember({ id: data.id, name: data.name, role: data.role } as Member);
      localStorage.setItem(STORAGE_KEY, name);
    } catch (err: any) {
      console.error('Failed to load member:', err);
      // Fallback for old 401 style or other errors
      if (err.data?.needsPassword || err.message === 'PASSWORD_REQUIRED') {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmHouseKey = useCallback((key: string) => {
    localStorage.setItem(HOUSE_KEY_STORAGE, key);
    setHasHouseKey(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMember(null);
  }, []);

  useEffect(() => {
    const savedKey = localStorage.getItem(HOUSE_KEY_STORAGE);
    if (savedKey) {
      setHasHouseKey(true);
      const savedName = localStorage.getItem(STORAGE_KEY);
      if (savedName) {
        loadMember(savedName).catch((err) => {
          if (err.message === 'PASSWORD_REQUIRED') {
            setPendingPasswordName(savedName);
          }
        });
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [loadMember]);

  const isAdmin = member?.role === 'admin' || member?.role === 'superadmin';
  const isSuperadmin = member?.role === 'superadmin';

  const value = useMemo(() => ({
    member,
    loading,
    hasHouseKey,
    needsPasswordSetup,
    pendingPasswordName,
    loadMember,
    confirmHouseKey,
    logout,
    isAdmin,
    isSuperadmin
  }), [member, loading, hasHouseKey, needsPasswordSetup, pendingPasswordName, loadMember, confirmHouseKey, logout, isAdmin, isSuperadmin]);

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
