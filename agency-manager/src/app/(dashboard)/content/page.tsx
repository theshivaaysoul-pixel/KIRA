'use client';
// src/app/(dashboard)/content/page.tsx
// Content Management page — search, filter, sort, paginate, CRUD, workflow.

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Search, SlidersHorizontal, X, RefreshCw,
  Filter, ChevronLeft, ChevronRight, Image as ImageIcon,
  Archive, Trash2, Layers, RotateCcw, AlertTriangle, Clock,
} from 'lucide-react';
import { useContent } from '@/hooks/useContent';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { ContentCard, ContentCardSkeleton } from '@/components/content/ContentCard';
import { ContentFormModal } from '@/components/content/ContentFormModal';
import { ContentDetailsModal } from '@/components/content/ContentDetailsModal';
import { ContentDeleteModal } from '@/components/content/ContentDeleteModal';
import type { ContentWithRelations, ContentType, ContentStatus, TeamMember } from '@/lib/types/domain';
import { usePlatforms } from '@/hooks/usePlatforms';
import { MagneticButton } from '@/components/motion';

const CONTENT_TYPES: (ContentType | 'ALL')[] = [
  'ALL', 'POST', 'REEL', 'SHORT', 'VIDEO', 'IMAGE', 'CAROUSEL', 'STORY', 'TEXT', 'LIVE', 'OTHER',
];

// Archived content is strictly stored and displayed in "Archived", never in active status filter
const CONTENT_STATUSES: (ContentStatus | 'ALL')[] = [
  'ALL', 'IDEA', 'SCRIPT', 'PRODUCTION', 'EDITING', 'REVIEW',
  'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED',
];

