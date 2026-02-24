'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const DashboardLayout = ({ children, title }: DashboardLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed lg:relative z-50 lg:z-auto transition-transform duration-300',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
