'use client';
// src/components/platforms/PlatformCard.tsx
// Modern platform card with prominent, high-resolution logo hero filling the card.

import React from 'react';
import {
  Trash2,
  Power,
  Users,
  Eye,
  RotateCcw,
  Clock,
} from 'lucide-react';
import type { PlatformWithStats, PlatformCapability } from '@/lib/types/domain';
import { PlatformIcon } from './PlatformIcon';

interface PlatformCardProps {
  platform: PlatformWithStats;
  canUpdate: boolean;
  canDelete: boolean;
  onViewDetails: (platform: PlatformWithStats) => void;
  onEdit: (platform: PlatformWithStats) => void;
  onToggleActive: (platform: PlatformWithStats) => void;
  onDelete: (platform: PlatformWithStats) => void;
  onRestore?: (platform: PlatformWithStats) => void;
  viewMode?: 'active' | 'bin';
}

const CAPABILITY_LABELS: Record<PlatformCapability, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  carousel: 'Carousel',
  story: 'Story',
  shortVideo: 'Shorts/Reels',
  live: 'Live',
  scheduling: 'Scheduling',
  analytics: 'Analytics',
  publishing: 'Publishing',
};

export function PlatformCard({
  platform,
  canUpdate,
  canDelete,
  onViewDetails,
  onEdit: _onEdit,
  onToggleActive,
  onDelete,
  onRestore,
  viewMode = 'active',
}: PlatformCardProps) {
  const [nowTimestamp] = React.useState(() => Date.now());
  const isInBin = Boolean(platform.deletedAt) || viewMode === 'bin';
  const daysRemaining = platform.deletedAt
    ? Math.max(
        0,
        30 -
          Math.floor(
            (nowTimestamp - new Date(platform.deletedAt).getTime()) / (24 * 60 * 60 * 1000)
          )
      )
    : 30;

  return (
    <div
      onClick={() => onViewDetails(platform)}
      className="card flex flex-col justify-between hover:shadow-xl hover:border-blue-500/50 transition-all duration-200 group border-[rgb(var(--border))] overflow-hidden rounded-2xl bg-[rgb(var(--card-bg))] cursor-pointer"
    >
      {/* Prominent Logo Banner - fits and fills the top of the card */}
      <div className="relative w-full h-36 sm:h-40 bg-gradient-to-b from-[rgb(var(--bg-subtle))] to-[rgb(var(--card-bg))] border-b border-[rgb(var(--border))] flex items-center justify-center p-6 overflow-hidden">
        {/* Active status pill / Bin pill */}
        <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
          {isInBin ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border shadow-xs backdrop-blur-sm bg-amber-500/10 text-amber-500 border-amber-500/30">
              <Clock size={11} />
              <span>{daysRemaining}d left in Bin</span>
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border shadow-xs backdrop-blur-sm ${
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
              {platform.isActive ? 'Active' : 'Inactive'}
            </span>
          )}
        </div>

        {/* Large, centered official platform logo */}
        <div className="w-full h-full max-h-24 max-w-[160px] flex items-center justify-center">
          <PlatformIcon
            icon={platform.icon}
            name={platform.name}
            size={76}
            className="max-h-24 w-auto max-w-full object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3
              onClick={() => onViewDetails(platform)}
              className="text-base font-bold text-[rgb(var(--text-primary))] group-hover:text-[rgb(var(--primary))] transition-colors cursor-pointer"
            >
              {platform.name}
            </h3>
            <span className="text-[11px] font-mono text-[rgb(var(--text-muted))]">
              @{platform.slug}
            </span>
          </div>

          <p className="text-[10px] font-mono text-[rgb(var(--text-muted))] mb-2.5">
            ID: {platform.id}
          </p>

          {/* Description */}
          <p className="text-xs text-[rgb(var(--text-secondary))] leading-relaxed line-clamp-2 mb-4 min-h-[32px]">
            {platform.description || 'No description provided for this social platform.'}
          </p>

          {/* Dynamic Capabilities Badges */}
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--text-muted))] mb-2">
              Capabilities ({platform.capabilities.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {platform.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] border border-[rgb(var(--border))]"
                >
                  {CAPABILITY_LABELS[cap] || cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer & Actions */}
        <div className="pt-4 border-t border-[rgb(var(--border))] flex items-center justify-between gap-3">
          {/* Connected accounts counter */}
          <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))] font-medium">
            <Users size={13} />
            <span>
              <strong className="text-[rgb(var(--text-primary))] font-semibold">
                {platform.accountCount}
              </strong>{' '}
              account{platform.accountCount === 1 ? '' : 's'}
            </span>
          </div>

          {/* Actions capsule */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(platform);
              }}
              className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
              title="View Details"
            >
              <Eye size={15} />
            </button>

            {isInBin ? (
              <>
                {canUpdate && onRestore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(platform);
                    }}
                    className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Restore Platform"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}

                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(platform);
                    }}
                    className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title={
                      platform.accountCount > 0
                        ? `Cannot delete: ${platform.accountCount} account(s) connected`
                        : 'Permanently Delete Platform'
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            ) : (
              <>
                {canUpdate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleActive(platform);
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      platform.isActive
                        ? 'text-[rgb(var(--text-muted))] hover:text-amber-500 hover:bg-amber-500/10'
                        : 'text-[rgb(var(--text-muted))] hover:text-emerald-500 hover:bg-emerald-500/10'
                    }`}
                    title={platform.isActive ? 'Deactivate Platform' : 'Activate Platform'}
                  >
                    <Power size={15} />
                  </button>
                )}

                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(platform);
                    }}
                    className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title={
                      platform.accountCount > 0
                        ? `Cannot delete: ${platform.accountCount} account(s) connected`
                        : 'Delete Platform'
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
