# Multi-Agent Testing Framework - Deployment & Operations Guide

## Table of Contents
1. [Introduction & Scope](#introduction--scope)
2. [Prerequisites & Environment Matrix](#prerequisites--environment-matrix)
3. [Quick Start Guide](#quick-start-guide)
4. [Detailed Setup Instructions](#detailed-setup-instructions)
5. [CI/CD Pipeline Configuration](#cicd-pipeline-configuration)
6. [Monitoring & Alerting Setup](#monitoring--alerting-setup)
7. [Backup & Recovery Procedures](#backup--recovery-procedures)
8. [Performance Tuning](#performance-tuning)
9. [Security Hardening](#security-hardening)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Maintenance Runbooks](#maintenance-runbooks)
12. [Appendix: Scripts & Templates](#appendix-scripts--templates)

---

## Introduction & Scope

### Purpose
This guide provides comprehensive instructions for deploying, configuring, and operating the Multi-Agent Testing Framework in production environments. It covers everything from initial setup to ongoing maintenance, ensuring reliable and secure operation of the testing infrastructure.

### Scope
- **Development Environment**: Local setup for development and testing
- **Staging Environment**: Pre-production validation environment
- **Production Environment**: Full-scale production deployment
- **Cloud Deployments**: AWS, Azure, GCP deployment considerations
- **On-Premises**: Self-hosted infrastructure deployment

### Architecture Overview
The framework consists of six specialized agents communicating through Redis-based messaging, with Playwright for browser automation, Mistral AI for intelligent test generation, and comprehensive monitoring through Prometheus/Grafana.

```
┌─────────────────────────────────────────────────────────────────┐
│                Production Deployment Architecture               │
├─────────────────────────────────────────────────────────────────┤
│  Load Balancer (Nginx/Traefik)                                │
│  ├── API Gateway (Port 3000)                                   │
│  ├── Monitoring Dashboard (Port 8080)                          │
│  └── WebSocket Gateway (Port 3001)                             │
├─────────────────────────────────────────────────────────────────┤
│  Agent Runtime Environment                                      │
│  ├── Test Writer Agent                                         │
│  ├── Test Executor Agent                                       │
│  ├── Report Generator Agent                                    │
│  ├── Test Optimizer Agent                                      │
│  ├── Context Manager Agent                                     │
│  └── Logger Agent                                              │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure Services                                        │
│  ├── Redis Cluster (Message Queue/Cache)                       │
│  ├── SQLite (Data Storage)                                     │
│  ├── InfluxDB (Time-series Metrics)                           │
│  └── File Storage (Artifacts/Reports)                          │
├─────────────────────────────────────────────────────────────────┤
│  Monitoring & Observability                                    │
│  ├── Prometheus (Metrics Collection)                           │
│  ├── Grafana (Visualization)                                   │
│  ├── AlertManager (Alerting)                                   │
│  └── Jaeger (Distributed Tracing)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites & Environment Matrix

### System Requirements

#### Minimum Requirements (Development)
- **CPU**: 4 cores (2.0 GHz)
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 10 Mbps internet connection
- **OS**: Ubuntu 20.04+, macOS 12+, Windows 10+ with WSL2

#### Recommended Requirements (Production)
- **CPU**: 16 cores (3.0 GHz)
- **RAM**: 32 GB
- **Storage**: 500 GB NVMe SSD
- **Network**: 100 Mbps dedicated connection
- **OS**: Ubuntu 22.04 LTS (recommended)

#### High-Availability Setup
- **CPU**: 32+ cores across multiple nodes
- **RAM**: 64+ GB per node
- **Storage**: 1+ TB with RAID 10
- **Network**: Gigabit with redundancy
- **Load Balancer**: HAProxy/Nginx with SSL termination

### Software Dependencies

#### Core Dependencies
```bash
# Node.js and npm
Node.js >= 18.0.0
npm >= 9.0.0

# Python (for monitoring scripts)
Python >= 3.9.0
pip >= 21.0.0

# Docker and Docker Compose
Docker >= 24.0.0
Docker Compose >= 2.20.0

# Git (for version control)
Git >= 2.30.0
```

#### Browser Dependencies
```bash
# Playwright browsers (auto-installed)
Chromium >= 118.0.0
Firefox >= 119.0.0
WebKit >= 17.0.0

# System dependencies for browsers
libgtk-3-0, libgbm-dev, libasound2-dev (Ubuntu)
```

#### Database Dependencies
```bash
# Redis (message queue and cache)
Redis >= 7.0.0

# SQLite (primary datastore)
SQLite >= 3.40.0

# InfluxDB (time-series metrics)
InfluxDB >= 2.7.0
```

### Environment Matrix

| Environment | Purpose | Resources | Availability | Backup |
|-------------|---------|-----------|--------------|--------|
| Development | Local development and testing | Minimal | Best effort | None |
| Staging | Pre-production validation | Medium | 95% | Daily |
| Production | Live testing operations | High | 99.9% | Real-time |
| DR | Disaster recovery | Medium | On-demand | Continuous |

---

## Quick Start Guide

### Automated Setup Script

The fastest way to get started is using our automated setup script:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/your-org/multi-agent-testing/main/scripts/setup.sh | bash

# Or clone and run manually
git clone https://github.com/your-org/multi-agent-testing-framework.git
cd multi-agent-testing-framework
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Docker Compose Quick Start

For immediate deployment using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/your-org/multi-agent-testing-framework.git
cd multi-agent-testing-framework

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Verify deployment
docker-compose ps
curl http://localhost:3000/health
```

### Verification Steps

After deployment, verify the system is working:

```bash
# Check service health
curl http://localhost:3000/api/v1/system/health

# Check agent status
curl http://localhost:3000/api/v1/system/agents/status

# Access monitoring dashboard
open http://localhost:8080

# Run a test execution
curl -X POST http://localhost:3000/api/v1/tests/execute \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "type": "functional"}'
```

---

## Detailed Setup Instructions

### 1. Host Preparation

#### Ubuntu/Debian Setup
```bash
#!/bin/bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential python3 python3-pip

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/multi-agent-testing
sudo chown $USER:$USER /opt/multi-agent-testing
```

#### macOS Setup
```bash
#!/bin/bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@18 python@3.9 git docker docker-compose redis

# Start Docker Desktop
open -a Docker

# Verify installations
node --version
python3 --version
docker --version
docker-compose --version
```

### 2. Environment Configuration

#### Environment Variables (.env)
```bash
# Application Configuration
NODE_ENV=production
PORT=3000
WS_PORT=3001
LOG_LEVEL=info

# Database Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_secure_redis_password
DATABASE_URL=sqlite:///data/framework.db
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your_influxdb_token

# External Service Configuration
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_MODEL=mistral-large-latest
MISTRAL_MAX_TOKENS=4000

# Security Configuration
JWT_SECRET=your_jwt_secret_key
API_KEY=your_api_key
ENCRYPTION_KEY=your_32_character_encryption_key

# Monitoring Configuration
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3000
GRAFANA_ADMIN_PASSWORD=your_grafana_password

# Storage Configuration
STORAGE_PATH=/opt/multi-agent-testing/data
BACKUP_PATH=/opt/multi-agent-testing/backups
TEMP_PATH=/tmp/multi-agent-testing

# Performance Configuration
MAX_CONCURRENT_TESTS=10
TEST_TIMEOUT=300000
BROWSER_POOL_SIZE=5
MEMORY_LIMIT=2048

# Feature Flags
ENABLE_ACCESSIBILITY_TESTING=true
ENABLE_PERFORMANCE_TESTING=true
ENABLE_VISUAL_REGRESSION=true
ENABLE_API_TESTING=true
```

#### Application Configuration (config/production.json)
```json
{
  "agents": {
    "testWriter": {
      "enabled": true,
      "instances": 2,
      "resources": {
        "memory": "1GB",
        "cpu": "1"
      },
      "config": {
        "maxTestsPerBatch": 10,
        "codeOptimization": true,
        "templateCaching": true
      }
    },
    "testExecutor": {
      "enabled": true,
      "instances": 4,
      "resources": {
        "memory": "2GB",
        "cpu": "2"
      },
      "config": {
        "browserPool": {
          "chromium": 3,
          "firefox": 2,
          "webkit": 1
        },
        "parallelExecution": true,
        "screenshotOnFailure": true,
        "videoRecording": false
      }
    },
    "reportGenerator": {
      "enabled": true,
      "instances": 1,
      "resources": {
        "memory": "1GB",
        "cpu": "1"
      },
      "config": {
        "formats": ["html", "json", "pdf"],
        "templateCaching": true,
        "compressionEnabled": true
      }
    },
    "testOptimizer": {
      "enabled": true,
      "instances": 1,
      "resources": {
        "memory": "512MB",
        "cpu": "0.5"
      },
      "config": {
        "analysisInterval": "1h",
        "optimizationThreshold": 0.8,
        "historicalDataDays": 30
      }
    },
    "contextManager": {
      "enabled": true,
      "instances": 1,
      "resources": {
        "memory": "512MB",
        "cpu": "0.5"
      },
      "config": {
        "stateBackupInterval": "5m",
        "contextCacheSize": 1000,
        "sessionTimeout": "1h"
      }
    },
    "logger": {
      "enabled": true,
      "instances": 1,
      "resources": {
        "memory": "1GB",
        "cpu": "1"
      },
      "config": {
        "logLevel": "info",
        "logRetention": "30d",
        "metricsInterval": "30s",
        "alertingEnabled": true
      }
    }
  },
  "integrations": {
    "playwright": {
      "headless": true,
      "slowMo": 0,
      "timeout": 30000,
      "retries": 2,
      "workers": 4
    },
    "mistral": {
      "model": "mistral-large-latest",
      "maxTokens": 4000,
      "temperature": 0.1,
      "rateLimitRpm": 60,
      "retryAttempts": 3
    },
    "monitoring": {
      "prometheus": {
        "enabled": true,
        "scrapeInterval": "15s",
        "metricsPath": "/metrics"
      },
      "grafana": {
        "enabled": true,
        "dashboardProvisioning": true,
        "alerting": true
      },
      "jaeger": {
        "enabled": true,
        "samplingRate": 0.1,
        "endpoint": "http://localhost:14268/api/traces"
      }
    }
  },
  "security": {
    "authentication": {
      "enabled": true,
      "provider": "jwt",
      "tokenExpiry": "24h"
    },
    "authorization": {
      "enabled": true,
      "rbac": true,
      "defaultRole": "viewer"
    },
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm",
      "keyRotationDays": 90
    },
    "rateLimit": {
      "enabled": true,
      "windowMs": 900000,
      "maxRequests": 100
    }
  }
}
```

### 3. Network Configuration

#### Docker Network Setup
```bash
# Create dedicated networks
docker network create --driver bridge multi-agent-network
docker network create --driver bridge monitoring-network

# Configure network policies (if using Docker Swarm)
docker network create --driver overlay --attachable multi-agent-overlay
```

#### Firewall Configuration (UFW)
```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application ports
sudo ufw allow 3000/tcp  # API Gateway
sudo ufw allow 3001/tcp  # WebSocket
sudo ufw allow 8080/tcp  # Monitoring Dashboard

# Allow internal services (restrict to local network)
sudo ufw allow from 10.0.0.0/8 to any port 6379  # Redis
sudo ufw allow from 10.0.0.0/8 to any port 9090  # Prometheus
sudo ufw allow from 10.0.0.0/8 to any port 8086  # InfluxDB

# Deny all other traffic
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

### 4. Database Setup

#### Redis Configuration
```bash
# Create Redis configuration
sudo mkdir -p /etc/redis
sudo tee /etc/redis/redis.conf << EOF
# Network
bind 127.0.0.1
port 6379
protected-mode yes

# Security
requirepass your_secure_redis_password
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
dir /var/lib/redis
dbfilename dump.rdb

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Performance
tcp-keepalive 300
timeout 0
tcp-backlog 511
EOF

# Start Redis service
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### SQLite Setup (Development)
```bash
# Create database directory
mkdir -p /opt/multi-agent-testing/data/sqlite

# Initialize database schema
sqlite3 /opt/multi-agent-testing/data/sqlite/framework.db < scripts/schema.sql
```

<!-- PostgreSQL setup section removed; SQLite is the standard datastore for this project. -->

### 5. Service Installation

#### Systemd Service Configuration
```bash
# Create systemd service file
sudo tee /etc/systemd/system/multi-agent-testing.service << EOF
[Unit]
Description=Multi-Agent Testing Framework
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=framework
Group=framework
WorkingDirectory=/opt/multi-agent-testing
Environment=NODE_ENV=production
EnvironmentFile=/opt/multi-agent-testing/.env
ExecStart=/usr/bin/node dist/index.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=multi-agent-testing

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/multi-agent-testing/data /opt/multi-agent-testing/logs /tmp

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryLimit=8G

[Install]
WantedBy=multi-user.target
EOF

# Create service user
sudo useradd -r -s /bin/false -d /opt/multi-agent-testing framework
sudo chown -R framework:framework /opt/multi-agent-testing

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable multi-agent-testing
sudo systemctl start multi-agent-testing
```

---

## CI/CD Pipeline Configuration

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Multi-Agent Testing Framework

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  DOCKER_REGISTRY: ghcr.io
  IMAGE_NAME: multi-agent-testing-framework

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run type checking
      run: npm run type-check

    - name: Run unit tests
      run: npm run test:unit
      env:
        REDIS_URL: redis://localhost:6379

    - name: Run integration tests
      run: npm run test:integration
      env:
        REDIS_URL: redis://localhost:6379
        NODE_ENV: test

    - name: Generate test coverage
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.DOCKER_REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.DOCKER_REGISTRY }}/${{ github.repository }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push Docker image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        build-args: |
          NODE_VERSION=${{ env.NODE_VERSION }}
          BUILD_DATE=${{ github.event.head_commit.timestamp }}
          VCS_REF=${{ github.sha }}

  security-scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ needs.build.outputs.image-tag }}
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  deploy-staging:
    needs: [build, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
    - name: Deploy to staging
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.STAGING_HOST }}
        username: ${{ secrets.STAGING_USER }}
        key: ${{ secrets.STAGING_SSH_KEY }}
        script: |
          cd /opt/multi-agent-testing
          docker-compose pull
          docker-compose up -d --remove-orphans
          docker system prune -f

    - name: Run smoke tests
      run: |
        sleep 30
        curl -f http://${{ secrets.STAGING_HOST }}:3000/health || exit 1

  deploy-production:
    needs: [build, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
    - name: Deploy to production
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.PRODUCTION_HOST }}
        username: ${{ secrets.PRODUCTION_USER }}
        key: ${{ secrets.PRODUCTION_SSH_KEY }}
        script: |
          cd /opt/multi-agent-testing
          
          # Backup current deployment
          docker-compose exec -T framework npm run backup:create
          
          # Rolling update
          docker-compose pull
          docker-compose up -d --remove-orphans --scale framework=2
          sleep 30
          docker-compose up -d --remove-orphans --scale framework=1
          
          # Cleanup
          docker system prune -f

    - name: Run production health checks
      run: |
        sleep 60
        curl -f http://${{ secrets.PRODUCTION_HOST }}:3000/health || exit 1
        curl -f http://${{ secrets.PRODUCTION_HOST }}:3000/api/v1/system/agents/status || exit 1

    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
      if: always()
```

### GitLab CI/CD Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - security
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  NODE_VERSION: "18"
  IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

services:
  - docker:24-dind
  - redis:7-alpine

before_script:
  - docker info

test:
  stage: test
  image: node:18-alpine
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run lint
    - npm run type-check
    - npm run test:unit
    - npm run test:integration
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 1 week

build:
  stage: build
  image: docker:24
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build --build-arg NODE_VERSION=$NODE_VERSION -t $IMAGE_TAG .
    - docker push $IMAGE_TAG
  only:
    - main
    - develop

security:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy image --exit-code 0 --format template --template "@contrib/sarif.tpl" -o trivy-report.sarif $IMAGE_TAG
    - trivy image --exit-code 1 --severity HIGH,CRITICAL $IMAGE_TAG
  artifacts:
    reports:
      sast: trivy-report.sarif
  only:
    - main
    - develop

deploy:staging:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$STAGING_SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan $STAGING_HOST >> ~/.ssh/known_hosts
    - chmod 644 ~/.ssh/known_hosts
  script:
    - ssh $STAGING_USER@$STAGING_HOST "cd /opt/multi-agent-testing && docker-compose pull && docker-compose up -d"
  environment:
    name: staging
    url: http://$STAGING_HOST:3000
  only:
    - develop

deploy:production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client curl
    - eval $(ssh-agent -s)
    - echo "$PRODUCTION_SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan $PRODUCTION_HOST >> ~/.ssh/known_hosts
    - chmod 644 ~/.ssh/known_hosts
  script:
    - ssh $PRODUCTION_USER@$PRODUCTION_HOST "cd /opt/multi-agent-testing && ./scripts/deploy.sh"
    - sleep 60
    - curl -f http://$PRODUCTION_HOST:3000/health
  environment:
    name: production
    url: http://$PRODUCTION_HOST:3000
  when: manual
  only:
    - main
```

### Docker Compose for CI/CD

```yaml
# docker-compose.ci.yml
version: '3.8'

services:
  framework:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_VERSION: 18
    image: ${IMAGE_TAG:-multi-agent-testing:latest}
    ports:
      - "3000:3000"
      - "3001:3001"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=sqlite:///data/framework.db
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      redis:
        condition: service_healthy
      # postgres removed
    volumes:
      - framework_data:/app/data
      - framework_logs:/app/logs
    networks:
      - multi-agent-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - multi-agent-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # postgres service removed; SQLite is used as the datastore

  prometheus:
    image: prom/prometheus:v2.47.0
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    networks:
      - monitoring-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:10.1.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    networks:
      - monitoring-network
    restart: unless-stopped
    depends_on:
      - prometheus

networks:
  multi-agent-network:
    driver: bridge
  monitoring-network:
    driver: bridge

volumes:
  framework_data:
  framework_logs:
  redis_data:
  prometheus_data:
  grafana_data:
```

---

## Monitoring & Alerting Setup

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'multi-agent-testing'
    environment: 'production'

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'multi-agent-framework'
    static_configs:
      - targets: ['framework:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
```

### Alert Rules

```yaml
# monitoring/alert_rules.yml
groups:
  - name: multi-agent-framework
    rules:
      - alert: FrameworkDown
        expr: up{job="multi-agent-framework"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Multi-Agent Framework is down"
          description: "The Multi-Agent Testing Framework has been down for more than 1 minute."

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second."

      - alert: AgentUnhealthy
        expr: agent_health_status == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Agent {{ $labels.agent_name }} is unhealthy"
          description: "Agent {{ $labels.agent_name }} has been unhealthy for more than 30 seconds."

      - alert: TestExecutionTimeout
        expr: test_execution_duration_seconds > 600
        for: 0s
        labels:
          severity: warning
        annotations:
          summary: "Test execution timeout"
          description: "Test {{ $labels.test_id }} has been running for more than 10 minutes."

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90% for more than 5 minutes."

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is below 10% on root filesystem."

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis is down"
          description: "Redis has been down for more than 1 minute."

      - alert: DatabaseConnectionFailure
        expr: database_connections_failed_total > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection failures"
          description: "More than 10 database connection failures in the last 2 minutes."

  - name: performance
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }} seconds."

      - alert: TestQueueBacklog
        expr: test_queue_size > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Test queue backlog"
          description: "Test queue has {{ $value }} pending tests."
```

### AlertManager Configuration

```yaml
# monitoring/alertmanager.yml (production-ready template)
global:
  resolve_timeout: 5m
  smtp_smarthost: 'localhost:25'
  smtp_from: 'alerts@example.com'

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 2m
  repeat_interval: 2h
  routes:
    - matchers: [ 'severity="critical"' ]
      receiver: 'critical-alerts'
    - matchers: [ 'severity="warning"' ]
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://127.0.0.1:12345/'
        send_resolved: true

  - name: 'critical-alerts'
    email_configs:
      - to: 'ops-team@example.com'
        send_resolved: true
    slack_configs:
      - channel: '#critical-alerts'
        send_resolved: true
        title: 'CRITICAL: {{ .CommonAnnotations.summary }}'
        text: '{{ range .Alerts }}• {{ .Annotations.description }}{{ "\n" }}{{ end }}'
        api_url_file: '/etc/alertmanager/slack_api_url'

  - name: 'warning-alerts'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: 'Warning: {{ .CommonAnnotations.summary }}'
        text: '{{ range .Alerts }}• {{ .Annotations.description }}{{ "\n" }}{{ end }}'
        api_url_file: '/etc/alertmanager/slack_api_url'

inhibit_rules:
  - source_matchers: [ 'severity="critical"' ]
    target_matchers: [ 'severity="warning"' ]
    equal: ['alertname', 'service']
```

Kubernetes secret for Slack webhook (template): `project/k8s/alertmanager-secret.example.yaml`

Mount the secret into Alertmanager container (Compose or K8s) so `/etc/alertmanager/slack_api_url` exists. For Compose, bind-mount the file or use `env_file`. For K8s, create a Secret and mount it as a volume at `/etc/alertmanager`.

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "id": null,
    "title": "Multi-Agent Testing Framework",
    "tags": ["multi-agent", "testing", "framework"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "System Overview",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"multi-agent-framework\"}",
            "legendFormat": "Framework Status"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "green", "value": 1}
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "Agent Health Status",
        "type": "stat",
        "targets": [
          {
            "expr": "agent_health_status",
            "legendFormat": "{{ agent_name }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "green", "value": 1}
              ]
            }
          }
        }
      },
      {
        "id": 3,
        "title": "Test Execution Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(tests_executed_total[5m])",
            "legendFormat": "Tests per second"
          }
        ]
      },
      {
        "id": 4,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "id": 5,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes / 1024 / 1024",
            "legendFormat": "Memory Usage (MB)"
          }
        ]
      },
      {
        "id": 6,
        "title": "Test Queue Size",
        "type": "graph",
        "targets": [
          {
            "expr": "test_queue_size",
            "legendFormat": "Queue Size"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

---

## Backup & Recovery Procedures

### Kubernetes: SQLite automated backups

For Kubernetes deployments using the default SQLite datastore at `/app/data/framework.db`, a CronJob is provided to create time-stamped copies into a dedicated backup PVC.

- Manifest: `project/k8s/backup-cronjob.yaml`
- Schedule: daily at 02:30
- Source PVC: `matf-data` mounted at `/data`
- Backup PVC: `matf-backups` mounted at `/backup` (5Gi by default)
- Retention: keeps the 14 most recent copies (FIFO cleanup)

Deploy the CronJob and backup PVC:

1) Create the backup PVC and CronJob
   kubectl apply -f project/k8s/backup-cronjob.yaml

2) Verify
   kubectl get cronjob matf-sqlite-backup
   kubectl get pvc matf-backups

3) Inspect backup artifacts (file names like `framework-YYYYMMDD-HHMMSS.db`)
   kubectl -n <ns> get pods  # find a pod with the backup PVC mounted, or start a temporary pod
   kubectl -n <ns> exec -it <pod> -- ls -1 /backup

Manual run (on-demand):
   kubectl create job --from=cronjob/matf-sqlite-backup manual-sqlite-backup-$(date +%s)

Restore (Kubernetes):
- Safest path is to scale down the application to avoid writes, copy a chosen backup file over the live DB, then scale back up.

   # Scale down app
   kubectl scale deploy/multi-agent-testing-framework --replicas=0

   # Start a debug pod with both PVCs mounted to perform the copy
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: Pod
   metadata:
     name: restore-sqlite-once
   spec:
     restartPolicy: Never
     containers:
       - name: busybox
         image: alpine:3.20
         command: ["/bin/sh","-c","sleep 3600"]
         volumeMounts:
           - name: data
             mountPath: /data
           - name: backup
             mountPath: /backup
     volumes:
       - name: data
         persistentVolumeClaim:
           claimName: matf-data
       - name: backup
         persistentVolumeClaim:
           claimName: matf-backups
   EOF

   # After the pod is Running, copy the selected backup over the live DB
   kubectl exec -it restore-sqlite-once -- /bin/sh -lc "cp -f /backup/<your-backup-file>.db /data/framework.db && sync"

   # Remove the restore pod
   kubectl delete pod restore-sqlite-once --wait=true

   # Scale the app back up
   kubectl scale deploy/multi-agent-testing-framework --replicas=1

Notes:
- Ensure the app is fully quiesced (scaled to 0) before replacing the DB file to avoid corruption.
- Increase the `matf-backups` PVC size or adjust retention as data grows.
- Consider off-cluster copy (e.g., to object storage) by extending the CronJob to upload backups.

### Automated Backup Script

```bash
#!/bin/bash
# scripts/backup.sh

set -euo pipefail

# Configuration
BACKUP_DIR="/opt/multi-agent-testing/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="framework_backup_${TIMESTAMP}"
RETENTION_DAYS=30

# Logging
LOG_FILE="/var/log/multi-agent-testing/backup.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo "Starting backup at $(date)"

# Create backup directory
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Backup application data
echo "Backing up application data..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME/app_data.tar.gz" \
    -C /opt/multi-agent-testing \
    data/ config/ logs/ \
    --exclude='data/temp/*' \
    --exclude='logs/*.log'

# Backup Redis data
echo "Backing up Redis data..."
if systemctl is-active --quiet redis-server; then
    redis-cli --rdb "$BACKUP_DIR/$BACKUP_NAME/redis_dump.rdb"
else
    echo "Warning: Redis is not running, skipping Redis backup"
fi

# Backup PostgreSQL (if used)
if command -v pg_dump &> /dev/null; then
    echo "Backing up PostgreSQL database..."
    pg_dump -h localhost -U framework_user -d multi_agent_testing \
        --no-password --clean --create \
        > "$BACKUP_DIR/$BACKUP_NAME/postgres_dump.sql"
fi

# Backup SQLite (if used)
if [ -f "/opt/multi-agent-testing/data/sqlite/framework.db" ]; then
    echo "Backing up SQLite database..."
    sqlite3 /opt/multi-agent-testing/data/sqlite/framework.db \
        ".backup '$BACKUP_DIR/$BACKUP_NAME/sqlite_backup.db'"
fi

# Create backup manifest
echo "Creating backup manifest..."
cat > "$BACKUP_DIR/$BACKUP_NAME/manifest.json" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$TIMESTAMP",
  "hostname": "$(hostname)",
  "version": "$(cd /opt/multi-agent-testing && git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "files": [
    "app_data.tar.gz",
    "redis_dump.rdb",
    "postgres_dump.sql",
    "sqlite_backup.db"
  ],
  "size_bytes": $(du -sb "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
}
EOF

# Compress entire backup
echo "Compressing backup..."
tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"
rm -rf "$BACKUP_DIR/$BACKUP_NAME"

# Upload to cloud storage (optional)
if [ "${BACKUP_UPLOAD_ENABLED:-false}" = "true" ]; then
    echo "Uploading backup to cloud storage..."
    case "${BACKUP_STORAGE_TYPE:-s3}" in
        "s3")
            aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" \
                "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_NAME}.tar.gz"
            ;;
        "gcs")
            gsutil cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" \
                "gs://${BACKUP_GCS_BUCKET}/backups/${BACKUP_NAME}.tar.gz"
            ;;
        "azure")
            az storage blob upload \
                --account-name "$BACKUP_AZURE_ACCOUNT" \
                --container-name "$BACKUP_AZURE_CONTAINER" \
                --name "backups/${BACKUP_NAME}.tar.gz" \
                --file "$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
            ;;
    esac
