'use client';
// src/components/team/TeamDeleteModal.tsx
// Delete confirmation modal with last-owner protection warning.

import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import type { TeamMember } from '@/lib/types/domain';

interface TeamDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  member: TeamMember | null;
  isMutating: boolean;
  activeOwnerCount: number;
}

export function TeamDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  member,
  isMutating,
  activeOwnerCount,
}: TeamDeleteModalProps) {
  if (!isOpen || !member) return null;

  const isSoleOwner = member.role === 'OWNER' && activeOwnerCount <= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-400 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[rgb(var(--text-primary))]">
                Remove Team Member
              </h3>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Confirm account deletion
              </p>
            </div>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-xs space-y-1">
            <div className="font-semibold text-[rgb(var(--text-primary))]">
              {member.name}
            </div>
            <div className="text-[rgb(var(--text-muted))]">{member.email}</div>
            <div className="text-[rgb(var(--text-muted))] font-mono text-[11px]">
              ID: {member.id} • Role: {member.role}
            </div>
          </div>

          {isSoleOwner ? (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              ⚠️ <strong>Action Blocked:</strong> {member.name} is the last remaining active
              Agency OWNER. You cannot delete the sole owner without transferring ownership first.
            </div>
          ) : (
            <p className="mt-4 text-xs text-[rgb(var(--text-secondary))] leading-relaxed">
              Are you sure you want to remove this team member? Their active session access and
              permissions will be immediately revoked. This action is permanently logged to the audit trail.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgb(var(--border))] flex items-center justify-end gap-2.5 bg-[rgb(var(--bg-subtle))]/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isMutating}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-surface))] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isMutating || isSoleOwner}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm shadow-red-500/20"
          >
            {isMutating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Remove Member</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
