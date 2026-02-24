'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types/recruitment';

interface AuthContextType {
  user: User | null;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_USER: User = {
  id: 'default-admin',
  name: 'Admin User',
  email: 'admin@hireflow.com',
  role: 'super_admin',
  isActive: true,
  permissions: {
    isSuperAdmin: true,
    canManageUsers: true,
    features: {
      dashboard: true,
      demands: true,
      candidates: true,
      interviews: true,
    },
  },
  originalRole: 'super_admin',
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(DEFAULT_USER);

  const logout = () => {
    // No-op in this mode — app always stays logged in
    setUser(DEFAULT_USER);
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      const originalRole = user.originalRole || user.role;
      setUser({ ...user, role, originalRole });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      logout,
      switchRole,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