fi

# Cleanup old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "framework_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully at $(date)"
echo "Backup location: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo "Backup size: $(du -h "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)"
```

### Restore Script

```bash
#!/bin/bash
# scripts/restore.sh

set -euo pipefail

# Configuration
BACKUP_DIR="/opt/multi-agent-testing/backups"
RESTORE_POINT="${1:-latest}"

# Logging
LOG_FILE="/var/log/multi-agent-testing/restore.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo "Starting restore at $(date)"

# Find backup file
if [ "$RESTORE_POINT" = "latest" ]; then
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/framework_backup_*.tar.gz | head -n1)
else
    BACKUP_FILE="$BACKUP_DIR/framework_backup_${RESTORE_POINT}.tar.gz"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring from: $BACKUP_FILE"

# Stop services
echo "Stopping services..."
systemctl stop multi-agent-testing
systemctl stop redis-server
if systemctl is-active --quiet postgresql; then
    systemctl stop postgresql
fi

# Extract backup
TEMP_DIR=$(mktemp -d)
echo "Extracting backup to $TEMP_DIR..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)
BACKUP_PATH="$TEMP_DIR/$BACKUP_NAME"

# Restore application data
echo "Restoring application data..."
cd /opt/multi-agent-testing
tar -xzf "$BACKUP_PATH/app_data.tar.gz"

