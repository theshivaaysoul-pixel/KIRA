'use client';
// src/components/tasks/TaskModal.tsx
// Modal for Creating and Editing Tasks (Phase 10).
// Loads real TeamMembers, Content, and Social Accounts from API.

import { useState, useEffect } from 'react';
import { X, Calendar, User, FileText, Share2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskPriority, TaskStatus, TeamMember, Content, SocialAccount } from '@/lib/types/domain';
import type { TaskWithRelations } from '@/lib/services/task-service';
import { VALID_TASK_STATUS_TRANSITIONS } from '@/lib/validation';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: TaskWithRelations | null;
  onSuccess: () => void;
}

export function TaskModal({ isOpen, onClose, taskToEdit, onSuccess }: TaskModalProps) {
  const { getIdToken } = useAuth();
  const isEditing = Boolean(taskToEdit);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [relatedContentId, setRelatedContentId] = useState('');
  const [relatedAccountId, setRelatedAccountId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [dueDateTime, setDueDateTime] = useState('');

  // Dropdown reference data
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [contentList, setContentList] = useState<Content[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Form submission state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when opening or changing taskToEdit
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setAssignedTo(taskToEdit.assignedTo || '');
      setRelatedContentId(taskToEdit.relatedContentId || '');
      setRelatedAccountId(taskToEdit.relatedAccountId || '');
      setPriority(taskToEdit.priority || 'MEDIUM');
      setStatus(taskToEdit.status || 'TODO');
      if (taskToEdit.dueDate) {
        // Convert ISO string to YYYY-MM-DDTHH:mm format for datetime-local
        try {
          const d = new Date(taskToEdit.dueDate);
          const pad = (n: number) => String(n).padStart(2, '0');
          const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setDueDateTime(localStr);
        } catch {
          setDueDateTime('');
        }
      } else {
        setDueDateTime('');
      }
    } else {
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setRelatedContentId('');
      setRelatedAccountId('');
      setPriority('MEDIUM');
      setStatus('TODO');
      setDueDateTime('');
    }
    setError(null);
  }, [taskToEdit, isOpen]);

  // Load real options from API
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadReferenceData() {
      setLoadingRefs(true);
      try {
        const token = await getIdToken();
        if (!token) return;

        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };

        const [teamRes, contentRes, accountsRes] = await Promise.allSettled([
          fetch('/api/team', { headers }),
          fetch('/api/content', { headers }),
          fetch('/api/social-accounts?status=ACTIVE', { headers }),
        ]);

        if (teamRes.status === 'fulfilled' && teamRes.value.ok) {
          const data = await teamRes.value.json();
          if (data.success && isMounted) {
            setMembers((data.data || []).filter((m: TeamMember) => m.status === 'ACTIVE'));
          }
        }

        if (contentRes.status === 'fulfilled' && contentRes.value.ok) {
          const data = await contentRes.value.json();
          if (data.success && isMounted) {
            setContentList((data.data?.items || data.data || []).filter((c: Content) => !c.deletedAt && c.status !== 'ARCHIVED'));
          }
        }

        if (accountsRes.status === 'fulfilled' && accountsRes.value.ok) {
          const data = await accountsRes.value.json();
          if (data.success && isMounted) {
            setAccounts(data.data?.items || data.data || []);
          }
        }
      } catch (err) {
        console.warn('[TaskModal] Could not fetch reference lists:', err);
      } finally {
        if (isMounted) setLoadingRefs(false);
      }
    }

    loadReferenceData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, getIdToken]);

  if (!isOpen) return null;

  // Allowed statuses on edit
  const currentStatus = taskToEdit?.status || 'TODO';
  const allowedNext = isEditing
    ? [currentStatus, ...(VALID_TASK_STATUS_TRANSITIONS[currentStatus] || [])]
    : ['TODO', 'IN_PROGRESS'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      let isoDueDate: string | undefined;
      if (dueDateTime) {
        isoDueDate = new Date(dueDateTime).toISOString();
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo || undefined,
        relatedContentId: relatedContentId || undefined,
        relatedAccountId: relatedAccountId || undefined,
        priority,
        status,
        dueDate: isoDueDate,
      };

      const url = isEditing && taskToEdit ? `/api/tasks/${taskToEdit.id}` : '/api/tasks';
      const method = isEditing && taskToEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        const msg = typeof json.error === 'object' && json.error?.message ? json.error.message : (json.error || 'Failed to save task.');
        throw new Error(msg);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('[TaskModal handleSubmit]', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="task-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--border))]">
          <div>
            <h2 id="task-modal-title" className="text-lg font-semibold text-[rgb(var(--text-primary))]">
              {isEditing && taskToEdit ? `Edit Task — ${taskToEdit.id}` : 'Create New Task'}
            </h2>
            <p className="text-xs text-[rgb(var(--text-secondary))] mt-0.5">
              {isEditing ? 'Update task attributes and workflow status' : 'Assign operational tasks and link them to agency content'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] rounded-lg hover:bg-[rgb(var(--bg-subtle))] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Finalize Instagram caption & approval"
              maxLength={200}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add task context, notes, or specific requirements..."
              rows={3}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition resize-none"
            />
          </div>

          {/* Priority & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5">
                Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
              >
                {allowedNext.includes('TODO') && <option value="TODO">To Do</option>}
                {allowedNext.includes('IN_PROGRESS') && <option value="IN_PROGRESS">In Progress</option>}
                {allowedNext.includes('REVIEW') && <option value="REVIEW">Review</option>}
                {allowedNext.includes('COMPLETED') && <option value="COMPLETED">Completed</option>}
                {allowedNext.includes('CANCELLED') && <option value="CANCELLED">Cancelled</option>}
              </select>
            </div>
          </div>

          {/* Assignee & Due Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5 flex items-center gap-1.5">
                <User size={12} /> Assignee
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-secondary))] mb-1.5 flex items-center gap-1.5">
                <Calendar size={12} /> Due Date & Time
              </label>
              <input
                type="datetime-local"
                value={dueDateTime}
                onChange={(e) => setDueDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
              />
            </div>
          </div>

          {/* Relations: Content & Social Account */}
          <div className="border-t border-[rgb(var(--border))] pt-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
              Optional Relationships
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5 flex items-center gap-1.5">
                  <FileText size={12} /> Related Content
                </label>
                <select
                  value={relatedContentId}
                  onChange={(e) => setRelatedContentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
                >
                  <option value="">None</option>
                  {contentList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} [{c.contentType} · {c.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-secondary))] mb-1.5 flex items-center gap-1.5">
                  <Share2 size={12} /> Related Social Account
                </label>
                <select
                  value={relatedAccountId}
                  onChange={(e) => setRelatedAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] text-sm focus:outline-hidden focus:ring-2 focus:ring-[rgb(var(--kira-purple))] transition"
                >
                  <option value="">None</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} (@{a.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgb(var(--border))]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-subtle))] rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 rounded-xl transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
