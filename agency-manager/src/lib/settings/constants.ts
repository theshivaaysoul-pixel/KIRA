// src/lib/settings/constants.ts
// Pure constants and validators for agency settings (browser-safe, zero server dependencies)

export const SUPPORTED_DATE_FORMATS = [
  'YYYY-MM-DD',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'DD.MM.YYYY',
] as const;

export type SupportedDateFormat = (typeof SUPPORTED_DATE_FORMATS)[number];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English (US/UK)' },
] as const;

export const COMMON_TIMEZONES = [
  'UTC',
  'Europe/Amsterdam',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Calcutta',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

/**
 * Validate whether a string is a recognized IANA timezone identifier.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