# Restore Redis data
if [ -f "$BACKUP_PATH/redis_dump.rdb" ]; then
    echo "Restoring Redis data..."
    cp "$BACKUP_PATH/redis_dump.rdb" /var/lib/redis/dump.rdb
    chown redis:redis /var/lib/redis/dump.rdb
fi

# Restore PostgreSQL
if [ -f "$BACKUP_PATH/postgres_dump.sql" ]; then
    echo "Restoring PostgreSQL database..."
    systemctl start postgresql
    sleep 5
    psql -h localhost -U framework_user -d postgres < "$BACKUP_PATH/postgres_dump.sql"
fi

# Restore SQLite
if [ -f "$BACKUP_PATH/sqlite_backup.db" ]; then
    echo "Restoring SQLite database..."
    mkdir -p /opt/multi-agent-testing/data/sqlite
    cp "$BACKUP_PATH/sqlite_backup.db" /opt/multi-agent-testing/data/sqlite/framework.db
fi

# Fix permissions
echo "Fixing permissions..."
chown -R framework:framework /opt/multi-agent-testing

# Start services
echo "Starting services..."
systemctl start redis-server
if systemctl is-enabled --quiet postgresql; then
    systemctl start postgresql
fi
systemctl start multi-agent-testing

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 30

# Verify restore
echo "Verifying restore..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Restore completed successfully!"
else
    echo "Warning: Health check failed after restore"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo "Restore completed at $(date)"
