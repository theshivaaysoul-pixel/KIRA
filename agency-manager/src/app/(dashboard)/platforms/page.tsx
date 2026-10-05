'use client';
// src/app/(dashboard)/platforms/page.tsx
// Dynamic Platform Management interface for KIRA Agency Manager.
// Built with Instagram-inspired aesthetics, real GCS persistence, and role-based actions.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Share2,
  Plus,
  RotateCw,
  Search,
  AlertCircle,
  Trash2,
  Clock,
} from 'lucide-react';
import { usePlatforms } from '@/hooks/usePlatforms';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/Loading';
import type { PlatformWithStats, PlatformCapability } from '@/lib/types/domain';
import { PLATFORM_CAPABILITIES } from '@/lib/types/domain';
import type { CreatePlatformInput, UpdatePlatformInput } from '@/lib/services/platform-service';

import { PlatformCard } from '@/components/platforms/PlatformCard';
import { PlatformFormModal } from '@/components/platforms/PlatformFormModal';
import { PlatformDeleteModal } from '@/components/platforms/PlatformDeleteModal';
import { PlatformDeactivateModal } from '@/components/platforms/PlatformDeactivateModal';
import { PlatformSkeleton } from '@/components/platforms/PlatformSkeleton';

export default function PlatformsPage() {
  const router = useRouter();
  const { role, hasPermission } = usePermission();
  const { success, error: toastError, info } = useToast();

  const {
    platforms,
    stats,
    loading,
    isMutating,
    error,
    view,
    setView,
    search,
    setSearch,
    isActiveFilter,
    setIsActiveFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    refresh,
    createPlatform,
    updatePlatform,
    deactivatePlatform,
    deletePlatform,
    restorePlatform,
    emptyBin,
  } = usePlatforms();

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<PlatformWithStats | null>(null);
  const [deletingPlatform, setDeletingPlatform] = useState<PlatformWithStats | null>(null);
  const [deactivatingPlatform, setDeactivatingPlatform] = useState<PlatformWithStats | null>(null);
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all');

  // Permission Checks
  const canCreate = hasPermission('platforms.create');
  const canUpdate = hasPermission('platforms.update');
  const canDelete = hasPermission('platforms.delete');

  const handleOpenCreate = () => {
    setEditingPlatform(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (platform: PlatformWithStats) => {
    setEditingPlatform(platform);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: CreatePlatformInput) => {
    if (editingPlatform) {
      await updatePlatform(editingPlatform.id, data as UpdatePlatformInput);
      success(`Saved changes to ${data.name}`);
    } else {
      await createPlatform(data);
      success(`Added ${data.name} to supported platforms`);
    }
  };

  const handleToggleActive = async (platform: PlatformWithStats) => {
    if (platform.isActive) {
      // Prompt confirmation modal before deactivating
      setDeactivatingPlatform(platform);
      return;
    }

    try {
      await updatePlatform(platform.id, { isActive: true });
      success(`${platform.name} is now available for account connections.`);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to update platform state');
    }
  };

  const handleConfirmDeactivateOnly = async (id: string) => {
    try {
      await deactivatePlatform(id);
      info(`${deactivatingPlatform?.name || 'Platform'} deactivated. Historical data is preserved.`);
      setDeactivatingPlatform(null);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to deactivate platform');
    }
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      const isAlreadyInBin = Boolean(deletingPlatform?.deletedAt);
      const res = await deletePlatform(id, isAlreadyInBin);
      if (res.movedToBin) {
        info(`"${deletingPlatform?.name || 'Platform'}" moved to Bin (recoverable for 30 days).`);
      } else {
        success(`"${deletingPlatform?.name || 'Platform'}" permanently removed.`);
      }
      setDeletingPlatform(null);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to delete platform');
    }
  };

  const handleRestorePlatform = async (platform: PlatformWithStats) => {
    try {
      await restorePlatform(platform.id);
      success(`"${platform.name}" restored successfully.`);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to restore platform');
    }
  };

  const handleEmptyBin = async () => {
    if (!window.confirm('Are you sure you want to permanently delete ALL platforms in the Bin? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await emptyBin();
      if (res.blockedCount > 0) {
        info(`Bin emptied. Permanently deleted ${res.deletedCount} platform(s). (${res.blockedCount} platform(s) kept because accounts are connected)`);
      } else {
        success(`Bin emptied. Permanently deleted ${res.deletedCount} platform(s).`);
      }
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to empty bin');
    }
  };

  const handleConfirmDeactivate = async (id: string) => {
    try {
      await deactivatePlatform(id);
      info('Platform deactivated instead of deleted. All accounts preserved.');
      setDeletingPlatform(null);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to deactivate platform');
    }
  };


  // Filter platforms by capability on client if capability filter is active
  const displayedPlatforms = capabilityFilter === 'all'
    ? platforms
    : platforms.filter((p) => p.capabilities.includes(capabilityFilter as PlatformCapability));

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-black border border-white/10 flex items-center justify-center text-white shadow-sm shrink-0">
            <Share2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[rgb(var(--text-primary))] leading-tight">
                {view === 'bin' ? 'Recycle Bin' : 'Platforms'}
              </h1>
              {role && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgb(var(--primary-light))] text-[rgb(var(--primary))] border border-[rgb(var(--primary))]/20">
                  {role}
                </span>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5">
              {view === 'bin'
                ? `${stats.bin} deleted platform${stats.bin !== 1 ? 's' : ''} in 30-day recovery`
                : 'Dynamic social networks, media capabilities, and account connection channels'}
            </p>
          </div>
        </div>

        {/* View and Action Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Bin Toggle Button */}
          <button
            type="button"
            onClick={() => setView(view === 'bin' ? 'active' : 'bin')}
            id="platform-bin-btn"
            title={view === 'bin' ? 'Back to Active Platforms' : `Bin / Trash (${stats.bin})`}
            aria-label={view === 'bin' ? 'Back to Active Platforms' : `Bin / Trash (${stats.bin})`}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${view === 'bin'
              ? 'bg-amber-600 text-white shadow-sm border border-amber-500'
              : 'bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] text-[rgb(var(--text-muted))] hover:text-amber-500 hover:border-amber-500/40 hover:bg-amber-500/10'
              }`}
          >
            <Trash2 size={18} />
          </button>

          <button
            onClick={() => refresh()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-sm font-medium text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-all disabled:opacity-50 min-h-[42px] cursor-pointer"
            title="Refresh platforms from storage"
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {view === 'bin' && stats.bin > 0 && canDelete && (
            <button
              type="button"
              onClick={handleEmptyBin}
              disabled={isMutating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-sm min-h-[44px] cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={16} />
              <span>Empty Bin</span>
            </button>
          )}

          {view === 'active' && canCreate && (
            <button
              onClick={handleOpenCreate}
              disabled={isMutating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[rgb(var(--primary))] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 min-h-[44px] cursor-pointer"
            >
              <Plus size={18} />
              <span>Add Platform</span>
            </button>
          )}
        </div>
      </div>

      {/* Information Banner for Bin (30-day auto-purge rule) */}
      {view === 'bin' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start sm:items-center justify-between gap-4 text-xs text-amber-600 dark:text-amber-400 animate-in fade-in flex-wrap">
          <div className="flex items-start gap-3">
            <Clock size={18} className="shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-semibold text-sm text-[rgb(var(--text-primary))]">
                Recycle Bin (30-Day Auto-Purge)
              </p>
              <p className="text-[rgb(var(--text-secondary))] mt-0.5 leading-relaxed">
                All deleted platforms are stored and displayed only here, and will be <strong>permanently deleted from everywhere after 30 days</strong> of deletion. During these 30 days, you can restore platforms back to active status anytime.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setView('active')}
            className="px-3.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold transition-colors shrink-0 cursor-pointer"
          >
            ← Back to Platforms
          </button>
        </div>
      )}

      {/* 2. Platform Operational Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 lg:gap-8">
        <div className="card flex flex-col justify-between" style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}>
          <span className="text-[11px] font-semibold text-[rgb(var(--text-muted))] uppercase tracking-wider block mb-1">
            Total Platforms
          </span>
          <span className="text-2xl font-bold text-[rgb(var(--text-primary))]">
            {stats.total}
          </span>
        </div>

        <div className="card flex flex-col justify-between" style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
            Active Networks
          </span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.active}
          </span>
        </div>

        <div className="card flex flex-col justify-between" style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}>
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
            Inactive / Disabled
          </span>
          <span className="text-2xl font-bold text-neutral-500">
            {stats.inactive}
          </span>
        </div>

        <div className="card flex flex-col justify-between" style={{ padding: '1.5rem 1.75rem', minHeight: '148px' }}>
          <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider block mb-1">
            In Recycle Bin
          </span>
          <span className="text-2xl font-bold text-amber-500">
            {stats.bin}
          </span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input */}
        <div className="relative flex items-center flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--text-muted))]">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))] transition-all"
          />
        </div>

        {/* Filters and Sorting */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 bg-[rgb(var(--bg-subtle))] p-1.5 rounded-full border border-[rgb(var(--border))]">
            <button
              onClick={() => setIsActiveFilter('all')}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors min-h-[38px] ${isActiveFilter === 'all'
                ? 'bg-[rgb(var(--card-bg))] text-[rgb(var(--text-primary))] shadow-xs'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setIsActiveFilter(true)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors min-h-[38px] ${isActiveFilter === true
                ? 'bg-[rgb(var(--card-bg))] text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                }`}
            >
              Active ({stats.active})
            </button>
            <button
              onClick={() => setIsActiveFilter(false)}
              className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors min-h-[38px] ${isActiveFilter === false
                ? 'bg-[rgb(var(--card-bg))] text-neutral-500 shadow-xs'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                }`}
            >
              Inactive ({stats.inactive})
            </button>
          </div>

          {/* Capability Filter Dropdown */}
          <select
            value={capabilityFilter}
            onChange={(e) => setCapabilityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs font-semibold text-[rgb(var(--text-secondary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))]"
          >
            <option value="all">All Capabilities</option>
            {PLATFORM_CAPABILITIES.map((cap) => (
              <option key={cap} value={cap}>
                Supports {cap.charAt(0).toUpperCase() + cap.slice(1)}
              </option>
            ))}
          </select>

          {/* Sort dropdown */}
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [
                'name' | 'createdAt' | 'updatedAt' | 'isActive',
                'asc' | 'desc'
              ];
              setSortField(field);
              setSortOrder(order);
            }}
            className="px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs font-semibold text-[rgb(var(--text-secondary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))]"
          >
            <option value="name-asc">Name (A–Z)</option>
            <option value="name-desc">Name (Z–A)</option>
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="updatedAt-desc">Recently Updated</option>
            <option value="isActive-desc">Active First</option>
          </select>
        </div>
      </div>

      {/* 4. Main Platform Content */}
      {loading && platforms.length === 0 ? (
        <PlatformSkeleton />
      ) : error ? (
        <div className="card p-8 text-center flex flex-col items-center justify-center max-w-md mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mb-3">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-base font-bold text-[rgb(var(--text-primary))] mb-1">
            Unable to Load Platforms
          </h2>
          <p className="text-xs text-[rgb(var(--text-muted))] mb-5 leading-relaxed">{error}</p>
          <button
            onClick={() => refresh()}
            className="px-4 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      ) : displayedPlatforms.length === 0 ? (
        <div className="card p-10">
          <EmptyState
            icon={view === 'bin' ? '🗑️' : '🌐'}
            title={
              view === 'bin'
                ? 'The Recycle Bin is empty'
                : search || isActiveFilter !== 'all' || capabilityFilter !== 'all'
                  ? 'No matching platforms'
                  : 'No platforms configured'
            }
            description={
              view === 'bin'
                ? 'Platforms deleted will be safely stored here for 30 days before permanent deletion.'
                : search || isActiveFilter !== 'all' || capabilityFilter !== 'all'
                  ? 'No social platforms match your active filter or search criteria.'
                  : 'Configure and add social platforms to enable social account connections and publishing.'
            }
            action={
              view === 'bin' ? (
                <button
                  type="button"
                  onClick={() => setView('active')}
                  className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-semibold text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition-colors shadow-xs cursor-pointer"
                >
                  ← Back to Active Platforms
                </button>
              ) : view === 'active' && canCreate ? (
                <button
                  onClick={handleOpenCreate}
                  disabled={isMutating}
                  className="px-4 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
                >
                  Add Platform
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {displayedPlatforms.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onViewDetails={(p) => router.push(`/platforms/${p.id}`)}
              onEdit={handleOpenEdit}
              onToggleActive={handleToggleActive}
              onDelete={setDeletingPlatform}
              onRestore={handleRestorePlatform}
              viewMode={view}
            />
          ))}
        </div>
      )}

      {/* 5. Modals */}
      <PlatformFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPlatform(null);
        }}
        initialData={editingPlatform}
        onSubmit={handleFormSubmit}
        isMutating={isMutating}
      />

      <PlatformDeleteModal
        platform={deletingPlatform}
        isOpen={Boolean(deletingPlatform)}
        onClose={() => setDeletingPlatform(null)}
        onConfirmDelete={handleConfirmDelete}
        onConfirmDeactivate={handleConfirmDeactivate}
        isMutating={isMutating}
      />

      <PlatformDeactivateModal
        platform={deactivatingPlatform}
        isOpen={Boolean(deactivatingPlatform)}
        onClose={() => setDeactivatingPlatform(null)}
        onConfirm={handleConfirmDeactivateOnly}
      />
    </div>
  );
}
