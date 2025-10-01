# syntax=docker/dockerfile:1

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

# Runtime
FROM mcr.microsoft.com/playwright:v1.40.0-jammy AS runtime
WORKDIR /app
ENV NODE_ENV=production

# App files and prod deps
COPY --from=base /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=base /app/dist ./dist
COPY public ./public

# Data/logs dirs
RUN mkdir -p /app/data /app/logs /app/generated_tests /app/test_execution_reports && chown -R pwuser:pwuser /app
USER pwuser

EXPOSE 3000
CMD ["node", "-r", "module-alias/register", "dist/api/server.js"]
