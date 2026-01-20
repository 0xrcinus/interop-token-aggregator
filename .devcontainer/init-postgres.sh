#!/bin/bash
set -e

echo "Starting PostgreSQL initialization..."

# Start PostgreSQL if not running
if ! pg_isready -p 5433 > /dev/null 2>&1; then
    echo "Starting PostgreSQL on port 5433..."
    /usr/bin/pg_ctlcluster 16 main start

    # Wait for PostgreSQL to be ready
    for i in {1..30}; do
        if pg_isready -p 5433 > /dev/null 2>&1; then
            echo "PostgreSQL is ready!"
            break
        fi
        echo "Waiting for PostgreSQL to start... ($i/30)"
        sleep 1
    done
fi

# Create user and database if they don't exist
sudo -u postgres psql -p 5433 -tc "SELECT 1 FROM pg_user WHERE usename = 'dev'" | grep -q 1 || \
    sudo -u postgres psql -p 5433 -c "CREATE USER dev WITH PASSWORD 'dev' CREATEDB;"

sudo -u postgres psql -p 5433 -tc "SELECT 1 FROM pg_database WHERE datname = 'tokendb'" | grep -q 1 || \
    sudo -u postgres psql -p 5433 -c "CREATE DATABASE tokendb OWNER dev;"

echo "PostgreSQL initialization complete!"
echo "Database: tokendb"
echo "User: dev"
echo "Port: 5433"
