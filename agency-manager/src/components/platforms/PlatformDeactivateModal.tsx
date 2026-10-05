'use client';
// src/components/platforms/PlatformDeactivateModal.tsx
// Confirmation popup modal for deactivating a platform with Confirm and Cancel buttons.

import React, { useState, useEffect } from 'react';
import { Power, X, Loader2, AlertCircle } from 'lucide-react';
import type { PlatformWithStats } from '@/lib/types/domain';

interface PlatformDeactivateModalProps {
  platform: PlatformWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function PlatformDeactivateModal({
  platform,
  isOpen,
  onClose,
  onConfirm,
}: PlatformDeactivateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !platform) return null;

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirm(platform.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[rgb(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0 flex items-center justify-center">
              <Power size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[rgb(var(--text-primary))]">
                Deactivate Platform
              </h2>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                {platform.name} <span className="font-mono">(@{platform.slug})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
            Are you sure you want to deactivate{' '}
            <strong className="font-bold text-[rgb(var(--text-primary))]">
              {platform.name}
            </strong>
            ?
          </p>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 text-amber-500 mt-0.5" />
            <div className="space-y-1">
              <p className="leading-relaxed">
                Deactivating this platform will disable new account connections and pause daily deliverables.
                All existing connected accounts, posts, and historical metrics will remain safe and preserved.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions: Cancel and Confirm */}
        <div className="p-4 sm:p-5 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Power size={15} />
            )}
            <span>{isSubmitting ? 'Confirming…' : 'Confirm'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
