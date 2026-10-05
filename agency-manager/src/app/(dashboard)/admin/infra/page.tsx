'use client';
// src/app/(dashboard)/admin/infra/page.tsx
// Infrastructure, Storage & Security Administration Page
// Accessible only by Owner and Manager.

import { Server } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { AccessRestrictedCard } from '@/components/auth/AccessRestrictedCard';
import { SystemStatusCard } from '@/components/dashboard/SystemStatusCard';
import { StorageSafetyCard } from '@/components/dashboard/StorageSafetyCard';
import { UserProfileCard } from '@/components/dashboard/UserProfileCard';
import { TeamRoleManagementCard } from '@/components/dashboard/TeamRoleManagementCard';

export default function InfraPage() {
  const { role, hasPermission, loading } = usePermission();

  const isAuthorized =
    role === 'OWNER' ||
    role === 'MANAGER' ||
    hasPermission('system.admin') ||
    hasPermission('storage.read');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin w-6 h-6 border-2 border-[rgb(var(--primary))] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <AccessRestrictedCard
        featureName="Infrastructure & Storage Administration"
        description="Only the Owner and Manager can view infrastructure health diagnostics, storage safety backups, and role access."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] flex items-center justify-center text-[rgb(var(--text-primary))]">
          <Server size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[rgb(var(--text-primary))]">
            Infrastructure & Storage Administration
          </h1>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Live health checks, GCS data safety backups, recovery pipeline & role access
          </p>
        </div>
      </div>

      {/* Identity & Team Administration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <UserProfileCard />
        <TeamRoleManagementCard />
      </div>

      {/* Storage Safety & Health Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <SystemStatusCard />
        <StorageSafetyCard />
      </div>
    </div>
  );
}
