


# ── Stage 1: install production dependencies ──────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy manifests first so Docker caches this layer unless deps change
COPY package*.json ./
RUN npm ci --production --ignore-scripts

# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user — defence-in-depth
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

# Application code
COPY --from=deps /app/node_modules ./node_modules
COPY server.js      ./server.js
COPY src/           ./src/
COPY .env.example   ./.env.example

# Pre-create log directory so volume mounts work with the right owner
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 3000

CMD ["node", "server.js"]
