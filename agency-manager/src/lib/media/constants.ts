// src/lib/media/constants.ts
// Centralized configuration for media types, size limits, and magic byte signatures.
// Single source of truth for Phase 8 GCS Media Manager.

import type { AssetType } from '@/lib/types/domain';

// ─── Supported MIME Types & Categories ─────────────────────────────────────────

export const ALLOWED_MIME_TYPES: Record<string, AssetType> = {
  // Image
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/gif': 'IMAGE',

  // Video
  'video/mp4': 'VIDEO',
  'video/webm': 'VIDEO',
  'video/quicktime': 'VIDEO',

  // Audio
  'audio/mpeg': 'AUDIO',
  'audio/wav': 'AUDIO',
  'audio/ogg': 'AUDIO',
  'audio/webm': 'AUDIO',

  // Document
  'application/pdf': 'DOCUMENT',
};

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
};

// ─── Configurable File Size Limits ────────────────────────────────────────────

function parseEnvLimit(envVar: string | undefined, defaultBytes: number): number {
  if (!envVar) return defaultBytes;
  const parsed = parseInt(envVar, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultBytes;
}

export function getFileLimits() {
  return {
    IMAGE: parseEnvLimit(process.env.MAX_IMAGE_UPLOAD_SIZE, 10 * 1024 * 1024), // 10MB
    VIDEO: parseEnvLimit(process.env.MAX_VIDEO_UPLOAD_SIZE, 50 * 1024 * 1024), // 50MB
    AUDIO: parseEnvLimit(process.env.MAX_AUDIO_UPLOAD_SIZE, 25 * 1024 * 1024), // 25MB
    DOCUMENT: parseEnvLimit(process.env.MAX_DOCUMENT_UPLOAD_SIZE, 20 * 1024 * 1024), // 20MB
    OTHER: parseEnvLimit(process.env.MAX_IMAGE_UPLOAD_SIZE, 10 * 1024 * 1024),
    THUMBNAIL: 2 * 1024 * 1024, // 2MB
  };
}

// ─── Magic Bytes / File Signatures ────────────────────────────────────────────

export interface MagicSignature {
  mime: string;
  offset: number;
  bytes: number[];
  mask?: number[];
}

export const MAGIC_SIGNATURES: MagicSignature[] = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },

  // GIF: GIF87a or GIF89a
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },

  // WebP: RIFF .... WEBP
  { mime: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF at 0, verified with WEBP at 8

  // PDF: %PDF
  { mime: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },

  // MP4 / MOV: ....ftyp or ....moov
  { mime: 'video/mp4', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // 'ftyp'
  { mime: 'video/quicktime', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { mime: 'video/quicktime', offset: 4, bytes: [0x6d, 0x6f, 0x6f, 0x76] }, // 'moov'

  // WebM / Matroska: 1A 45 DF A3
  { mime: 'video/webm', offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { mime: 'audio/webm', offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },

  // MP3: ID3 or sync frame FF FB / FF F3 / FF F2
  { mime: 'audio/mpeg', offset: 0, bytes: [0x49, 0x44, 0x33] }, // 'ID3'
  { mime: 'audio/mpeg', offset: 0, bytes: [0xff, 0xfb] },
  { mime: 'audio/mpeg', offset: 0, bytes: [0xff, 0xf3] },
  { mime: 'audio/mpeg', offset: 0, bytes: [0xff, 0xf2] },

  // WAV: RIFF .... WAVE
  { mime: 'audio/wav', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },

  // OGG: OggS
  { mime: 'audio/ogg', offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
];

/**
 * Validate that buffer magic bytes match the claimed MIME type.
 * Returns true if the buffer matches any known valid signature for that MIME,
 * or false if it contradicts.
 */
export function validateMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  if (buffer.length < 4) return false;

  // Check special cases with secondary offsets
  if (claimedMime === 'image/webp') {
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  if (claimedMime === 'audio/wav') {
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWave = buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45;
    return isRiff && isWave;
  }

  const matchingSigs = MAGIC_SIGNATURES.filter((s) => s.mime === claimedMime);
  if (matchingSigs.length === 0) {
    // If no explicit signature registered for this allowed MIME, check it's not an executable/script
    return !isExecutableOrScript(buffer);
  }

  return matchingSigs.some((sig) => {
    if (buffer.length < sig.offset + sig.bytes.length) return false;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) return false;
    }
    return true;
  });
}

/**
 * Reject common dangerous binary signatures regardless of claimed extension or MIME.
 */
export function isExecutableOrScript(buffer: Buffer): boolean {
  if (buffer.length < 2) return false;

  // DOS MZ executable (.exe, .dll)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return true;

  // ELF binary (Linux executable)
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return true;
  }

  // Mach-O binary (macOS executable)
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && (buffer[3] === 0xce || buffer[3] === 0xcf)) ||
      (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe))
  ) {
    return true;
  }

  // Shell script: #!
  if (buffer[0] === 0x23 && buffer[1] === 0x21) return true;

  // HTML / XML / SVG tags at start (prevents stored XSS via fake image)
  const headerText = buffer.subarray(0, Math.min(buffer.length, 128)).toString('utf8').trim().toLowerCase();
  if (
    headerText.startsWith('<!doctype html') ||
    headerText.startsWith('<html') ||
    headerText.startsWith('<script') ||
    headerText.startsWith('<?php') ||
    headerText.startsWith('<svg') ||
    headerText.includes('<?xml') && headerText.includes('<svg')
  ) {
    return true;
  }

  return false;
}

// ─── Filename Sanitization ───────────────────────────────────────────────────

export function sanitizeFileName(rawName: string): { safeFileName: string; extension: string } {
  // Remove null bytes and control characters
  let clean = rawName.replace(/[\x00-\x1f\x7f]/g, '').trim();

  // Strip path traversal attempts: slashes, backslashes, leading dots
  clean = clean.replace(/\\/g, '/');
  clean = clean.split('/').pop() || 'unnamed_file';
  clean = clean.replace(/^\.+/, ''); // strip leading dots (e.g. .env, ..)

  // Separate extension
  const lastDot = clean.lastIndexOf('.');
  let base = lastDot > 0 ? clean.substring(0, lastDot) : clean;
  let ext = lastDot > 0 ? clean.substring(lastDot + 1).toLowerCase() : '';

  // Sanitize base: allow alphanumeric, hyphens, underscores
  base = base.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
  if (!base) base = 'asset';

  // Sanitize ext: only alphanumeric
  ext = ext.replace(/[^a-z0-9]/g, '').substring(0, 10);

  const safeFileName = ext ? `${base}.${ext}` : base;
  return { safeFileName, extension: ext };
}
