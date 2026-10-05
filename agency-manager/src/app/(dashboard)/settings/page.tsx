'use client';
// src/app/(dashboard)/settings/page.tsx
// Phase 18 — KIRA Agency Settings Page
//
// Sections:
// 1. Agency — Agency name, Logo URL / preview
// 2. Regional — IANA Timezone, Language (honestly English-only), Date format preview
// 3. Appearance — Theme selector (Dark / Light / System)
//
// Permissions:
// - settings.read required to view
// - settings.update required to save (read-only mode if missing)

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useTheme } from 'next-themes';
import { Avatar } from '@/components/ui/Avatar';
import type { AgencySettings } from '@/lib/types/domain';
import {
  COMMON_TIMEZONES,
  SUPPORTED_DATE_FORMATS,
  isValidIanaTimezone,
  type SupportedDateFormat,
} from '@/lib/settings/constants';
import {
  Globe2,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  RotateCcw,
  Sun,
  Moon,
  Laptop,
  Clock,
  Calendar,
  ShieldAlert,
  MapPin,
  LogOut,
} from 'lucide-react';

export default function SettingsPage() {
  const { getIdToken, user, signOut } = useAuth();
  const { hasPermission, loading: permLoading } = usePermission();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [formData, setFormData] = useState<{
    agencyName: string;
    logoUrl: string;
    timezone: string;
    language: string;
    dateFormat: SupportedDateFormat;
  }>({
    agencyName: '',
    logoUrl: '',
    timezone: 'Asia/Kolkata',
    language: 'en',
    dateFormat: 'YYYY-MM-DD',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentTimeInTz, setCurrentTimeInTz] = useState<string>('');

  const canEdit = hasPermission('settings.update');

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      await signOut();
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out. Please try again.');
      setLoggingOut(false);
    }
  };

  const handleDetectLocation = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && isValidIanaTimezone(detected)) {
        const canonical = detected === 'Asia/Calcutta' ? 'Asia/Kolkata' : detected;
        setFormData((prev) => ({ ...prev, timezone: canonical }));
        setSuccessMessage(`Detected location timezone: ${canonical}`);
        setTimeout(() => setSuccessMessage(null), 3500);
      } else {
        setError('Unable to automatically determine location timezone from browser.');
      }
    } catch {
      setError('Browser does not support automatic timezone detection.');
    }
  };

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getIdToken();
      const res = await fetch('/api/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Failed to fetch settings (HTTP ${res.status})`);
      }

      const json = await res.json();
      const data: AgencySettings = json.data;
      setSettings(data);
      setFormData({
        agencyName: data.agencyName || 'KIRA Agency',
        logoUrl: data.logoUrl || '/logo.png',
        timezone: data.timezone || 'Asia/Kolkata',
        language: data.language || 'en',
        dateFormat: (data.dateFormat as SupportedDateFormat) || 'YYYY-MM-DD',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading settings');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (!permLoading) {
      fetchSettings();
    }
  }, [permLoading, fetchSettings]);

  // Update live preview of time in configured timezone
  useEffect(() => {
    const updateClock = () => {
      if (isValidIanaTimezone(formData.timezone)) {
        try {
          const formatted = new Intl.DateTimeFormat('en-US', {
            timeZone: formData.timezone,
            dateStyle: 'medium',
            timeStyle: 'medium',
          }).format(new Date());
          setCurrentTimeInTz(formatted);
        } catch {
          setCurrentTimeInTz('Invalid Timezone');
        }
      } else {
        setCurrentTimeInTz('Invalid Timezone');
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [formData.timezone]);

  // Format date preview
  const formatSampleDate = (fmt: SupportedDateFormat) => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    switch (fmt) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    // Validate timezone before save
    if (!isValidIanaTimezone(formData.timezone)) {
      setError(`"${formData.timezone}" is not a valid IANA timezone identifier.`);
      return;
    }

    if (!formData.agencyName.trim()) {
      setError('Agency name cannot be blank.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const token = await getIdToken();
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Failed to update settings (HTTP ${res.status})`);
      }

      const json = await res.json();
      setSettings(json.data);
      setSuccessMessage('Settings saved and persisted successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!settings) return;
    setFormData({
      agencyName: settings.agencyName || 'KIRA Agency',
      logoUrl: settings.logoUrl || '/logo.png',
      timezone: settings.timezone || 'Asia/Kolkata',
      language: settings.language || 'en',
      dateFormat: (settings.dateFormat as SupportedDateFormat) || 'YYYY-MM-DD',
    });
    setError(null);
    setSuccessMessage(null);
  };

  const isDirty =
    settings &&
    (formData.timezone !== settings.timezone ||
      formData.language !== settings.language ||
      formData.dateFormat !== settings.dateFormat);

  if (permLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[rgb(var(--primary))]" />
        <p className="text-xs text-[rgb(var(--text-muted))]">Loading agency configuration…</p>
      </div>
    );
  }

  if (!hasPermission('settings.read')) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
        <ShieldAlert className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <h1 className="text-xl font-bold text-red-400 mb-2">403 Forbidden</h1>
        <p className="text-xs text-[rgb(var(--text-muted))]">
          You do not have permission to view agency settings. Contact an administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            Agency Settings
          </h1>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Manage global agency branding, regional localization, and appearance preferences.
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="px-3 py-2 rounded-xl text-xs font-medium border border-[rgb(var(--border))]
                           bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-base))]
                           flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} /> Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[rgb(var(--primary))] text-white
                         hover:opacity-90 transition-opacity shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>Read-only mode: You have permission to view settings, but editing requires <code className="font-mono">settings.update</code>.</span>
        </div>
      )}

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        {/* Section 1: Regional & Localization */}
        <div className="card p-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-5">
          <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] pb-3">
            <Globe2 size={18} className="text-[rgb(var(--primary))]" />
            <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">Regional & Localization</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Timezone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[rgb(var(--text-primary))]">
                  Timezone (IANA Identifier) <span className="text-red-400">*</span>
                </label>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[rgb(var(--kira-purple-light))] hover:text-[rgb(var(--kira-purple))] transition-colors px-2 py-0.5 rounded-md hover:bg-[rgb(var(--bg-base))]"
                    title="Automatically detect timezone from your device location"
                  >
                    <MapPin size={12} />
                    <span>Detect My Location</span>
                  </button>
                )}
              </div>
              <select
                value={(COMMON_TIMEZONES as readonly string[]).includes(formData.timezone) ? formData.timezone : '__custom__'}
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    setFormData({ ...formData, timezone: e.target.value });
                  }
                }}
                disabled={!canEdit}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[rgb(var(--border))]
                           bg-[rgb(var(--bg-base))] text-[rgb(var(--text-primary))] focus:outline-none
                           focus:ring-1 focus:ring-[rgb(var(--primary))] disabled:opacity-60 mb-2"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
                {!(COMMON_TIMEZONES as readonly string[]).includes(formData.timezone) && (
                  <option value="__custom__">Custom: {formData.timezone}</option>
                )}
              </select>

              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value.trim() })}
                disabled={!canEdit}
                placeholder="e.g. Europe/Amsterdam or Asia/Kolkata"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[rgb(var(--border))]
                           bg-[rgb(var(--bg-base))] text-[rgb(var(--text-primary))] focus:outline-none
                           focus:ring-1 focus:ring-[rgb(var(--primary))] font-mono disabled:opacity-60"
              />

              <div className="mt-2 p-2 rounded-lg bg-[rgb(var(--bg-base))] border border-[rgb(var(--border))] flex items-center gap-2 text-[11px]">
                <Clock size={13} className="text-[rgb(var(--primary))]" />
                <span className="text-[rgb(var(--text-muted))]">Live Time in Zone:</span>
                <span className="font-mono font-medium text-[rgb(var(--text-primary))]">
                  {currentTimeInTz}
                </span>
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-1.5">
                System Language
              </label>
              <select
                value={formData.language}
                disabled
                className="w-full px-3 py-2 text-xs rounded-xl border border-[rgb(var(--border))]
                           bg-[rgb(var(--bg-base))] text-[rgb(var(--text-primary))] opacity-75"
              >
                <option value="en">English (US/UK) - Active</option>
              </select>
              <p className="text-[11px] text-[rgb(var(--text-muted))] mt-1.5">
                KIRA operates natively in English. Multi-language catalogs will be enabled when localized translation packs are published.
              </p>
            </div>

            {/* Date Format */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-2">
                Date Display Format
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUPPORTED_DATE_FORMATS.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => canEdit && setFormData({ ...formData, dateFormat: fmt })}
                    disabled={!canEdit}
                    className={`p-3 rounded-xl border text-left transition-all
                      ${
                        formData.dateFormat === fmt
                          ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--text-primary))]'
                          : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-base))]/60'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-[rgb(var(--text-primary))]">{fmt}</span>
                      {formData.dateFormat === fmt && (
                        <CheckCircle2 size={13} className="text-[rgb(var(--primary))]" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-[rgb(var(--text-muted))]">
                      {formatSampleDate(fmt)}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[rgb(var(--text-muted))] mt-2 flex items-center gap-1.5">
                <Calendar size={13} />
                Used across calendar views, task schedules, and publishing timelines.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Appearance */}
        <div className="card p-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-5">
          <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] pb-3">
            <Palette size={18} className="text-[rgb(var(--primary))]" />
            <h2 className="text-sm font-bold text-[rgb(var(--text-primary))]">Appearance & Theme</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[rgb(var(--text-primary))] mb-2">
              Color Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                  ${
                    theme === 'dark'
                      ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                      : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                  }`}
              >
                <Moon size={18} />
                <span className="text-xs font-medium">Dark Mode</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                  ${
                    theme === 'light'
                      ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                      : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                  }`}
              >
                <Sun size={18} />
                <span className="text-xs font-medium">Light Mode</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                  ${
                    theme === 'system'
                      ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]'
                      : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
                  }`}
              >
                <Laptop size={18} />
                <span className="text-xs font-medium">System</span>
              </button>
            </div>
            <p className="text-[11px] text-[rgb(var(--text-muted))] mt-2">
              Personal appearance preference applied across this browser session.
            </p>
          </div>
        </div>

        {/* Section 3: Account & Session */}
        <div className="card p-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar src={user?.photoURL} name={user?.displayName ?? user?.email} size="md" />
              <div>
                <h3 className="text-sm font-bold text-[rgb(var(--text-primary))]">
                  {user?.displayName || 'User Account'}
                </h3>
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={loggingOut}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full
                         bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20
                         hover:border-red-500/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              <LogOut size={15} />
              <span>{loggingOut ? 'Signing out…' : 'Log Out'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
