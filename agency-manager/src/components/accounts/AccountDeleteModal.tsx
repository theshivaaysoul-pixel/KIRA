'use client';
// src/components/accounts/AccountDeleteModal.tsx
// Dialog for safely archiving or permanently deleting a social account with relationship protection.

import React, { useState } from 'react';
import { AlertTriangle, Archive, Trash2, X, Loader2, ShieldAlert } from 'lucide-react';
import type { SocialAccountWithRelations } from '@/lib/types/domain';

interface AccountDeleteModalProps {
  account: SocialAccountWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmArchive: (id: string) => Promise<boolean>;
  onConfirmDelete: (id: string, forcePermanent: boolean) => Promise<boolean>;
}

export function AccountDeleteModal({
  account,
  isOpen,
  onClose,
  onConfirmArchive,
  onConfirmDelete,
}: AccountDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !account) return null;

  const totalReferences =
    account.publicationCount + account.analyticsCount + account.taskCount;
  const hasReferences = totalReferences > 0;

  const handleArchive = async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await onConfirmArchive(account.id);
      if (ok) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive account');
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await onConfirmDelete(account.id, true);
      if (ok) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] shadow-2xl overflow-hidden p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl ${
              hasReferences
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {hasReferences ? <ShieldAlert size={24} /> : <AlertTriangle size={24} />}
          </div>

          <div className="flex-1">
            <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">
              {hasReferences ? 'Account Has Historical Records' : 'Delete Social Account?'}
            </h3>
            <p className="mt-1 text-xs text-[rgb(var(--text-secondary))]">
              <span className="font-semibold text-[rgb(var(--text-primary))]">
                {account.accountName}
              </span>{' '}
              (@{account.username})
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {hasReferences ? (
          /* Referenced: Recommend Archive */
          <div className="mt-4 space-y-3">
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-[rgb(var(--text-secondary))] space-y-2">
              <div className="font-semibold text-amber-700 dark:text-amber-400">
                Cannot permanently delete: Account in active use
              </div>
              <p>
                This account is referenced by{' '}
                <span className="font-bold text-[rgb(var(--text-primary))]">
                  {account.publicationCount} publications
                </span>
                ,{' '}
                <span className="font-bold text-[rgb(var(--text-primary))]">
                  {account.analyticsCount} analytics records
                </span>
                , and{' '}
                <span className="font-bold text-[rgb(var(--text-primary))]">
                  {account.taskCount} tasks
                </span>
                .
              </p>
              <p>
                To preserve historical reporting and audit logs, please{' '}
                <span className="font-semibold">archive</span> the account instead.
              </p>
            </div>

            <div className="pt-3 border-t border-[rgb(var(--border))] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleArchive}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60 shadow-sm"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                <span>Archive Account Instead</span>
              </button>
            </div>
          </div>
        ) : (
          /* Unreferenced: Permanent Delete Allowed */
          <div className="mt-4 space-y-4">
            <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed">
              This account has no associated publications, analytics records, or tasks. Permanent
              deletion is permitted and will remove this account record from Google Cloud Storage.
            </p>

            <div className="pt-3 border-t border-[rgb(var(--border))] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handlePermanentDelete}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors disabled:opacity-60 shadow-sm"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
