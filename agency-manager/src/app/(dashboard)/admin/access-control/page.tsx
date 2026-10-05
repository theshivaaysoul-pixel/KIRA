'use client';
// src/app/(dashboard)/admin/access-control/page.tsx
// Access Management Dashboard for Owner & Manager to grant separate access to different options.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  Lock,
  Unlock,
  Server,
  Activity,
  Cpu,
  Image,
  Calendar,
  Share2,
  CheckSquare,
  Settings,
  UsersRound,
  RotateCcw,
  Sparkles,
  UserCheck,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { AccessRestrictedCard } from '@/components/auth/AccessRestrictedCard';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import {
  ACCESS_OPTION_MODULES,
  PERMISSIONS,
  Permission,
  AccessOptionModule,
  KIRA_OWNER_EMAIL,
  KIRA_MANAGER_EMAIL,
} from '@/lib/auth/permissions';
import type { TeamMember, ApiResponse } from '@/lib/types';
import type { AccessControlData } from '@/app/api/admin/access-control/route';

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Activity,
  Server,
  ShieldCheck,
  Cpu,
  CheckSquare,
  Image,
  Users,
  Share2,
  Calendar,
  UsersRound,
  Settings,
};

export default function AccessControlPage() {
  const { user, getIdToken } = useAuth();
  const { role, isOwnerOrManager, loading: permissionLoading, refresh: refreshAuthMe } = usePermission();
  const { success, error: toastError, info: toastInfo } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<Record<string, string[]>>({});
  const [initialPermissions, setInitialPermissions] = useState<Record<string, string[]>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CUSTOM' | 'MEMBERS'>('ALL');

  // Fetch all team members and their access states
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch('/api/admin/access-control', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = (await res.json()) as ApiResponse<AccessControlData>;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(
          typeof json.error === 'string'
            ? json.error
            : (json.error as { message?: string })?.message || 'Failed to load access control data'
        );
      }

      const teamList = json.data.members || [];
      setMembers(teamList);

      const permMap: Record<string, string[]> = {};
      teamList.forEach((m) => {
        permMap[m.id] = [...(m.customPermissions || [])];
      });
      setMemberPermissions(permMap);
      setInitialPermissions(JSON.parse(JSON.stringify(permMap)));

      // Auto-select first non-owner member if none selected
      if (!selectedMemberId && teamList.length > 0) {
        const candidate = teamList.find(
          (m) => m.role !== 'OWNER' && m.role !== 'MANAGER'
        ) || teamList[0];
        setSelectedMemberId(candidate.id);
      }
    } catch (err) {
      console.error('Failed to fetch access control data:', err);
      toastError(err instanceof Error ? err.message : 'Error fetching team data');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, selectedMemberId, toastError]);

  useEffect(() => {
    if (isOwnerOrManager) {
      fetchData();
    }
  }, [isOwnerOrManager, fetchData]);

  // Selected member object
  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const selectedMemberIsLeadership = useMemo(() => {
    if (!selectedMember) return false;
    return selectedMember.role === 'OWNER' || selectedMember.role === 'MANAGER';
  }, [selectedMember]);

  const activePermissions = useMemo(() => {
    if (!selectedMemberId) return [];
    return memberPermissions[selectedMemberId] || [];
  }, [memberPermissions, selectedMemberId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedMemberId) return false;
    const current = [...(memberPermissions[selectedMemberId] || [])].sort().join(',');
    const initial = [...(initialPermissions[selectedMemberId] || [])].sort().join(',');
    return current !== initial;
  }, [memberPermissions, initialPermissions, selectedMemberId]);

  // Filter members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterMode === 'CUSTOM') {
        return (memberPermissions[m.id] || []).length > 0;
      }
      if (filterMode === 'MEMBERS') {
        return m.role === 'MEMBER';
      }
      return true;
    });
  }, [members, searchQuery, filterMode, memberPermissions]);

  // Check if an option module is fully enabled for the selected member
  const isOptionModuleEnabled = (option: AccessOptionModule): boolean => {
    if (selectedMemberIsLeadership) return true;
    return option.permissions.every((perm) => activePermissions.includes(perm));
  };

  // Toggle an entire option module on or off for the selected member
  const toggleOptionModule = (option: AccessOptionModule) => {
    if (!selectedMemberId || selectedMemberIsLeadership) return;

    const current = new Set(activePermissions);
    const isCurrentlyEnabled = option.permissions.every((p) => current.has(p));

    if (isCurrentlyEnabled) {
      // Turn OFF: remove these permissions
      option.permissions.forEach((p) => current.delete(p));
    } else {
      // Turn ON: add all permissions required by this option
      option.permissions.forEach((p) => current.add(p));
    }

    setMemberPermissions((prev) => ({
      ...prev,
      [selectedMemberId]: Array.from(current),
    }));
  };

  // Toggle single fine-grained permission
  const toggleSinglePermission = (perm: Permission) => {
    if (!selectedMemberId || selectedMemberIsLeadership) return;

    const current = new Set(activePermissions);
    if (current.has(perm)) {
      current.delete(perm);
    } else {
      current.add(perm);
    }

    setMemberPermissions((prev) => ({
      ...prev,
      [selectedMemberId]: Array.from(current),
    }));
  };

  // Apply Quick Preset
  const applyPreset = (preset: 'ADMIN' | 'OPERATIONS' | 'AUDIT' | 'CLEAR') => {
    if (!selectedMemberId || selectedMemberIsLeadership) return;

    let targetPermissions: Permission[] = [];
    if (preset === 'ADMIN') {
      targetPermissions = [
        'activity.read',
        'storage.read',
        'storage.backup',
        'storage.recover',
        'system.admin',
        'content.approve',
        'content.delete',
        'accounts.create',
        'accounts.update',
        'accounts.delete',
      ];
    } else if (preset === 'OPERATIONS') {
      targetPermissions = [
        'content.approve',
        'accounts.create',
        'accounts.update',
        'calendar.create',
        'calendar.update',
        'tasks.create',
        'tasks.update',
      ];
    } else if (preset === 'AUDIT') {
      targetPermissions = ['activity.read', 'analytics.read', 'system.admin'];
    } else if (preset === 'CLEAR') {
      targetPermissions = [];
    }

    setMemberPermissions((prev) => ({
      ...prev,
      [selectedMemberId]: targetPermissions,
    }));

    toastInfo(`Applied preset. Click "Save Access Changes" to persist.`);
  };

  // Save changes to server
  const handleSave = async () => {
    if (!selectedMemberId || selectedMemberIsLeadership) return;

    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) return;

      const permsToSave = memberPermissions[selectedMemberId] || [];

      const res = await fetch('/api/admin/access-control', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memberId: selectedMemberId,
          customPermissions: permsToSave,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || 'Failed to save access permissions');
      }

      // Update local baseline
      setInitialPermissions((prev) => ({
        ...prev,
        [selectedMemberId]: [...permsToSave],
      }));

      // Update members list
      setMembers((prev) =>
        prev.map((m) =>
          m.id === selectedMemberId ? { ...m, customPermissions: permsToSave } : m
        )
      );

      // Refresh client permissions
      await refreshAuthMe();

      success(`Access updated for ${selectedMember?.name || 'team member'}!`);
    } catch (err) {
      console.error('Failed to save access changes:', err);
      toastError(err instanceof Error ? err.message : 'Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  // Revert changes for selected member
  const handleReset = () => {
    if (!selectedMemberId) return;
    setMemberPermissions((prev) => ({
      ...prev,
      [selectedMemberId]: [...(initialPermissions[selectedMemberId] || [])],
    }));
  };

  // Guard: Only Owner and Manager can view or access this interface
  if (permissionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[rgb(var(--primary))]" />
        <p className="text-sm text-[rgb(var(--text-muted))]">Loading access control settings…</p>
      </div>
    );
  }

  if (!isOwnerOrManager) {
    return (
      <AccessRestrictedCard
        featureName="Access Management & Permissions"
        description="Only the Owner (theshivaaysoul@gmail.com) and Manager (teamofkira@gmail.com) can grant access or configure permissions for agency members."
      />
    );
  }

  const customGrantsCount = Object.values(memberPermissions).filter((p) => p && p.length > 0).length;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Leadership Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[rgb(var(--primary))] to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
            <KeyRound size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[rgb(var(--text-primary))] tracking-tight">
                Team Access Control
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] border border-[rgb(var(--primary))]/20">
                Owner & Manager
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-1">
              Grant or revoke separate access to different agency features, operational tools, and administrative modules for individual team members.
            </p>
          </div>
        </div>

        {/* Current Active Leader Badge */}
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-right">
            <div className="text-xs font-bold text-[rgb(var(--text-primary))] flex items-center gap-1">
              <ShieldCheck size={13} className="text-[rgb(var(--primary))]" />
              <span>{role === 'OWNER' ? 'Owner Session' : 'Manager Session'}</span>
            </div>
            <div className="text-[10px] text-[rgb(var(--text-muted))] font-mono">
              {user?.email}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <div className="text-xs text-[rgb(var(--text-muted))] font-medium">Total Team Members</div>
            <div className="text-xl font-bold text-[rgb(var(--text-primary))]">{members.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-xs text-[rgb(var(--text-muted))] font-medium">Custom Access Grants</div>
            <div className="text-xl font-bold text-[rgb(var(--text-primary))]">{customGrantsCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <div className="text-xs text-[rgb(var(--text-muted))] font-medium">Configurable Modules</div>
            <div className="text-xl font-bold text-[rgb(var(--text-primary))]">{ACCESS_OPTION_MODULES.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-xs text-[rgb(var(--text-muted))] font-medium">Security Mode</div>
            <div className="text-xs font-bold text-emerald-500">Strict Leadership Control</div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Member List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="p-4 rounded-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">Team Members</h2>
              <span className="text-xs text-[rgb(var(--text-muted))]">{filteredMembers.length} shown</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--text-muted))]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member by name or email…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--primary))]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'ALL'
                    ? 'bg-[rgb(var(--primary))] text-white'
                    : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('CUSTOM')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'CUSTOM'
                    ? 'bg-[rgb(var(--primary))] text-white'
                    : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                }`}
              >
                Custom Grants
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('MEMBERS')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterMode === 'MEMBERS'
                    ? 'bg-[rgb(var(--primary))] text-white'
                    : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                }`}
              >
                Members
              </button>
            </div>

            {/* Scrollable List */}
            <div className="flex flex-col gap-1.5 max-h-[560px] overflow-y-auto pr-1">
              {loading && members.length === 0 ? (
                <div className="py-8 text-center text-xs text-[rgb(var(--text-muted))] flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Loading members…</span>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-[rgb(var(--text-muted))]">
                  No matching team members found.
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isSelected = member.id === selectedMemberId;
                  const isLeader = member.role === 'OWNER' || member.role === 'MANAGER';
                  const customPerms = memberPermissions[member.id] || [];

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelectedMemberId(member.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 border ${
                        isSelected
                          ? 'bg-[rgb(var(--primary))]/10 border-[rgb(var(--primary))]/40 shadow-sm'
                          : 'bg-[rgb(var(--bg-surface))] border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-subtle))]'
                      }`}
                    >
                      <Avatar
                        src={member.avatarUrl}
                        name={member.name || member.email}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[rgb(var(--text-primary))] truncate">
                            {member.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                              isLeader
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] border border-[rgb(var(--border))]'
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--text-muted))] truncate">
                          {member.email}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[10px]">
                          {isLeader ? (
                            <span className="text-purple-400 font-semibold flex items-center gap-1">
                              <ShieldCheck size={11} />
                              Unrestricted Full Access
                            </span>
                          ) : customPerms.length > 0 ? (
                            <span className="text-[rgb(var(--primary))] font-semibold flex items-center gap-1">
                              <Sparkles size={11} />
                              {customPerms.length} Separate Grants
                            </span>
                          ) : (
                            <span className="text-[rgb(var(--text-muted))]">
                              Default Member Access
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`shrink-0 transition-transform ${
                          isSelected ? 'text-[rgb(var(--primary))] translate-x-0.5' : 'text-[rgb(var(--text-muted))] opacity-40'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Permission Matrix Workspace (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {selectedMember ? (
            <div className="p-6 rounded-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] shadow-sm flex flex-col gap-6">
              {/* Selected Member Header Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[rgb(var(--border))]">
                <div className="flex items-center gap-3.5">
                  <Avatar
                    src={selectedMember.avatarUrl}
                    name={selectedMember.name || selectedMember.email}
                    size="lg"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">
                        {selectedMember.name}
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))]">
                        {selectedMember.role}
                      </span>
                      {selectedMember.status === 'ACTIVE' ? (
                        <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-500">
                          {selectedMember.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[rgb(var(--text-muted))] font-mono mt-0.5">
                      {selectedMember.email}
                    </p>
                  </div>
                </div>

                {/* Save and Actions */}
                {!selectedMemberIsLeadership && (
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={saving}
                        className="btn-ghost px-3 py-1.5 text-xs font-semibold rounded-xl text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] flex items-center gap-1.5"
                      >
                        <RotateCcw size={14} />
                        Discard
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !hasUnsavedChanges}
                      className={`btn-primary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all ${
                        hasUnsavedChanges
                          ? 'ring-2 ring-[rgb(var(--primary))]/30 hover:scale-105'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={14} />
                          <span>Save Access Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Leadership Callout if Owner or Manager selected */}
              {selectedMemberIsLeadership ? (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-start gap-3">
                  <ShieldCheck size={20} className="text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-purple-200">
                      Leadership Account — Permanently Unrestricted
                    </p>
                    <p className="text-purple-300/80 leading-relaxed">
                      {selectedMember.role === 'OWNER'
                        ? `The Agency Owner (${KIRA_OWNER_EMAIL}) permanently retains unrestricted access across all systems.`
                        : `The Agency Manager (${KIRA_MANAGER_EMAIL}) permanently retains unrestricted access across all systems.`}
                      Individual permissions cannot be revoked from leadership roles.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Quick Preset Buttons */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))] flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-500" />
                        Quick Access Presets
                      </span>
                      <span className="text-[11px] text-[rgb(var(--text-muted))]">
                        Select a preset or toggle options separately below
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => applyPreset('ADMIN')}
                        className="p-2.5 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]/40 hover:bg-[rgb(var(--primary))]/5 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-[rgb(var(--text-primary))]">
                          Full Admin Tier
                        </div>
                        <div className="text-[10px] text-[rgb(var(--text-muted))] mt-0.5">
                          Activity + Infra + Audits
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('OPERATIONS')}
                        className="p-2.5 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]/40 hover:bg-[rgb(var(--primary))]/5 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-[rgb(var(--text-primary))]">
                          Operations Lead
                        </div>
                        <div className="text-[10px] text-[rgb(var(--text-muted))] mt-0.5">
                          Approve + Manage Ops
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('AUDIT')}
                        className="p-2.5 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] hover:border-[rgb(var(--primary))]/40 hover:bg-[rgb(var(--primary))]/5 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-[rgb(var(--text-primary))]">
                          Auditor & Analyst
                        </div>
                        <div className="text-[10px] text-[rgb(var(--text-muted))] mt-0.5">
                          Activity + Diagnostics
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('CLEAR')}
                        className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/15 hover:border-red-500/30 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-red-400">
                          Reset Default
                        </div>
                        <div className="text-[10px] text-red-400/70 mt-0.5">
                          Standard Member only
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Separate Option Modules Grid */}
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                        Configurable Option Access
                      </span>
                      <span className="text-[11px] text-[rgb(var(--text-muted))]">
                        Toggle on to grant access, toggle off to revoke
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ACCESS_OPTION_MODULES.map((opt) => {
                        const enabled = isOptionModuleEnabled(opt);
                        const IconComponent = ICON_MAP[opt.icon] || ShieldCheck;
                        const isRestrictedFeature = opt.restrictedByRole;

                        return (
                          <div
                            key={opt.id}
                            onClick={() => toggleOptionModule(opt)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                              enabled
                                ? 'bg-[rgb(var(--bg-subtle))] border-[rgb(var(--primary))]/50 shadow-sm'
                                : 'bg-[rgb(var(--bg-surface))] border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-subtle))]/60 opacity-80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                    enabled
                                      ? 'bg-[rgb(var(--primary))] text-white shadow-sm'
                                      : 'bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-muted))] border border-[rgb(var(--border))]'
                                  }`}
                                >
                                  <IconComponent size={18} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[rgb(var(--text-primary))] truncate">
                                      {opt.name}
                                    </span>
                                    {isRestrictedFeature && (
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                        Restricted
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[rgb(var(--text-muted))] mt-1 leading-snug line-clamp-2">
                                    {opt.description}
                                  </p>
                                </div>
                              </div>

                              {/* Toggle Switch */}
                              <div className="shrink-0 pt-0.5">
                                <div
                                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                                    enabled ? 'bg-[rgb(var(--primary))]' : 'bg-neutral-700/60'
                                  }`}
                                >
                                  <div
                                    className={`w-5 h-5 rounded-full bg-white transition-transform shadow-md ${
                                      enabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Permissions tags footer */}
                            <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-[rgb(var(--border))]/50">
                              <span className="text-[10px] text-[rgb(var(--text-muted))] font-medium">
                                Grants:
                              </span>
                              {opt.permissions.map((p) => (
                                <span
                                  key={p}
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] border border-[rgb(var(--border))]"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Advanced Granular Permissions Accordion */}
                  <div className="pt-2 border-t border-[rgb(var(--border))]">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs font-semibold text-[rgb(var(--primary))] hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lock size={13} />
                      <span>{showAdvanced ? 'Hide' : 'Show'} Fine-Grained Permission Checkboxes</span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-3 p-4 rounded-xl bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))]">
                          <Info size={14} className="shrink-0" />
                          <span>Directly check or uncheck individual system permission strings for advanced tuning.</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {PERMISSIONS.map((perm) => {
                            const isChecked = activePermissions.includes(perm);
                            return (
                              <label
                                key={perm}
                                className="flex items-center gap-2 p-2 rounded-lg bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] text-xs cursor-pointer hover:bg-[rgb(var(--bg-subtle))]"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSinglePermission(perm)}
                                  className="rounded border-[rgb(var(--border))] text-[rgb(var(--primary))] focus:ring-0"
                                />
                                <span className="font-mono text-[10px] text-[rgb(var(--text-primary))] truncate">
                                  {perm}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-[rgb(var(--text-muted))] rounded-2xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))]">
              Select a team member from the left panel to configure their access options.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
