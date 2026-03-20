# ============================================
# Stage 1: BUILD (compile frontend + install all deps)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time deps for native modules (pg, bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy package files first (Docker layer caching)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for Vite build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Vite inlines VITE_* env vars at build time — pass them as build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build the frontend — VITE_* vars injected as build args above
RUN npm run build

# Prune devDependencies — only production deps for the final image
RUN npm prune --production --legacy-peer-deps

# ============================================
# Stage 2: PRODUCTION (lean runtime image)
# ============================================
# Note: Supabase migrations are NOT in this image. Run `supabase db push` (or
# apply in Supabase Dashboard) before/after deploy so your DB has the latest schema.
# See docs/DEPLOY.md.
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Copy only what the app needs at runtime (no supabase/, no dev files)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ecosystem.prod.config.js ./ecosystem.prod.config.js
COPY --from=builder /app/run-ml-training.js ./run-ml-training.js

# Set production environment (FLY_APP_NAME so app uses 8080 when on Fly)
ENV NODE_ENV=production
ENV PORT=8080
ENV FLY_APP_NAME=hot-honey
# Reduce log volume in production (pino: warn only; set LOG_LEVEL=info for more)
ENV LOG_LEVEL=warn

EXPOSE 8080

# Run API server with tsx so .ts services (startupScoringService, urlScrapingService) load correctly
CMD ["npx", "tsx", "server/index.js"]
