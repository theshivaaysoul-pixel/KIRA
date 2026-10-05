'use client';
// src/components/platforms/PlatformDetailsModal.tsx
// Comprehensive Platform Workspace & Targeted Content Hub.
// Displays high-resolution platform identity, targeted content grid, live media players,
// 1-click media download, workflow status controls, and full content editing tools.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Check, Minus, Edit2, Users, Layers, Tag,
  ExternalLink, Loader2, Plus, Film, Download,
  Play, Eye, Trash2, Copy, Search, RefreshCw,
  Image as ImageIcon, Music, FileText, ChevronRight,
} from 'lucide-react';
import type {
  PlatformWithStats, PlatformCapability, ContentWithRelations,
  ContentType, ContentStatus, ContentAsset,
} from '@/lib/types/domain';
import { PLATFORM_CAPABILITIES } from '@/lib/types/domain';
import { PlatformIcon } from './PlatformIcon';
import { ContentTypeBadge, StatusBadge, STATUS_CONFIG } from '@/components/content/ContentBadges';
import { ContentFormModal } from '@/components/content/ContentFormModal';
import { ContentDetailsModal } from '@/components/content/ContentDetailsModal';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { getAllowedTransitions, STATUS_TRANSITION_LABELS } from '@/lib/content/workflow-transitions';

interface PlatformDetailsModalProps {
  platform: PlatformWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (platform: PlatformWithStats) => void;
  canUpdate: boolean;
}

const CAPABILITY_METADATA: Record<
  PlatformCapability,
  { label: string; description: string; category: string }
