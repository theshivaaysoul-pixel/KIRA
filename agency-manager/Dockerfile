# =============================================================================
# KIRA Agency Manager — Production Dockerfile
# Multi-stage optimized build for Google Cloud Run / Container Platforms
# Non-root execution, minimal attack surface, standalone Next.js server runtime
# =============================================================================

# ─── Stage 1: Dependencies ──────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install libc6-compat for Alpine compatibility with native bindings
RUN apk add --no-cache libc6-compat

# Copy package manifests and lockfile
COPY package.json package-lock.json ./

# Install dependencies strictly following package-lock
RUN npm ci

# ─── Stage 2: Builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment for build-time optimizations
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run Next.js production build using standalone output
RUN npm run build

# ─── Stage 3: Runner (Minimal Production Image) ──────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Create non-root system user and group for principle of least privilege
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and public directory
COPY --from=builder /app/public ./public

# Set correct permissions for Next.js cache directory
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone build output and static assets from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose standard Cloud Run port
EXPOSE 8080

# Configure container healthcheck against the live public health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start Next.js standalone server
CMD ["node", "server.js"]