```

### Backup Monitoring Script

```bash
#!/bin/bash
# scripts/backup_monitor.sh

set -euo pipefail

BACKUP_DIR="/opt/multi-agent-testing/backups"
ALERT_EMAIL="ops-team@your-domain.com"
MAX_AGE_HOURS=25  # Alert if latest backup is older than 25 hours

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: Backup directory does not exist: $BACKUP_DIR"
    exit 1
fi

# Find latest backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/framework_backup_*.tar.gz 2>/dev/null | head -n1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No backups found in $BACKUP_DIR"
    # Send alert
    echo "No backups found for Multi-Agent Testing Framework" | \
        mail -s "CRITICAL: No backups found" "$ALERT_EMAIL"
    exit 1
fi

# Check backup age
BACKUP_TIME=$(stat -c %Y "$LATEST_BACKUP")
CURRENT_TIME=$(date +%s)
AGE_HOURS=$(( (CURRENT_TIME - BACKUP_TIME) / 3600 ))

if [ $AGE_HOURS -gt $MAX_AGE_HOURS ]; then
    echo "WARNING: Latest backup is $AGE_HOURS hours old"
    echo "Latest backup is $AGE_HOURS hours old (threshold: $MAX_AGE_HOURS hours)" | \
        mail -s "WARNING: Backup age threshold exceeded" "$ALERT_EMAIL"
    exit 1
fi

# Check backup integrity
echo "Checking backup integrity..."
if tar -tzf "$LATEST_BACKUP" > /dev/null 2>&1; then
    echo "Backup integrity check passed"
else
    echo "ERROR: Backup integrity check failed"
    echo "Backup integrity check failed for: $LATEST_BACKUP" | \
        mail -s "CRITICAL: Backup corruption detected" "$ALERT_EMAIL"
    exit 1
fi

# Check backup size
BACKUP_SIZE=$(stat -c %s "$LATEST_BACKUP")
MIN_SIZE=$((10 * 1024 * 1024))  # 10MB minimum

if [ $BACKUP_SIZE -lt $MIN_SIZE ]; then
    echo "WARNING: Backup size is suspiciously small: $(du -h "$LATEST_BACKUP" | cut -f1)"
    echo "Backup size is suspiciously small: $(du -h "$LATEST_BACKUP" | cut -f1)" | \
        mail -s "WARNING: Small backup size detected" "$ALERT_EMAIL"
fi

echo "Backup monitoring completed successfully"
echo "Latest backup: $LATEST_BACKUP"
echo "Backup age: $AGE_HOURS hours"
echo "Backup size: $(du -h "$LATEST_BACKUP" | cut -f1)"
```

### Cron Jobs for Automated Backups

```bash
# Add to crontab: crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/multi-agent-testing/scripts/backup.sh

# Backup monitoring every 4 hours
0 */4 * * * /opt/multi-agent-testing/scripts/backup_monitor.sh

# Weekly backup verification (restore test)
0 3 * * 0 /opt/multi-agent-testing/scripts/backup_test.sh
```

---

## Performance Tuning

### System-Level Optimizations

#### Kernel Parameters
```bash
# /etc/sysctl.d/99-multi-agent-testing.conf

# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_max_tw_buckets = 1440000

# Memory optimizations
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.overcommit_memory = 1

# File system optimizations
fs.file-max = 2097152
fs.nr_open = 1048576

# Apply changes
sudo sysctl -p /etc/sysctl.d/99-multi-agent-testing.conf
```

#### System Limits
```bash
# /etc/security/limits.d/multi-agent-testing.conf

framework soft nofile 65536
framework hard nofile 65536
framework soft nproc 32768
framework hard nproc 32768
framework soft memlock unlimited
framework hard memlock unlimited

# For all users (if needed)
* soft nofile 65536
* hard nofile 65536
```

### Application-Level Optimizations

#### Node.js Performance Tuning
```bash
# Environment variables for Node.js optimization
export NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=128"
export UV_THREADPOOL_SIZE=16
export NODE_ENV=production
```

#### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'multi-agent-testing',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Performance optimizations
    node_args: '--max-old-space-size=4096',
    max_memory_restart: '2G',
    
    // Monitoring
    monitoring: true,
    pmx: true,
    
    // Logging
    log_file: '/opt/multi-agent-testing/logs/combined.log',
    out_file: '/opt/multi-agent-testing/logs/out.log',
    error_file: '/opt/multi-agent-testing/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto-restart
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data'],
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
```

### Database Optimizations

#### Redis Performance Tuning
```bash
# /etc/redis/redis.conf

# Memory optimizations
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Persistence optimizations
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error no
rdbcompression yes
rdbchecksum yes

# Network optimizations
tcp-keepalive 300
timeout 0
tcp-backlog 511

# Performance optimizations
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64

# Disable slow operations in production
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""
```

#### PostgreSQL Performance Tuning
```sql
-- /etc/postgresql/14/main/postgresql.conf

-- Memory settings
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 16MB

-- Checkpoint settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

-- Connection settings
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'

-- Query optimization
random_page_cost = 1.1
effective_io_concurrency = 200

-- WAL settings
min_wal_size = 1GB
max_wal_size = 4GB
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/14/main/archive/%f'

-- Logging
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
```

### Container Optimizations

#### Docker Performance Settings
```yaml
# docker-compose.override.yml
version: '3.8'

services:
  framework:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      nproc:
        soft: 32768
        hard: 32768
    sysctls:
      - net.core.somaxconn=65535
      - net.ipv4.tcp_keepalive_time=1200
    security_opt:
      - seccomp:unconfined
    
  redis:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    sysctls:
      - net.core.somaxconn=65535
```

### Load Balancing Configuration

#### Nginx Load Balancer
```nginx
# /etc/nginx/sites-available/multi-agent-testing

upstream framework_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3003 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name testing.your-domain.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/testing.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/testing.your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Performance optimizations
    client_max_body_size 100M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    keepalive_timeout 65s;
    send_timeout 60s;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://framework_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    location /ws {
        proxy_pass http://framework_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    location /health {
        access_log off;
        proxy_pass http://framework_backend;
        proxy_set_header Host $host;
    }
    
    location /metrics {
        access_log off;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
        proxy_pass http://framework_backend;
    }
}
```

---

## Security Hardening

### System Security

#### Firewall Configuration (UFW)
```bash
#!/bin/bash
# scripts/configure_firewall.sh

# Reset UFW to defaults
sudo ufw --force reset

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if using non-standard)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application ports (restrict to specific IPs in production)
sudo ufw allow from 10.0.0.0/8 to any port 3000  # API
sudo ufw allow from 10.0.0.0/8 to any port 3001  # WebSocket
sudo ufw allow from 10.0.0.0/8 to any port 8080  # Monitoring

# Allow database ports (restrict to application servers)
sudo ufw allow from 10.0.1.0/24 to any port 6379  # Redis
sudo ufw allow from 10.0.1.0/24 to any port 5432  # PostgreSQL

# Allow monitoring ports (restrict to monitoring servers)
sudo ufw allow from 10.0.2.0/24 to any port 9090  # Prometheus
sudo ufw allow from 10.0.2.0/24 to any port 9100  # Node Exporter

# Rate limiting for SSH
sudo ufw limit ssh

# Enable UFW
sudo ufw --force enable

# Show status
sudo ufw status verbose
```

#### Fail2Ban Configuration
```ini
# /etc/fail2ban/jail.local

[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 600
bantime = 600

[multi-agent-api]
enabled = true
filter = multi-agent-api
logpath = /opt/multi-agent-testing/logs/access.log
maxretry = 10
findtime = 300
bantime = 1800
```

#### Fail2Ban Filter for API
```ini
# /etc/fail2ban/filter.d/multi-agent-api.conf

[Definition]
failregex = ^.*"status":(?:401|403|429).*"ip":"<HOST>".*$
ignoreregex =
```

### Application Security

#### Environment Variables Security
```bash
#!/bin/bash
# scripts/secure_env.sh

ENV_FILE="/opt/multi-agent-testing/.env"

# Set secure permissions
chmod 600 "$ENV_FILE"
chown framework:framework "$ENV_FILE"

# Generate secure secrets if not present
if ! grep -q "JWT_SECRET=" "$ENV_FILE"; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "JWT_SECRET=$JWT_SECRET" >> "$ENV_FILE"
fi

if ! grep -q "ENCRYPTION_KEY=" "$ENV_FILE"; then
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> "$ENV_FILE"
fi

if ! grep -q "REDIS_PASSWORD=" "$ENV_FILE"; then
    REDIS_PASSWORD=$(openssl rand -base64 24)
    echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> "$ENV_FILE"
fi

# Validate environment file
if [ ! -s "$ENV_FILE" ]; then
    echo "Error: Environment file is empty or missing"
    exit 1
fi

echo "Environment security configuration completed"
```

#### SSL/TLS Configuration
```bash
#!/bin/bash
# scripts/setup_ssl.sh

DOMAIN="testing.your-domain.com"
EMAIL="admin@your-domain.com"

# Install Certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive

# Setup auto-renewal
sudo crontab -l | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

# Test renewal
sudo certbot renew --dry-run

echo "SSL/TLS configuration completed for $DOMAIN"
```

#### Security Headers Configuration
```javascript
// src/middleware/security.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

export const securityMiddleware = [
  // Helmet for security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }),

  // Rate limiting
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Slow down repeated requests
  slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // allow 50 requests per windowMs without delay
    delayMs: 500 // add 500ms delay per request after delayAfter
  })
];
```

### Container Security

