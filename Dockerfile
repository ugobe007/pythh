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

# Build the frontend
RUN npm run build

# Prune devDependencies — only production deps for the final image
RUN npm prune --production --legacy-peer-deps

# ============================================
# Stage 2: PRODUCTION (lean runtime image)
# ============================================
FROM node:20-alpine

WORKDIR /app

# Only curl needed at runtime (for health checks)
RUN apk add --no-cache curl

# Install PM2 globally
RUN npm install -g pm2

# Copy production node_modules (no devDependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server code + config files needed at runtime
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ecosystem.prod.config.js ./ecosystem.prod.config.js

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start via PM2 runtime
CMD ["pm2-runtime", "start", "ecosystem.prod.config.js"]
