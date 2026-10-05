'use client';
// src/components/accounts/AccountDetailsModal.tsx
// Detailed modal drawer showing full account metadata, platform relation, assigned manager, and live relationship counts.

import React from 'react';
import {
  X,
  ExternalLink,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  FileText,
  BarChart2,
  CheckSquare,
  Calendar,
  Hash,
  Tag,
  User,
} from 'lucide-react';
import type { SocialAccountWithRelations, SocialAccountStatus } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';

interface AccountDetailsModalProps {
  account: SocialAccountWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (account: SocialAccountWithRelations) => void;
  onArchive?: (account: SocialAccountWithRelations) => void;
  onReactivate?: (account: SocialAccountWithRelations) => void;
  onDelete?: (account: SocialAccountWithRelations) => void;
  canUpdate: boolean;
  canDelete: boolean;
}

const STATUS_CONFIG: Record<
  SocialAccountStatus,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  ACTIVE: {
    label: 'Active Account',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/20',
  },
  INACTIVE: {
    label: 'Inactive Account',
    bg: 'bg-neutral-500/10 dark:bg-neutral-500/20',
    text: 'text-neutral-600 dark:text-neutral-400',
    dot: 'bg-neutral-400',
    border: 'border-neutral-500/20',
  },
  ARCHIVED: {
    label: 'Archived Account',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
    border: 'border-purple-500/20',
  },
  CONNECTION_ERROR: {
    label: 'Connection Error',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
    border: 'border-rose-500/20',
  },
};

