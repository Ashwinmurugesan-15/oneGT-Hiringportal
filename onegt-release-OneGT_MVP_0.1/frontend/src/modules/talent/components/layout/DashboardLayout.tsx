'use client';

import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="flex-1 overflow-auto p-4 lg:p-6" style={{ background: 'linear-gradient(135deg, #EAF6FB, #D7EFF9, #C3E7F5)', minHeight: 'calc(100vh - 70px)' }}>
      <div className="max-w-7xl mx-auto animate-fade-in">
        {children}
      </div>
    </div>
  );
};
