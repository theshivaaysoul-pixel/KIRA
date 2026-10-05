// src/lib/adapters/platform-adapter-service.ts
// Phase 13 — Platform Adapter Service
//
// Routes adapter calls through the registry.
// Validates adapter availability and capability before any call.
// Normalizes errors so the rest of the application never receives raw platform errors.
//
// This service never:
//  - Invents fake connections
//  - Returns fake success for missing adapters
//  - Stores tokens/secrets in domain models or GCS

import { getAdapterRegistry } from './registry';
import type {
  IPlatformAdapter,
  AdapterContext,
  ConnectionStatus,
  ConnectionResult,
  PublishRequest,
  PublishResult,
  PostStatusResult,
  AdapterAnalyticsResult,
  AdapterError,
  AdapterErrorCode,
} from './types';
import type { PlatformCapability } from '@/lib/types/domain';
import { getRepositories } from '@/lib/repositories';

// ─── Service Errors ───────────────────────────────────────────────────────────

export class PlatformAdapterServiceError extends Error {
  readonly code: AdapterErrorCode | 'SERVICE_ERROR';
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: AdapterErrorCode | 'SERVICE_ERROR' = 'SERVICE_ERROR',
    status = 500,
    retryable = false
  ) {
    super(message);
    this.name = 'PlatformAdapterServiceError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function notConfiguredError(platformSlug: string): AdapterError {
  return {
    code: 'ADAPTER_NOT_FOUND',
    message: `Platform adapter is not configured for "${platformSlug}". Connect a supported integration to enable this feature.`,
    retryable: false,
  };
}

function capabilityError(platformSlug: string, capability: PlatformCapability): AdapterError {
  return {
    code: 'CAPABILITY_NOT_SUPPORTED',
    message: `Platform "${platformSlug}" does not support the "${capability}" capability.`,
    retryable: false,
  };
}

// ─── Platform Adapter Service ─────────────────────────────────────────────────

export class PlatformAdapterService {
  private get registry() {
    return getAdapterRegistry();
  }

  private get repos() {
    return getRepositories();
  }

  /**
   * Retrieve a registered adapter or return null.
   * Never throws — always returns null for unconfigured platforms.
   */
  getAdapter(platformSlug: string): IPlatformAdapter | null {
    return this.registry.get(platformSlug);
  }

  /**
   * Check whether an adapter is registered for a platform slug.
   */
  isAdapterAvailable(platformSlug: string): boolean {
    return this.registry.get(platformSlug) !== null;
  }

