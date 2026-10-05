'use client';
// src/components/calendar/ScheduleModal.tsx
// Modal for scheduling a content publication on a specific social account.
// Only accepts APPROVED/SCHEDULED content and ACTIVE accounts.

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { SocialAccount } from '@/lib/types/domain';
import { useAuth } from '@/contexts/AuthContext';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: (pubId: string) => void;
  /** Pre-selected content ID (from Content page → Schedule action) */
  preselectedContentId?: string;
  preselectedContentTitle?: string;
  schedulePublication: (data: {
    contentId: string;
    socialAccountId: string;
    scheduledAt: string;
    platformSpecificCaption?: string;
    platformSpecificTitle?: string;
  }) => Promise<{ id: string }>;
}

interface ContentOption {
  id: string;
  title: string;
  contentType: string;
  status: string;
}

async function apiFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'Request failed');
  return json.data as T;
}

export function ScheduleModal({
  isOpen,
  onClose,
  onScheduled,
  preselectedContentId,
  preselectedContentTitle,
  schedulePublication,
}: ScheduleModalProps) {
  const { user, getIdToken } = useAuth();

  const [contentId, setContentId] = useState(preselectedContentId || '');
  const [socialAccountId, setSocialAccountId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [platformCaption, setPlatformCaption] = useState('');
  const [platformTitle, setPlatformTitle] = useState('');

  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [accountOptions, setAccountOptions] = useState<SocialAccount[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load approved content and active accounts when modal opens
  useEffect(() => {
    if (!isOpen || !user) return;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const token = await getIdToken();
        if (!token) return;

        const [contentData, accountData] = await Promise.all([
          apiFetch<{ items: ContentOption[] }>(
            '/api/content?status=APPROVED&pageSize=100',
            token
          ),
          apiFetch<{ items: SocialAccount[] }>(
            '/api/social-accounts?status=ACTIVE&pageSize=200',
            token
          ),
        ]);

        // Also include SCHEDULED content for re-publishing
        const scheduledData = await apiFetch<{ items: ContentOption[] }>(
          '/api/content?status=SCHEDULED&pageSize=100',
          token
        );

        const combined = [...contentData.items, ...scheduledData.items];
        const unique = Array.from(new Map(combined.map((c) => [c.id, c])).values());
        setContentOptions(unique);
        setAccountOptions(accountData.items);
      } catch {
        setError('Failed to load content and account options.');
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [isOpen, user, getIdToken]);

  // Sync preselected content
  useEffect(() => {
    if (preselectedContentId) setContentId(preselectedContentId);
  }, [preselectedContentId]);

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setSocialAccountId('');
    setScheduledDate('');
    setScheduledTime('');
    setPlatformCaption('');
    setPlatformTitle('');
    if (!preselectedContentId) setContentId('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentId || !socialAccountId || !scheduledDate || !scheduledTime) {
      setError('Please fill in all required fields.');
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00Z`).toISOString();

    setSubmitting(true);
    setError(null);
    try {
      const pub = await schedulePublication({
        contentId,
        socialAccountId,
        scheduledAt,
        platformSpecificCaption: platformCaption || undefined,
        platformSpecificTitle: platformTitle || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onScheduled(pub.id);
        handleClose();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule publication.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Minimum date = tomorrow UTC
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content max-w-xl w-full bg-white dark:bg-[#18181b] rounded-2xl border border-[rgb(var(--border))] shadow-2xl opacity-100 z-10 overflow-hidden"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgb(var(--border))] bg-white dark:bg-[#18181b]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Calendar size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[rgb(var(--text-primary))]">
                Schedule Publication
              </h2>
              {preselectedContentTitle && (
                <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5 truncate max-w-xs">
                  {preselectedContentTitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="btn-ghost p-1.5 rounded-lg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>Publication scheduled successfully!</span>
            </div>
          )}

          {/* Content Selection */}
          {!preselectedContentId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                Content <span className="text-red-400">*</span>
              </label>
              {loadingOptions ? (
                <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : (
                <select
                  id="schedule-content-id"
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">— Select APPROVED content —</option>
                  {contentOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.status}] {c.title} ({c.contentType})
                    </option>
                  ))}
                </select>
              )}
              {contentOptions.length === 0 && !loadingOptions && (
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  No APPROVED content available. Approve content before scheduling.
                </p>
              )}
            </div>
          )}

          {/* Social Account */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
              Social Account <span className="text-red-400">*</span>
            </label>
            {loadingOptions ? (
              <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <select
                id="schedule-account-id"
                value={socialAccountId}
                onChange={(e) => setSocialAccountId(e.target.value)}
                className="input"
                required
              >
                <option value="">— Select account —</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username} — {a.accountName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                Date (UTC) <span className="text-red-400">*</span>
              </label>
              <input
                id="schedule-date"
                type="date"
                min={minDate}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                Time (UTC) <span className="text-red-400">*</span>
              </label>
              <input
                id="schedule-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          {/* Platform-specific caption */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
              Platform Caption <span className="text-[rgb(var(--text-muted))]">(optional override)</span>
            </label>
            <textarea
              id="schedule-caption"
              value={platformCaption}
              onChange={(e) => setPlatformCaption(e.target.value)}
              placeholder="Leave blank to use the content's default caption…"
              className="input resize-none"
              rows={3}
              maxLength={5000}
            />
          </div>

          {/* Platform-specific title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
              Platform Title <span className="text-[rgb(var(--text-muted))]">(optional override)</span>
            </label>
            <input
              id="schedule-title"
              type="text"
              value={platformTitle}
              onChange={(e) => setPlatformTitle(e.target.value)}
              placeholder="Leave blank to use the content's default title…"
              className="input"
              maxLength={200}
            />
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-xs text-[rgb(var(--text-muted))]">
            <Clock size={13} className="shrink-0 mt-0.5 text-indigo-400" />
            <span>
              All times are stored and displayed in <strong>UTC</strong>. The agency timezone (
              displayed in the calendar header) is used only for display formatting.
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="btn-ghost flex-1 py-2.5 text-sm"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
              disabled={submitting || success || loadingOptions}
              id="schedule-submit-btn"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Scheduling…
                </>
              ) : (
                <>
                  <Calendar size={14} /> Schedule
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
