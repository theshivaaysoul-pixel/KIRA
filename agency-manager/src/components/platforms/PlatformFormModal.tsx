'use client';
// src/components/platforms/PlatformFormModal.tsx
// Modal form for creating and editing dynamic social platforms.

import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { PlatformWithStats, PlatformCapability } from '@/lib/types/domain';
import { PLATFORM_CAPABILITIES } from '@/lib/types/domain';
import type { CreatePlatformInput } from '@/lib/services/platform-service';
import { PlatformIcon, AVAILABLE_PLATFORM_ICONS } from './PlatformIcon';

interface PlatformFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: PlatformWithStats | null;
  onSubmit: (data: CreatePlatformInput) => Promise<void>;
  isMutating: boolean;
}

const CAPABILITY_DESCRIPTIONS: Record<PlatformCapability, string> = {
  text: 'Text and character updates',
  image: 'Single static photo uploads',
  video: 'Standard landscape or square video',
  carousel: 'Multi-image or video carousel albums',
  story: 'Ephemeral 24-hour stories',
  shortVideo: 'Vertical short-form video (Shorts/Reels/TikTok)',
  live: 'Real-time video broadcasting and streaming',
  scheduling: 'Automated post queue and future scheduling',
  analytics: 'Audience metrics, reach, and performance stats',
  publishing: 'Direct automated publishing via API',
};

export function PlatformFormModal({
  isOpen,
  onClose,
  initialData,
  onSubmit,
  isMutating,
}: PlatformFormModalProps) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [icon, setIcon] = useState('Share2');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [capabilities, setCapabilities] = useState<PlatformCapability[]>([
    'image',
    'video',
    'publishing',
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (initialData) {
        setName(initialData.name);
        setSlug(initialData.slug);
        setSlugManuallyEdited(true);
        setIcon(initialData.icon || 'Share2');
        setDescription(initialData.description || '');
        setIsActive(initialData.isActive);
        setCapabilities(initialData.capabilities);
      } else {
        setName('');
        setSlug('');
        setSlugManuallyEdited(false);
        setIcon('Camera');
        setDescription('');
        setIsActive(true);
        setCapabilities(['image', 'video', 'carousel', 'story', 'scheduling', 'publishing']);
      }
      setFormError(null);
    });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited && !isEditing) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generated);
    }
  };

  const toggleCapability = (cap: PlatformCapability) => {
    if (capabilities.includes(cap)) {
      if (capabilities.length === 1) {
        setFormError('At least one platform capability is required.');
        return;
      }
      setCapabilities(capabilities.filter((c) => c !== cap));
    } else {
      setCapabilities([...capabilities, cap]);
    }
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanIcon = icon.trim();

    if (!cleanName) {
      setFormError('Platform name is required.');
      return;
    }

    if (!cleanSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      setFormError(
        'Slug must be lowercase alphanumeric with single hyphens (e.g. "instagram" or "threads-app").'
      );
      return;
    }

    if (capabilities.length === 0) {
      setFormError('Please select at least one capability.');
      return;
    }

    try {
      await onSubmit({
        name: cleanName,
        slug: cleanSlug,
        icon: cleanIcon,
        description: description.trim() || undefined,
        isActive,
        capabilities,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save platform.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[rgb(var(--card-bg))] border border-[rgb(var(--border))] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[rgb(var(--border))] flex items-center justify-between sticky top-0 bg-[rgb(var(--card-bg))] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgb(var(--primary-light))] text-[rgb(var(--primary))] flex items-center justify-center font-bold">
              <PlatformIcon icon={icon} name={name} size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[rgb(var(--text-primary))]">
                {isEditing ? `Edit Platform: ${initialData?.name}` : 'Add New Social Platform'}
              </h2>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                {isEditing
                  ? `Update configuration for @${initialData?.slug}`
                  : 'Configure dynamic capabilities and metadata'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Name & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Platform Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Instagram"
                className="w-full px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Slug (URL Identifier) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="e.g. instagram"
                className="w-full px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] font-mono text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))] transition-all"
              />
              <span className="text-[10px] text-[rgb(var(--text-muted))] mt-1 block">
                Preview: <code className="font-mono">@{slug || 'slug'}</code>
              </span>
            </div>
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
              Platform Icon <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {AVAILABLE_PLATFORM_ICONS.map((item) => {
                const isSelected = icon.toLowerCase() === item.key.toLowerCase();
                const IconCmp = item.icon;
                return (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => setIcon(item.key)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs text-left transition-all ${
                      isSelected
                        ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary-light))] text-[rgb(var(--primary))] font-semibold'
                        : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--card-bg))]'
                    }`}
                  >
                    <PlatformIcon icon={item.key} name={item.label} size={18} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational description or social network niche..."
              className="w-full px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))] transition-all resize-none"
            />
          </div>

          {/* Capabilities Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[rgb(var(--text-primary))]">
                Supported Content & Workflow Capabilities <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-[rgb(var(--text-muted))]">
                {capabilities.length} selected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[rgb(var(--border))] rounded-xl p-3 bg-[rgb(var(--bg-subtle))] max-h-56 overflow-y-auto">
              {PLATFORM_CAPABILITIES.map((cap) => {
                const isChecked = capabilities.includes(cap);
                return (
                  <label
                    key={cap}
                    className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-[rgb(var(--card-bg))] border border-[rgb(var(--primary))]/30 shadow-xs'
                        : 'hover:bg-[rgb(var(--card-bg))]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCapability(cap)}
                      className="mt-0.5 rounded text-[rgb(var(--primary))] focus:ring-[rgb(var(--primary))]"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[rgb(var(--text-primary))] block capitalize">
                        {cap}
                      </span>
                      <span className="text-[10px] text-[rgb(var(--text-muted))] block leading-tight">
                        {CAPABILITY_DESCRIPTIONS[cap]}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))]">
            <div>
              <span className="text-xs font-semibold text-[rgb(var(--text-primary))] block">
                Active for Account Connections
              </span>
              <span className="text-[11px] text-[rgb(var(--text-muted))] block">
                When active, agency team members can link social accounts to this platform.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[rgb(var(--primary))]"></div>
            </label>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-[rgb(var(--border))] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isMutating}
              className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-semibold text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-5 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isMutating && (
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              {isEditing ? 'Save Changes' : 'Create Platform'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
