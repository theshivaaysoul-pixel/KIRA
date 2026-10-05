// src/lib/services/platform-audit-service.ts
// Phase 20 — Dynamic Platform Test & Audit Service
//
// Comprehensive administrator-facing audit system for the dynamic platform architecture.
// Verifies that future platforms can be added through configuration/adapter architecture
// without hard-coding platform-specific generic logic.
//
// CRITICAL RULES:
//  - Zero mock data; operates on real Platform and SocialAccount records from storage
//  - Never infer adapter availability from platform name
//  - If no adapter exists, external connection is explicitly "NOT_VERIFIABLE"
//  - Never show "All platforms healthy", "Connected", or "Publishing Ready" without real evidence
//  - Zero fake accounts or fake analytics snapshots
//  - Logs PLATFORM_AUDIT_RUN with zero secrets/tokens

import { getRepositories, type Repositories } from '../repositories';
import { getAdapterRegistry, type AdapterRegistry } from '../adapters/registry';
import {
  PLATFORM_CAPABILITIES,
  type Platform,
  type PlatformCapability,
  type SocialAccount,
} from '../types/domain';
import { CreatePlatformSchema } from '../validation';
import fs from 'fs';
import path from 'path';

export type AdapterAuditStatus = 'CONFIGURED' | 'PARTIALLY_SUPPORTED' | 'UNAVAILABLE';
export type ConnectionAuditStatus = 'CONNECTED' | 'DISCONNECTED' | 'NOT_VERIFIABLE' | 'NO_ACCOUNTS';
export type FeatureAuditStatus = 'PASS' | 'WARNING' | 'NOT_CONFIGURED';

export interface PlatformCapabilityAudit {
  valid: boolean;
  capabilities: Record<PlatformCapability, boolean>;
  invalidKeys: string[];
}

export interface PlatformAuditItem {
  platformId: string;
  name: string;
  slug: string;
  isActive: boolean;
  accountCount: number;
  capabilities: PlatformCapabilityAudit;
  adapter: {
    status: AdapterAuditStatus;
    name: string | null;
    supportedCapabilities: readonly PlatformCapability[];
    missingCapabilities: PlatformCapability[];
  };
  connection: {
    status: ConnectionAuditStatus;
    details: string;
  };
  publishing: {
    status: FeatureAuditStatus;
    details: string;
  };
  analytics: {
    status: FeatureAuditStatus;
    details: string;
  };
  scheduling: {
    status: FeatureAuditStatus;
    details: string;
  };
  warnings: string[];
}

export interface CodeIntegrityAuditResult {
  passed: boolean;
  inspectedFiles: number;
  hardcodedBranches: {
    file: string;
    line: number;
    snippet: string;
  }[];
}

export interface FuturePlatformCompatibilityResult {
  passed: boolean;
  testedPlatforms: {
    name: string;
    slug: string;
    valid: boolean;
    error?: string;
  }[];
}

export interface PlatformAuditReport {
  id: string;
  timestamp: string;
  overallStatus: 'PASS' | 'WARNING' | 'ERROR';
  summary: {
    totalPlatforms: number;
    activePlatforms: number;
    inactivePlatforms: number;
    totalAccounts: number;
    adaptersConfigured: number;
    adaptersUnavailable: number;
    adaptersPartiallySupported: number;
    warningsCount: number;
    errorsCount: number;
  };
  platforms: PlatformAuditItem[];
  codeIntegrity: CodeIntegrityAuditResult;
  futureCompatibility: FuturePlatformCompatibilityResult;
  warnings: string[];
  errors: string[];
}

export class PlatformAuditService {
  private readonly repos: Repositories;
  private readonly adapterRegistry: AdapterRegistry;

  constructor(
    repos: Repositories = getRepositories(),
    adapterRegistry: AdapterRegistry = getAdapterRegistry()
  ) {
    this.repos = repos;
    this.adapterRegistry = adapterRegistry;
  }

