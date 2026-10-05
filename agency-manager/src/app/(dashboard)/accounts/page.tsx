'use client';
// src/app/(dashboard)/accounts/page.tsx
// Social Account Management page for KIRA Agency Manager (Phase 6).
// Features Instagram-inspired responsive cards, dynamic platform correlation,
// server-side search, filtering, sorting, pagination, and relationship protection.

import React, { useState, useEffect } from 'react';
import {
  Plus,
  RotateCw,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSocialAccounts } from '@/hooks/useSocialAccounts';
import { usePlatforms } from '@/hooks/usePlatforms';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/Loading';
import type {
  SocialAccountWithRelations,
  SocialAccountStatus,
  TeamMember,
} from '@/lib/types/domain';
import type { CreateSocialAccountInput } from '@/lib/services/social-account-service';

import { AccountCard } from '@/components/accounts/AccountCard';
import { AccountFormModal } from '@/components/accounts/AccountFormModal';
import { AccountDetailsModal } from '@/components/accounts/AccountDetailsModal';
import { AccountDeleteModal } from '@/components/accounts/AccountDeleteModal';
import { AccountSkeleton } from '@/components/accounts/AccountSkeleton';
import { MagneticButton } from '@/components/motion';

export default function AccountsPage() {
  const { hasPermission } = usePermission();
  const { getIdToken } = useAuth();
  const toast = useToast();

  const canCreate = hasPermission('accounts.create');
  const canUpdate = hasPermission('accounts.update');
  const canDelete = hasPermission('accounts.delete');

  const {
    accounts,
    stats,
    loading,
    error,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    search,
    setSearch,
    platformFilter,
    setPlatformFilter,
    statusFilter,
    setStatusFilter,
    managerFilter,
    setManagerFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    fetchAccounts,
    createAccount,
    updateAccount,
    archiveAccount,
    restoreAccount,
    deleteAccount,
  } = useSocialAccounts();

  // Fetch available platforms dynamically
  const { platforms } = usePlatforms();

  // Fetch available team members dynamically (gracefully handles roles without team.read)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    async function loadTeam() {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/team', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setTeamMembers(json.data);
          }
        }
      } catch {
        // Silently ignore if role doesn't have team.read
      }
    }
    loadTeam();
  }, [getIdToken]);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccountWithRelations | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<SocialAccountWithRelations | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<SocialAccountWithRelations | null>(null);

  // Debounced search input
  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearch]);

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (account: SocialAccountWithRelations) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: CreateSocialAccountInput): Promise<boolean> => {
    if (editingAccount) {
      const res = await updateAccount(editingAccount.id, data);
      if (res.success) {
        toast.success(`Account @${data.username} updated successfully.`);
        return true;
      } else {
        toast.error(res.error || 'Failed to update account.');
        return false;
      }
    } else {
      const res = await createAccount(data);
      if (res.success) {
        toast.success(`Account @${data.username} connected successfully.`);
        return true;
      } else {
        toast.error(res.error || 'Failed to connect account.');
        return false;
      }
    }
  };

  const handleArchiveConfirm = async (id: string): Promise<boolean> => {
    const res = await archiveAccount(id);
    if (res.success) {
      toast.success('Account archived successfully.');
      return true;
    } else {
      toast.error(res.error || 'Failed to archive account.');
      return false;
    }
  };

  const handleDeleteConfirm = async (id: string, forcePermanent: boolean): Promise<boolean> => {
    const res = await deleteAccount(id, forcePermanent);
    if (res.success) {
      if (res.archived) {
        toast.success(res.message || 'Account was archived to protect historical records.');
      } else {
        toast.success('Social account permanently deleted.');
      }
      return true;
    } else {
      toast.error(res.error || 'Failed to delete account.');
      return false;
    }
  };

  const handleReactivate = async (account: SocialAccountWithRelations) => {
    const res = await restoreAccount(account.id, 'ACTIVE');
    if (res.success) {
      toast.success(`Account @${account.username} reactivated.`);
    } else {
      toast.error(res.error || 'Failed to reactivate account.');
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
              Social Accounts
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] border border-[rgb(var(--primary))]/20">
              {stats.total} Total
            </span>
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">
            Manage brand profiles, creator channels, team assignments, and dynamic platform connections.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchAccounts()}
            disabled={loading}
            className="w-11 h-11 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
            title="Refresh accounts"
          >
            <RotateCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>

          {canCreate && (
            <MagneticButton>
              <button
                onClick={handleOpenCreate}
                className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[rgb(var(--primary))] text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm min-h-[44px] cursor-pointer"
              >
                <Plus size={18} className="transition-transform duration-200 group-hover:scale-110" />
                <span>Connect Account</span>
              </button>
            </MagneticButton>
          )}
        </div>
      </div>

      {/* KPI Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 lg:gap-8">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`card rounded-2xl border text-left flex flex-col justify-between transition-all ${statusFilter === 'ALL'
              ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/5 shadow-xs'
              : 'border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] hover:border-[rgb(var(--border-hover))]'
            }`}
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider">
            All Accounts
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))]">
            {stats.total}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('ACTIVE')}
          className={`card rounded-2xl border text-left flex flex-col justify-between transition-all ${statusFilter === 'ACTIVE'
              ? 'border-emerald-500 bg-emerald-500/5 shadow-xs'
              : 'border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] hover:border-[rgb(var(--border-hover))]'
            }`}
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))]">
            {stats.active}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('INACTIVE')}
          className={`card rounded-2xl border text-left flex flex-col justify-between transition-all ${statusFilter === 'INACTIVE'
              ? 'border-neutral-500 bg-neutral-500/5 shadow-xs'
              : 'border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] hover:border-[rgb(var(--border-hover))]'
            }`}
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neutral-400" />
            Inactive
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))]">
            {stats.inactive}
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('ARCHIVED')}
          className={`card rounded-2xl border text-left flex flex-col justify-between transition-all ${statusFilter === 'ARCHIVED'
              ? 'border-purple-500 bg-purple-500/5 shadow-xs'
              : 'border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] hover:border-[rgb(var(--border-hover))]'
            }`}
          style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}
        >
          <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Archived
          </div>
          <div className="mt-1.5 text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))]">
            {stats.archived}
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3" style={{ padding: '1.15rem 1.25rem' }}>
        {/* Search Input */}
        <div className="relative flex items-center flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--text-muted))]">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden"
          >
            <option value="ALL">All Platforms</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SocialAccountStatus | 'ALL')}
            className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
            <option value="CONNECTION_ERROR">Connection Error</option>
          </select>

          {/* Assigned Manager Filter */}
          {teamMembers.length > 0 && (
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden"
            >
              <option value="ALL">All Managers</option>
              <option value="UNASSIGNED">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as 'accountName' | 'username' | 'createdAt' | 'updatedAt' | 'status'
              )
            }
            className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden"
          >
            <option value="createdAt">Date Created</option>
            <option value="updatedAt">Date Updated</option>
            <option value="accountName">Account Name</option>
            <option value="username">Username</option>
            <option value="status">Status</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs font-medium text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors"
            title="Toggle sort direction"
          >
            {sortOrder === 'asc' ? 'Asc ↑' : 'Desc ↓'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <AccountSkeleton count={6} />
      ) : error ? (
        <div className="p-8 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center">
          <AlertCircle size={32} className="mx-auto text-rose-500 mb-3" />
          <h3 className="text-sm font-semibold text-[rgb(var(--text-primary))]">
            Unable to load social accounts
          </h3>
          <p className="mt-1 text-xs text-[rgb(var(--text-secondary))] max-w-sm mx-auto">
            {error}
          </p>
          <button
            onClick={() => fetchAccounts()}
            className="mt-4 px-4 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No social accounts found"
          description={
            search || platformFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No accounts match your current filter parameters. Try clearing filters.'
              : 'Start by connecting your first social media account to begin managing content and analytics.'
          }
          action={
            canCreate && !search && platformFilter === 'ALL' && statusFilter === 'ALL' ? (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus size={15} />
                <span>Connect Account</span>
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Account Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onViewDetails={(acc) => setSelectedAccount(acc)}
                onEdit={handleOpenEdit}
                onArchive={(acc) => setDeletingAccount(acc)}
                onReactivate={handleReactivate}
                onDelete={(acc) => setDeletingAccount(acc)}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-4 border-t border-[rgb(var(--border))] flex items-center justify-between text-xs text-[rgb(var(--text-secondary))]">
              <div>
                Showing{' '}
                <span className="font-semibold text-[rgb(var(--text-primary))]">
                  {(page - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-[rgb(var(--text-primary))]">
                  {Math.min(page * pageSize, total)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-[rgb(var(--text-primary))]">{total}</span>{' '}
                accounts
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs text-[rgb(var(--text-primary))]"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs font-medium text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>

                  <span className="px-2 font-medium">
                    {page} / {totalPages}
                  </span>

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs font-medium text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] disabled:opacity-40 transition-colors"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AccountFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingAccount(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingAccount}
        platforms={platforms}
        teamMembers={teamMembers}
      />

      <AccountDetailsModal
        isOpen={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        account={selectedAccount}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onEdit={handleOpenEdit}
        onArchive={(acc) => setDeletingAccount(acc)}
        onReactivate={handleReactivate}
        onDelete={(acc) => setDeletingAccount(acc)}
      />

      <AccountDeleteModal
        isOpen={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        account={deletingAccount}
        onConfirmArchive={handleArchiveConfirm}
        onConfirmDelete={handleDeleteConfirm}
      />
    </div>
  );
}
