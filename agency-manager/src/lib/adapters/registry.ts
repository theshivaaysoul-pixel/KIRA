// src/lib/adapters/registry.ts
// Phase 13 — Platform Adapter Registry
//
// Central registry mapping platform slugs → adapter instances.
// Business logic routes through this registry — never uses if/switch on platform names.
//
// In Phase 13 no real adapters are registered (none are implemented yet).
// When a slug has no registered adapter, the registry returns a clear
// "adapter not configured" state — it NEVER pretends the platform is supported.

import type { IPlatformAdapter } from './types';

export class AdapterRegistry {
  private readonly adapters = new Map<string, IPlatformAdapter>();

  /**
   * Register an adapter for a platform slug.
   * Throws if an adapter for that slug is already registered
   * (prevents silent duplicate registration).
   */
  register(adapter: IPlatformAdapter): void {
    if (this.adapters.has(adapter.platformSlug)) {
      throw new Error(
        `[AdapterRegistry] An adapter for platform slug "${adapter.platformSlug}" is already registered. ` +
        `Deregister it first before registering a replacement.`
      );
    }
    this.adapters.set(adapter.platformSlug, adapter);
  }

  /**
   * Replace an existing adapter (for hot-swapping in tests or upgrades).
   */
  replace(adapter: IPlatformAdapter): void {
    this.adapters.set(adapter.platformSlug, adapter);
  }

  /**
   * Retrieve an adapter for the given platform slug.
   * Returns null if no adapter is configured — NEVER throws.
   * Callers must check for null and surface "adapter not configured" state.
   */
  get(platformSlug: string): IPlatformAdapter | null {
    return this.adapters.get(platformSlug) ?? null;
  }

  /**
   * Check whether a registered adapter supports a specific capability.
   * Returns false (not throws) for unknown slugs or unsupported capabilities.
   */
  supportsCapability(
    platformSlug: string,
    capability: IPlatformAdapter['supportedCapabilities'][number]
  ): boolean {
    const adapter = this.adapters.get(platformSlug);
    if (!adapter) return false;
    return (adapter.supportedCapabilities as readonly string[]).includes(capability);
  }

  /**
   * List all currently registered platform slugs (for diagnostics/admin UI).
   */
  registeredSlugs(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Remove a registered adapter (used in test teardown).
   */
  deregister(platformSlug: string): void {
    this.adapters.delete(platformSlug);
  }
}

// ─── Singleton registry ───────────────────────────────────────────────────────

let _registry: AdapterRegistry | null = null;

/**
 * Get the global adapter registry singleton.
 * Real adapters are registered in their own module initializers.
 * The registry is empty until adapters are explicitly registered.
 */
export function getAdapterRegistry(): AdapterRegistry {
  if (!_registry) {
    _registry = new AdapterRegistry();
    // Phase 13: No real adapters registered yet.
    // Future adapters will call getAdapterRegistry().register(new InstagramAdapter())
    // in their own initializer files.
  }
  return _registry;
}

/**
 * Reset the registry — ONLY for use in automated tests.
 * Must never be called from production code paths.
 */
export function _resetRegistryForTestsOnly(): void {
  _registry = null;
}
