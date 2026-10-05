'use client';
// src/components/content/ContentFormModal.tsx
// Create and Edit content modal with media upload, multi-platform selector,
// quick platform creator, and caption input.
// (Title, description, and hashtags removed per user request; title is auto-derived for data integrity).

import { useState, useEffect, useId, useRef } from 'react';
import {
  X, Plus, Loader2, UploadCloud, Film, Image as ImageIcon,
  Music, FileText, Check, Sparkles, Layers,
} from 'lucide-react';
import type { ContentWithRelations, ContentType } from '@/lib/types/domain';
import { TYPE_CONFIG } from './ContentBadges';
import { usePlatforms } from '@/hooks/usePlatforms';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';

interface ContentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    contentType: ContentType;
    caption?: string;
    hashtags?: string[];
    targetPlatformIds?: string[];
    mediaFile?: File;
  }) => Promise<void>;
  initialData?: Partial<ContentWithRelations> | null;
  title?: string;
}

const CONTENT_TYPES: ContentType[] = [
  'POST', 'REEL', 'SHORT', 'VIDEO', 'IMAGE', 'CAROUSEL', 'STORY', 'TEXT', 'LIVE', 'OTHER',
];

const POPULAR_SUGGESTIONS = [
  { name: 'Instagram', icon: '/logos/Instagram.png' },
  { name: 'TikTok', icon: '/logos/Tiktok.png' },
  { name: 'YouTube', icon: '/logos/Youtube.png' },
  { name: 'X', icon: '/logos/X.png' },
  { name: 'Facebook', icon: '/logos/Facebook.png' },
  { name: 'Threads', icon: '/logos/Threads.png' },
  { name: 'Kick', icon: '/logos/KICK.png' },
  { name: 'Snapchat', icon: '/logos/Snapchat.png' },
];