#### Docker Security Configuration
```dockerfile
# Dockerfile.secure
FROM node:18-alpine AS builder

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S framework -u 1001

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S framework -u 1001

# Set working directory
WORKDIR /app

# Copy application files
COPY --from=builder --chown=framework:nodejs /app/node_modules ./node_modules
COPY --chown=framework:nodejs . .

# Remove unnecessary files
RUN rm -rf .git .github docs tests *.md

# Set security options
USER framework
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

#### Docker Compose Security
```yaml
# docker-compose.security.yml
version: '3.8'

services:
  framework:
    build:
      context: .
      dockerfile: Dockerfile.secure
    user: "1001:1001"
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
    volumes:
      - framework_data:/app/data:rw
      - framework_logs:/app/logs:rw
    security_opt:
      - no-new-privileges:true
      - apparmor:docker-default
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    sysctls:
      - net.ipv4.ip_unprivileged_port_start=0

  redis:
    image: redis:7-alpine
    user: "999:999"
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=50m
    volumes:
      - redis_data:/data:rw
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - SETGID
      - SETUID
```

### Secrets Management

#### HashiCorp Vault Integration
```bash
#!/bin/bash
# scripts/setup_vault.sh

# Install Vault
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt update && sudo apt install vault

# Configure Vault
sudo mkdir -p /etc/vault.d
sudo tee /etc/vault.d/vault.hcl << EOF
ui = true
storage "file" {
  path = "/opt/vault/data"
}
listener "tcp" {
  address = "127.0.0.1:8200"
  tls_disable = 1
}
api_addr = "http://127.0.0.1:8200"
cluster_addr = "https://127.0.0.1:8201"
EOF

# Create Vault user and directories
sudo useradd --system --home /etc/vault.d --shell /bin/false vault
sudo mkdir -p /opt/vault/data
sudo chown -R vault:vault /opt/vault/data /etc/vault.d

# Create systemd service
sudo tee /etc/systemd/system/vault.service << EOF
[Unit]
Description=HashiCorp Vault
Documentation=https://www.vaultproject.io/docs/
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=/etc/vault.d/vault.hcl

[Service]
Type=notify
User=vault
Group=vault
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=yes
PrivateDevices=yes
SecureBits=keep-caps
AmbientCapabilities=CAP_IPC_LOCK
NoNewPrivileges=yes
ExecStart=/usr/bin/vault server -config=/etc/vault.d/vault.hcl
ExecReload=/bin/kill -HUP $MAINPID
KillMode=process
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
StartLimitBurst=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Start and enable Vault
sudo systemctl daemon-reload
sudo systemctl enable vault
sudo systemctl start vault

echo "Vault setup completed. Initialize with: vault operator init"
```

#### Secrets Rotation Script
```bash
#!/bin/bash
# scripts/rotate_secrets.sh

set -euo pipefail

VAULT_ADDR="http://127.0.0.1:8200"
SECRET_PATH="secret/multi-agent-testing"

# Function to generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Function to rotate secret
rotate_secret() {
    local key=$1
    local new_value=$2
    
    echo "Rotating secret: $key"
    vault kv put "$SECRET_PATH" "$key=$new_value"
}

# Rotate database passwords
DB_PASSWORD=$(generate_password)
rotate_secret "DB_PASSWORD" "$DB_PASSWORD"

# Rotate Redis password
REDIS_PASSWORD=$(generate_password)
rotate_secret "REDIS_PASSWORD" "$REDIS_PASSWORD"

# Rotate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
rotate_secret "JWT_SECRET" "$JWT_SECRET"

# Rotate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)
rotate_secret "ENCRYPTION_KEY" "$ENCRYPTION_KEY"

# Update application configuration
echo "Updating application configuration..."
systemctl restart multi-agent-testing

echo "Secret rotation completed successfully"
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Service Startup Issues

**Problem**: Framework fails to start
```bash
# Check service status
systemctl status multi-agent-testing

# Check logs
journalctl -u multi-agent-testing -f

# Common solutions:
# 1. Check environment variables
cat /opt/multi-agent-testing/.env

# 2. Verify dependencies
systemctl status redis-server
systemctl status postgresql

# 3. Check port availability
netstat -tlnp | grep :3000

# 4. Verify permissions
ls -la /opt/multi-agent-testing/
```

**Problem**: Redis connection failures
```bash
# Test Redis connectivity
redis-cli ping

# Check Redis logs
tail -f /var/log/redis/redis-server.log

# Verify Redis configuration
grep -E "^(bind|port|requirepass)" /etc/redis/redis.conf

# Test authentication
redis-cli -a your_password ping
```

**Problem**: Database connection issues
```bash
# PostgreSQL connection test
psql -h localhost -U framework_user -d multi_agent_testing -c "SELECT 1;"

# Check PostgreSQL status
systemctl status postgresql

# View PostgreSQL logs
tail -f /var/log/postgresql/postgresql-14-main.log

# SQLite permissions check
ls -la /opt/multi-agent-testing/data/sqlite/
```

#### 2. Performance Issues

**Problem**: High memory usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Check for memory leaks
node --inspect dist/index.js
# Connect to Chrome DevTools for heap analysis

# Monitor garbage collection
NODE_OPTIONS="--trace-gc" node dist/index.js
```

**Problem**: High CPU usage
```bash
# Identify CPU-intensive processes
top -p $(pgrep -d',' node)

# Profile Node.js application
node --prof dist/index.js
# Generate profile report
node --prof-process isolate-*.log > profile.txt

# Check for infinite loops or blocking operations
strace -p $(pgrep node) -e trace=all
```

**Problem**: Slow test execution
```bash
# Check browser pool status
curl http://localhost:3000/api/v1/system/browser-pool

# Monitor test queue
curl http://localhost:3000/api/v1/system/test-queue

# Check network latency
ping target-website.com
traceroute target-website.com

# Analyze test execution logs
grep "execution_time" /opt/multi-agent-testing/logs/test-executor.log
```

#### 3. Network and Connectivity Issues

**Problem**: API endpoints not responding
```bash
# Test API connectivity
curl -v http://localhost:3000/health
curl -v http://localhost:3000/api/v1/system/status

# Check listening ports
netstat -tlnp | grep node

# Verify firewall rules
sudo ufw status verbose

# Check nginx configuration (if using reverse proxy)
nginx -t
systemctl status nginx
```

**Problem**: WebSocket connection failures
```bash
# Test WebSocket connection
wscat -c ws://localhost:3001

# Check WebSocket logs
grep "websocket" /opt/multi-agent-testing/logs/combined.log

# Verify proxy configuration
curl -H "Upgrade: websocket" -H "Connection: Upgrade" http://localhost:3000/ws
```

#### 4. Browser and Playwright Issues

**Problem**: Browser launch failures
```bash
# Check browser installations
npx playwright install --dry-run

# Test browser launch manually
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  console.log('Browser launched successfully');
  await browser.close();
})();
"

# Check system dependencies
ldd $(which chromium-browser)

# Verify display configuration (for headful mode)
echo $DISPLAY
xvfb-run --auto-servernum --server-args='-screen 0 1280x960x24' node test.js
```

**Problem**: Test timeouts
```bash
# Check test timeout configuration
grep -r "timeout" /opt/multi-agent-testing/config/

# Monitor test execution
tail -f /opt/multi-agent-testing/logs/test-executor.log | grep timeout

