# syntax=docker/dockerfile:1

# Playwright image version for runtime
ARG PLAYWRIGHT_VERSION=1.55.1

FROM node:20-slim AS base
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Runtime with preinstalled browsers and dependencies
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy AS runtime
WORKDIR /app
ENV NODE_ENV=production

# App files and prod deps (copy from build stage to avoid network in runtime)
COPY --from=base /app/package*.json ./
COPY --from=base /app/node_modules ./node_modules
RUN npm prune --omit=dev || true
COPY --from=base /app/dist ./dist
COPY public ./public

# Data/logs dirs
RUN mkdir -p /app/data /app/logs /app/generated_tests /app/test_execution_reports && chown -R pwuser:pwuser /app
USER pwuser

EXPOSE 3000
CMD ["node", "-r", "module-alias/register", "dist/api/server.js"]