  /**
   * Get connection status for a SocialAccount.
   * If no adapter is registered: returns NOT_CONFIGURED — never pretends connected.
   */
  async getConnectionStatus(socialAccountId: string): Promise<ConnectionStatus> {
    const account = await this.repos.socialAccounts.findById(socialAccountId);
    if (!account) {
      return {
        code: 'ERROR',
        message: `Social account "${socialAccountId}" not found.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const platform = await this.repos.platforms.findById(account.platformId);
    if (!platform) {
      return {
        code: 'NOT_CONFIGURED',
        message: 'Platform configuration not found.',
        checkedAt: new Date().toISOString(),
      };
    }

    const adapter = this.registry.get(platform.slug);
    if (!adapter) {
      return {
        code: 'NOT_CONFIGURED',
        message: `Platform adapter not configured for "${platform.name}". Integration is not available.`,
        checkedAt: new Date().toISOString(),
      };
    }

    const ctx = this.buildContext(account.id, account.platformId, platform.slug);
    try {
      return await adapter.validateConnection(ctx);
    } catch (err) {
      console.error(`[PlatformAdapterService] validateConnection error for ${socialAccountId}:`, err);
      return {
        code: 'ERROR',
        message: 'Failed to validate connection. Check server logs for details.',
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Initiate account connection.
   * Returns failure result if adapter is unavailable.
   */
  async connectAccount(socialAccountId: string): Promise<ConnectionResult> {
    const { adapter, ctx, error } = await this.resolveAdapterForAccount(
      socialAccountId,
      'publishing'
    );
    if (error || !adapter || !ctx) {
      return {
        success: false,
        status: {
          code: 'NOT_CONFIGURED',
          message: error?.message ?? 'Adapter not configured.',
          checkedAt: new Date().toISOString(),
        },
        error,
      };
    }
    return adapter.connectAccount(ctx);
  }

  /**
   * Disconnect an account from the external platform.
   */
  async disconnectAccount(
    socialAccountId: string
  ): Promise<{ success: boolean; error?: AdapterError }> {
    const { adapter, ctx, error } = await this.resolveAdapterForAccount(
      socialAccountId,
      'publishing'
    );
    if (error || !adapter || !ctx) {
      return { success: false, error };
    }
    return adapter.disconnectAccount(ctx);
  }

  /**
   * Publish content via the platform adapter.
   * Returns FAILED result (never throws) if no adapter is configured.
   */
  async publishContent(
    socialAccountId: string,
    request: PublishRequest
  ): Promise<PublishResult> {
    const { adapter, ctx, error } = await this.resolveAdapterForAccount(
      socialAccountId,
      'publishing'
    );
    if (error || !adapter || !ctx) {
      return { success: false, error };
    }

    // Verify content type capability
    const contentTypeCapability = request.contentType as PlatformCapability;
    if (!this.registry.supportsCapability(ctx.platformSlug, contentTypeCapability)) {
      return {
        success: false,
        error: capabilityError(ctx.platformSlug, contentTypeCapability),
      };
    }

    try {
      return await adapter.publishContent(ctx, request);
    } catch (err) {
      console.error(`[PlatformAdapterService] publishContent error:`, err);
      return {
        success: false,
        error: {
          code: 'PLATFORM_ERROR',
          message: 'Publishing failed due to an unexpected error. Check server logs.',
          retryable: true,
        },
      };
    }
  }

  /**
   * Check post status (for idempotency verification).
   */
  async getPostStatus(
    socialAccountId: string,
    externalPostId: string
  ): Promise<PostStatusResult> {
    const { adapter, ctx, error } = await this.resolveAdapterForAccount(
      socialAccountId,
      'publishing'
    );
    if (error || !adapter || !ctx) {
      return {
        found: false,
        externalPostId,
        error,
      };
    }
    return adapter.getPostStatus(ctx, externalPostId);
  }

  /**
   * Fetch real analytics from the platform adapter.
   * Returns unavailable state if adapter not configured.
   */
  async fetchAnalytics(socialAccountId: string): Promise<AdapterAnalyticsResult> {
    const { adapter, ctx, error } = await this.resolveAdapterForAccount(
      socialAccountId,
      'analytics'
    );
    if (error || !adapter || !ctx) {
      return { success: false, error };
    }
    try {
      return await adapter.fetchAnalytics(ctx);
    } catch (err) {
      console.error(`[PlatformAdapterService] fetchAnalytics error:`, err);
      return {
        success: false,
        error: {
          code: 'PLATFORM_ERROR',
          message: 'Failed to fetch analytics from platform.',
          retryable: false,
        },
      };
    }
  }

  /**
   * List which registered adapters are available and for which slugs.
   */
  getAvailableAdapters(): { platformSlug: string; name: string; capabilities: readonly PlatformCapability[] }[] {
    return this.registry.registeredSlugs().map((slug) => {
      const adapter = this.registry.get(slug)!;
      return {
        platformSlug: slug,
        name: adapter.name,
        capabilities: adapter.supportedCapabilities,
      };
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async resolveAdapterForAccount(
    socialAccountId: string,
    requiredCapability: PlatformCapability
  ): Promise<{
    adapter: IPlatformAdapter | null;
    ctx: AdapterContext | null;
    error?: AdapterError;
  }> {
    const account = await this.repos.socialAccounts.findById(socialAccountId);
    if (!account) {
      return {
        adapter: null,
        ctx: null,
        error: {
          code: 'ADAPTER_NOT_FOUND',
          message: `Social account "${socialAccountId}" not found.`,
          retryable: false,
        },
      };
    }

    const platform = await this.repos.platforms.findById(account.platformId);
    if (!platform) {
      return {
        adapter: null,
        ctx: null,
        error: {
          code: 'ADAPTER_NOT_FOUND',
          message: 'Platform not found for this account.',
          retryable: false,
        },
      };
    }

    const adapter = this.registry.get(platform.slug);
    if (!adapter) {
      return {
        adapter: null,
        ctx: null,
        error: notConfiguredError(platform.slug),
      };
    }

    if (!this.registry.supportsCapability(platform.slug, requiredCapability)) {
      return {
        adapter: null,
        ctx: null,
        error: capabilityError(platform.slug, requiredCapability),
      };
    }

    const ctx = this.buildContext(account.id, account.platformId, platform.slug);
    return { adapter, ctx };
  }

  private buildContext(
    socialAccountId: string,
    platformId: string,
    platformSlug: string
  ): AdapterContext {
    // credentialRef is resolved at runtime by SecretService (Phase 15)
    // NEVER a raw token — never stored in GCS JSON
    return {
      socialAccountId,
      platformId,
      platformSlug,
      // credentialRef will be populated by SecretService in Phase 15
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _service: PlatformAdapterService | null = null;

export function getPlatformAdapterService(): PlatformAdapterService {
  if (!_service) _service = new PlatformAdapterService();
  return _service;
}