  /**
   * Run the complete dynamic platform audit across all real records and generic code paths.
   */
  async runAudit(actor?: { id: string; email?: string }): Promise<PlatformAuditReport> {
    const auditId = `AUD-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const platforms = await this.repos.platforms.findAll();
    const accounts = await this.repos.socialAccounts.findAll();

    const auditedPlatforms: PlatformAuditItem[] = [];
    const globalWarnings: string[] = [];
    const globalErrors: string[] = [];

    let adaptersConfigured = 0;
    let adaptersUnavailable = 0;
    let adaptersPartiallySupported = 0;

    for (const platform of platforms) {
      // 20.2 Platform Inventory & Account Count (from real SocialAccounts)
      const platformAccounts = accounts.filter((a) => a.platformId === platform.id);
      const accountCount = platformAccounts.length;

      const warnings: string[] = [];

      // 20.3 Capability Audit
      const capAudit = this.auditPlatformCapabilities(platform);
      if (!capAudit.valid) {
        warnings.push(
          `Platform "${platform.name}" has unrecognized capability keys: ${capAudit.invalidKeys.join(', ')}`
        );
      }

      // 20.4 Adapter Audit (queried from registry, NEVER inferred from platform name)
      const adapter = this.adapterRegistry.get(platform.slug);
      let adapterStatus: AdapterAuditStatus = 'UNAVAILABLE';
      let missingCaps: PlatformCapability[] = [];

      if (adapter) {
        const enabledCaps = (PLATFORM_CAPABILITIES as readonly PlatformCapability[]).filter(
          (cap) => capAudit.capabilities[cap]
        );

        missingCaps = enabledCaps.filter(
          (cap) => !(adapter.supportedCapabilities as readonly string[]).includes(cap)
        );

        if (missingCaps.length === 0) {
          adapterStatus = 'CONFIGURED';
          adaptersConfigured++;
        } else {
          adapterStatus = 'PARTIALLY_SUPPORTED';
          adaptersPartiallySupported++;
          warnings.push(
            `Adapter for "${platform.name}" does not support enabled capabilities: ${missingCaps.join(', ')}`
          );
        }
      } else {
        adapterStatus = 'UNAVAILABLE';
        adaptersUnavailable++;
        warnings.push(`Platform adapter is unavailable for "${platform.name}" (${platform.slug})`);
      }

      // 20.5 Connection Audit
      let connectionStatus: ConnectionAuditStatus = 'NO_ACCOUNTS';
      let connectionDetails = 'No social accounts connected';

      if (accountCount > 0) {
        if (!adapter) {
          // If no adapter exists, external connection is explicitly NOT VERIFIABLE
          connectionStatus = 'NOT_VERIFIABLE';
          connectionDetails = `${accountCount} account(s) registered in storage, but external connection is not verifiable (no platform adapter configured)`;
          warnings.push(
            `Accounts exist for "${platform.name}", but external connection cannot be verified without an adapter`
          );
        } else {
          // In future when adapters exist, validate real connection
          connectionStatus = 'DISCONNECTED';
          connectionDetails = `${accountCount} account(s) registered; adapter does not have live authenticated credentials`;
        }
      }

      // 20.6 Publishing Audit
      let publishingStatus: FeatureAuditStatus = 'NOT_CONFIGURED';
      let publishingDetails = 'Publishing capability not enabled in platform record';

      if (capAudit.capabilities.publishing) {
        if (adapter && (adapter.supportedCapabilities as readonly string[]).includes('publishing')) {
          publishingStatus = 'PASS';
          publishingDetails = 'Publishing capability enabled and supported by registered adapter';
        } else {
          publishingStatus = 'WARNING';
          publishingDetails = 'Publishing capability enabled in platform record, but no adapter with publishing support exists';
          warnings.push(
            `Publishing enabled for "${platform.name}", but platform adapter lacks publishing implementation`
          );
        }
      }

      // 20.7 Analytics Audit
      let analyticsStatus: FeatureAuditStatus = 'NOT_CONFIGURED';
      let analyticsDetails = 'Analytics capability not enabled in platform record';

      if (capAudit.capabilities.analytics) {
        if (adapter && (adapter.supportedCapabilities as readonly string[]).includes('analytics')) {
          analyticsStatus = 'PASS';
          analyticsDetails = 'Analytics capability enabled and supported by registered adapter';
        } else {
          analyticsStatus = 'WARNING';
          analyticsDetails = 'Analytics capability enabled in platform record, but no adapter with analytics support exists';
          warnings.push(
            `Analytics enabled for "${platform.name}", but platform adapter lacks analytics implementation`
          );
        }
      }

      // 20.8 Scheduling Audit
      let schedulingStatus: FeatureAuditStatus = 'NOT_CONFIGURED';
      let schedulingDetails = 'Scheduling capability not enabled in platform record';

      if (capAudit.capabilities.scheduling) {
        schedulingStatus = 'PASS';
        schedulingDetails = adapter
          ? 'Internal scheduling enabled (calendar queuing supported; external dispatch depends on publishing adapter)'
          : 'Internal scheduling enabled (calendar queuing supported; external auto-publish blocked due to missing adapter)';
      }

      for (const w of warnings) {
        globalWarnings.push(`[${platform.name}] ${w}`);
      }

      auditedPlatforms.push({
        platformId: platform.id,
        name: platform.name,
        slug: platform.slug,
        isActive: platform.isActive,
        accountCount,
        capabilities: capAudit,
        adapter: {
          status: adapterStatus,
          name: adapter?.name ?? null,
          supportedCapabilities: adapter?.supportedCapabilities ?? [],
          missingCapabilities: missingCaps,
        },
        connection: {
          status: connectionStatus,
          details: connectionDetails,
        },
        publishing: {
          status: publishingStatus,
          details: publishingDetails,
        },
        analytics: {
          status: analyticsStatus,
          details: analyticsDetails,
        },
        scheduling: {
          status: schedulingStatus,
          details: schedulingDetails,
        },
        warnings,
      });
    }

    // 20.9 Dynamic Platform Test (Code Inspection for hardcoded platform branches)
    const codeIntegrity = this.auditCodeIntegrity();
    if (!codeIntegrity.passed) {
      for (const b of codeIntegrity.hardcodedBranches) {
        globalWarnings.push(
          `Hard-coded platform branch detected in generic logic at ${b.file}:${b.line} (${b.snippet})`
        );
      }
    }

    // 20.10 Future Platform Compatibility Check
    const futureCompatibility = this.auditFuturePlatformCompatibility();
    if (!futureCompatibility.passed) {
      globalErrors.push('Schema validation failed for future platform models');
    }

    // Determine overall status
    let overallStatus: 'PASS' | 'WARNING' | 'ERROR' = 'PASS';
    if (globalErrors.length > 0) {
      overallStatus = 'ERROR';
    } else if (globalWarnings.length > 0 || adaptersUnavailable > 0) {
      overallStatus = 'WARNING';
    }

    const report: PlatformAuditReport = {
      id: auditId,
      timestamp,
      overallStatus,
      summary: {
        totalPlatforms: platforms.length,
        activePlatforms: platforms.filter((p) => p.isActive).length,
        inactivePlatforms: platforms.filter((p) => !p.isActive).length,
        totalAccounts: accounts.length,
        adaptersConfigured,
        adaptersUnavailable,
        adaptersPartiallySupported,
        warningsCount: globalWarnings.length,
        errorsCount: globalErrors.length,
      },
      platforms: auditedPlatforms,
      codeIntegrity,
      futureCompatibility,
      warnings: globalWarnings,
      errors: globalErrors,
    };

    // 20.15 Log Activity
    if (actor) {
      try {
        await this.repos.activityLogs.log({
          userId: actor.id,
          action: 'PLATFORM_AUDIT_RUN',
          entityType: 'PlatformAudit',
          entityId: auditId,
          metadata: {
            overallStatus,
            totalPlatforms: platforms.length,
            adaptersConfigured,
            adaptersUnavailable,
            warningsCount: globalWarnings.length,
            errorsCount: globalErrors.length,
          },
        });
      } catch (logErr) {
        console.warn('[PlatformAuditService] Failed to record activity log for audit run:', logErr);
      }
    }

    return report;
  }

  /**
   * Verify all 10 capabilities for a platform against the domain schema.
   */
  private auditPlatformCapabilities(platform: Platform): PlatformCapabilityAudit {
    const rawCaps = (platform.capabilities || []) as unknown;
    const invalidKeys: string[] = [];
    const enabledSet = new Set<string>();

    if (Array.isArray(rawCaps)) {
      for (const cap of rawCaps) {
        if (typeof cap === 'string') {
          if ((PLATFORM_CAPABILITIES as readonly string[]).includes(cap)) {
            enabledSet.add(cap);
          } else {
            invalidKeys.push(cap);
          }
        }
      }
    } else if (typeof rawCaps === 'object' && rawCaps !== null) {
      for (const [key, val] of Object.entries(rawCaps as Record<string, unknown>)) {
        if ((PLATFORM_CAPABILITIES as readonly string[]).includes(key)) {
          if (val) enabledSet.add(key);
        } else {
          invalidKeys.push(key);
        }
      }
    }

    const capabilities: Record<PlatformCapability, boolean> = {
      text: enabledSet.has('text'),
      image: enabledSet.has('image'),
      video: enabledSet.has('video'),
      carousel: enabledSet.has('carousel'),
      story: enabledSet.has('story'),
      shortVideo: enabledSet.has('shortVideo'),
      live: enabledSet.has('live'),
      scheduling: enabledSet.has('scheduling'),
      analytics: enabledSet.has('analytics'),
      publishing: enabledSet.has('publishing'),
    };

    return {
      valid: invalidKeys.length === 0,
      capabilities,
      invalidKeys,
    };
  }

  /**
   * Static scan of generic business logic for hard-coded platform branches.
   * Platform-specific logic must live in adapters, never in generic business logic.
   */
  private auditCodeIntegrity(): CodeIntegrityAuditResult {
    const hardcodedBranches: { file: string; line: number; snippet: string }[] = [];

    // Files to scan: generic services in src/lib/services/
    const servicesDir = path.resolve(process.cwd(), 'src/lib/services');
    let inspectedFiles = 0;

    if (fs.existsSync(servicesDir)) {
      const files = fs
        .readdirSync(servicesDir)
        .filter(
          (f) =>
            f.endsWith('.ts') &&
            !f.includes('platform-audit-service') &&
            !f.includes('diagnostic')
        );

      inspectedFiles = files.length;

      // Anti-pattern regex: if (platform === 'instagram') or switch(platform)
      // Excludes platform-service seed list or adapter references
      const branchRegex =
        /(?:if\s*\(\s*(?:platform|slug|platformSlug)\s*===?\s*['"](?:instagram|tiktok|twitter|youtube|facebook|discord|kick|snapchat)['"])|(?:switch\s*\(\s*(?:platform|slug|platformSlug)\s*\))/i;

      for (const file of files) {
        const fullPath = path.join(servicesDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          // Ignore comments
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            return;
          }

          // In platform-service.ts, the seedPlatforms method defines standard defaults by design
          if (file === 'platform-service.ts' && trimmed.includes('slug:')) {
            return;
          }

          if (branchRegex.test(line)) {
            hardcodedBranches.push({
              file: `src/lib/services/${file}`,
              line: idx + 1,
              snippet: trimmed.slice(0, 80),
            });
          }
        });
      }
    }

    return {
      passed: hardcodedBranches.length === 0,
      inspectedFiles,
      hardcodedBranches,
    };
  }

  /**
   * Verify future platform compatibility through configuration / schema validation.
   * Tests that a hypothetical new platform can be modeled without schema changes.
   */
  private auditFuturePlatformCompatibility(): FuturePlatformCompatibilityResult {
    const testCases: {
      name: string;
      slug: string;
      icon: string;
      description: string;
      isActive: boolean;
      capabilities: PlatformCapability[];
    }[] = [
      {
        name: 'Threads by Meta',
        slug: 'threads',
        icon: 'threads',
        description: 'Microblogging platform by Instagram/Meta',
        isActive: true,
        capabilities: ['text', 'image', 'video', 'carousel', 'scheduling', 'analytics', 'publishing'],
      },
      {
        name: 'Bluesky Social',
        slug: 'bluesky',
        icon: 'cloud',
        description: 'Decentralized AT-protocol network',
        isActive: true,
        capabilities: ['text', 'image', 'video', 'scheduling', 'publishing'],
      },
      {
        name: 'LinkedIn Professional',
        slug: 'linkedin',
        icon: 'linkedin',
        description: 'B2B social network and company pages',
        isActive: true,
        capabilities: ['text', 'image', 'video', 'carousel', 'live', 'scheduling', 'analytics', 'publishing'],
      },
    ];

    const testedPlatforms = testCases.map((tc) => {
      const parseResult = CreatePlatformSchema.safeParse(tc);
      return {
        name: tc.name,
        slug: tc.slug,
        valid: parseResult.success,
        error: parseResult.success ? undefined : JSON.stringify(parseResult.error.format()),
      };
    });

    const passed = testedPlatforms.every((t) => t.valid);

    return {
      passed,
      testedPlatforms,
    };
  }

  /**
   * Run a lifecycle validation using PlatformRepository.create() and verify cleanup.
   * Complies with Test Data Rule 20.11:
   *  - Uses server-generated ID (never PLT-999999 or PLT-TEST)
   *  - Deactivates and deletes temporary platform after verification
   */
  async verifyDynamicPlatformLifecycle(): Promise<{
    createdId: string;
    cleanedUp: boolean;
  }> {
    const tempSlug = `test-dynamic-${Date.now()}`;
    const created = await this.repos.platforms.create({
      name: 'Dynamic Test Architecture Platform',
      slug: tempSlug,
      icon: 'sparkles',
      description: 'Temporary platform for Phase 20 architectural verification',
      isActive: false,
      capabilities: ['text', 'image', 'scheduling'],
    });

    // Ensure ID conforms to server format (PLT-XXXXXX)
    if (!created.id.startsWith('PLT-') || created.id === 'PLT-999999' || created.id === 'PLT-TEST') {
      throw new Error(`Unexpected non-server ID format: ${created.id}`);
    }

    // Verify it exists in storage
    const read = await this.repos.platforms.findById(created.id);
    if (!read) {
      throw new Error(`Temporary platform ${created.id} was not found after creation`);
    }

    // Delete and verify cleanup
    await this.repos.platforms.delete(created.id);
    const postDelete = await this.repos.platforms.findById(created.id);
    const cleanedUp = postDelete === null;

    return {
      createdId: created.id,
      cleanedUp,
    };
  }
}

let _platformAuditService: PlatformAuditService | null = null;

export function getPlatformAuditService(): PlatformAuditService {
  if (!_platformAuditService) {
    _platformAuditService = new PlatformAuditService();
  }
  return _platformAuditService;
}
