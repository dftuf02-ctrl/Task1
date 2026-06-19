# ── Stage 1: Build & Dependencies ──────────────────────────────────────
FROM node:22-alpine AS builder

# Patch OS packages to the latest fixed versions in the Alpine repo. The base
# image lags behind the repo between releases, so this clears fixable
# HIGH/CRITICAL OS-layer CVEs that the Trivy image-scan gate would otherwise
# fail the build on.
RUN apk --no-cache upgrade

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for tests/linting)
RUN npm ci

# Copy application source code
COPY . .

# ── Stage 2: Production Release ────────────────────────────────────────
FROM node:22-alpine AS runner

# Patch OS packages in the FINAL image — this is the layer Trivy scans and
# gates on. Also refresh the bundled npm in case the base ships a version with
# a fixable advisory.
RUN apk --no-cache upgrade \
 && npm install -g npm@latest \
 && npm cache clean --force

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
