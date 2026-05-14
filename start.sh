#!/bin/sh

# Wait for DB to be ready (handled by docker-compose depends_on healthcheck mostly, but safe to have)
echo "Running database migrations/sync..."
npx prisma db push --accept-data-loss

echo "Starting application..."
node server.js
