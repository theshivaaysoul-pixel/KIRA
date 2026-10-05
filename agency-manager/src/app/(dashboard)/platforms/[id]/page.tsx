'use client';
// src/app/(dashboard)/platforms/[id]/page.tsx
// Full dedicated webpage for a platform's targeted content hub.
// Automatically archives content upon download.
// "Add new content" and "Edit" options removed per user instructions.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Download, Check, Copy, Search, RefreshCw,
  FileText, Music, Film, Image as ImageIcon, Layers,
  Loader2, CheckCircle2, Archive, Users, AlertCircle,
} from 'lucide-react';
import type {
  PlatformWithStats, ContentWithRelations, ContentAsset,
} from '@/lib/types/domain';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';
import { ContentTypeBadge, StatusBadge } from '@/components/content/ContentBadges';
import { useAuth } from '@/contexts/AuthContext';

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function PlatformContentPage() {
  const router = useRouter();
  const params = useParams();
  const platformId = params?.id as string;
  const { getIdToken } = useAuth();

  const [platform, setPlatform] = useState<PlatformWithStats | null>(null);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformError, setPlatformError] = useState<string | null>(null);

  const [contentList, setContentList] = useState<ContentWithRelations[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Action states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [justArchivedId, setJustArchivedId] = useState<string | null>(null);
  const [copiedCaptionId, setCopiedCaptionId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // 1. Fetch Platform Data
  const fetchPlatform = useCallback(async () => {
    if (!platformId) return;
    setPlatformLoading(true);
    setPlatformError(null);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/platforms/${platformId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Platform not found or access denied');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setPlatform(json.data);
      }
    } catch (err) {
      setPlatformError(err instanceof Error ? err.message : 'Failed to load platform');
    } finally {
      setPlatformLoading(false);
    }
  }, [platformId, getIdToken]);

  // 2. Fetch Targeted Content for this Platform
  const fetchContent = useCallback(async () => {
    if (!platformId) return;
    setContentLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/content?platformId=${platformId}&pageSize=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setContentList(json.data.items || []);
        }
      }
    } catch (err) {
      console.error('Error fetching platform content:', err);
    } finally {
      setContentLoading(false);
    }
  }, [platformId, getIdToken]);

  useEffect(() => {
    fetchPlatform();
    fetchContent();
  }, [fetchPlatform, fetchContent]);

  // 3. Download & Automatically Archive (Only if downloaded from all targeted platforms)
  const handleDownloadAndArchive = async (cnt: ContentWithRelations, asset?: ContentAsset) => {
    const targetAsset = asset || cnt.assets?.[0];
    if (!targetAsset || !platform) return;

    setDownloadingId(cnt.id);
    setActionMessage(null);

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // A. Trigger browser file download with platform context
      const downloadUrl = `/api/content/${cnt.id}/assets/${targetAsset.id}/file?download=true&platformId=${platform.id}`;
      const res = await fetch(downloadUrl, { headers });
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = targetAsset.fileName || `${cnt.title || 'media'}.${targetAsset.mimeType.split('/')[1] || 'bin'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      // B. Check if server archived content (only when downloaded from every targeted platform, once)
      const wasArchived = res.headers.get('X-Content-Archived') === 'true';

      if (wasArchived) {
        setContentList((prev) => prev.filter((c) => c.id !== cnt.id));
        setJustArchivedId(cnt.id);
        setActionMessage(`"${cnt.caption || cnt.title || targetAsset.fileName}" downloaded from all targeted platforms and moved to Archived.`);
        setTimeout(() => {
          setJustArchivedId(null);
          setActionMessage(null);
        }, 4500);
      } else {
        setActionMessage(`"${cnt.caption || cnt.title || targetAsset.fileName}" downloaded for ${platform.name}. Remaining targeted platforms still active.`);
        setTimeout(() => {
          setActionMessage(null);
        }, 4000);
      }
    } catch (err) {
      console.error('Download/archive error:', err);
      // Fallback direct link
      window.open(`/api/content/${cnt.id}/assets/${targetAsset.id}/file?download=true&platformId=${platform.id}`, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  // Copy caption
  const handleCopyCaption = (cnt: ContentWithRelations) => {
    const text = cnt.caption || cnt.title || '';
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCaptionId(cnt.id);
    setTimeout(() => setCopiedCaptionId(null), 2000);
  };

  // Filtered Content — never display archived or bin content
  const filteredContent = useMemo(() => {
    return contentList.filter((cnt) => {
      // NEVER show archived or deleted content outside of the Archived / Bin sections
      if (cnt.status === 'ARCHIVED' || cnt.deletedAt) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && cnt.status !== statusFilter) {
        return false;
      }
      // Search
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
  }, [contentList, statusFilter, searchQuery]);

  if (platformLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm font-medium text-[rgb(var(--text-muted))]">Loading platform workspace…</p>
      </div>
    );
  }

  if (platformError || !platform) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">Platform Not Found</h2>
        <p className="text-xs text-[rgb(var(--text-muted))]">{platformError || 'Could not find the requested platform.'}</p>
        <Link
          href="/platforms"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
        >
          <ArrowLeft size={14} /> Back to Platforms
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 min-h-full">
      {/* 1. Top Breadcrumbs / Back Navigation */}
      <div>
        <Link
          href="/platforms"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--text-muted))] hover:text-blue-500 transition-colors mb-2"
        >
          <ArrowLeft size={14} />
          <span>Back to Platforms</span>
        </Link>
      </div>

      {/* 2. Full-Width Platform Branded Hero Header */}
      <div className="card p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-[rgb(var(--border))] bg-gradient-to-r from-[rgb(var(--bg-subtle))] to-[rgb(var(--card-bg))] rounded-2xl shadow-xs">
        <div className="flex items-center gap-5 min-w-0">
          {/* Large, high-resolution platform logo */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] flex items-center justify-center p-3 shadow-sm shrink-0 overflow-hidden">
            <PlatformIcon
              icon={platform.icon}
              name={platform.name}
              size={72}
              className="max-h-full max-w-full object-contain drop-shadow-sm"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[rgb(var(--text-primary))] tracking-tight">
                {platform.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
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

            <p className="text-xs text-[rgb(var(--text-secondary))] mt-1.5 max-w-2xl leading-relaxed">
              {platform.description || 'Targeted content repository for ' + platform.name}
            </p>

            <div className="flex items-center gap-3 mt-3 text-xs text-[rgb(var(--text-muted))] font-mono flex-wrap">
              <span>@{platform.slug}</span>
              <span>•</span>
              <span>ID: {platform.id}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[rgb(var(--text-secondary))] font-sans font-medium">
                <Users size={13} /> {platform.accountCount} connected account{platform.accountCount === 1 ? '' : 's'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-500 font-sans font-semibold">
                <Layers size={13} /> {contentList.length} targeted piece{contentList.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* 3. Search & Status Filter Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between border-[rgb(var(--border))] rounded-2xl">
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

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-xs font-semibold text-[rgb(var(--text-secondary))] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Active ({filteredContent.length})</option>
            <option value="IDEA">Idea</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">Review</option>
            <option value="APPROVED">Approved</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PUBLISHED">Published</option>
          </select>

          <button
            type="button"
            onClick={fetchContent}
            disabled={contentLoading}
            className="p-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={contentLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 4. Targeted Content Grid */}
      {contentLoading && contentList.length === 0 ? (
        <div className="p-16 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <p className="text-sm font-medium text-[rgb(var(--text-muted))]">
            Loading {platform.name} content…
          </p>
        </div>
      ) : filteredContent.length === 0 ? (
        <div className="card p-12 text-center border-[rgb(var(--border))] rounded-2xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
            <Layers size={24} />
          </div>
          <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No matching content pieces'
              : `No content pieces currently targeting ${platform.name}`}
          </h3>
          <p className="text-xs text-[rgb(var(--text-muted))] max-w-md mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Try changing your search query or status filter.'
              : `When content is uploaded with ${platform.name} selected as a targeted platform, it will automatically appear on this webpage ready for download and media access.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filteredContent.map((cnt) => {
            const primaryAsset = cnt.assets?.[0];
            const isVideo = primaryAsset?.type === 'VIDEO' || primaryAsset?.mimeType?.startsWith('video/');
            const isImage = primaryAsset?.type === 'IMAGE' || primaryAsset?.mimeType?.startsWith('image/');
            const isAudio = primaryAsset?.type === 'AUDIO' || primaryAsset?.mimeType?.startsWith('audio/');
            const streamUrl = primaryAsset ? `/api/content/${cnt.id}/assets/${primaryAsset.id}/file` : null;
            const isArchived = cnt.status === 'ARCHIVED';

            return (
              <div
                key={cnt.id}
                className={`card flex flex-col justify-between rounded-2xl border transition-all overflow-hidden bg-[rgb(var(--card-bg))] hover:shadow-lg ${
                  isArchived
                    ? 'border-neutral-300/60 dark:border-neutral-800 opacity-80'
                    : 'border-[rgb(var(--border))] hover:border-blue-500/40'
                }`}
              >
                <div>
                  {/* Media Section: Live Video / Image / Audio */}
                  {streamUrl ? (
                    <div className="relative w-full h-52 bg-black/95 overflow-hidden flex items-center justify-center group/media">
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
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-neutral-900 to-black text-white gap-3">
                          <Music size={32} className="text-purple-400" />
                          <audio src={streamUrl} controls className="w-full max-w-[260px]" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))]">
                          <FileText size={36} />
                        </div>
                      )}

                      {/* Top Badges overlay */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
                        <ContentTypeBadge type={cnt.contentType} />
                        <StatusBadge status={cnt.status} />
                      </div>
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

                  {/* Card Body */}
                  <div className="p-5 space-y-3">
                    {/* Caption / Title */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[rgb(var(--text-primary))] line-clamp-3 leading-snug flex-1">
                        {cnt.caption || cnt.title || 'Untitled Post'}
                      </p>
                      {(cnt.caption || cnt.title) && (
                        <button
                          type="button"
                          onClick={() => handleCopyCaption(cnt)}
                          className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors shrink-0"
                          title="Copy caption"
                        >
                          {copiedCaptionId === cnt.id ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Media File Details */}
                    {primaryAsset && (
                      <div className="text-xs text-[rgb(var(--text-muted))] flex items-center gap-2 truncate p-2 rounded-lg bg-[rgb(var(--bg-subtle))]">
                        <Film size={13} className="text-blue-500 shrink-0" />
                        <span className="font-mono truncate">{primaryAsset.fileName}</span>
                        <span>•</span>
                        <span className="shrink-0 font-medium">{formatFileSize(primaryAsset.size)}</span>
                      </div>
                    )}

                    {/* Target Platforms Chips */}
                    {cnt.targetPlatforms && cnt.targetPlatforms.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
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

                {/* Footer Tools Bar: 1-Click Download (with Auto-Archive!) */}
                <div className="p-4 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {primaryAsset ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadAndArchive(cnt, primaryAsset)}
                        disabled={downloadingId === cnt.id}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                        title="Download media file and automatically archive this content"
                      >
                        {downloadingId === cnt.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Downloading…</span>
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            <span>Download Media</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-[rgb(var(--text-muted))]">
                        No media attached
                      </span>
                    )}

                    {justArchivedId === cnt.id && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30 text-xs font-semibold animate-in fade-in">
                        <Archive size={12} /> Auto-Archived
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-[rgb(var(--text-muted))] font-mono">
                    {new Date(cnt.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
