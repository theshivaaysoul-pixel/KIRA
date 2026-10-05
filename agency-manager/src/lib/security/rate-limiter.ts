// src/lib/security/rate-limiter.ts
// Production sliding-window in-memory rate limiter for KIRA Agency Manager (Phase 21).
// Provides protection against brute-force, DoS, and resource exhaustion.
// Returns rate-limiting metadata and standard HTTP 429 response when limits are exceeded.

import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  /** Maximum number of allowed requests in the sliding window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds
  retryAfterSeconds: number;
}

interface WindowRecord {
  timestamps: number[];
}

export const RATE_LIMIT_PRESETS: Record<string, RateLimitConfig> = {
  // Sensitive auth actions (login/logout activity records)
  AUTH: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 req / min
  // Search queries (prevent scraping / CPU exhaustion)
  SEARCH: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 req / min
  // File uploads (prevent storage / bandwidth exhaustion)
  UPLOAD: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 req / min
  // Administrative diagnostics, backups, and audits
  ADMIN: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 req / min
  // Standard API endpoints
  STANDARD: { maxRequests: 120, windowMs: 60 * 1000 }, // 120 req / min
};

class InMemoryRateLimiter {
  private store: Map<string, WindowRecord> = new Map();
  private lastCleanup: number = Date.now();

  /**
   * Check whether a client request is within the rate limit.
   */
  check(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Periodic cleanup of stale records every 5 minutes
    if (now - this.lastCleanup > 5 * 60 * 1000) {
      this.cleanup(windowStart);
      this.lastCleanup = now;
    }

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    const count = record.timestamps.length;
    const resetTime = Math.ceil((now + config.windowMs) / 1000);

    if (count >= config.maxRequests) {
      const oldestInWindow = record.timestamps[0] || now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + config.windowMs - now) / 1000));
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime,
        retryAfterSeconds,
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - record.timestamps.length),
      resetTime,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Reset store (useful for testing).
   */
  reset(): void {
    this.store.clear();
  }

  private cleanup(cutoff: number): void {
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
      if (record.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

// Global singleton rate limiter instance
const limiter = new InMemoryRateLimiter();

export function getRateLimiter(): InMemoryRateLimiter {
  return limiter;
}

/**
 * Helper to extract client identifier (IP or forwarded header).
 */
export function getClientIdentifier(req: NextRequest, prefix = 'global'): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  return `${prefix}:${ip}`;
}

/**
 * Apply rate limit check to a NextRequest.
 * Returns null if request is allowed, or a 429 NextResponse if rate limit is exceeded.
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.STANDARD,
  bucketPrefix = 'api'
): NextResponse | null {
  const identifier = getClientIdentifier(req, bucketPrefix);
  const result = limiter.check(identifier, config);

  if (!result.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please retry after ${result.retryAfterSeconds} seconds.`,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetTime),
        },
      }
    );
  }

  return null;
}
