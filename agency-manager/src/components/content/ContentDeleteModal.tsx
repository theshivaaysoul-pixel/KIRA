'use client';
// src/components/content/ContentDeleteModal.tsx
// Relationship-aware delete/archive confirmation modal.

import { useState, useId } from 'react';
import { X, AlertTriangle, Archive, Trash2, Loader2 } from 'lucide-react';
import type { ContentWithRelations } from '@/lib/types/domain';

interface ContentDeleteModalProps {
  open: boolean;
  content: ContentWithRelations | null;
  onClose: () => void;
  onConfirm: (forcePermanent: boolean) => Promise<void>;
}

export function ContentDeleteModal({ open, content, onClose, onConfirm }: ContentDeleteModalProps) {
  const uid = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !content) return null;

  const isInBin = Boolean(content.deletedAt);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      // If already in Bin, force permanent deletion; otherwise soft-delete to Bin
      await onConfirm(isInBin);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl border border-[rgb(var(--border))] bg-white dark:bg-[#18181b] shadow-2xl z-10 opacity-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--border))] bg-white dark:bg-[#18181b]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className={isInBin ? "text-red-500 shrink-0" : "text-amber-400 shrink-0"} aria-hidden />
            <h2 id={`${uid}-title`} className="text-base font-semibold text-[rgb(var(--foreground))]">
              {isInBin ? 'Permanently Delete Content' : 'Move Content to Bin'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[rgb(var(--muted))] text-[rgb(var(--muted-foreground))] transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[rgb(var(--foreground))]">
            You are about to {isInBin ? 'permanently delete' : 'delete'} <strong>&ldquo;{content.title}&rdquo;</strong>.
          </p>

          {isInBin ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25">
              <p className="text-sm text-red-400 font-medium">
                This will permanently delete this piece of content and all of its associated media files from everywhere.
              </p>
              <p className="text-xs text-red-400/80 mt-1.5">
                This action cannot be undone and the content cannot be recovered.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
              <p className="text-sm font-semibold text-amber-500">
                This content will be moved to the Bin:
              </p>
              <ul className="text-xs text-[rgb(var(--muted-foreground))] space-y-1 list-disc list-inside">
                <li>Stored safely in the <strong>Bin</strong> for <strong>30 days</strong>.</li>
                <li>You can restore it back to where it was deleted anytime during these 30 days.</li>
                <li>After 30 days, it will be automatically permanently deleted from everywhere.</li>
              </ul>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-xl p-3" role="alert">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgb(var(--border))]">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isInBin
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
            <Trash2 size={14} />
            <span>{isInBin ? 'Permanently Delete' : 'Move to Bin'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
