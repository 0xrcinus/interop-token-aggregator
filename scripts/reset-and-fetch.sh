#!/bin/bash
set -e

# Load environment variables from .env.local
source <(grep -v '^#' .env.local | sed 's/^/export /')

echo "🗑️  Cleaning database..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DATABASE << EOF
TRUNCATE TABLE tokens, chain_provider_support, provider_fetches, chains RESTART IDENTITY CASCADE;
EOF

echo "✅ Database cleaned!"
echo ""
echo "🔄 Triggering provider fetch..."

# Trigger the admin fetch endpoint
RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/fetch \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET")

echo "$RESPONSE" | jq '.'

echo ""
echo "✅ Fetch completed!"
