#!/bin/sh
# Trigger test generation from Docker network (bypasses Windows WSL Redis conflict)
# Usage: ./trigger-test-docker.sh

docker run --rm \
  --network project_default \
  -v "$(pwd):/app" \
  -w /app \
  node:20-alpine \
  sh -c "npm install --silent redis uuid > /dev/null 2>&1 && node trigger-test-gen.js"
