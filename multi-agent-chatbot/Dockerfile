# ── Multi-Agent Chatbot System — Next.js Frontend ────────────────────────────
#
# Three-stage build:
#   deps    — install all dependencies (including devDeps needed for build)
#   builder — run `next build`
#   runner  — production image with only what next start needs

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_API_URL is baked into the client bundle at build time.
# Pass the public backend URL as a build arg so it ends up in the bundle.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Stage 3: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

ENV NODE_ENV=production
ENV PORT=3002

# Copy only what `next start` needs
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public       ./public

USER nodejs
EXPOSE 3002

CMD ["node_modules/.bin/next", "start", "-p", "3002"]
