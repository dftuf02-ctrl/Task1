# ── Stage 1: Build React App ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

# Build the app using Vite
RUN npm run build

# ── Stage 2: Production Nginx Server ──────────────────────────────────
FROM nginx:alpine

# Copy built static files
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
