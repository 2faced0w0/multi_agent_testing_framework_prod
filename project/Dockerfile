# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
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
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

# App files and prod deps
COPY --from=base /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=base /app/dist ./dist

# Data/logs dirs
RUN mkdir -p /app/data /app/logs /app/generated_tests /app/test_execution_reports && chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "-r", "module-alias/register", "dist/api/server.js"]
