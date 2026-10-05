'use client';
// src/components/accounts/AccountFormModal.tsx
// Modal dialog for creating and editing social accounts.
// Enforces dynamic active platform selection, active manager assignment, and real-time avatar preview.

import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import type {
  Platform,
  TeamMember,
  SocialAccountWithRelations,
  SocialAccountStatus,
} from '@/lib/types/domain';
import type { CreateSocialAccountInput } from '@/lib/services/social-account-service';
import { Avatar } from '@/components/ui/Avatar';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSocialAccountInput) => Promise<boolean>;
  initialData?: SocialAccountWithRelations | null;
  platforms: Platform[];
  teamMembers: TeamMember[];
}

export function AccountFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  platforms,
  teamMembers,
}: AccountFormModalProps) {
  const isEditing = !!initialData;

  const [platformId, setPlatformId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [username, setUsername] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [niche, setNiche] = useState('');
  const [description, setDescription] = useState('');
  const [assignedManagerId, setAssignedManagerId] = useState('');
  const [externalAccountId, setExternalAccountId] = useState('');
  const [status, setStatus] = useState<SocialAccountStatus>('ACTIVE');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter platforms: For new accounts, only active platforms can be selected
  const availablePlatforms = isEditing
    ? platforms
    : platforms.filter((p) => p.isActive);

  // Filter team members: only active members can be assigned
  const activeTeamMembers = teamMembers.filter((m) => m.status === 'ACTIVE');

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (initialData) {
        setPlatformId(initialData.platformId);
        setAccountName(initialData.accountName);
        setUsername(initialData.username);
        setProfileUrl(initialData.profileUrl || '');
        setAvatarUrl(initialData.avatarUrl || '');
        setNiche(initialData.niche || '');
        setDescription(initialData.description || '');
        setAssignedManagerId(initialData.assignedManagerId || '');
        setExternalAccountId(initialData.externalAccountId || '');
        setStatus(initialData.status);
      } else {
        setPlatformId(availablePlatforms[0]?.id || '');
        setAccountName('');
        setUsername('');
        setProfileUrl('');
        setAvatarUrl('');
        setNiche('');
        setDescription('');
        setAssignedManagerId('');
        setExternalAccountId('');
        setStatus('ACTIVE');
      }
      setError(null);
    });
  }, [initialData, isOpen, availablePlatforms]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!platformId) {
      setError('Please select a social platform.');
      return;
    }

    if (!accountName.trim()) {
      setError('Account name is required.');
      return;
    }

    const cleanUsername = username.trim().replace(/^@+/, '');
    if (!cleanUsername) {
      setError('Username is required.');
      return;
    }

    if (profileUrl && !/^https?:\/\//i.test(profileUrl.trim())) {
      setError('Profile URL must start with http:// or https://');
      return;
    }

    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl.trim())) {
      setError('Avatar URL must start with http:// or https://');
      return;
    }

    setLoading(true);
    try {
      const payload: CreateSocialAccountInput = {
        platformId,
        accountName: accountName.trim(),
        username: cleanUsername,
        profileUrl: profileUrl.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        niche: niche.trim() || undefined,
        description: description.trim() || undefined,
        assignedManagerId: assignedManagerId || undefined,
        externalAccountId: externalAccountId.trim() || undefined,
        status,
      };

      const success = await onSubmit(payload);
      if (success) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save social account');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlatform = platforms.find((p) => p.id === platformId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card-bg))] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[rgb(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[rgb(var(--text-primary))]">
                {isEditing ? 'Edit Social Account' : 'Connect Social Account'}
              </h2>
              <p className="text-xs text-[rgb(var(--text-secondary))]">
                {isEditing
                  ? `Update configuration for @${initialData?.username}`
                  : 'Add a new social media profile to your agency management fleet'}
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Platform Selector */}
          <div>
            <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
              Social Platform <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                disabled={isEditing} // Platform is immutable after creation to protect adapter routing
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40 disabled:opacity-60"
              >
                {availablePlatforms.length === 0 ? (
                  <option value="">No active platforms available</option>
                ) : (
                  availablePlatforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug}) {!p.isActive ? '[Inactive]' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
            {selectedPlatform && (
              <p className="mt-1 text-[11px] text-[rgb(var(--text-muted))] flex items-center gap-1.5">
                <PlatformIcon
                  icon={selectedPlatform.icon}
                  platformName={selectedPlatform.name}
                  size={12}
                />
                Platform ID: {selectedPlatform.id}
              </p>
            )}
          </div>

          {/* Account Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Account Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. KIRA Agency Official"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Username / Handle <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--text-muted))]">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@+/, ''))}
                  placeholder="kira_agency"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
                />
              </div>
            </div>
          </div>

          {/* Profile URL & Avatar URL with Live Preview */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Profile URL
              </label>
              <input
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://instagram.com/kira_agency"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Avatar Image URL
              </label>
              <div className="flex items-center gap-3">
                <Avatar
                  src={avatarUrl.trim() || null}
                  name={accountName || username || 'Account'}
                  size="md"
                />
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
                />
              </div>
            </div>
          </div>

          {/* Niche & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Niche / Category
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Fashion, Tech, Lifestyle"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SocialAccountStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
                <option value="CONNECTION_ERROR">CONNECTION_ERROR</option>
              </select>
            </div>
          </div>

          {/* Assigned Manager */}
          <div>
            <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
              Assigned Account Manager
            </label>
            <select
              value={assignedManagerId}
              onChange={(e) => setAssignedManagerId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
            >
              <option value="">None (Unassigned)</option>
              {activeTeamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[rgb(var(--text-muted))]">
              Only active agency team members are eligible for account management assignment.
            </p>
          </div>

          {/* External Account ID */}
          <div>
            <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
              External Platform Account ID <span className="font-normal text-[rgb(var(--text-muted))]">(Optional)</span>
            </label>
            <input
              type="text"
              value={externalAccountId}
              onChange={(e) => setExternalAccountId(e.target.value)}
              placeholder="e.g. 17841400000000000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40"
            />
            <p className="mt-1 text-[11px] text-[rgb(var(--text-muted))]">
              Platform-assigned external identifier if known. Must be unique per platform.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
              Description / Internal Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Primary branding account for product releases and community outreach..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-xs text-[rgb(var(--text-primary))] focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--primary))]/40 resize-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-[rgb(var(--border))] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[rgb(var(--border))] text-xs font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[rgb(var(--primary))] text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 shadow-sm"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{isEditing ? 'Save Changes' : 'Connect Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
