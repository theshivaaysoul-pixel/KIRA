'use client';
// src/components/calendar/RescheduleModal.tsx
// Modal for rescheduling or viewing details of an existing publication.

import { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import type { CalendarEvent } from '@/lib/services/calendar-service';
import type { ContentPublication } from '@/lib/types/domain';
import { PlatformIcon } from '@/components/platforms/PlatformIcon';

interface RescheduleModalProps {
  isOpen: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onRescheduled: (pub: ContentPublication) => void;
  onCancelled: (pub: ContentPublication) => void;
  reschedulePublication: (
    pubId: string,
    data: { scheduledAt: string; platformSpecificCaption?: string; platformSpecificTitle?: string }
  ) => Promise<ContentPublication>;
  cancelPublication: (pubId: string) => Promise<ContentPublication>;
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  PROCESSING: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  PUBLISHED: 'text-green-400 bg-green-400/10 border-green-400/20',
  FAILED: 'text-red-400 bg-red-400/10 border-red-400/20',
  RETRYING: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  CANCELLED: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
};

export function RescheduleModal({
  isOpen,
  event,
  onClose,
  onRescheduled,
  onCancelled,
  reschedulePublication,
  cancelPublication,
}: RescheduleModalProps) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [platformCaption, setPlatformCaption] = useState('');
  const [platformTitle, setPlatformTitle] = useState('');
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');

  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setMode('view');
    setScheduledDate('');
    setScheduledTime('');
    setPlatformCaption('');
    setPlatformTitle('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const startReschedule = () => {
    if (!event) return;
    setMode('reschedule');
    setError(null);
    setSuccess(false);
    // Pre-fill with existing scheduledAt
    if (event.publication.scheduledAt) {
      const dt = new Date(event.publication.scheduledAt);
      setScheduledDate(dt.toISOString().slice(0, 10));
      setScheduledTime(dt.toISOString().slice(11, 16));
    }
    setPlatformCaption(event.publication.platformSpecificCaption || '');
    setPlatformTitle(event.publication.platformSpecificTitle || '');
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !scheduledDate || !scheduledTime) {
      setError('Please fill in date and time.');
      return;
    }
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00Z`).toISOString();

    setSubmitting(true);
    setError(null);
    try {
      const updated = await reschedulePublication(event.publication.id, {
        scheduledAt,
        platformSpecificCaption: platformCaption || undefined,
        platformSpecificTitle: platformTitle || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onRescheduled(updated);
        handleClose();
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reschedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!event) return;
    if (!window.confirm(`Cancel this publication scheduled for ${formatDate(event.publication.scheduledAt)}?`)) return;

    setCancelling(true);
    setError(null);
    try {
      const cancelled = await cancelPublication(event.publication.id);
      onCancelled(cancelled);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel publication.');
    } finally {
      setCancelling(false);
    }
  };

  if (!isOpen || !event) return null;

  const pub = event.publication;
  const isReschedulable = pub.status === 'QUEUED' || pub.status === 'RETRYING';
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content max-w-lg w-full"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Calendar size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[rgb(var(--text-primary))]">
                {mode === 'reschedule' ? 'Reschedule Publication' : 'Publication Details'}
              </h2>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                  STATUS_COLORS[pub.status] || STATUS_COLORS['QUEUED']
                }`}
              >
                {pub.status}
              </span>
            </div>
          </div>
          <button onClick={handleClose} className="btn-ghost p-1.5 rounded-lg" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>Rescheduled successfully!</span>
            </div>
          )}

          {mode === 'view' ? (
            <>
              {/* Content info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]">
                  <p className="text-[10px] text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1">Content</p>
                  <p className="text-sm font-medium text-[rgb(var(--text-primary))] truncate">{event.content.title}</p>
                  <p className="text-[11px] text-[rgb(var(--text-muted))]">{event.content.contentType}</p>
                </div>
                <div className="p-3 rounded-lg bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]">
                  <p className="text-[10px] text-[rgb(var(--text-muted))] uppercase tracking-wider mb-1">Account</p>
                  <p className="text-sm font-medium text-[rgb(var(--text-primary))] truncate">@{event.account.username}</p>
                  <p className="text-[11px] text-[rgb(var(--text-muted))] flex items-center gap-1 mt-0.5">
                    <PlatformIcon icon={event.platformIcon} name={event.platformName} size={13} className="shrink-0" />
                    <span>{event.platformName}</span>
                  </p>
                </div>
              </div>

              {/* Scheduled at */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))]">
                <Clock size={16} className="text-indigo-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-[rgb(var(--text-muted))] uppercase tracking-wider">Scheduled (UTC)</p>
                  <p className="text-sm font-medium text-[rgb(var(--text-primary))]">
                    {pub.scheduledAt ? formatDate(pub.scheduledAt) : '—'}
                  </p>
                </div>
              </div>

              {/* Published URL */}
              {pub.publishedUrl && (
                <a
                  href={pub.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-400 hover:underline"
                >
                  <ExternalLink size={13} /> View published post
                </a>
              )}

              {/* Platform caption */}
              {pub.platformSpecificCaption && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-[rgb(var(--text-muted))] uppercase tracking-wider">Platform Caption</p>
                  <p className="text-sm text-[rgb(var(--text-primary))] whitespace-pre-wrap line-clamp-4">
                    {pub.platformSpecificCaption}
                  </p>
                </div>
              )}

              {/* Error message */}
              {pub.errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <p className="text-[10px] uppercase tracking-wider mb-1 font-medium">Error</p>
                  <p>{pub.errorMessage}</p>
                </div>
              )}

              {/* IDs */}
              <div className="text-[10px] text-[rgb(var(--text-muted))] font-mono space-y-0.5">
                <p>PUB: {pub.id}</p>
                <p>CNT: {pub.contentId}</p>
                <p>ACC: {pub.socialAccountId}</p>
              </div>

              {/* Actions */}
              {isReschedulable && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="btn-ghost flex-1 py-2.5 text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 flex items-center justify-center gap-2"
                  >
                    {cancelling ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Cancel
                  </button>
                  <button
                    onClick={startReschedule}
                    className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                    id="start-reschedule-btn"
                  >
                    <RotateCcw size={14} /> Reschedule
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Reschedule form */
            <form onSubmit={handleReschedule} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                    Date (UTC) <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="reschedule-date"
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
                    id="reschedule-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[rgb(var(--text-secondary))] uppercase tracking-wider">
                  Platform Caption
                </label>
                <textarea
                  id="reschedule-caption"
                  value={platformCaption}
                  onChange={(e) => setPlatformCaption(e.target.value)}
                  className="input resize-none"
                  rows={3}
                  maxLength={5000}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="btn-ghost flex-1 py-2.5 text-sm"
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                  disabled={submitting || success}
                  id="reschedule-submit-btn"
                >
                  {submitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <RotateCcw size={14} /> Confirm Reschedule
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' UTC';
}