export default function ContentPage() {
  const { hasPermission, teamMember } = usePermission();
  const { getIdToken } = useAuth();
  const { platforms } = usePlatforms();
  const toast = useToast();
  const {
    result, loading, error, filters, counts,
    updateFilter, resetFilters, refresh,
    createContent, updateContent, transitionStatus, deleteContent,
    restoreContent, emptyBin, getContentById,
  } = useContent();

  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editContent, setEditContent] = useState<ContentWithRelations | null>(null);
  const [viewContent, setViewContent] = useState<ContentWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentWithRelations | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync platformId from URL query param if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const pId = params.get('platformId');
      if (pId) {
        updateFilter('platformId', pId);
      }
    }
  }, [updateFilter]);

  const canCreate = hasPermission('content.create');
  const canUpdate = hasPermission('content.update');
  const canDelete = hasPermission('content.delete');

  const handleView = useCallback(async (content: ContentWithRelations) => {
    // Refresh from server to get latest state
    try {
      const fresh = await getContentById(content.id);
      setViewContent(fresh);
    } catch {
      setViewContent(content);
    }
  }, [getContentById]);

  const handleEdit = useCallback((content: ContentWithRelations) => {
    setViewContent(null);
    setEditContent(content);
  }, []);

  const handleDeleteTarget = useCallback((content: ContentWithRelations) => {
    setViewContent(null);
    setDeleteTarget(content);
  }, []);

  const handleCreate = useCallback(async (data: {
    title: string;
    description?: string;
    contentType: ContentType;
    caption?: string;
    hashtags?: string[];
    targetPlatformIds?: string[];
    mediaFile?: File;
  }) => {
    setActionError(null);
    const { mediaFile, ...contentData } = data;
    const created = await createContent(contentData);

    if (mediaFile && created?.id) {
      try {
        const token = await getIdToken();
        const formData = new FormData();
        formData.append('file', mediaFile);
        const res = await fetch(`/api/content/${created.id}/assets`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          console.error('Failed to upload media asset for new content:', errData);
        }
        await refresh();
      } catch (uploadErr) {
        console.error('Error uploading media asset:', uploadErr);
      }
    }
  }, [createContent, getIdToken, refresh]);

  const handleUpdate = useCallback(async (data: {
    title?: string;
    description?: string;
    contentType?: ContentType;
    caption?: string;
    hashtags?: string[];
    targetPlatformIds?: string[];
    mediaFile?: File;
  }) => {
    if (!editContent) return;
    setActionError(null);
    const { mediaFile, ...contentData } = data;
    await updateContent(editContent.id, contentData);

    if (mediaFile) {
      try {
        const token = await getIdToken();
        const formData = new FormData();
        formData.append('file', mediaFile);
        await fetch(`/api/content/${editContent.id}/assets`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        await refresh();
      } catch (uploadErr) {
        console.error('Error uploading media asset during edit:', uploadErr);
      }
    }
  }, [editContent, updateContent, getIdToken, refresh]);

  const handleTransition = useCallback(async (id: string, status: ContentStatus) => {
    setActionError(null);
    const updated = await transitionStatus(id, status);
    setViewContent(updated);
  }, [transitionStatus]);

  const handleDelete = useCallback(async (forcePermanent: boolean) => {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      const res = await deleteContent(deleteTarget.id, forcePermanent);
      if (res.movedToBin) {
        toast.info(`"${deleteTarget.title}" moved to Bin (recoverable for 30 days).`);
      } else {
        toast.success(`"${deleteTarget.title}" permanently deleted.`);
      }
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete content';
      setActionError(msg);
      toast.error(msg);
    }
  }, [deleteTarget, deleteContent, toast]);

  const handleRestore = useCallback(async (content: ContentWithRelations) => {
    setActionError(null);
    try {
      await restoreContent(content.id);
      toast.success(`"${content.title}" restored successfully.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to restore content';
      setActionError(msg);
      toast.error(msg);
    }
  }, [restoreContent, toast]);

  const handleEmptyBin = useCallback(async () => {
    if (!window.confirm('Are you sure you want to permanently delete ALL items in the Bin? This action cannot be undone.')) {
      return;
    }
    setActionError(null);
    try {
      const res = await emptyBin();
      toast.success(`Bin emptied. Permanently deleted ${res.deletedCount} piece(s).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to empty bin';
      setActionError(msg);
      toast.error(msg);
    }
  }, [emptyBin, toast]);

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;

  const currentView = filters.view || 'active';

  return (
    <div className="flex flex-col gap-8 p-6 min-h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--foreground))]">
            {currentView === 'bin'
              ? 'Recycle Bin'
              : currentView === 'archived'
              ? 'Archived Content'
              : 'Content'}
          </h1>
          <p className="text-sm text-[rgb(var(--muted-foreground))] mt-0.5">
            {loading
              ? 'Loading…'
              : currentView === 'bin'
              ? `${counts.bin} deleted piece${counts.bin !== 1 ? 's' : ''} in 30-day recovery`
              : currentView === 'archived'
              ? `${counts.archived} archived piece${counts.archived !== 1 ? 's' : ''} stored safely`
              : `${counts.active} active piece${counts.active !== 1 ? 's' : ''} of content`}
          </p>
        </div>

        {/* View Filter Circle Buttons: Active, Archived & Bin */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateFilter('view', 'active')}
              title={`Active Content (${counts.active})`}
              aria-label={`Active Content (${counts.active})`}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
                currentView === 'active'
                  ? 'bg-blue-600 text-white shadow-sm border border-blue-500'
                  : 'bg-[rgb(var(--card))] border border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))]'
              }`}
            >
              <Layers size={18} />
            </button>

            <button
              type="button"
              onClick={() => updateFilter('view', 'archived')}
              id="content-archived-btn"
              title={`Archived Content (${counts.archived})`}
              aria-label={`Archived Content (${counts.archived})`}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
                currentView === 'archived'
                  ? 'bg-blue-600 text-white shadow-sm border border-blue-500'
                  : 'bg-[rgb(var(--card))] border border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))]'
              }`}
            >
              <Archive size={18} />
            </button>

            <button
              type="button"
              onClick={() => updateFilter('view', 'bin')}
              id="content-bin-btn"
              title={`Bin / Trash (${counts.bin})`}
              aria-label={`Bin / Trash (${counts.bin})`}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
                currentView === 'bin'
                  ? 'bg-amber-600 text-white shadow-sm border border-amber-500'
                  : 'bg-[rgb(var(--card))] border border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))]'
              }`}
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={refresh}
              disabled={loading}
              className="w-11 h-11 rounded-full border border-[rgb(var(--border))] flex items-center justify-center hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] transition-colors disabled:opacity-50 shrink-0"
              aria-label="Refresh content"
              title="Refresh content"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>

            {currentView === 'bin' && counts.bin > 0 && canDelete && (
              <button
                type="button"
                onClick={handleEmptyBin}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-sm min-h-[44px]"
              >
                <Trash2 size={16} />
                <span>Empty Bin</span>
              </button>
            )}

            {currentView === 'active' && canCreate && (
              <MagneticButton>
                <button
                  onClick={() => setCreateOpen(true)}
                  id="create-content-btn"
                  className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm min-h-[44px] cursor-pointer active:scale-95"
                >
                  <Plus size={18} className="transition-transform duration-200 group-hover:scale-110" />
                  <span>New Content</span>
                </button>
              </MagneticButton>
            )}
          </div>
        </div>
      </div>

      {/* Information Banner for Bin (30-day auto-purge rule) */}
      {currentView === 'bin' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start justify-between gap-3 text-xs text-amber-500 animate-in fade-in">
          <div className="flex items-start gap-3">
            <Clock size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-[rgb(var(--foreground))]">
                Recycle Bin (30-Day Auto-Purge)
              </p>
              <p className="text-[rgb(var(--muted-foreground))] mt-0.5 leading-relaxed">
                All deleted content is stored and displayed only here, and will be <strong>permanently deleted from everywhere after 30 days</strong> of deletion. During these 30 days, you can restore content back to where it was deleted anytime.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Information Banner for Archived (Never deleted indefinitely) */}
      {currentView === 'archived' && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-start justify-between gap-3 text-xs text-blue-500 animate-in fade-in">
          <div className="flex items-start gap-3">
            <Archive size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-[rgb(var(--foreground))]">
                Archived Content Vault
              </p>
              <p className="text-[rgb(var(--muted-foreground))] mt-0.5 leading-relaxed">
                All archived content is stored and displayed only here. It will <strong>never be automatically deleted</strong> and remains preserved indefinitely until you restore it or delete it.
              </p>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm" role="alert">
          {actionError}
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex items-center flex-1 min-w-56">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--muted-foreground))]">
            <Search size={15} aria-hidden />
          </div>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            aria-label="Search content"
            id="content-search"
          />
        </div>

        {/* Quick status filter — only relevant in active view */}
        {currentView === 'active' && (
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as ContentStatus | 'ALL')}
            className="px-3 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            aria-label="Filter by status"
            id="content-status-filter"
          >
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Active Statuses' : s}</option>
            ))}
          </select>
        )}

        {/* Quick platform filter */}
        <select
          value={filters.platformId}
          onChange={(e) => updateFilter('platformId', e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all max-w-[170px] truncate"
          aria-label="Filter by target platform"
          id="content-platform-filter"
        >
          <option value="ALL">All Platforms</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Quick type filter */}
        <select
          value={filters.contentType}
          onChange={(e) => updateFilter('contentType', e.target.value as ContentType | 'ALL')}
          className="px-3 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          aria-label="Filter by content type"
          id="content-type-filter"
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</option>
          ))}
        </select>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all ${
            showFilters
              ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
              : 'border-[rgb(var(--border))] text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))]'
          }`}
          aria-label="Toggle advanced filters"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={14} />
          Sort
        </button>

        {(filters.search || filters.status !== 'ALL' || filters.contentType !== 'ALL' || (filters.platformId && filters.platformId !== 'ALL')) && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[rgb(var(--border))] text-sm text-[rgb(var(--muted-foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
            aria-label="Reset all filters"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap p-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
          <div className="flex items-center gap-2">
            <label htmlFor="content-sort-by" className="text-sm text-[rgb(var(--muted-foreground))] whitespace-nowrap">Sort by</label>
            <select
              id="content-sort-by"
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value as typeof filters.sortBy)}
              className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] text-sm focus:outline-none"
            >
              <option value="updatedAt">Last Updated</option>
              <option value="createdAt">Created Date</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
              <option value="contentType">Type</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="content-sort-order" className="text-sm text-[rgb(var(--muted-foreground))]">Order</label>
            <select
              id="content-sort-order"
              value={filters.sortOrder}
              onChange={(e) => updateFilter('sortOrder', e.target.value as 'asc' | 'desc')}
              className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] text-sm focus:outline-none"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="content-page-size" className="text-sm text-[rgb(var(--muted-foreground))] whitespace-nowrap">Per page</label>
            <select
              id="content-page-size"
              value={filters.pageSize}
              onChange={(e) => updateFilter('pageSize', parseInt(e.target.value, 10))}
              className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--muted))] text-[rgb(var(--foreground))] text-sm focus:outline-none"
            >
              <option value={12}>12</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
            </select>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={refresh} className="px-4 py-2 rounded-xl bg-[rgb(var(--muted))] text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--border))] transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* Content Grid */}
      {!error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
            {loading
              ? Array.from({ length: filters.pageSize }).map((_, i) => (
                  <ContentCardSkeleton key={i} />
                ))
              : items.map((content) => (
                  <ContentCard
                    key={content.id}
                    content={content}
                    onView={handleView}
                    onEdit={canUpdate && currentView === 'active' ? handleEdit : () => {}}
                    onDelete={handleDeleteTarget}
                    onRestore={handleRestore}
                    viewMode={currentView}
                  />
                ))
            }
          </div>

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--muted))] flex items-center justify-center">
                {currentView === 'bin' ? (
                  <Trash2 size={28} className="text-amber-500" />
                ) : currentView === 'archived' ? (
                  <Archive size={28} className="text-blue-500" />
                ) : (
                  <ImageIcon size={28} className="text-[rgb(var(--muted-foreground))]" />
                )}
              </div>
              <div>
                <p className="text-[rgb(var(--foreground))] font-semibold">
                  {currentView === 'bin'
                    ? 'The Recycle Bin is empty'
                    : currentView === 'archived'
                    ? 'No archived content yet'
                    : 'No content found'}
                </p>
                <p className="text-sm text-[rgb(var(--muted-foreground))] mt-1 max-w-md">
                  {currentView === 'bin'
                    ? 'Items deleted from active content or the platform hub will be safely stored here for 30 days before permanent deletion.'
                    : currentView === 'archived'
                    ? 'All archived content is stored and preserved indefinitely here. Downloaded content from platforms is automatically moved here.'
                    : filters.search || filters.status !== 'ALL' || filters.contentType !== 'ALL'
                    ? 'Try adjusting your search or filters.'
                    : canCreate
                    ? 'Create your first piece of content to get started.'
                    : 'No content has been created yet.'}
                </p>
              </div>
              {canCreate && currentView === 'active' && !filters.search && filters.status === 'ALL' && filters.contentType === 'ALL' && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <Plus size={16} /> Create Content
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => updateFilter('page', Math.max(1, filters.page - 1))}
                disabled={filters.page <= 1}
                className="p-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[rgb(var(--foreground))]"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-[rgb(var(--muted-foreground))] px-3">
                Page <strong className="text-[rgb(var(--foreground))]">{filters.page}</strong> of {totalPages}
              </span>
              <button
                onClick={() => updateFilter('page', Math.min(totalPages, filters.page + 1))}
                disabled={filters.page >= totalPages}
                className="p-2 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[rgb(var(--foreground))]"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ContentFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        title="Create Content"
      />

      <ContentFormModal
        open={!!editContent}
        onClose={() => setEditContent(null)}
        onSubmit={handleUpdate}
        initialData={editContent}
        title="Edit Content"
      />

      <ContentDetailsModal
        open={!!viewContent}
        content={viewContent}
        actor={teamMember}
        onClose={() => setViewContent(null)}
        onEdit={canUpdate ? handleEdit : () => {}}
        onTransition={handleTransition}
        onContentUpdated={refresh}
        onContentArchived={() => {
          setViewContent(null);
          refresh();
          toast.success('Downloaded from all targeted platforms. Content archived automatically.');
        }}
      />

      <ContentDeleteModal
        open={!!deleteTarget}
        content={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
