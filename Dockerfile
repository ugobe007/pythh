# Combined Frontend + Backend for Fly.io
# Serves React frontend AND Express API from a single container

FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# The server will serve both:
# - Static files from /app/dist (frontend)
# - API endpoints at /api/* (backend)

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port Fly.io expects
EXPOSE 8080

# Start the Express server (which serves both frontend + API)
# Use tsx for TypeScript support (Node 20 doesn't support .ts require natively)
CMD ["npx", "tsx", "server/index.js"]
