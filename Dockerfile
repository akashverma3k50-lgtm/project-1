# ==============================================================================
# Multi-Stage Secure Production Dockerfile
# - Minimal attack surface (Node alpine)
# - Runs as non-privileged node user
# - Separation of build vs runtime dependencies
# ==============================================================================

# Stage 1: Build & Prune
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY content/ ./content/
COPY public/ ./public/

RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime dependencies for SQLite
RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled artifacts and assets from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/content ./content
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/src/views ./src/views

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app

# Run as non-root user for security hardening
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
