# ── Multi-Agent Chatbot System — Backend ─────────────────────────────────────
# One image for all backend services (manager + 4 agents).
# The CMD is overridden per-service in docker-compose.yml.
#
# Build:  docker build -t mac-backend .
# Run manager directly (without compose):
#   docker run --env-file .env -p 3000:3000 mac-backend

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
COPY src/           ./src/
COPY .env.example   ./.env.example

# Pre-create log directory so volume mounts work with the right owner
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

# Manager port — individual agent ports are set via AGENT_{N}_PORT env vars
EXPOSE 3000

# Default: start the manager.
# Override in docker-compose: command: node src/agents/agent-llama3/index.js
CMD ["node", "src/agents/manager/index.js"]
