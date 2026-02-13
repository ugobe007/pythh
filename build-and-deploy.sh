#!/bin/bash
# Build locally with env vars, then deploy to Fly.io

echo "🔨 Building locally with environment variables..."

# Load secrets from Fly.io (they're set as secrets)
# For local build, we need to get them from Fly.io or use .env
# But for Fly.io deployment, secrets are automatically available

# Build locally first to ensure env vars are embedded
export VITE_SUPABASE_URL="https://unkpogyhhjbvxxjvmxlt.supabase.co"
export VITE_SUPABASE_ANON_KEY="sb_publishable_Ii6LaEBqdDaBkPfNl_lsXg_kiUGPiD2"

echo "Building with Supabase credentials..."
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful"
  echo "🚀 Deploying to Fly.io..."
  flyctl deploy --remote-only
else
  echo "❌ Build failed"
  exit 1
fi





