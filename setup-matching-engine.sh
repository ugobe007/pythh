#!/bin/bash

# Setup script for bulletproof matching engine
# Runs migrations and starts worker

set -e

echo "🔧 Setting up bulletproof matching engine..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check environment
if [ ! -f .env ]; then
  echo -e "${RED}❌ .env file not found${NC}"
  exit 1
fi

# Load environment variables
source .env

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}❌ Supabase credentials not found in .env${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"

# Function to run SQL migration
run_migration() {
  local file=$1
  local description=$2
  
  echo -e "${BLUE}📝 Running: $description${NC}"
  
  # Use Supabase CLI if available, otherwise use psql
  if command -v supabase &> /dev/null; then
    supabase db execute -f "$file"
  else
    # Extract database URL from SUPABASE_URL
    # Note: This is simplified - you may need to adjust based on your setup
    echo -e "${BLUE}   (Using direct SQL execution)${NC}"
    npx tsx -e "
      import { createClient } from '@supabase/supabase-js';
      import { readFileSync } from 'fs';
      
      const sql = readFileSync('$file', 'utf-8');
      const supabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      // Split on semicolons and run each statement
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error('SQL Error:', error);
            process.exit(1);
          }
        }
      }
      
      console.log('✅ Migration completed');
    " || {
      echo -e "${RED}❌ Migration failed${NC}"
      echo "Please run the SQL file manually: $file"
      exit 1
    }
  fi
  
  echo -e "${GREEN}✅ $description complete${NC}"
}

# Run migrations in order
echo ""
echo "📦 Running database migrations..."
echo ""

run_migration "migrations/create-match-runs-table.sql" "Create match_runs table"
run_migration "migrations/add-canonical-url-columns.sql" "Add canonical URL columns"

echo ""
echo -e "${GREEN}✅ All migrations complete${NC}"
echo ""

# Build TypeScript files
echo "🔨 Building TypeScript files..."
if [ -d "server" ]; then
  npx tsc server/matchWorker.ts --outDir dist --moduleResolution node --esModuleInterop || {
    echo -e "${BLUE}ℹ️  TypeScript build skipped (will use tsx for runtime)${NC}"
  }
fi

# Add to PM2 ecosystem
echo ""
echo "📋 Adding match worker to PM2..."

# Check if ecosystem.config.js exists
if [ -f "ecosystem.config.js" ]; then
  # Check if match-worker already exists
  if grep -q "name.*match-worker" ecosystem.config.js; then
    echo -e "${BLUE}ℹ️  match-worker already in ecosystem.config.js${NC}"
  else
    echo -e "${BLUE}ℹ️  Please add this to ecosystem.config.js:${NC}"
    echo ""
    echo "  {"
    echo "    name: 'match-worker',"
    echo "    script: 'npx',"
    echo "    args: 'tsx server/matchWorker.ts',"
    echo "    cwd: __dirname,"
    echo "    instances: 1,"
    echo "    autorestart: true,"
    echo "    watch: false,"
    echo "    max_memory_restart: '500M',"
    echo "    env: {"
    echo "      NODE_ENV: 'production'"
    echo "    }"
    echo "  }"
    echo ""
  fi
else
  echo -e "${RED}❌ ecosystem.config.js not found${NC}"
fi

echo ""
echo "🎯 Setup complete! Next steps:"
echo ""
echo "1. Start the match worker:"
echo -e "   ${BLUE}pm2 start server/matchWorker.ts --name match-worker --interpreter tsx${NC}"
echo ""
echo "2. Start your Express server:"
echo -e "   ${BLUE}npm run dev${NC}"
echo ""
echo "3. Test the endpoints:"
echo -e "   ${BLUE}curl -X POST http://localhost:3002/api/match/run -H 'Content-Type: application/json' -d '{\"url\":\"example.com\"}'${NC}"
echo ""
echo "4. View worker logs:"
echo -e "   ${BLUE}pm2 logs match-worker${NC}"
echo ""
echo "✨ The matching engine is now bulletproof!"
echo ""