# Increase timeout values temporarily
export TEST_TIMEOUT=60000
systemctl restart multi-agent-testing
```

#### 5. Storage and File System Issues

**Problem**: Disk space issues
```bash
# Check disk usage
df -h
du -sh /opt/multi-agent-testing/*

# Clean up old logs
find /opt/multi-agent-testing/logs -name "*.log" -mtime +7 -delete

# Clean up old test artifacts
find /opt/multi-agent-testing/data/artifacts -mtime +30 -delete

# Clean up Docker images
docker system prune -a
```

**Problem**: File permission issues
```bash
# Fix ownership
sudo chown -R framework:framework /opt/multi-agent-testing/

# Fix permissions
sudo chmod -R 755 /opt/multi-agent-testing/
sudo chmod -R 644 /opt/multi-agent-testing/config/
sudo chmod 600 /opt/multi-agent-testing/.env
```

### Diagnostic Scripts

#### System Health Check
```bash
#!/bin/bash
# scripts/health_check.sh

set -euo pipefail

echo "=== Multi-Agent Testing Framework Health Check ==="
echo "Timestamp: $(date)"
echo

# Check system resources
echo "=== System Resources ==="
echo "Memory usage:"
free -h
echo
echo "Disk usage:"
df -h /opt/multi-agent-testing
echo
echo "CPU load:"
uptime
echo

# Check services
echo "=== Service Status ==="
services=("multi-agent-testing" "redis-server" "postgresql" "nginx")
for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "✓ $service: running"
    else
        echo "✗ $service: not running"
    fi
done
echo

# Check network connectivity
echo "=== Network Connectivity ==="
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
    echo "✓ API endpoint: accessible"
else
    echo "✗ API endpoint: not accessible"
fi

if redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis: accessible"
else
    echo "✗ Redis: not accessible"
fi
echo

# Check log files
echo "=== Recent Errors ==="
if [ -f "/opt/multi-agent-testing/logs/error.log" ]; then
    echo "Recent errors (last 10):"
    tail -n 10 /opt/multi-agent-testing/logs/error.log
else
    echo "No error log found"
fi
echo

# Check agent status
echo "=== Agent Status ==="
if command -v curl > /dev/null; then
    curl -s http://localhost:3000/api/v1/system/agents/status | jq '.' 2>/dev/null || echo "Unable to fetch agent status"
else
    echo "curl not available"
fi

echo
echo "Health check completed"
```

#### Log Analysis Script
```bash
#!/bin/bash
# scripts/analyze_logs.sh

set -euo pipefail

LOG_DIR="/opt/multi-agent-testing/logs"
DAYS=${1:-1}

echo "=== Log Analysis (Last $DAYS days) ==="
echo

# Error analysis
echo "=== Error Summary ==="
find "$LOG_DIR" -name "*.log" -mtime -"$DAYS" -exec grep -h "ERROR" {} \; | \
    sort | uniq -c | sort -nr | head -10
echo

# Performance analysis
echo "=== Performance Issues ==="
find "$LOG_DIR" -name "*.log" -mtime -"$DAYS" -exec grep -h "slow\|timeout\|memory" {} \; | \
    sort | uniq -c | sort -nr | head -10
echo

# Test execution analysis
echo "=== Test Execution Summary ==="
find "$LOG_DIR" -name "test-executor.log" -mtime -"$DAYS" -exec grep -h "test_completed" {} \; | \
    wc -l | xargs echo "Total tests executed:"

find "$LOG_DIR" -name "test-executor.log" -mtime -"$DAYS" -exec grep -h "test_failed" {} \; | \
    wc -l | xargs echo "Total tests failed:"
echo

# Agent health analysis
echo "=== Agent Health Issues ==="
find "$LOG_DIR" -name "*.log" -mtime -"$DAYS" -exec grep -h "agent.*unhealthy\|agent.*crashed" {} \; | \
    sort | uniq -c | sort -nr
echo

echo "Log analysis completed"
```

### Emergency Procedures

#### Service Recovery Script
```bash
#!/bin/bash
# scripts/emergency_recovery.sh

set -euo pipefail

echo "=== Emergency Recovery Procedure ==="
echo "Starting at: $(date)"

# Stop all services
echo "Stopping services..."
systemctl stop multi-agent-testing
systemctl stop nginx
sleep 5

# Check for stuck processes
echo "Checking for stuck processes..."
pkill -f "multi-agent-testing" || true
pkill -f "node.*dist/index.js" || true

# Clear temporary files
echo "Clearing temporary files..."
rm -rf /tmp/multi-agent-testing-*
rm -rf /opt/multi-agent-testing/data/temp/*

# Reset Redis (if safe to do so)
read -p "Reset Redis data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    redis-cli FLUSHALL
fi

# Restart services
echo "Restarting services..."
systemctl start redis-server
sleep 5
systemctl start postgresql
sleep 5
systemctl start multi-agent-testing
sleep 10
systemctl start nginx

# Verify recovery
echo "Verifying recovery..."
sleep 30
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ Recovery successful"
else
    echo "✗ Recovery failed - manual intervention required"
    exit 1
fi

echo "Emergency recovery completed at: $(date)"
```

---

## Maintenance Runbooks

### Daily Maintenance Tasks

#### Daily Health Check
```bash
#!/bin/bash
# runbooks/daily_health_check.sh

set -euo pipefail

REPORT_FILE="/var/log/multi-agent-testing/daily_health_$(date +%Y%m%d).log"
ALERT_EMAIL="ops-team@your-domain.com"

exec 1> >(tee -a "$REPORT_FILE")
exec 2>&1

echo "=== Daily Health Check - $(date) ==="

# System metrics
echo "System Metrics:"
echo "- Memory: $(free -h | grep Mem | awk '{print $3"/"$2}')"
echo "- Disk: $(df -h /opt/multi-agent-testing | tail -1 | awk '{print $3"/"$2" ("$5" used)"}')"
echo "- Load: $(uptime | awk -F'load average:' '{print $2}')"

# Service status
echo -e "\nService Status:"
for service in multi-agent-testing redis-server postgresql nginx; do
    if systemctl is-active --quiet "$service"; then
        echo "- $service: ✓ Running"
    else
        echo "- $service: ✗ Not running"
        echo "ALERT: $service is not running" | mail -s "Service Down Alert" "$ALERT_EMAIL"
    fi
done

# API health check
echo -e "\nAPI Health:"
if response=$(curl -s -w "%{http_code}" http://localhost:3000/health -o /tmp/health_response); then
    if [ "$response" = "200" ]; then
        echo "- API: ✓ Healthy"
    else
        echo "- API: ✗ Unhealthy (HTTP $response)"
        echo "API health check failed with HTTP $response" | mail -s "API Health Alert" "$ALERT_EMAIL"
    fi
else
    echo "- API: ✗ Unreachable"
    echo "API is unreachable" | mail -s "API Unreachable Alert" "$ALERT_EMAIL"
fi

# Agent status
echo -e "\nAgent Status:"
if agent_status=$(curl -s http://localhost:3000/api/v1/system/agents/status 2>/dev/null); then
    echo "$agent_status" | jq -r '.agents[] | "- \(.name): \(if .healthy then "✓ Healthy" else "✗ Unhealthy" end)"'
else
    echo "- Unable to fetch agent status"
fi

# Test execution metrics (last 24 hours)
echo -e "\nTest Execution (Last 24h):"
if [ -f "/opt/multi-agent-testing/logs/test-executor.log" ]; then
    total_tests=$(grep -c "test_completed" /opt/multi-agent-testing/logs/test-executor.log | tail -1000 || echo "0")
    failed_tests=$(grep -c "test_failed" /opt/multi-agent-testing/logs/test-executor.log | tail -1000 || echo "0")
    echo "- Total tests: $total_tests"
    echo "- Failed tests: $failed_tests"
    if [ "$total_tests" -gt 0 ]; then
        success_rate=$(echo "scale=2; ($total_tests - $failed_tests) * 100 / $total_tests" | bc)
        echo "- Success rate: ${success_rate}%"
    fi
fi

# Error summary
echo -e "\nRecent Errors (Last 24h):"
if [ -f "/opt/multi-agent-testing/logs/error.log" ]; then
    error_count=$(grep -c "ERROR" /opt/multi-agent-testing/logs/error.log | tail -1000 || echo "0")
    echo "- Total errors: $error_count"
    if [ "$error_count" -gt 0 ]; then
        echo "- Top errors:"
        grep "ERROR" /opt/multi-agent-testing/logs/error.log | tail -1000 | \
            awk '{print $NF}' | sort | uniq -c | sort -nr | head -5 | \
            sed 's/^/  /'
    fi
fi

echo -e "\n=== Daily Health Check Complete ==="
```

#### Log Rotation and Cleanup
```bash
#!/bin/bash
# runbooks/daily_cleanup.sh

set -euo pipefail

LOG_DIR="/opt/multi-agent-testing/logs"
DATA_DIR="/opt/multi-agent-testing/data"
RETENTION_DAYS=30
TEMP_RETENTION_HOURS=24

echo "=== Daily Cleanup - $(date) ==="

# Rotate logs
echo "Rotating logs..."
if [ -f "$LOG_DIR/combined.log" ] && [ $(stat -c%s "$LOG_DIR/combined.log") -gt 104857600 ]; then
    mv "$LOG_DIR/combined.log" "$LOG_DIR/combined.log.$(date +%Y%m%d_%H%M%S)"
    systemctl reload multi-agent-testing
fi

# Clean old logs
echo "Cleaning old logs..."
find "$LOG_DIR" -name "*.log.*" -mtime +$RETENTION_DAYS -delete
find "$LOG_DIR" -name "*.log" -size +100M -mtime +7 -exec gzip {} \;

# Clean temporary files
echo "Cleaning temporary files..."
find "$DATA_DIR/temp" -type f -mtime +1 -delete
find /tmp -name "multi-agent-testing-*" -mtime +1 -delete

# Clean old test artifacts
echo "Cleaning old test artifacts..."
find "$DATA_DIR/artifacts/screenshots" -name "*.png" -mtime +$RETENTION_DAYS -delete
find "$DATA_DIR/artifacts/videos" -name "*.webm" -mtime +$RETENTION_DAYS -delete
find "$DATA_DIR/artifacts/reports" -name "*.html" -mtime +$RETENTION_DAYS -delete

# Clean Docker resources
echo "Cleaning Docker resources..."
docker system prune -f --filter "until=24h"
docker image prune -f --filter "until=168h"

# Update disk usage report
echo "Current disk usage:"
du -sh "$LOG_DIR" "$DATA_DIR"
df -h /opt/multi-agent-testing

echo "=== Daily Cleanup Complete ==="
```

### Weekly Maintenance Tasks

#### Weekly Performance Analysis
```bash
#!/bin/bash
# runbooks/weekly_performance_analysis.sh

set -euo pipefail

REPORT_FILE="/var/log/multi-agent-testing/weekly_performance_$(date +%Y%m%d).log"
DAYS=7

exec 1> >(tee -a "$REPORT_FILE")
exec 2>&1

echo "=== Weekly Performance Analysis - $(date) ==="

# Test execution statistics
echo "Test Execution Statistics (Last $DAYS days):"
if [ -f "/opt/multi-agent-testing/logs/test-executor.log" ]; then
    total_tests=$(find /opt/multi-agent-testing/logs -name "test-executor.log*" -mtime -$DAYS -exec grep -h "test_completed" {} \; | wc -l)
    failed_tests=$(find /opt/multi-agent-testing/logs -name "test-executor.log*" -mtime -$DAYS -exec grep -h "test_failed" {} \; | wc -l)
    
    echo "- Total tests executed: $total_tests"
    echo "- Failed tests: $failed_tests"
    
    if [ "$total_tests" -gt 0 ]; then
        success_rate=$(echo "scale=2; ($total_tests - $failed_tests) * 100 / $total_tests" | bc)
        echo "- Success rate: ${success_rate}%"
        
        # Average execution time
        avg_time=$(find /opt/multi-agent-testing/logs -name "test-executor.log*" -mtime -$DAYS -exec grep -h "execution_time" {} \; | \
            awk '{sum+=$NF; count++} END {if(count>0) print sum/count; else print 0}')
        echo "- Average execution time: ${avg_time}ms"
    fi
fi

# Performance trends
echo -e "\nPerformance Trends:"
echo "- Memory usage trend:"
find /opt/multi-agent-testing/logs -name "system.log*" -mtime -$DAYS -exec grep -h "memory_usage" {} \; | \
    awk '{print $1, $NF}' | sort | tail -10

echo "- Response time trend:"
find /opt/multi-agent-testing/logs -name "access.log*" -mtime -$DAYS -exec grep -h "response_time" {} \; | \
    awk '{sum+=$NF; count++} END {if(count>0) print "Average:", sum/count "ms"; else print "No data"}'

# Error analysis
echo -e "\nError Analysis:"
echo "- Top errors (Last $DAYS days):"
find /opt/multi-agent-testing/logs -name "*.log*" -mtime -$DAYS -exec grep -h "ERROR" {} \; | \
    awk '{print $NF}' | sort | uniq -c | sort -nr | head -10

# Resource utilization
echo -e "\nResource Utilization:"
echo "- Peak memory usage: $(grep -h "memory_usage" /opt/multi-agent-testing/logs/system.log* | sort -k2 -nr | head -1 | awk '{print $2}')"
echo "- Peak CPU usage: $(grep -h "cpu_usage" /opt/multi-agent-testing/logs/system.log* | sort -k2 -nr | head -1 | awk '{print $2}')"

# Recommendations
echo -e "\nRecommendations:"
if [ "$failed_tests" -gt 0 ] && [ "$total_tests" -gt 0 ]; then
    failure_rate=$(echo "scale=2; $failed_tests * 100 / $total_tests" | bc)
    if (( $(echo "$failure_rate > 5" | bc -l) )); then
        echo "- High failure rate detected ($failure_rate%). Investigate common failure patterns."
    fi
fi

echo "=== Weekly Performance Analysis Complete ==="
```

#### Weekly Security Audit
```bash
#!/bin/bash
# runbooks/weekly_security_audit.sh

set -euo pipefail

REPORT_FILE="/var/log/multi-agent-testing/security_audit_$(date +%Y%m%d).log"

exec 1> >(tee -a "$REPORT_FILE")
exec 2>&1

echo "=== Weekly Security Audit - $(date) ==="

# Check for security updates
echo "System Security Updates:"
apt list --upgradable 2>/dev/null | grep -i security | head -10

# Check file permissions
echo -e "\nFile Permission Audit:"
find /opt/multi-agent-testing -type f -perm /o+w -ls | head -10
find /opt/multi-agent-testing -name "*.env" ! -perm 600 -ls

# Check for suspicious login attempts
echo -e "\nSecurity Log Analysis:"
if [ -f "/var/log/auth.log" ]; then
    echo "- Failed SSH attempts (Last 7 days):"
    grep "Failed password" /var/log/auth.log | grep "$(date -d '7 days ago' '+%b %d')" | wc -l
    
    echo "- Successful SSH logins (Last 7 days):"
    grep "Accepted password" /var/log/auth.log | grep "$(date -d '7 days ago' '+%b %d')" | wc -l
fi

# Check SSL certificate expiry
echo -e "\nSSL Certificate Status:"
if command -v openssl > /dev/null; then
    cert_expiry=$(echo | openssl s_client -servername testing.your-domain.com -connect testing.your-domain.com:443 2>/dev/null | \
        openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    echo "- Certificate expires: $cert_expiry"
    
    # Check if certificate expires within 30 days
    if [ $(date -d "$cert_expiry" +%s) -lt $(date -d "+30 days" +%s) ]; then
        echo "- WARNING: Certificate expires within 30 days!"
    fi
fi

# Check for open ports
echo -e "\nOpen Ports Audit:"
netstat -tlnp | grep LISTEN | awk '{print $4, $7}' | sort

# Check Docker security
echo -e "\nDocker Security:"
if command -v docker > /dev/null; then
    echo "- Running containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    
    echo "- Container security options:"
    docker inspect $(docker ps -q) --format '{{.Name}}: {{.HostConfig.SecurityOpt}}' 2>/dev/null
fi

# Check fail2ban status
echo -e "\nFail2ban Status:"
if command -v fail2ban-client > /dev/null; then
    fail2ban-client status
fi

echo "=== Weekly Security Audit Complete ==="
```

### Monthly Maintenance Tasks

#### Monthly System Optimization
```bash
#!/bin/bash
# runbooks/monthly_optimization.sh

set -euo pipefail

echo "=== Monthly System Optimization - $(date) ==="

# Database optimization
echo "Database Optimization:"
if systemctl is-active --quiet postgresql; then
    echo "- Running PostgreSQL VACUUM and ANALYZE..."
    sudo -u postgres psql -d multi_agent_testing -c "VACUUM ANALYZE;"
    
    echo "- Updating PostgreSQL statistics..."
    sudo -u postgres psql -d multi_agent_testing -c "ANALYZE;"
fi

# Redis optimization
echo -e "\nRedis Optimization:"
if systemctl is-active --quiet redis-server; then
    echo "- Redis memory usage: $(redis-cli info memory | grep used_memory_human)"
    echo "- Running Redis BGSAVE..."
    redis-cli BGSAVE
fi

# System package updates
echo -e "\nSystem Updates:"
apt update
apt list --upgradable

# Docker image updates
echo -e "\nDocker Image Updates:"
if command -v docker > /dev/null; then
    echo "- Pulling latest images..."
    docker-compose pull
    
    echo "- Cleaning up old images..."
    docker image prune -f --filter "until=720h"  # 30 days
fi

# Log analysis and archiving
echo -e "\nLog Management:"
echo "- Compressing old logs..."
find /opt/multi-agent-testing/logs -name "*.log" -mtime +30 -exec gzip {} \;

echo "- Archiving logs older than 90 days..."
find /opt/multi-agent-testing/logs -name "*.log.gz" -mtime +90 -exec mv {} /opt/multi-agent-testing/archive/ \;

# Performance baseline update
echo -e "\nPerformance Baseline Update:"
echo "- Current system metrics:"
echo "  Memory: $(free -h | grep Mem | awk '{print $3"/"$2}')"
echo "  Disk: $(df -h /opt/multi-agent-testing | tail -1 | awk '{print $5}')"
echo "  Load: $(uptime | awk -F'load average:' '{print $2}')"

# Generate monthly report
echo -e "\nGenerating Monthly Report..."
/opt/multi-agent-testing/scripts/generate_monthly_report.sh

echo "=== Monthly System Optimization Complete ==="
```

#### Monthly Backup Verification
```bash
#!/bin/bash
# runbooks/monthly_backup_verification.sh

set -euo pipefail

BACKUP_DIR="/opt/multi-agent-testing/backups"
TEST_RESTORE_DIR="/tmp/backup_test_$(date +%Y%m%d)"

echo "=== Monthly Backup Verification - $(date) ==="

# Find latest backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/framework_backup_*.tar.gz | head -n1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No backups found!"
    exit 1
fi

echo "Testing backup: $LATEST_BACKUP"

# Create test environment
mkdir -p "$TEST_RESTORE_DIR"
cd "$TEST_RESTORE_DIR"

# Extract backup
echo "Extracting backup..."
tar -xzf "$LATEST_BACKUP"

BACKUP_NAME=$(basename "$LATEST_BACKUP" .tar.gz)

# Verify backup contents
echo "Verifying backup contents..."
if [ -f "$BACKUP_NAME/manifest.json" ]; then
    echo "- Manifest found: ✓"
    cat "$BACKUP_NAME/manifest.json" | jq '.'
else
    echo "- Manifest missing: ✗"
fi

# Test database backup
if [ -f "$BACKUP_NAME/postgres_dump.sql" ]; then
    echo "- PostgreSQL backup found: ✓"
    echo "  Size: $(du -h "$BACKUP_NAME/postgres_dump.sql" | cut -f1)"
    
    # Test SQL syntax
    if pg_dump --help > /dev/null 2>&1; then
        echo "  SQL syntax check: $(head -10 "$BACKUP_NAME/postgres_dump.sql" | grep -q "PostgreSQL database dump" && echo "✓" || echo "✗")"
    fi
fi

if [ -f "$BACKUP_NAME/sqlite_backup.db" ]; then
    echo "- SQLite backup found: ✓"
    echo "  Size: $(du -h "$BACKUP_NAME/sqlite_backup.db" | cut -f1)"
    
    # Test SQLite integrity
    if sqlite3 "$BACKUP_NAME/sqlite_backup.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo "  Integrity check: ✓"
    else
        echo "  Integrity check: ✗"
    fi
fi

# Test Redis backup
if [ -f "$BACKUP_NAME/redis_dump.rdb" ]; then
    echo "- Redis backup found: ✓"
    echo "  Size: $(du -h "$BACKUP_NAME/redis_dump.rdb" | cut -f1)"
fi

# Test application data
if [ -f "$BACKUP_NAME/app_data.tar.gz" ]; then
    echo "- Application data backup found: ✓"
    echo "  Size: $(du -h "$BACKUP_NAME/app_data.tar.gz" | cut -f1)"
    
    # Extract and verify structure
    tar -tzf "$BACKUP_NAME/app_data.tar.gz" | head -10
fi

# Cleanup
cd /
rm -rf "$TEST_RESTORE_DIR"

echo "=== Monthly Backup Verification Complete ==="
```

### Automated Maintenance Scheduling

#### Crontab Configuration
```bash
# /etc/cron.d/multi-agent-testing

# Daily tasks
0 2 * * * framework /opt/multi-agent-testing/runbooks/daily_health_check.sh
30 2 * * * framework /opt/multi-agent-testing/runbooks/daily_cleanup.sh
0 3 * * * framework /opt/multi-agent-testing/scripts/backup.sh

# Weekly tasks
0 4 * * 0 framework /opt/multi-agent-testing/runbooks/weekly_performance_analysis.sh
0 5 * * 0 framework /opt/multi-agent-testing/runbooks/weekly_security_audit.sh

# Monthly tasks
0 6 1 * * framework /opt/multi-agent-testing/runbooks/monthly_optimization.sh
0 7 1 * * framework /opt/multi-agent-testing/runbooks/monthly_backup_verification.sh

# Monitoring tasks
*/15 * * * * framework /opt/multi-agent-testing/scripts/backup_monitor.sh
*/5 * * * * framework /opt/multi-agent-testing/scripts/health_check.sh > /dev/null 2>&1
```

---

## Appendix: Scripts & Templates

### Setup Scripts

#### Complete Setup Script
```bash
#!/bin/bash
# scripts/setup.sh