export function AccountDetailsModal({
  account,
  isOpen,
  onClose,
  onEdit,
  onArchive,
  onReactivate,
  onDelete,
  canUpdate,
  canDelete,
}: AccountDetailsModalProps) {
  if (!isOpen || !account) return null;

  const statusCfg = STATUS_CONFIG[account.status] || STATUS_CONFIG.INACTIVE;
  const platformName = account.platform?.name || 'Social Platform';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[rgb(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar
                src={account.avatarUrl}
                name={account.accountName}
                size="lg"
                className="ring-2 ring-[rgb(var(--border))]"
              />
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] shadow-xs">
                <PlatformIcon
                  icon={account.platform?.icon}
                  platformName={platformName}
                  size={12}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[rgb(var(--text-primary))]">
                  {account.accountName}
                </h2>
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                  <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
                  <span>{statusCfg.label}</span>
                </div>
              </div>
              <p className="text-xs text-[rgb(var(--text-secondary))]">
                @{account.username} • {platformName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Real Relationships Stats Grid */}
          <div>
            <h4 className="text-xs font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wider mb-2.5">
              Associated Content & Activity
            </h4>
            <div className="grid grid-cols-3 gap-4 sm:gap-5">
              <div className="p-3.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="text-base font-bold text-[rgb(var(--text-primary))]">
                    {account.publicationCount}
                  </div>
                  <div className="text-[11px] text-[rgb(var(--text-muted))]">Publications</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <BarChart2 size={18} />
                </div>
                <div>
                  <div className="text-base font-bold text-[rgb(var(--text-primary))]">
                    {account.analyticsCount}
                  </div>
                  <div className="text-[11px] text-[rgb(var(--text-muted))]">Analytics</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <div className="text-base font-bold text-[rgb(var(--text-primary))]">
                    {account.taskCount}
                  </div>
                  <div className="text-[11px] text-[rgb(var(--text-muted))]">Tasks</div>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Bio */}
          {account.description && (
            <div>
              <h4 className="text-xs font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wider mb-1.5">
                Description / Internal Notes
              </h4>
              <p className="text-xs text-[rgb(var(--text-primary))] leading-relaxed p-3.5 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]">
                {account.description}
              </p>
            </div>
          )}

          {/* Details & Attributes */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-[rgb(var(--text-secondary))] uppercase tracking-wider mb-1">
              Account Attributes
            </h4>

            {account.niche && (
              <div className="flex items-center justify-between text-xs py-2 border-b border-[rgb(var(--border))]">
                <span className="text-[rgb(var(--text-secondary))] flex items-center gap-1.5">
                  <Tag size={13} className="text-[rgb(var(--text-muted))]" />
                  Niche
                </span>
                <span className="font-medium text-[rgb(var(--text-primary))]">
                  {account.niche}
                </span>
              </div>
            )}

            {account.profileUrl && (
              <div className="flex items-center justify-between text-xs py-2 border-b border-[rgb(var(--border))]">
                <span className="text-[rgb(var(--text-secondary))] flex items-center gap-1.5">
                  <ExternalLink size={13} className="text-[rgb(var(--text-muted))]" />
                  Profile Link
                </span>
                <a
                  href={account.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[rgb(var(--primary))] hover:underline flex items-center gap-1 max-w-[280px] truncate"
                >
                  <span>{account.profileUrl}</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}

            {account.externalAccountId && (
              <div className="flex items-center justify-between text-xs py-2 border-b border-[rgb(var(--border))]">
                <span className="text-[rgb(var(--text-secondary))] flex items-center gap-1.5">
                  <Hash size={13} className="text-[rgb(var(--text-muted))]" />
                  External ID
                </span>
                <span className="font-mono text-xs text-[rgb(var(--text-primary))]">
                  {account.externalAccountId}
                </span>
              </div>
            )}

            {/* Assigned Manager */}
            <div className="flex items-center justify-between text-xs py-2 border-b border-[rgb(var(--border))]">
              <span className="text-[rgb(var(--text-secondary))] flex items-center gap-1.5">
                <User size={13} className="text-[rgb(var(--text-muted))]" />
                Assigned Manager
              </span>
              {account.assignedManager ? (
                <div className="flex items-center gap-2">
                  <Avatar
                    src={account.assignedManager.avatarUrl}
                    name={account.assignedManager.name}
                    size="xs"
                  />
                  <span className="font-medium text-[rgb(var(--text-primary))]">
                    {account.assignedManager.name} ({account.assignedManager.role})
                  </span>
                </div>
              ) : (
                <span className="text-[rgb(var(--text-muted))] italic">Unassigned</span>
              )}
            </div>

            {/* Identifiers and Timestamps */}
            <div className="flex items-center justify-between text-xs py-2 border-b border-[rgb(var(--border))]">
              <span className="text-[rgb(var(--text-secondary))] flex items-center gap-1.5">
                <Hash size={13} className="text-[rgb(var(--text-muted))]" />
                Record ID
              </span>
              <span className="font-mono text-xs text-[rgb(var(--text-muted))]">
                {account.id}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs py-2">
              <span className="text-[rgb(var(--text-secondary))] flex items-center gap-1.5">
                <Calendar size={13} className="text-[rgb(var(--text-muted))]" />
                Created At
              </span>
              <span className="text-[rgb(var(--text-muted))]">
                {new Date(account.createdAt).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[rgb(var(--border))] flex items-center justify-between bg-[rgb(var(--bg-subtle))]">
          <div className="flex items-center gap-2">
            {canUpdate && account.status === 'ARCHIVED' && onReactivate && (
              <button
                onClick={() => {
                  onReactivate(account);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
              >
                <RotateCcw size={13} />
                <span>Reactivate</span>
              </button>
            )}

            {canUpdate && account.status !== 'ARCHIVED' && onArchive && (
              <button
                onClick={() => {
                  onArchive(account);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--text-secondary))] hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
              >
                <Archive size={13} />
                <span>Archive</span>
              </button>
            )}

            {canDelete && onDelete && (
              <button
                onClick={() => {
                  onDelete(account);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canUpdate && onEdit && (
              <button
                onClick={() => {
                  onEdit(account);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Edit2 size={13} />
                <span>Edit Account</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
