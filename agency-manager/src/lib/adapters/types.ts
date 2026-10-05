// src/lib/adapters/types.ts
// Phase 13 — Platform Adapter Architecture
//
// Defines the strict contract that every platform adapter must implement.
// Generic business logic MUST use these types and capabilities — never
// hard-code "if platform === 'instagram'" throughout the app.
//
// Phase 13 does NOT publish content or perform real platform calls.
// Phase 14 builds on these contracts with the publishing engine.
//
// SECURITY: credentials/tokens are NEVER stored in these types or
// in any GCS JSON file. Phase 15 handles secrets architecture.

import type { PlatformCapability } from '@/lib/types/domain';

// ─── Connection Types ─────────────────────────────────────────────────────────

export type ConnectionStatusCode =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'PENDING'
  | 'NOT_CONFIGURED';

export interface ConnectionStatus {
  code: ConnectionStatusCode;
  /** Human-readable explanation */
  message: string;
  /** ISO timestamp of the last status check */
  checkedAt: string;
}

export interface ConnectionResult {
  success: boolean;
  status: ConnectionStatus;
  /** External account ID as returned by the real platform — never fabricated */
  externalAccountId?: string;
  error?: AdapterError;
}

// ─── Context passed into every adapter call ───────────────────────────────────

export interface AdapterContext {
  /** KIRA internal social account ID */
  socialAccountId: string;
  /** KIRA internal platform ID */
  platformId: string;
  /** Platform slug (e.g. "instagram") — used for routing only, not for conditionals */
  platformSlug: string;
  /**
   * Opaque credential handle — resolved at runtime by SecretService.
   * NEVER a raw token/secret string. NEVER stored in GCS JSON.
   */
  credentialRef?: string;
}

// ─── Publish Types ────────────────────────────────────────────────────────────

export type PublishableContentType =
  | 'text'
  | 'image'
  | 'video'
  | 'carousel'
  | 'story'
  | 'shortVideo';

export interface PublishRequest {
  contentId: string;
  publicationId: string;
  contentType: PublishableContentType;
  caption?: string;
  title?: string;
  /** Resolved GCS asset URLs — NOT raw upload blobs */
  assetUrls: string[];
  /** ISO string — for scheduled posts */
  scheduledAt?: string;
  /** Idempotency key — must be unique per publication attempt */
  idempotencyKey: string;
}

export interface PublishResult {
  success: boolean;
  /** Only set when the platform actually returns a post ID */
  externalPostId?: string;
  /** Only set when the platform returns a URL */
  publishedUrl?: string;
  /** ISO string of real publication time returned by the platform */
  publishedAt?: string;
  error?: AdapterError;
}

export interface PostStatusResult {
  found: boolean;
  externalPostId: string;
  /** Status as reported by the platform */
  platformStatus?: string;
  publishedUrl?: string;
  error?: AdapterError;
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

export interface AdapterAnalyticsResult {
  success: boolean;
  /** Raw metrics as returned by the platform — never fabricated */
  metrics?: {
    followers?: number;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    engagementRate?: number;
  };
  /** ISO timestamp when data was fetched */
  fetchedAt?: string;
  error?: AdapterError;
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export type AdapterErrorCode =
  | 'ADAPTER_NOT_FOUND'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'NOT_CONNECTED'
  | 'CREDENTIALS_MISSING'
  | 'CREDENTIALS_INVALID'
  | 'PLATFORM_ERROR'
  | 'RATE_LIMITED'
  | 'CONTENT_REJECTED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UNKNOWN';

export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
  /** Whether the operation can be safely retried */
  retryable: boolean;
  /** Raw platform error for server-side logging only — NEVER sent to client */
  _internalDetail?: string;
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

/**
 * Every platform integration must implement this interface.
 * Methods return structured results — they never throw on expected failures.
 * Only unexpected runtime errors may throw.
 */
export interface IPlatformAdapter {
  /** Human-readable adapter name */
  readonly name: string;
  /** Platform slug this adapter handles */
  readonly platformSlug: string;
  /** Capabilities this adapter actually supports */
  readonly supportedCapabilities: readonly PlatformCapability[];

  /**
   * Validate that a real external connection exists for the given account.
   * A SocialAccount record alone is NOT sufficient — the adapter must
   * confirm the external connection is live.
   */
  validateConnection(ctx: AdapterContext): Promise<ConnectionStatus>;

  /**
   * Initiate a connection / OAuth flow for an account.
   * Returns a result — never throws on expected auth failures.
   */
  connectAccount(ctx: AdapterContext): Promise<ConnectionResult>;

  /**
   * Disconnect/revoke the external platform connection.
   */
  disconnectAccount(ctx: AdapterContext): Promise<{ success: boolean; error?: AdapterError }>;

  /**
   * Publish content to the external platform.
   * Must only return success when the platform confirms the post.
   * NEVER fabricates externalPostId or publishedUrl.
   */
  publishContent(ctx: AdapterContext, request: PublishRequest): Promise<PublishResult>;

  /**
   * Check the current status of a previously submitted post.
   * Used for verifying idempotency — if a prior publish may have succeeded
   * but the response was lost.
   */
  getPostStatus(ctx: AdapterContext, externalPostId: string): Promise<PostStatusResult>;

  /**
   * Delete a post from the platform.
   */
  deletePost(ctx: AdapterContext, externalPostId: string): Promise<{ success: boolean; error?: AdapterError }>;

  /**
   * Fetch real analytics from the platform for the given account.
   * Returns undefined metrics rather than fabricated values.
   */
  fetchAnalytics(ctx: AdapterContext): Promise<AdapterAnalyticsResult>;
}
