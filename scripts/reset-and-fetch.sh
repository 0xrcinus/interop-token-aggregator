#!/bin/bash
set -e

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

echo "🗑️  Cleaning database..."
PGPASSWORD=$DATABASE_PASSWORD psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER -d $DATABASE_NAME << EOF
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
