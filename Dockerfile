FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# Copiar archivos de definición de paquetes
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar prisma y source files
COPY prisma ./prisma
COPY . .

# Generar cliente de Prisma 7
RUN npx prisma generate

# ---------- dev ----------
FROM base AS dev
WORKDIR /app
EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "dev"]

# ---------- prod ----------
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
