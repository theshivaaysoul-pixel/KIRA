'use client';
// src/app/(dashboard)/layout.tsx
// Protected layout — redirects to /login if not authenticated.

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loading } from '@/components/ui/Loading';
import { AppShell } from '@/components/layout/AppShell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <Loading fullPage message="Loading…" />;
  }

  if (!user) {
    // Still showing loading while redirect happens
    return <Loading fullPage />;
  }

  return <AppShell>{children}</AppShell>;
}
