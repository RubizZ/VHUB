#!/bin/sh

# Sincronizar esquema de base de datos
echo "🔄 Sincronizando base de datos con Prisma..."
npx prisma db push --accept-data-loss

if [ "$NODE_ENV" = "development" ]; then
  echo "🚀 Arrancando en modo DESARROLLO (Hot Reload activo)..."
  # En dev usamos npm run dev
  npm run dev
else
  echo "📦 Arrancando en modo PRODUCCIÓN..."
  # En producción (standalone) usamos node server.js
  node server.js
fi
