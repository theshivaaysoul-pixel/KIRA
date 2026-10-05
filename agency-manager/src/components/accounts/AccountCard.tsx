'use client';
// src/components/accounts/AccountCard.tsx
// Instagram-inspired social account card displaying dynamic platform, status, manager, and metrics.

import React from 'react';
import {
  ExternalLink,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Eye,
  FileText,
  BarChart2,
  CheckSquare,
  User,
} from 'lucide-react';
import type { SocialAccountWithRelations, SocialAccountStatus } from '@/lib/types/domain';
import { Avatar } from '@/components/ui/Avatar';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';

interface AccountCardProps {
  account: SocialAccountWithRelations;
  canUpdate: boolean;
  canDelete: boolean;
  onViewDetails: (account: SocialAccountWithRelations) => void;
  onEdit: (account: SocialAccountWithRelations) => void;
  onArchive: (account: SocialAccountWithRelations) => void;
  onReactivate: (account: SocialAccountWithRelations) => void;
  onDelete: (account: SocialAccountWithRelations) => void;
}

const STATUS_CONFIG: Record<
  SocialAccountStatus,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  ACTIVE: {
    label: 'Active',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/20',
  },
  INACTIVE: {
    label: 'Inactive',
    bg: 'bg-neutral-500/10 dark:bg-neutral-500/20',
    text: 'text-neutral-600 dark:text-neutral-400',
    dot: 'bg-neutral-400',
    border: 'border-neutral-500/20',
  },
  ARCHIVED: {
    label: 'Archived',
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

export function AccountCard({
  account,
  canUpdate,
  canDelete,
  onViewDetails,
  onEdit,
  onArchive,
  onReactivate,
  onDelete,
}: AccountCardProps) {
  const statusCfg = STATUS_CONFIG[account.status] || STATUS_CONFIG.INACTIVE;
  const platformName = account.platform?.name || 'Social Platform';

  return (
    <div className="card group relative rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] p-5 shadow-xs hover:shadow-md hover:border-[rgb(var(--primary))]/30 transition-all duration-200 flex flex-col justify-between">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar
                src={account.avatarUrl}
                name={account.accountName}
                size="lg"
                className="ring-2 ring-[rgb(var(--border))] group-hover:ring-[rgb(var(--primary))]/30 transition-all"
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base text-[rgb(var(--text-primary))] leading-tight line-clamp-1">
                  {account.accountName}
                </h3>
                {account.niche && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] border border-[rgb(var(--border))]">
                    {account.niche}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-medium text-[rgb(var(--text-secondary))]">
                  @{account.username}
                </span>
                <span className="text-[rgb(var(--text-muted))] text-xs">•</span>
                <span className="text-xs text-[rgb(var(--text-secondary))]">
                  {platformName}
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} animate-pulse`} />
            <span>{statusCfg.label}</span>
          </div>
        </div>

        {/* Description */}
        {account.description && (
          <p className="mt-3 text-xs text-[rgb(var(--text-secondary))] line-clamp-2 leading-relaxed">
            {account.description}
          </p>
        )}

        {/* Manager & Relationship Stats */}
        <div className="mt-4 pt-3 border-t border-[rgb(var(--border))] flex items-center justify-between text-xs text-[rgb(var(--text-secondary))]">
          <div className="flex items-center gap-1.5">
            {account.assignedManager ? (
              <>
                <Avatar
                  src={account.assignedManager.avatarUrl}
                  name={account.assignedManager.name}
                  size="xs"
                />
                <span className="truncate max-w-[110px] text-xs font-medium text-[rgb(var(--text-primary))]">
                  {account.assignedManager.name}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-[rgb(var(--text-muted))] text-xs italic">
                <User size={12} />
                Unassigned
              </span>
            )}
          </div>

          {/* Relationship Metrics */}
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1 text-xs text-[rgb(var(--text-secondary))]"
              title={`${account.publicationCount} Publications`}
            >
              <FileText size={12} className="text-[rgb(var(--text-muted))]" />
              {account.publicationCount}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs text-[rgb(var(--text-secondary))]"
              title={`${account.analyticsCount} Analytics Snapshots`}
            >
              <BarChart2 size={12} className="text-[rgb(var(--text-muted))]" />
              {account.analyticsCount}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs text-[rgb(var(--text-secondary))]"
              title={`${account.taskCount} Related Tasks`}
            >
              <CheckSquare size={12} className="text-[rgb(var(--text-muted))]" />
              {account.taskCount}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-[rgb(var(--border))] flex items-center justify-between">
        <div className="flex items-center gap-1">
          {account.profileUrl && (
            <a
              href={account.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
              title="Open profile in new tab"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            onClick={() => onViewDetails(account)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
          >
            <Eye size={13} />
            <span>Details</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {canUpdate && (
            <>
              {account.status === 'ARCHIVED' ? (
                <button
                  onClick={() => onReactivate(account)}
                  className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors"
                  title="Reactivate Account"
                >
                  <RotateCcw size={14} />
                </button>
              ) : (
                <button
                  onClick={() => onArchive(account)}
                  className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                  title="Archive Account"
                >
                  <Archive size={14} />
                </button>
              )}

              <button
                onClick={() => onEdit(account)}
                className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
                title="Edit Account"
              >
                <Edit2 size={14} />
              </button>
            </>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(account)}
              className="p-1.5 rounded-lg text-[rgb(var(--text-secondary))] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete or Archive Account"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