set -euo pipefail

# Configuration
INSTALL_DIR="/opt/multi-agent-testing"
SERVICE_USER="framework"
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/tmp/multi-agent-testing-setup.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${GREEN}=== Multi-Agent Testing Framework Setup ===${NC}"
echo "Starting setup at: $(date)"
echo "Log file: $LOG_FILE"
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS version${NC}"
    exit 1
fi

echo "Detected OS: $OS $VER"

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install essential packages
echo -e "${YELLOW}Installing essential packages...${NC}"
apt install -y curl wget git build-essential python3 python3-pip \
    software-properties-common apt-transport-https ca-certificates \
    gnupg lsb-release jq bc sqlite3 redis-server nginx

# Install Node.js
echo -e "${YELLOW}Installing Node.js $NODE_VERSION...${NC}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs

# Install Docker
echo -e "${YELLOW}Installing Docker...${NC}"
curl -fsSL https://get.docker.com | sh
usermod -aG docker $SERVICE_USER 2>/dev/null || true

# Install Docker Compose
echo -e "${YELLOW}Installing Docker Compose...${NC}"
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create service user
echo -e "${YELLOW}Creating service user...${NC}"
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/bash -d "$INSTALL_DIR" -m "$SERVICE_USER"
fi

# Create directory structure
echo -e "${YELLOW}Creating directory structure...${NC}"
mkdir -p "$INSTALL_DIR"/{config,data,logs,scripts,backups,temp}
mkdir -p "$INSTALL_DIR"/data/{sqlite,artifacts,cache}
mkdir -p "$INSTALL_DIR"/logs/{agents,system,tests}

