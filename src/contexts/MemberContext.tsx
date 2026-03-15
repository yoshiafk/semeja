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
  clearPasswordSetup: () => void;
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
  const TOKEN_STORAGE_KEY = 'semeja_auth_token';

  const encodeData = (data: string) => data; // No longer encoding for simplicity and bug prevention

  const decodeData = (data: string) => {
    return data;
  };

  const loadMember = useCallback(async (name: string, password?: string) => {
    try {
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
      localStorage.setItem(STORAGE_KEY, encodeData(name));
      if (data.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
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
    localStorage.setItem(HOUSE_KEY_STORAGE, encodeData(key));
    setHasHouseKey(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setMember(null);
  }, []);

  const clearPasswordSetup = useCallback(() => {
    setNeedsPasswordSetup(false);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      // 1. Ensure Device ID exists
      if (!localStorage.getItem('semeja_device_id')) {
        localStorage.setItem('semeja_device_id', crypto.randomUUID());
      }

      const rawSavedKey = localStorage.getItem(HOUSE_KEY_STORAGE);
      if (!rawSavedKey) {
        setLoading(false);
        return;
      }
      
      setHasHouseKey(true);

      // 2. Try Silent Session Recovery via /me
      try {
        const data = await api.get<any>('/members/me');
        if (data.id) {
          setMember({ id: data.id, name: data.name, role: data.role } as Member);
          if (data.token) {
            localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        // Silently fail and proceed to legacy name-based check
      }

      // 3. Fallback: Check local storage for name
      const rawSavedName = localStorage.getItem(STORAGE_KEY);
      if (rawSavedName) {
        const savedName = decodeData(rawSavedName);
        
        if (savedName.includes('%') || (savedName.includes(' ') && savedName.length > 20)) {
           setLoading(false);
           return;
        }

        try {
          await loadMember(savedName);
        } catch (err: any) {
          if (err.message === 'PASSWORD_REQUIRED') {
            setPendingPasswordName(savedName);
          }
        }
      }
      
      setLoading(false);
    };

    initialize();
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
    clearPasswordSetup,
    logout,
    isAdmin,
    isSuperadmin
  }), [member, loading, hasHouseKey, needsPasswordSetup, pendingPasswordName, loadMember, confirmHouseKey, clearPasswordSetup, logout, isAdmin, isSuperadmin]);

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
