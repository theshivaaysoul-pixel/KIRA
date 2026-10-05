'use client';
// src/components/content/MediaManager.tsx
// Comprehensive Media Manager component for KIRA Agency Manager (Phase 8).
// Features real GCS upload, drag-and-drop, client-side validation, media playback/preview,
// metadata display, and safe deletion confirmation.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { ContentAsset } from '@/lib/types/domain';
import { useMediaAssets } from '@/hooks/useMediaAssets';
import { useAuth } from '@/contexts/AuthContext';

interface MediaManagerProps {
  contentId: string;
  isArchived?: boolean;
  canManage?: boolean;
  onAssetsChange?: (count: number) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'application/pdf',
].join(',');

export function MediaManager({ contentId, isArchived = false, canManage = true, onAssetsChange }: MediaManagerProps) {
  const { getIdToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const { assets, loading, uploading, error, uploadAsset, deleteAsset } = useMediaAssets(contentId);
  const [dragActive, setDragActive] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentAsset | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getIdToken().then((t) => {
      if (t) setToken(t);
    });
  }, [getIdToken]);

  useEffect(() => {
    onAssetsChange?.(assets.length);
  }, [assets.length, onAssetsChange]);

  const validateAndUpload = useCallback(
    async (file: File) => {
      setClientError(null);

      // Client-side quick validation
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setClientError(`Unsupported file format (${file.type || 'unknown'}). Supported: JPG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, WAV, OGG, PDF.`);
        return;
      }

      // 50MB universal ceiling
      if (file.size > 50 * 1024 * 1024) {
        setClientError(`File size (${formatBytes(file.size)}) exceeds the maximum allowed upload limit of 50MB.`);
        return;
      }

      try {
        await uploadAsset(file);
      } catch {
        // Error is set inside useMediaAssets
      }
    },
    [uploadAsset]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndUpload(files[0]);
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
    if (isArchived || !canManage) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteAsset(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error handled in hook
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[rgb(var(--foreground))]">
          Media Assets <span className="text-[rgb(var(--muted-foreground))] font-normal">({assets.length})</span>
        </h3>
        {loading && <Loader2 size={14} className="animate-spin text-[rgb(var(--muted-foreground))]" />}
      </div>

      {/* Error alert */}
      {(error || clientError) && (
        <div className="flex items-start gap-2 p-3 text-xs rounded-xl bg-red-500/10 border border-red-500/20 text-red-400" role="alert">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{clientError || error}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      {!isArchived && canManage && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 text-center ${
            dragActive
              ? 'border-purple-500 bg-purple-500/10 scale-[0.99]'
              : 'border-[rgb(var(--border))] hover:border-purple-500/50 hover:bg-[rgb(var(--muted))]/40'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            className="hidden"
            id={`media-upload-${contentId}`}
            disabled={uploading || isArchived}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 size={24} className="animate-spin text-purple-400" />
              <p className="text-xs font-medium text-[rgb(var(--foreground))]">
                Uploading to Google Cloud Storage & verifying integrity...
              </p>
              <p className="text-[11px] text-[rgb(var(--muted-foreground))]">
                Validating checksum and registering metadata catalog
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="p-3 rounded-full bg-purple-500/10 text-purple-400">
                <UploadCloud size={24} />
              </div>
              <p className="text-xs font-medium text-[rgb(var(--foreground))]">
                Click or drag & drop media here to upload
              </p>
              <p className="text-[11px] text-[rgb(var(--muted-foreground))]">
                Images (up to 10MB), Videos (up to 50MB), Audio (up to 25MB), PDF (up to 20MB)
              </p>
            </div>
          )}
        </div>
      )}

      {isArchived && (
        <div className="p-3 rounded-xl bg-[rgb(var(--muted))] text-xs text-[rgb(var(--muted-foreground))] text-center">
          This content is archived. New media uploads are disabled.
        </div>
      )}

      {/* Asset Grid */}
      {assets.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-6 text-center text-[rgb(var(--muted-foreground))] border border-[rgb(var(--border))] rounded-2xl bg-[rgb(var(--muted))]/20">
          <FileText size={28} className="opacity-40 mb-2" />
          <p className="text-xs">No media assets attached yet.</p>
        </div>
      )}

      {assets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assets.map((asset) => {
            const streamUrl = `/api/content/${contentId}/assets/${asset.id}/file${
              token ? `?token=${encodeURIComponent(token)}` : ''
            }`;
            const isDeleting = deletingId === asset.id;

            return (
              <div
                key={asset.id}
                className="group relative flex flex-col rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] overflow-hidden transition-all hover:border-[rgb(var(--border))]/80 hover:shadow-sm"
              >
                {/* Media Preview Box */}
                <div className="relative aspect-video w-full bg-neutral-900/60 flex items-center justify-center overflow-hidden">
                  {asset.type === 'IMAGE' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={streamUrl}
                      alt={asset.fileName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}

                  {asset.type === 'VIDEO' && (
                    <video
                      src={streamUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  )}

                  {asset.type === 'AUDIO' && (
                    <div className="flex flex-col items-center justify-center gap-2 p-3 w-full">
                      <Music size={28} className="text-purple-400" />
                      <audio src={streamUrl} controls className="w-full max-w-[200px] h-8" />
                    </div>
                  )}

                  {asset.type === 'DOCUMENT' && (
                    <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-[rgb(var(--muted-foreground))]">
                      <FileText size={32} className="text-amber-400" />
                      <span className="text-[11px] font-mono uppercase font-semibold">PDF Document</span>
                      <a
                        href={streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-xs text-purple-400 hover:underline"
                      >
                        Open <ExternalLink size={11} />
                      </a>
                    </div>
                  )}

                  {asset.type === 'OTHER' && (
                    <div className="flex flex-col items-center justify-center gap-1 text-[rgb(var(--muted-foreground))]">
                      <FileText size={28} />
                      <span className="text-xs">Binary Asset</span>
                    </div>
                  )}

                  {/* Asset Type Chip */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase bg-black/60 backdrop-blur-md text-white">
                    {asset.type}
                  </span>
                </div>

                {/* Metadata & Actions Footer */}
                <div className="p-3 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[rgb(var(--foreground))] truncate" title={asset.fileName}>
                      {asset.fileName}
                    </p>
                    <p className="text-[11px] text-[rgb(var(--muted-foreground))] mt-0.5">
                      {formatBytes(asset.size)} • {new Date(asset.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`${streamUrl}?download=true`}
                      download={asset.fileName}
                      className="p-1.5 rounded-lg text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
                      title="Download original file"
                    >
                      <ExternalLink size={14} />
                    </a>

                    {canManage && !isArchived && (
                      <button
                        onClick={() => setDeleteTarget(asset)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete asset"
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-[rgb(var(--border))] bg-white dark:bg-[#18181b] p-5 shadow-2xl space-y-4 z-10 opacity-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-red-500/10 text-red-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[rgb(var(--foreground))]">Delete Media Asset</h4>
                <p className="text-xs text-[rgb(var(--muted-foreground))]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-[rgb(var(--muted-foreground))] bg-[rgb(var(--muted))] p-3 rounded-xl break-all">
              Are you sure you want to permanently delete <strong className="text-[rgb(var(--foreground))]">{deleteTarget.fileName}</strong> from Google Cloud Storage and remove its catalog entry?
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId !== null}
                className="px-3.5 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingId !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {deletingId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