# Set permissions
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"

# Clone repository (if not already present)
if [ ! -f "$INSTALL_DIR/package.json" ]; then
    echo -e "${YELLOW}Cloning repository...${NC}"
    cd "$INSTALL_DIR"
    # Replace with actual repository URL
    git clone https://github.com/your-org/multi-agent-testing-framework.git .
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
fi

# Install Node.js dependencies
echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
cd "$INSTALL_DIR"
sudo -u "$SERVICE_USER" npm install

# Install Playwright browsers
echo -e "${YELLOW}Installing Playwright browsers...${NC}"
sudo -u "$SERVICE_USER" npx playwright install
sudo -u "$SERVICE_USER" npx playwright install-deps

# Configure Redis
echo -e "${YELLOW}Configuring Redis...${NC}"
cp /etc/redis/redis.conf /etc/redis/redis.conf.backup
cat > /etc/redis/redis.conf << 'EOF'
bind 127.0.0.1
port 6379
protected-mode yes
requirepass $(openssl rand -base64 24)
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
dir /var/lib/redis
dbfilename dump.rdb
loglevel notice
logfile /var/log/redis/redis-server.log
EOF

systemctl enable redis-server
systemctl restart redis-server

# Configure environment
echo -e "${YELLOW}Configuring environment...${NC}"
if [ ! -f "$INSTALL_DIR/.env" ]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    
    # Generate secure secrets
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    REDIS_PASSWORD=$(grep requirepass /etc/redis/redis.conf | awk '{print $2}')
    
    sed -i "s/your_jwt_secret_key/$JWT_SECRET/" "$INSTALL_DIR/.env"
    sed -i "s/your_32_character_encryption_key/$ENCRYPTION_KEY/" "$INSTALL_DIR/.env"
    sed -i "s/your_secure_redis_password/$REDIS_PASSWORD/" "$INSTALL_DIR/.env"
    
    chmod 600 "$INSTALL_DIR/.env"
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
fi

# Build application
echo -e "${YELLOW}Building application...${NC}"
cd "$INSTALL_DIR"
sudo -u "$SERVICE_USER" npm run build

# Install systemd service
echo -e "${YELLOW}Installing systemd service...${NC}"
cat > /etc/systemd/system/multi-agent-testing.service << EOF
[Unit]
Description=Multi-Agent Testing Framework
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/node dist/index.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=multi-agent-testing

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/data $INSTALL_DIR/logs /tmp

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable multi-agent-testing

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

# Install monitoring (optional)
read -p "Install monitoring stack (Prometheus/Grafana)? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Installing monitoring stack...${NC}"
    cd "$INSTALL_DIR"
    docker-compose -f docker-compose.monitoring.yml up -d
fi

# Start services
echo -e "${YELLOW}Starting services...${NC}"
systemctl start multi-agent-testing

# Wait for service to be ready
echo -e "${YELLOW}Waiting for service to be ready...${NC}"
sleep 30

# Verify installation
echo -e "${YELLOW}Verifying installation...${NC}"
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Service is running and healthy${NC}"
else
    echo -e "${RED}✗ Service health check failed${NC}"
    echo "Check logs: journalctl -u multi-agent-testing -f"
fi

# Display summary
echo
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo "Installation directory: $INSTALL_DIR"
echo "Service user: $SERVICE_USER"
echo "API endpoint: http://localhost:3000"
echo "Health check: http://localhost:3000/health"
echo
echo "Next steps:"
echo "1. Configure your Mistral API key in $INSTALL_DIR/.env"
echo "2. Review configuration in $INSTALL_DIR/config/"
echo "3. Access the API documentation at http://localhost:3000/docs"
echo
echo "Logs:"
echo "- Service logs: journalctl -u multi-agent-testing -f"
echo "- Application logs: tail -f $INSTALL_DIR/logs/combined.log"
echo
echo "Setup completed at: $(date)"
```

#### Docker Compose Templates

##### Production Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  framework:
    image: multi-agent-testing:${VERSION:-latest}
    container_name: multi-agent-framework
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "3001:3001"
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=sqlite:///data/framework.db
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - framework_data:/app/data
      - framework_logs:/app/logs
      - framework_config:/app/config
    networks:
      - multi-agent-network
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

  redis:
    image: redis:7-alpine
    container_name: multi-agent-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 2gb --maxmemory-policy allkeys-lru
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
      - ./config/redis.conf:/usr/local/etc/redis/redis.conf
    networks:
      - multi-agent-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  # Postgres service removed in favor of SQLite datastore
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

  nginx:
    image: nginx:alpine
    container_name: multi-agent-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx.conf:/etc/nginx/nginx.conf
      - ./config/ssl:/etc/nginx/ssl
      - nginx_logs:/var/log/nginx
    networks:
      - multi-agent-network
    depends_on:
      - framework
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: multi-agent-prometheus
    restart: unless-stopped
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    networks:
      - monitoring-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

  grafana:
    image: grafana/grafana:10.1.0
    container_name: multi-agent-grafana
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    networks:
      - monitoring-network
    depends_on:
      - prometheus
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  alertmanager:
    image: prom/alertmanager:v0.26.0
    container_name: multi-agent-alertmanager
    restart: unless-stopped
    ports:
      - "127.0.0.1:9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    networks:
      - monitoring-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

networks:
  multi-agent-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
  monitoring-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16

volumes:
  framework_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/multi-agent-testing/data
  framework_logs:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/multi-agent-testing/logs
  framework_config:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/multi-agent-testing/config
  redis_data:
  postgres_data:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  nginx_logs:
```

##### Development Docker Compose
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  framework:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: multi-agent-framework-dev
    ports:
      - "3000:3000"
      - "3001:3001"
      - "8080:8080"
      - "9229:9229"  # Node.js debugger
    environment:
      - NODE_ENV=development
      - DEBUG=multi-agent:*
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=sqlite:///app/data/framework.db
    volumes:
      - .:/app
      - /app/node_modules
      - framework_data_dev:/app/data
    networks:
      - multi-agent-network-dev
    depends_on:
      - redis
    command: npm run dev

  redis:
    image: redis:7-alpine
    container_name: multi-agent-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data_dev:/data
    networks:
      - multi-agent-network-dev

  mailhog:
    image: mailhog/mailhog
    container_name: multi-agent-mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    networks:
      - multi-agent-network-dev

networks:
  multi-agent-network-dev:
    driver: bridge

volumes:
  framework_data_dev:
  redis_data_dev:
```

### Configuration Templates

#### Nginx Configuration Template
```nginx
# config/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Upstream
    upstream framework_backend {
        least_conn;
        server framework:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # Main server block
    server {
        listen 443 ssl http2;
        server_name testing.your-domain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: ws:;" always;

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://framework_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # WebSocket endpoint
        location /ws {
            proxy_pass http://framework_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket specific timeouts
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # Health check endpoint
        location /health {
            access_log off;
            proxy_pass http://framework_backend;
            proxy_set_header Host $host;
        }

        # Metrics endpoint (restricted)
        location /metrics {
            access_log off;
            allow 127.0.0.1;
            allow 10.0.0.0/8;
            allow 172.16.0.0/12;
            allow 192.168.0.0/16;
            deny all;
            proxy_pass http://framework_backend;
        }

        # Static files
        location /static/ {
            alias /var/www/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Root location
        location / {
            proxy_pass http://framework_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

---

## Conclusion

This comprehensive deployment and operations guide provides everything needed to successfully deploy, configure, and maintain the Multi-Agent Testing Framework in production environments. The guide covers:

- **Complete setup procedures** from system preparation to service deployment
- **Production-ready configurations** for all components and integrations
- **Automated CI/CD pipelines** for reliable deployments
- **Comprehensive monitoring** with Prometheus, Grafana, and alerting
- **Robust backup and recovery** procedures with automated verification
- **Performance tuning** guidelines for optimal system operation
- **Security hardening** measures and best practices
- **Detailed troubleshooting** guides for common issues
- **Maintenance runbooks** for ongoing operational tasks
- **Ready-to-use scripts** and configuration templates

By following this guide, operations teams can ensure reliable, secure, and high-performance operation of the Multi-Agent Testing Framework, enabling development teams to focus on creating and maintaining high-quality automated tests.

The framework's architecture supports horizontal scaling, high availability, and enterprise-grade security, making it suitable for organizations of all sizes. Regular maintenance procedures and monitoring ensure long-term stability and optimal performance.

For additional support or customization requirements, refer to the technical specifications and implementation roadmap documents, or contact the development team.
