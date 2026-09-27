# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps separately so this layer is cached unless package files change
COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL is injected at BUILD time via --build-arg so the compiled JS
# bundle points at the correct API gateway (e.g. https://api.your-domain.com).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove the default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled React SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (handles React Router client-side routing +
# WebSocket proxy to the gateway)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
