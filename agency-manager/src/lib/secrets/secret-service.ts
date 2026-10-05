// src/lib/secrets/secret-service.ts
// Phase 15 — Secrets Management
//
// SERVER-SIDE ONLY — never import this from client components.
//
// Retrieves credentials from environment variables (local dev) or
// Google Cloud Secret Manager (production).
//
// STRICT RULES:
//  - Secrets are NEVER returned through API responses
//  - Secrets are NEVER stored in GCS JSON files
//  - Secrets are NEVER logged in ActivityLog metadata
//  - NEXT_PUBLIC_* env vars are NEVER used for private credentials
//  - If a secret is unavailable → return controlled 'unavailable' state
//    NEVER use demo/fake/placeholder tokens

export type SecretAvailability = 'available' | 'unavailable' | 'error';

export interface SecretStatus {
  availability: SecretAvailability;
  /** Human-readable description — never includes the secret value */
  description: string;
}

export interface SecretHandle {
  /** Opaque reference — resolved at runtime, never exposed to client */
  ref: string;
}

export class SecretNotAvailableError extends Error {
  readonly integration: string;
  constructor(integration: string, detail?: string) {
    super(
      `Integration credentials are not configured for "${integration}".` +
      (detail ? ` ${detail}` : '')
    );
    this.name = 'SecretNotAvailableError';
    this.integration = integration;
  }
}

// ─── Secret Service ───────────────────────────────────────────────────────────

export class SecretService {
  /**
   * Retrieve a secret value by environment variable name.
   *
   * In local development: reads from process.env (populated via .env.local).
   * In production: should be extended to read from Google Cloud Secret Manager.
   *
   * NEVER returns the secret through any API response.
   * NEVER logs the secret value.
   * Returns undefined if not available — callers must handle this gracefully.
   */
  getSecret(envVarName: string): string | undefined {
    // Prevent accidental use of NEXT_PUBLIC_ prefixed vars for private credentials
    if (envVarName.startsWith('NEXT_PUBLIC_')) {
      console.error(
        `[SecretService] SECURITY: Attempted to use "${envVarName}" as a private secret. ` +
        'NEXT_PUBLIC_* variables are exposed to the browser and must NEVER store credentials.'
      );
      return undefined;
    }
    return process.env[envVarName];
  }

  /**
   * Check whether a secret is available without revealing its value.
   */
  checkSecret(envVarName: string): SecretStatus {
    if (envVarName.startsWith('NEXT_PUBLIC_')) {
      return {
        availability: 'error',
        description: `"${envVarName}" is a public browser variable and cannot store private credentials.`,
      };
    }
    const value = process.env[envVarName];
    if (!value || value.trim() === '') {
      return {
        availability: 'unavailable',
        description: `Environment variable "${envVarName}" is not set. Configure it in .env.local or Secret Manager.`,
      };
    }
    return {
      availability: 'available',
      description: `"${envVarName}" is configured.`,
    };
  }

  /**
   * Require a secret — throws SecretNotAvailableError if missing.
   * Callers should catch this and return a controlled unavailable state
   * to the API response (never the error detail).
   */
  requireSecret(envVarName: string, integration: string): string {
    const value = this.getSecret(envVarName);
    if (!value || value.trim() === '') {
      throw new SecretNotAvailableError(integration);
    }
    return value;
  }

  /**
   * Check the availability of all secrets for a named integration.
   * Returns a summary per required variable — never their values.
   *
   * Example:
   *   secretService.checkIntegration('Instagram', {
   *     clientId: 'INSTAGRAM_CLIENT_ID',
   *     clientSecret: 'INSTAGRAM_CLIENT_SECRET',
   *   })
   */
  checkIntegration(
    integrationName: string,
    requiredVars: Record<string, string>
  ): {
    integrationName: string;
    available: boolean;
    secrets: Record<string, SecretStatus>;
    unavailableReason?: string;
  } {
    const secrets: Record<string, SecretStatus> = {};
    let allAvailable = true;

    for (const [role, envVar] of Object.entries(requiredVars)) {
      const status = this.checkSecret(envVar);
      secrets[role] = status;
      if (status.availability !== 'available') allAvailable = false;
    }

    return {
      integrationName,
      available: allAvailable,
      secrets,
      ...(!allAvailable
        ? {
            unavailableReason: `Integration credentials are not configured. ` +
              `Set the required environment variables in .env.local or Google Cloud Secret Manager.`,
          }
        : {}),
    };
  }

  /**
   * Validate that required env vars are set at startup.
   * Logs warnings for missing optional integrations.
   * Does NOT crash the application — each integration degrades gracefully.
   */
  validateIntegrationsAtStartup(
    integrations: Array<{
      name: string;
      required: boolean;
      vars: Record<string, string>;
    }>
  ): void {
    for (const integration of integrations) {
      const result = this.checkIntegration(integration.name, integration.vars);
      if (!result.available) {
        if (integration.required) {
          console.error(
            `[SecretService] REQUIRED integration "${integration.name}" is not configured. ` +
            'Application will start but this integration will be unavailable.'
          );
        } else {
          console.warn(
            `[SecretService] Optional integration "${integration.name}" is not configured — ` +
            'it will show as unavailable.'
          );
        }
      }
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _secretService: SecretService | null = null;

export function getSecretService(): SecretService {
  if (!_secretService) _secretService = new SecretService();
  return _secretService;
}