const ACCEPTED_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
  'application/pdf',
].join(',');

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ContentFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  title = 'Create Content',
}: ContentFormModalProps) {
  const uid = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Platforms hook
  const { platforms, loading: platformsLoading, createPlatform, seedPlatforms } = usePlatforms();

  const [contentType, setContentType] = useState<ContentType>('POST');
  const [caption, setCaption] = useState('');
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Inline Quick Add Platform state
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [seedingPlatforms, setSeedingPlatforms] = useState(false);
  const [platformActionError, setPlatformActionError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset/sync state when modal opens or initialData changes
  useEffect(() => {
    if (open) {
      setContentType(initialData?.contentType ?? 'POST');
      setCaption(initialData?.caption ?? '');
      setSelectedPlatformIds(initialData?.targetPlatformIds ?? []);
      setMediaFile(null);
      setMediaPreviewUrl(null);
      setMediaError(null);
      setShowAddPlatform(false);
      setNewPlatformName('');
      setPlatformActionError(null);
      setError(null);
      setFieldErrors({});
    }
  }, [open, initialData]);

  // Clean up object URL when media preview changes or component unmounts
  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
    };
  }, [mediaPreviewUrl]);

  if (!open) return null;

  // Handle media selection
  const handleFileSelect = (file: File) => {
    setMediaError(null);

    // Max 50MB
    if (file.size > 50 * 1024 * 1024) {
      setMediaError(`File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of 50MB.`);
      return;
    }

    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }

    const preview = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaPreviewUrl(preview);

    // Smart auto-suggestion for content type
    if (contentType === 'POST') {
      if (file.type.startsWith('video/')) {
        setContentType('VIDEO');
      } else if (file.type.startsWith('image/')) {
        setContentType('IMAGE');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const removeMedia = () => {
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setMediaError(null);
  };

  // Toggle platform selection (allows selecting multiple platforms)
  const togglePlatform = (id: string) => {
    setSelectedPlatformIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // Select all or deselect all platforms
  const handleSelectAllPlatforms = () => {
    if (selectedPlatformIds.length === platforms.length) {
      setSelectedPlatformIds([]);
    } else {
      setSelectedPlatformIds(platforms.map((p) => p.id));
    }
  };

  // Inline Quick Add Platform by custom name
  const handleQuickAddPlatform = async (customName?: string, customIcon?: string) => {
    const nameToUse = (customName || newPlatformName).trim();
    if (!nameToUse) {
      setPlatformActionError('Platform name is required.');
      return;
    }
    setPlatformActionError(null);
    setAddingPlatform(true);
    try {
      const cleanBase = nameToUse
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const slug = cleanBase || `platform-${nameToUse.length}-${platforms.length}`;

      const created = await createPlatform({
        name: nameToUse,
        slug,
        icon: customIcon || 'globe',
        description: `${nameToUse} platform channel`,
        isActive: true,
        capabilities: ['text', 'image', 'video', 'publishing', 'scheduling'],
      });

      // Auto-select the newly created platform
      if (created?.id) {
        setSelectedPlatformIds((prev) =>
          prev.includes(created.id) ? prev : [...prev, created.id]
        );
      }

      setNewPlatformName('');
      if (!customName) {
        setShowAddPlatform(false);
      }
    } catch (err: unknown) {
      setPlatformActionError(err instanceof Error ? err.message : 'Failed to create platform.');
    } finally {
      setAddingPlatform(false);
    }
  };

  // Quick Seed Standard Platforms
  const handleSeedPlatforms = async () => {
    setPlatformActionError(null);
    setSeedingPlatforms(true);
    try {
      const result = await seedPlatforms();
      if (result.platforms && result.platforms.length > 0) {
        setSelectedPlatformIds((prev) => {
          const newIds = result.platforms.map((p) => p.id);
          return Array.from(new Set([...prev, ...newIds]));
        });
      }
    } catch (err: unknown) {
      setPlatformActionError(err instanceof Error ? err.message : 'Failed to seed platforms.');
    } finally {
      setSeedingPlatforms(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (caption.length > 5000) errs.caption = 'Caption must be at most 5000 characters.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    setSubmitting(true);
    setError(null);
    try {
      // Cleanly derive title from existing title or caption or media filename or type
      const resolvedTitle =
        initialData?.title ||
        caption.trim().split('\n')[0].slice(0, 60) ||
        mediaFile?.name?.replace(/\.[^/.]+$/, '') ||
        `${contentType} - ${new Date().toLocaleDateString()}`;

      await onSubmit({
        title: resolvedTitle,
        contentType,
        caption: caption.trim() || undefined,
        targetPlatformIds: selectedPlatformIds,
        mediaFile: mediaFile || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute suggestions not yet created
  const existingNamesLower = new Set(platforms.map((p) => p.name.toLowerCase()));
  const unaddedSuggestions = POPULAR_SUGGESTIONS.filter(
    (s) => !existingNamesLower.has(s.name.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl border border-[rgb(var(--border))] bg-white dark:bg-[#18181b] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 opacity-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--border))] shrink-0 bg-white dark:bg-[#18181b]">
          <div className="flex items-center gap-2">
            <h2 id={`${uid}-title`} className="text-lg font-bold text-[rgb(var(--foreground))]">{title}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
              {contentType}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6 bg-white dark:bg-[#18181b]">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm" role="alert">
              {error}
            </div>
          )}

          {/* 1. MEDIA UPLOAD SECTION (Drag & Drop + Live Playback Preview) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[rgb(var(--foreground))] flex items-center gap-1.5">
                <UploadCloud size={16} className="text-blue-400" />
                Upload Media Content
                <span className="text-xs font-normal text-[rgb(var(--muted-foreground))]">(optional)</span>
              </label>
              {mediaFile && (
                <button
                  type="button"
                  onClick={removeMedia}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <X size={12} /> Remove media
                </button>
              )}
            </div>

            {mediaError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2" role="alert">
                {mediaError}
              </p>
            )}

            {!mediaFile ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 text-center ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
                    : 'border-[rgb(var(--border))] hover:border-blue-500/50 hover:bg-[rgb(var(--muted))]/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MEDIA_TYPES}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 mb-2">
                  <UploadCloud size={24} />
                </div>
                <p className="text-sm font-medium text-[rgb(var(--foreground))]">
                  Click or drag & drop video, image, or audio here
                </p>
                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                  MP4, WebM, MOV, JPG, PNG, GIF, MP3, WAV (up to 50MB)
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[rgb(var(--foreground))] truncate max-w-[280px]">
                    {mediaFile.name}
                  </span>
                  <span className="text-[rgb(var(--muted-foreground))] shrink-0 font-mono">
                    {formatFileSize(mediaFile.size)}
                  </span>
                </div>

                {/* Media visual preview */}
                <div className="relative rounded-xl overflow-hidden bg-black/60 flex items-center justify-center">
                  {mediaFile.type.startsWith('video/') && mediaPreviewUrl && (
                    <video
                      src={mediaPreviewUrl}
                      controls
                      playsInline
                      className="max-h-52 w-full object-contain rounded-xl"
                    />
                  )}

                  {mediaFile.type.startsWith('image/') && mediaPreviewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaPreviewUrl}
                      alt="Preview"
                      className="max-h-52 w-full object-contain rounded-xl"
                    />
                  )}

                  {mediaFile.type.startsWith('audio/') && mediaPreviewUrl && (
                    <div className="p-4 w-full flex flex-col items-center gap-2">
                      <Music size={28} className="text-purple-400" />
                      <audio src={mediaPreviewUrl} controls className="w-full" />
                    </div>
                  )}

                  {!mediaFile.type.startsWith('video/') &&
                   !mediaFile.type.startsWith('image/') &&
                   !mediaFile.type.startsWith('audio/') && (
                    <div className="p-6 flex flex-col items-center gap-2 text-[rgb(var(--muted-foreground))]">
                      <FileText size={32} />
                      <span className="text-xs">{mediaFile.type || 'Document'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. TARGET PLATFORMS SECTION (Multi-select, clean platform names, and quick add) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-[rgb(var(--foreground))] flex items-center gap-1.5">
                  <Layers size={16} className="text-purple-400" />
                  Target Platforms
                  <span className="text-xs font-normal text-[rgb(var(--muted-foreground))]">
                    ({selectedPlatformIds.length} selected)
                  </span>
                </label>
                {platforms.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSelectAllPlatforms}
                    className="text-[11px] text-blue-400 hover:underline transition-colors ml-1"
                  >
                    {selectedPlatformIds.length === platforms.length ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAddPlatform((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <Plus size={13} />
                Add Platform
              </button>
            </div>

            {platformActionError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2" role="alert">
                {platformActionError}
              </p>
            )}

            {/* Inline Quick Add Platform Box */}
            {showAddPlatform && (
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 transition-all animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                    <Plus size={13} /> Add New Platform
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddPlatform(false)}
                    className="text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Popular one-click platform additions */}
                {unaddedSuggestions.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[rgb(var(--muted-foreground))] block mb-1.5">
                      Quick add popular platforms:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {unaddedSuggestions.map((sug) => (
                        <button
                          key={sug.name}
                          type="button"
                          disabled={addingPlatform}
                          onClick={() => handleQuickAddPlatform(sug.name, sug.icon)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <PlatformIcon icon={sug.icon} name={sug.name} size={14} className="shrink-0" />
                          <span>{sug.name}</span>
                          <Plus size={11} className="opacity-70" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-medium text-[rgb(var(--foreground))]">
                    Custom Platform Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPlatformName}
                      onChange={(e) => setNewPlatformName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddPlatform();
                        }
                      }}
                      placeholder="e.g. YouTube, TikTok, Threads..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] dark:bg-[#27272a] text-[rgb(var(--foreground))] text-xs placeholder:text-[rgb(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuickAddPlatform()}
                      disabled={addingPlatform || !newPlatformName.trim()}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors shrink-0"
                    >
                      {addingPlatform && <Loader2 size={11} className="animate-spin" />}
                      Add & Select
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Platform Selection Chips (Render official logo image alongside clean platform name) */}
            {platformsLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-[rgb(var(--muted-foreground))]">
                <Loader2 size={13} className="animate-spin" /> Loading platforms…
              </div>
            ) : platforms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[rgb(var(--border))] p-4 flex flex-col items-center justify-center gap-2 text-center">
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  No platforms currently configured.
                </p>
                <button
                  type="button"
                  onClick={handleSeedPlatforms}
                  disabled={seedingPlatforms}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 text-xs font-medium transition-colors"
                >
                  {seedingPlatforms ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  ⚡ Seed Standard Platforms (Instagram, TikTok, X, YouTube, Facebook, Threads, Kick, Snapchat)
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {platforms.map((plt) => {
                  const isSelected = selectedPlatformIds.includes(plt.id);
                  return (
                    <button
                      key={plt.id}
                      type="button"
                      onClick={() => togglePlatform(plt.id)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/15 text-blue-400 shadow-sm font-semibold'
                          : 'border-[rgb(var(--border))] bg-[rgb(var(--muted))]/40 text-[rgb(var(--foreground))] hover:border-[rgb(var(--border-hover,var(--border)))]'
                      }`}
                    >
                      <PlatformIcon icon={plt.icon} name={plt.name} size={16} className="shrink-0" />
                      <span>{plt.name}</span>
                      {isSelected && <Check size={13} className="text-blue-400 ml-0.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. CONTENT TYPE */}
          <div>
            <label htmlFor={`${uid}-type`} className="block text-sm font-semibold text-[rgb(var(--foreground))] mb-1.5">
              Content Type
            </label>
            <select
              id={`${uid}-type`}
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] dark:bg-[#27272a] text-[rgb(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. CAPTION */}
          <div>
            <label htmlFor={`${uid}-caption`} className="block text-sm font-semibold text-[rgb(var(--foreground))] mb-1.5">
              Caption <span className="text-[rgb(var(--muted-foreground))] font-normal text-xs">(platform post text)</span>
            </label>
            <textarea
              id={`${uid}-caption`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] dark:bg-[#27272a] text-[rgb(var(--foreground))] text-sm placeholder:text-[rgb(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
              placeholder="Write your post caption here..."
              rows={4}
              maxLength={5000}
              aria-describedby={fieldErrors.caption ? `${uid}-caption-err` : undefined}
              aria-invalid={!!fieldErrors.caption}
            />
            <div className="flex justify-between mt-1">
              {fieldErrors.caption
                ? <p id={`${uid}-caption-err`} className="text-xs text-red-400" role="alert">{fieldErrors.caption}</p>
                : <span />}
              <span className="text-xs text-[rgb(var(--muted-foreground))]">{caption.length}/5000</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgb(var(--border))] shrink-0 bg-white dark:bg-[#18181b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
          >
            {submitting && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {submitting ? 'Saving…' : initialData ? 'Save Changes' : 'Create Content'}
          </button>
        </div>
      </div>
    </div>
  );
}
