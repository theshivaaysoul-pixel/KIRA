'use client';
// src/components/platforms/PlatformDeleteModal.tsx
// Modal for safe deletion with strict relationship protection.
// Blocks deletion and offers deactivation if connected accounts exist.

import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertOctagon, ShieldAlert, Power, Trash2, X, Loader2 } from 'lucide-react';
import type { PlatformWithStats } from '@/lib/types/domain';

interface PlatformDeleteModalProps {
  platform: PlatformWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (id: string) => Promise<void>;
  onConfirmDeactivate: (id: string) => Promise<void>;
  isMutating?: boolean;
}

export function PlatformDeleteModal({
  platform,
  isOpen,
  onClose,
  onConfirmDelete,
  onConfirmDeactivate,
}: PlatformDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

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

  const isInBin = Boolean(platform.deletedAt);
  const hasConnectedAccounts = platform.accountCount > 0;

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await onConfirmDelete(platform.id);
      onClose();
    } catch {
      // error handled in parent page toast
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeactivating) return;

    setIsDeactivating(true);
    try {
      await onConfirmDeactivate(platform.id);
      onClose();
    } catch {
      // error handled in parent page toast
    } finally {
      setIsDeactivating(false);
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
        className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col transition-all overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[rgb(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center ${
                isInBin && !hasConnectedAccounts
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}
            >
              {isInBin ? <AlertOctagon size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[rgb(var(--text-primary))]">
                {isInBin
                  ? hasConnectedAccounts
                    ? 'Platform In Use'
                    : 'Permanently Delete Platform'
                  : 'Move Platform to Bin'}
              </h2>
              <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-0.5">
                {platform.name} <span className="font-mono">(@{platform.slug})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {isInBin ? (
            hasConnectedAccounts ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
                  <ShieldAlert size={20} className="shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-semibold">
                      Destructive Deletion Blocked
                    </strong>
                    <p className="leading-relaxed">
                      This platform cannot be permanently deleted because{' '}
                      <strong className="font-bold underline">
                        {platform.accountCount} social account{platform.accountCount === 1 ? '' : 's'}
                      </strong>{' '}
                      are currently linked to it. Permanently deleting it would orphan account records,
                      scheduled publications, and activity logs.
                    </p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                  To permanently delete this platform, please disconnect or reassign its social accounts first.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <strong className="font-bold text-[rgb(var(--text-primary))]">
                    {platform.name}
                  </strong>
                  ?
                </p>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-xs sm:text-sm text-red-500 dark:text-red-400 leading-relaxed">
                  This will permanently remove this platform record from the database. This action cannot be undone and cannot be recovered.
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <p className="text-sm sm:text-base text-[rgb(var(--text-secondary))] leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="font-bold text-[rgb(var(--text-primary))]">
                  {platform.name}
                </strong>
                ?
              </p>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                <p className="text-sm font-semibold text-amber-500">
                  This platform will be moved to the Bin:
                </p>
                <ul className="text-xs text-[rgb(var(--text-secondary))] space-y-1 list-disc list-inside leading-relaxed">
                  <li>Stored safely in the <strong>Bin</strong> for <strong>30 days</strong>.</li>
                  <li>You can restore it back anytime during these 30 days.</li>
                  <li>After 30 days, it will be automatically permanently deleted.</li>
                  {hasConnectedAccounts && (
                    <li>Existing {platform.accountCount} connected accounts and historical posts remain preserved while in the Bin.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions: Cancel and Confirm */}
        <div className="p-5 sm:p-6 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] rounded-b-2xl flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isDeleting || isDeactivating}
            className="px-5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-xs sm:text-sm font-semibold text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>

          {isInBin && hasConnectedAccounts ? (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isDeactivating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Power size={16} />
              )}
              <span>{isDeactivating ? 'Confirming…' : 'Confirm'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className={`px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95 ${
                isInBin
                  ? 'bg-red-600 hover:bg-red-500 active:bg-red-700'
                  : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
              }`}
            >
              {isDeleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              <span>{isDeleting ? 'Confirming…' : 'Confirm'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