> = {
  text: { label: 'Text Updates', description: 'Standalone character threads and captions', category: 'Content' },
  image: { label: 'Static Images', description: 'JPEG, PNG, and WebP single image posts', category: 'Content' },
  video: { label: 'Standard Video', description: 'Landscape and square video playback', category: 'Content' },
  carousel: { label: 'Multi-Image Albums', description: 'Swipeable carousel cards', category: 'Content' },
  story: { label: 'Ephemeral Stories', description: '24-hour vertical story cards', category: 'Content' },
  shortVideo: { label: 'Vertical Shorts / Reels', description: 'Full-screen mobile vertical short-form video', category: 'Content' },
  live: { label: 'Live Streaming', description: 'Real-time broadcast and chat integration', category: 'Broadcast' },
  scheduling: { label: 'Queue & Scheduling', description: 'Automated delayed publishing and queueing', category: 'Workflow' },
  analytics: { label: 'Performance Metrics', description: 'Audience reach, impressions, and engagement stats', category: 'Workflow' },
  publishing: { label: 'Automated Publishing', description: 'Direct API syndication and upload dispatch', category: 'Workflow' },
};

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function PlatformDetailsModal({
  platform,
  isOpen,
  onClose,
  onEdit,
  canUpdate,
}: PlatformDetailsModalProps) {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const { teamMember } = usePermission();

  // Active tab state: default to 'content' as requested
  const [activeTab, setActiveTab] = useState<'content' | 'overview'>('content');

  // Content state
  const [targetedContent, setTargetedContent] = useState<ContentWithRelations[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentTotal, setContentTotal] = useState(0);

  // Filters within platform content
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal sub-states
  const [editingContent, setEditingContent] = useState<ContentWithRelations | null>(null);
  const [viewingContent, setViewingContent] = useState<ContentWithRelations | null>(null);
  const [creatingContentForPlatform, setCreatingContentForPlatform] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [copiedCaptionId, setCopiedCaptionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchTargetedContent = useCallback(async () => {
    if (!platform?.id) return;
    setContentLoading(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/content?platformId=${platform.id}&pageSize=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setTargetedContent(json.data.items || []);
          setContentTotal(json.data.total || 0);
        }
      }
    } catch (err) {
      console.error('[PlatformDetailsModal] Error fetching targeted content:', err);
    } finally {
      setContentLoading(false);
    }
  }, [platform?.id, getIdToken]);

  useEffect(() => {
    if (isOpen && platform?.id) {
      fetchTargetedContent();
      setActiveTab('content');
    } else {
      setTargetedContent([]);
      setContentTotal(0);
      setEditingContent(null);
      setViewingContent(null);
      setCreatingContentForPlatform(false);
      setSearchQuery('');
      setStatusFilter('ALL');
    }
  }, [isOpen, platform?.id, fetchTargetedContent]);

  // Filtered targeted content
  const filteredContent = useMemo(() => {
    return targetedContent.filter((cnt) => {
      // Status filter
      if (statusFilter !== 'ALL' && cnt.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCaption = cnt.caption?.toLowerCase().includes(q);
        const matchesTitle = cnt.title?.toLowerCase().includes(q);
        const matchesType = cnt.contentType.toLowerCase().includes(q);
        if (!matchesCaption && !matchesTitle && !matchesType) {
          return false;
        }
      }
      return true;
    });
  }, [targetedContent, statusFilter, searchQuery]);

  // 1-Click Media Downloader
  const handleDownloadMedia = async (cnt: ContentWithRelations, asset?: ContentAsset) => {
    const targetAsset = asset || cnt.assets?.[0];
    if (!targetAsset) return;

    setDownloadingId(cnt.id);
    setActionError(null);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const downloadUrl = `/api/content/${cnt.id}/assets/${targetAsset.id}/file?download=true${platform?.id ? `&platformId=${platform.id}` : ''}`;
      const res = await fetch(downloadUrl, { headers });
      if (!res.ok) throw new Error('Download failed: ' + res.statusText);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = targetAsset.fileName || `${cnt.title || 'media'}.${targetAsset.mimeType.split('/')[1] || 'bin'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      // If server archived content because all targeted platforms were downloaded, remove from active list
      if (res.headers.get('X-Content-Archived') === 'true') {
        setTargetedContent((prev) => prev.filter((c) => c.id !== cnt.id));
      }
    } catch (err) {
      console.error('Download error:', err);
      // Fallback direct link
      window.open(`/api/content/${cnt.id}/assets/${targetAsset.id}/file?download=true${platform?.id ? `&platformId=${platform.id}` : ''}`, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  // Workflow Status Transition
  const handleTransitionStatus = async (contentId: string, nextStatus: ContentStatus) => {
    setTransitioningId(contentId);
    setActionError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/content/${contentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || 'Failed to update workflow status');
      }

      await fetchTargetedContent();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status transition failed');
    } finally {
      setTransitioningId(null);
    }
  };

  // Delete / Archive content
  const handleDeleteContent = async (cnt: ContentWithRelations) => {
    if (!confirm(`Are you sure you want to remove "${cnt.caption || cnt.title}"?`)) return;
    setActionError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/content/${cnt.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || 'Failed to delete content');
      }

      await fetchTargetedContent();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Copy Caption to Clipboard
  const handleCopyCaption = (cnt: ContentWithRelations) => {
    const textToCopy = cnt.caption || cnt.title || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCaptionId(cnt.id);
    setTimeout(() => setCopiedCaptionId(null), 2000);
  };

  // Edit Submit
  const handleEditContentSubmit = async (data: {
    title: string;
    description?: string;
    contentType: ContentType;
    caption?: string;
    hashtags?: string[];
    targetPlatformIds?: string[];
    mediaFile?: File;
  }) => {
    if (!editingContent) return;
    const token = await getIdToken();
    if (!token) return;

    const { mediaFile, ...patchData } = data;
    const res = await fetch(`/api/content/${editingContent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patchData),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error?.message || 'Failed to update content');
    }

    if (mediaFile) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      await fetch(`/api/content/${editingContent.id}/assets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    }

    setEditingContent(null);
    await fetchTargetedContent();
  };

  // Create Submit
  const handleCreateContentSubmit = async (data: {
    title: string;
    description?: string;
    contentType: ContentType;
    caption?: string;
    hashtags?: string[];
    targetPlatformIds?: string[];
    mediaFile?: File;
  }) => {
    const token = await getIdToken();
    if (!token) return;

    const { mediaFile, ...createData } = data;
    const targetPlatformIds = Array.from(
      new Set([...(createData.targetPlatformIds || []), platform?.id].filter(Boolean) as string[])
    );

    const res = await fetch('/api/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...createData, targetPlatformIds }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error?.message || 'Failed to create content');
    }

    const createdJson = await res.json();
    const createdId = createdJson.data?.id;

    if (mediaFile && createdId) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      await fetch(`/api/content/${createdId}/assets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    }

    setCreatingContentForPlatform(false);
    await fetchTargetedContent();
  };

  if (!isOpen || !platform) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
          
          {/* 1. Branded Platform Header */}
          <div className="p-5 sm:p-6 border-b border-[rgb(var(--border))] bg-gradient-to-r from-[rgb(var(--bg-subtle))] to-[rgb(var(--card-bg))] flex items-start justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              {/* Platform Official Logo Container */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] flex items-center justify-center p-2.5 shadow-sm shrink-0 overflow-hidden">
                <PlatformIcon
                  icon={platform.icon}
                  name={platform.name}
                  size={56}
                  className="max-h-full max-w-full object-contain drop-shadow-sm"
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-[rgb(var(--text-primary))] truncate">
                    {platform.name}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${
                      platform.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        platform.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                      }`}
                    />
                    {platform.isActive ? 'Active Platform' : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-[rgb(var(--text-muted))] font-mono">
                  <span>@{platform.slug}</span>
                  <span>•</span>
                  <span>ID: {platform.id}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-[rgb(var(--text-secondary))] font-sans font-medium">
                    <Users size={12} /> {platform.accountCount} account{platform.accountCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCreatingContentForPlatform(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus size={14} /> Add Content
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 2. Navigation Tabs */}
          <div className="flex items-center gap-4 sm:gap-6 px-6 border-b border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] shrink-0">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'content'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              <Layers size={14} />
              <span>Targeted Content Hub</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400">
                {contentTotal}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              <Tag size={14} />
              <span>Overview & Capabilities</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))]">
                {platform.capabilities.length}
              </span>
            </button>
          </div>

          {/* Action Error Alert */}
          {actionError && (
            <div className="mx-6 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-300">
                <X size={13} />
              </button>
            </div>
          )}

          {/* 3. Modal Scrollable Body */}
          <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
            
            {/* TAB 1: TARGETED CONTENT HUB */}
            {activeTab === 'content' && (
              <div className="space-y-4">
                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="relative flex items-center flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--text-muted))]">
                      <Search size={15} />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs font-semibold text-[rgb(var(--text-secondary))] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">All Statuses ({targetedContent.length})</option>
                      <option value="IDEA">Idea</option>
                      <option value="DRAFT">Draft</option>
                      <option value="REVIEW">Review</option>
                      <option value="APPROVED">Approved</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>

                    <button
                      type="button"
                      onClick={fetchTargetedContent}
                      disabled={contentLoading}
                      className="p-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] transition-colors disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw size={14} className={contentLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {/* Content Cards Grid */}
                {contentLoading && targetedContent.length === 0 ? (
                  <div className="p-12 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex flex-col items-center justify-center gap-3 text-center">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                    <p className="text-xs text-[rgb(var(--text-muted))] font-medium">
                      Loading content targeted for {platform.name}…
                    </p>
                  </div>
                ) : filteredContent.length === 0 ? (
                  <div className="p-10 rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                      <Layers size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[rgb(var(--text-primary))]">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'No matching content pieces found'
                          : `No content targeted for ${platform.name} yet`}
                      </h4>
                      <p className="text-xs text-[rgb(var(--text-muted))] max-w-sm mx-auto mt-1">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try clearing your search query or status filter.'
                          : `Upload and tag new content with ${platform.name} as a targeted platform to access, edit, and download it here.`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatingContentForPlatform(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                    >
                      <Plus size={14} /> Create Content for {platform.name}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                    {filteredContent.map((cnt) => {
                      const primaryAsset = cnt.assets?.[0];
                      const isVideo = primaryAsset?.type === 'VIDEO' || primaryAsset?.mimeType?.startsWith('video/');
                      const isImage = primaryAsset?.type === 'IMAGE' || primaryAsset?.mimeType?.startsWith('image/');
                      const isAudio = primaryAsset?.type === 'AUDIO' || primaryAsset?.mimeType?.startsWith('audio/');
                      const streamUrl = primaryAsset ? `/api/content/${cnt.id}/assets/${primaryAsset.id}/file` : null;

                      const allowedTransitions = teamMember ? getAllowedTransitions(cnt.status, teamMember) : [];

                      return (
                        <div
                          key={cnt.id}
                          className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] hover:border-blue-500/40 hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            {/* Media Section: Live Video / Image / Audio */}
                            {streamUrl ? (
                              <div className="relative w-full h-44 bg-black/90 overflow-hidden flex items-center justify-center group/media">
                                {isVideo ? (
                                  <video
                                    src={streamUrl}
                                    controls
                                    preload="metadata"
                                    className="w-full h-full object-cover"
                                  />
                                ) : isImage ? (
                                  <img
                                    src={streamUrl}
                                    alt={cnt.title || 'Content image'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : isAudio ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-neutral-900 to-black text-white gap-2">
                                    <Music size={28} className="text-purple-400" />
                                    <audio src={streamUrl} controls className="w-full max-w-[240px]" />
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))]">
                                    <FileText size={32} />
                                  </div>
                                )}

                                {/* Top Badges overlay */}
                                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 pointer-events-none">
                                  <ContentTypeBadge type={cnt.contentType} />
                                  <StatusBadge status={cnt.status} />
                                </div>

                                {/* Download quick badge overlay */}
                                <button
                                  type="button"
                                  onClick={() => handleDownloadMedia(cnt, primaryAsset)}
                                  disabled={downloadingId === cnt.id}
                                  className="absolute bottom-2.5 right-2.5 p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs transition-all shadow-sm opacity-90 hover:opacity-100"
                                  title={`Download ${primaryAsset.fileName}`}
                                >
                                  {downloadingId === cnt.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Download size={14} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              /* Fallback header when no media asset exists */
                              <div className="p-4 bg-[rgb(var(--bg-subtle))] border-b border-[rgb(var(--border))] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ContentTypeBadge type={cnt.contentType} />
                                  <StatusBadge status={cnt.status} />
                                </div>
                                <span className="text-[11px] text-[rgb(var(--text-muted))] font-mono">
                                  {cnt.id}
                                </span>
                              </div>
                            )}

                            {/* Content Body */}
                            <div className="p-4 space-y-2.5">
                              {/* Caption / Title */}
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-[rgb(var(--text-primary))] line-clamp-2 leading-relaxed flex-1">
                                  {cnt.caption || cnt.title || 'Untitled Post'}
                                </p>
                                {(cnt.caption || cnt.title) && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCaption(cnt)}
                                    className="p-1 rounded-md text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] transition-colors shrink-0"
                                    title="Copy caption"
                                  >
                                    {copiedCaptionId === cnt.id ? (
                                      <Check size={12} className="text-emerald-500" />
                                    ) : (
                                      <Copy size={12} />
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Asset details pill */}
                              {primaryAsset && (
                                <div className="text-[11px] text-[rgb(var(--text-muted))] flex items-center gap-1.5 truncate">
                                  <span className="font-mono truncate">{primaryAsset.fileName}</span>
                                  <span>•</span>
                                  <span>{formatFileSize(primaryAsset.size)}</span>
                                </div>
                              )}

                              {/* Target Platforms Chips */}
                              {cnt.targetPlatforms && cnt.targetPlatforms.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  {cnt.targetPlatforms.map((plt) => (
                                    <span
                                      key={plt.id}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                        plt.id === platform.id
                                          ? 'border-blue-500/40 bg-blue-500/10 text-blue-500'
                                          : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))]'
                                      }`}
                                    >
                                      <PlatformIcon icon={plt.icon} name={plt.name} size={11} className="shrink-0" />
                                      <span>{plt.name}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Content Tools Action Bar */}
                          <div className="p-3 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]/60 flex items-center justify-between gap-2 flex-wrap">
                            {/* Left actions: Download & View */}
                            <div className="flex items-center gap-1.5">
                              {primaryAsset ? (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadMedia(cnt, primaryAsset)}
                                  disabled={downloadingId === cnt.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs font-semibold text-[rgb(var(--text-primary))] hover:border-blue-500 hover:text-blue-500 transition-colors shadow-xs disabled:opacity-50"
                                  title="Download original media file"
                                >
                                  {downloadingId === cnt.id ? (
                                    <Loader2 size={13} className="animate-spin text-blue-500" />
                                  ) : (
                                    <Download size={13} className="text-blue-500" />
                                  )}
                                  <span>Download</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-[rgb(var(--text-muted))] px-2 py-1">
                                  No media
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => setViewingContent(cnt)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs font-medium text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--border))] transition-colors shadow-xs"
                                title="Open full content workspace"
                              >
                                <Eye size={12} /> View
                              </button>
                            </div>

                            {/* Right actions: Edit, Status, Delete */}
                            <div className="flex items-center gap-1.5">
                              {/* Workflow advance button */}
                              {allowedTransitions.length > 0 && (
                                <button
                                  type="button"
                                  disabled={transitioningId === cnt.id}
                                  onClick={() => handleTransitionStatus(cnt.id, allowedTransitions[0])}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
                                  title={`Advance to ${STATUS_TRANSITION_LABELS[allowedTransitions[0]] || allowedTransitions[0]}`}
                                >
                                  {transitioningId === cnt.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <ChevronRight size={12} />
                                  )}
                                  <span>{STATUS_TRANSITION_LABELS[allowedTransitions[0]] || allowedTransitions[0]}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setEditingContent(cnt)}
                                className="p-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-[rgb(var(--text-muted))] hover:text-blue-500 hover:border-blue-500/30 transition-colors shadow-xs"
                                title="Edit Content"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteContent(cnt)}
                                className="p-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-[rgb(var(--text-muted))] hover:text-red-500 hover:border-red-500/30 transition-colors shadow-xs"
                                title="Delete or Archive"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: OVERVIEW & CAPABILITIES */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-2">
                    Operational Description
                  </h4>
                  <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed p-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]">
                    {platform.description || 'No description provided for this social platform.'}
                  </p>
                </div>

                {/* Detailed Capabilities Matrix */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-2.5">
                    Platform Capability Matrix ({platform.capabilities.length} Supported)
                  </h4>
                  <div className="divide-y divide-[rgb(var(--border))] border border-[rgb(var(--border))] rounded-xl bg-[rgb(var(--bg-subtle))] overflow-hidden">
                    {PLATFORM_CAPABILITIES.map((cap) => {
                      const isSupported = platform.capabilities.includes(cap);
                      const meta = CAPABILITY_METADATA[cap];
                      return (
                        <div
                          key={cap}
                          className="p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[rgb(var(--text-primary))]">
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-[rgb(var(--text-muted))] font-mono">
                                ({cap})
                              </span>
                            </div>
                            <span className="text-[11px] text-[rgb(var(--text-muted))] block mt-0.5">
                              {meta.description}
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 ${
                              isSupported
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
                            }`}
                          >
                            {isSupported ? (
                              <>
                                <Check size={12} />
                                Supported
                              </>
                            ) : (
                              <>
                                <Minus size={12} />
                                Disabled
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="pt-3 border-t border-[rgb(var(--border))] flex items-center justify-between text-[11px] text-[rgb(var(--text-muted))] font-mono">
                  <span>Created: {new Date(platform.createdAt).toLocaleDateString()}</span>
                  <span>Updated: {new Date(platform.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-semibold text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--card-bg))] transition-colors"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/content?platformId=${platform.id}`);
                }}
                className="px-3.5 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-semibold text-[rgb(var(--text-secondary))] hover:text-blue-500 hover:bg-[rgb(var(--card-bg))] transition-colors flex items-center gap-1.5"
              >
                <span>Open in Content Library</span>
                <ExternalLink size={12} />
              </button>

              {canUpdate && onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(platform);
                  }}
                  className="px-4 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
                >
                  <Edit2 size={13} />
                  Edit Platform
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editing content modal directly from platform */}
      {editingContent && (
        <ContentFormModal
          open={Boolean(editingContent)}
          onClose={() => setEditingContent(null)}
          onSubmit={handleEditContentSubmit}
          initialData={editingContent}
          title={`Edit ${platform.name} Content`}
        />
      )}

      {/* Viewing full content details modal directly from platform */}
      {viewingContent && (
        <ContentDetailsModal
          open={Boolean(viewingContent)}
          content={viewingContent}
          actor={teamMember}
          onClose={() => setViewingContent(null)}
          onEdit={(cnt) => {
            setViewingContent(null);
            setEditingContent(cnt);
          }}
          onTransition={async (id, status) => {
            await handleTransitionStatus(id, status);
          }}
        />
      )}

      {/* Creating new content directly for this platform */}
      {creatingContentForPlatform && (
        <ContentFormModal
          open={creatingContentForPlatform}
          onClose={() => setCreatingContentForPlatform(false)}
          onSubmit={handleCreateContentSubmit}
          initialData={{
            targetPlatformIds: [platform.id],
          }}
          title={`New Content for ${platform.name}`}
        />
      )}
    </>
  );
}
