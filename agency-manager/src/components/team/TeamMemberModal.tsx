'use client';
// src/components/team/TeamMemberModal.tsx
// Modal for inviting a new team member with shareable link or editing existing member details.

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, Loader2, AlertCircle, Shield, Link2, Copy, Check, Share2 } from 'lucide-react';
import type { TeamMember, TeamRole, TeamMemberStatus } from '@/lib/types/domain';
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from '@/lib/services/team-service';

interface TeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTeamMemberInput | UpdateTeamMemberInput) => Promise<void>;
  member?: TeamMember | null;
  currentUserRole: TeamRole;
  isMutating: boolean;
}

const ROLES: { value: TeamRole; label: string; desc: string }[] = [
  { value: 'OWNER', label: 'Owner', desc: 'Full authority over entire agency, billing, data recovery, and members' },
  { value: 'ADMIN', label: 'Admin', desc: 'Manage accounts, content, tasks, team, and settings' },
  { value: 'MANAGER', label: 'Manager', desc: 'Manage accounts, approve content, schedule calendar, and assign tasks' },
  { value: 'EDITOR', label: 'Editor', desc: 'Create and edit draft content and manage publication schedules' },
  { value: 'DESIGNER', label: 'Designer', desc: 'Manage media assets and creative content designs' },
  { value: 'ANALYST', label: 'Analyst', desc: 'Access analytics reports, performance metrics, and insights' },
  { value: 'VIEWER', label: 'Viewer', desc: 'Read-only access to published content, calendar, and dashboards' },
  { value: 'MEMBER', label: 'Member', desc: 'Standard agency team member with full operational access' },
];

const STATUSES: { value: TeamMemberStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export function TeamMemberModal({
  isOpen,
  onClose,
  onSubmit,
  member,
  currentUserRole,
  isMutating,
}: TeamMemberModalProps) {
  const isEditing = !!member;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState<TeamRole>('MEMBER');
  const [status, setStatus] = useState<TeamMemberStatus>('ACTIVE');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setEmail(member.email);
      setAvatarUrl(member.avatarUrl || '');
      setRole(member.role);
      setStatus(member.status);
    } else {
      setName('');
      setEmail('');
      setAvatarUrl('');
      setRole(currentUserRole === 'MEMBER' ? 'MEMBER' : 'MEMBER');
      setStatus('ACTIVE');
    }
    setValidationError(null);
    setCopied(false);
  }, [member, isOpen, currentUserRole]);

  if (!isOpen) return null;

  const inviteUrl = `${origin || 'https://agency.kira.network'}/login?invite=true&role=${role}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setValidationError('Failed to copy link. Please manually copy the URL.');
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join KIRA Agency',
          text: `You have been invited to join KIRA Agency as a ${ROLES.find((r) => r.value === role)?.label || role}. Click the link to register:`,
          url: inviteUrl,
        });
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    await handleCopyLink();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // If invite mode, submitting copies the link and closes or keeps open
    if (!isEditing) {
      await handleCopyLink();
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setValidationError('Team member name is required.');
      return;
    }

    if (!trimmedEmail) {
      setValidationError('Email address is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    // Role assignment hierarchy check
    if (role === 'OWNER' && currentUserRole !== 'OWNER') {
      setValidationError('Only an existing Agency OWNER can assign the Owner role.');
      return;
    }

    if (currentUserRole === 'MEMBER' && (role === 'OWNER' || role === 'MANAGER' || role === 'ADMIN')) {
      setValidationError('Members cannot assign elevated administrative roles (Owner, Manager, Admin).');
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        email: trimmedEmail,
        avatarUrl: avatarUrl.trim() || undefined,
        role,
        status,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setValidationError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              {isEditing ? <Shield size={20} /> : <UserPlus size={20} />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[rgb(var(--text-primary))]">
                {isEditing ? 'Edit Team Member' : 'Invite Team Member'}
              </h3>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                {isEditing
                  ? `Update role, status, or details for ${member?.name}`
                  : 'Select the agency role to generate a shareable invitation link'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isMutating}
            className="p-1.5 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {validationError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {isEditing ? (
            /* Editing Full Form */
            <>
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  disabled={isMutating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-[rgb(var(--text-muted))]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@kira.agency"
                  disabled={isMutating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-[rgb(var(--text-muted))]"
                />
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                  Avatar Image URL <span className="text-[rgb(var(--text-muted))]">(optional)</span>
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  disabled={isMutating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all placeholder:text-[rgb(var(--text-muted))]"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                  Agency Role <span className="text-red-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as TeamRole)}
                  disabled={isMutating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all"
                >
                  {ROLES.map((r) => {
                    const isElevated = r.value === 'OWNER' || r.value === 'MANAGER' || r.value === 'ADMIN';
                    const disabled =
                      (r.value === 'OWNER' && currentUserRole !== 'OWNER') ||
                      (isElevated && currentUserRole === 'MEMBER');
                    return (
                      <option key={r.value} value={r.value} disabled={disabled}>
                        {r.label} {disabled ? '(Restricted)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] text-[rgb(var(--text-muted))]">
                  {ROLES.find((r) => r.value === role)?.desc}
                </p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                  Account Status <span className="text-red-400">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TeamMemberStatus)}
                  disabled={isMutating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            /* Invite Mode: ONLY Agency Role & Shareable Link */
            <>
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5">
                  Agency Role <span className="text-red-400">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as TeamRole)}
                  disabled={isMutating}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 transition-all cursor-pointer"
                >
                  {ROLES.map((r) => {
                    const isElevated = r.value === 'OWNER' || r.value === 'MANAGER' || r.value === 'ADMIN';
                    const disabled =
                      (r.value === 'OWNER' && currentUserRole !== 'OWNER') ||
                      (isElevated && currentUserRole === 'MEMBER');
                    return (
                      <option key={r.value} value={r.value} disabled={disabled}>
                        {r.label} {disabled ? '(Restricted)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1.5 text-[11px] text-[rgb(var(--text-muted))]">
                  {ROLES.find((r) => r.value === role)?.desc}
                </p>
              </div>

              {/* Shareable Link Box */}
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[rgb(var(--text-primary))] flex items-center gap-1.5">
                    <Link2 size={15} className="text-purple-400" />
                    <span>Invite Member Link</span>
                  </span>
                  <span className="text-[10px] text-purple-400 font-medium px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                    Ready to Share
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 px-3 py-2 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-primary))] text-xs font-mono select-all focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
                    title="Copy invite link"
                  >
                    {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="p-2 rounded-xl text-xs font-medium border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] hover:bg-[rgb(var(--border))] text-[rgb(var(--text-primary))] transition-all shrink-0 cursor-pointer"
                    title="Share link"
                  >
                    <Share2 size={14} />
                  </button>
                </div>

                <p className="text-[11px] text-[rgb(var(--text-muted))] leading-relaxed">
                  Anyone with this link can register and automatically join your agency as a{' '}
                  <strong className="text-purple-400 font-semibold">
                    {ROLES.find((r) => r.value === role)?.label || role}
                  </strong>.
                </p>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[rgb(var(--border))] flex items-center justify-end gap-2.5">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isMutating}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm shadow-purple-500/20 cursor-pointer"
                >
                  {isMutating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors cursor-pointer"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-all flex items-center gap-1.5 shadow-sm shadow-purple-500/20 cursor-pointer active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-300" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
