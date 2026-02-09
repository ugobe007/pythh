# Combined Frontend + Backend + Background Workers for Fly.io
# Serves React frontend, Express API, and all scrapers/workers from a single container
# Managed by PM2 process manager

FROM node:20-alpine

WORKDIR /app

# Install build dependencies + curl for health checks
RUN apk add --no-cache python3 make g++ curl

# Install PM2 globally (process manager for production)
RUN npm install -g pm2

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Vite inlines VITE_* env vars at build time — pass them as build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build the frontend (VITE_* vars are now available to Vite)
RUN npm run build

# The server will serve both:
# - Static files from /app/dist (frontend)
# - API endpoints at /api/* (backend)
# PM2 also manages all background scrapers, ML pipelines, and match engine

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port Fly.io expects
EXPOSE 8080

# Start all processes via PM2 (Express server + scrapers + workers)
# pm2-runtime keeps the container alive and handles signals properly
CMD ["pm2-runtime", "start", "ecosystem.prod.config.js"]
