# ── Stage 1: Build & Dependencies ──────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for tests/linting)
RUN npm ci

# Copy application source code
COPY . .

# ── Stage 2: Production Release ────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install production dependencies only. Native bcrypt (optional dep, used
# by PASSWORD_HASH=native) needs a toolchain to compile on Alpine/musl, so
# we add build deps just for the install and then remove them to keep the
# runtime image small.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev \
 && apk del .build-deps

# Copy source code from builder stage
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/server.js ./server.js
COPY --from=builder /usr/src/app/worker.js ./worker.js

# Use non-root user for security
USER node

EXPOSE 3001

CMD ["node", "server.js"]
