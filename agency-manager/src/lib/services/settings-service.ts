// src/lib/services/settings-service.ts
// Phase 18 — Agency Settings Service
//
// Manages real KIRA Agency Settings:
// - Agency Name (validated, non-empty, safe text)
// - Logo URL / Branding
// - Timezone (strictly validated IANA timezone)
// - Language (honestly reports currently supported locale)
// - Date Format (supported UI format conventions)
// - Activity Log on change (SETTINGS_UPDATED with safe diff only, no secrets)

import { getRepositories, type Repositories } from '../repositories/index';
import type { AgencySettings } from '../types/domain';
import { z } from 'zod';

export * from '../settings/constants';
import {
  SUPPORTED_DATE_FORMATS,
  SUPPORTED_LANGUAGES,
  isValidIanaTimezone,
} from '../settings/constants';

export const UpdateAgencySettingsSchema = z.object({
  agencyName: z
    .string()
    .trim()
    .min(1, 'Agency name is required')
    .max(100, 'Agency name must not exceed 100 characters')
    .refine((val) => !/[<>]/.test(val), 'Agency name must not contain HTML tags')
    .optional(),
  logoUrl: z
    .string()
    .trim()
    .max(500, 'Logo URL must not exceed 500 characters')
    .refine((val) => val === '' || val.startsWith('/') || /^https?:\/\//i.test(val), {
      message: 'Logo must be a valid http(s) URL or relative path (e.g. /logo.png)',
    })
    .optional(),
  timezone: z
    .string()
    .trim()
    .refine((tz) => isValidIanaTimezone(tz), {
      message: 'Must be a valid IANA timezone identifier (e.g. Europe/Amsterdam, Asia/Kolkata)',
    })
    .optional(),
  language: z
    .string()
    .trim()
    .refine((lang) => SUPPORTED_LANGUAGES.some((l) => l.code === lang), {
      message: 'Currently only English ("en") is supported. Additional localizations require translation assets.',
    })
    .optional(),
  dateFormat: z
    .string()
    .trim()
    .refine((df) => (SUPPORTED_DATE_FORMATS as readonly string[]).includes(df), {
      message: `Invalid date format. Supported formats: ${SUPPORTED_DATE_FORMATS.join(', ')}`,
    })
    .optional(),
});

export type UpdateAgencySettingsInput = z.infer<typeof UpdateAgencySettingsSchema>;

export class SettingsService {
  private readonly repos: Repositories;

  constructor(repos: Repositories = getRepositories()) {
    this.repos = repos;
  }

  /**
   * Retrieve current agency settings singleton.
   */
  async getSettings(): Promise<AgencySettings> {
    return this.repos.settings.getSettings();
  }

  /**
   * Update agency settings with validation and audit logging.
   */
  async updateSettings(
    input: UpdateAgencySettingsInput,
    updatedBy: { id: string; email?: string }
  ): Promise<AgencySettings> {
    const validated = UpdateAgencySettingsSchema.parse(input);

    const current = await this.getSettings();

    // Compute safe change diff for ActivityLog
    const safeDiff: Record<string, { from: unknown; to: unknown }> = {};
    if (validated.agencyName !== undefined && validated.agencyName !== current.agencyName) {
      safeDiff.agencyName = { from: current.agencyName, to: validated.agencyName };
    }
    if (validated.logoUrl !== undefined && validated.logoUrl !== current.logoUrl) {
      safeDiff.logoUrl = { from: current.logoUrl || null, to: validated.logoUrl };
    }
    if (validated.timezone !== undefined && validated.timezone !== current.timezone) {
      safeDiff.timezone = { from: current.timezone, to: validated.timezone };
    }
    if (validated.language !== undefined && validated.language !== current.language) {
      safeDiff.language = { from: current.language, to: validated.language };
    }
    if (validated.dateFormat !== undefined && validated.dateFormat !== current.dateFormat) {
      safeDiff.dateFormat = { from: current.dateFormat, to: validated.dateFormat };
    }

    // If nothing changed, return current
    if (Object.keys(safeDiff).length === 0) {
      return current;
    }

    // Persist changes through AgencySettingsRepository (which uses DataSafetyService with read-back verification)
    const updated = await this.repos.settings.updateSettings(validated);

    // Record audit activity log (SETTINGS_UPDATED)
    try {
      await this.repos.activityLogs.log({
        userId: updatedBy.id,
        action: 'SETTINGS_UPDATED',
        entityType: 'AgencySettings',
        entityId: 'settings',
        metadata: {
          changes: safeDiff,
        },
      });
    } catch (logErr) {
      console.warn('[SettingsService] Failed to log activity for SETTINGS_UPDATED:', logErr);
    }

    return updated;
  }
}

let _settingsService: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!_settingsService) {
    _settingsService = new SettingsService();
  }
  return _settingsService;
}
