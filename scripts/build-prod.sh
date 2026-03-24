#!/bin/bash
set -e

echo "=== Building The Necio Cobranza for production ==="

# Build shared libraries first
echo "-> Building shared libraries..."
pnpm --filter @workspace/db run build 2>/dev/null || true
pnpm --filter @workspace/api-zod run build 2>/dev/null || true
pnpm --filter @workspace/api-client-react run build 2>/dev/null || true

# Build the React frontend
echo "-> Building frontend..."
BASE_PATH=/ PORT=3000 NODE_ENV=production \
  pnpm --filter @workspace/necio-app run build

# Build the API server
echo "-> Building API server..."
pnpm --filter @workspace/api-server run build

echo "=== Build complete ==="
