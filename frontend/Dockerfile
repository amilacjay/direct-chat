# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# Build version stamped into the bundle (CI passes the git short sha). Git isn't
# available in this build context, so it's threaded in as a build arg.
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA + PWA-aware caching (service worker served no-cache so new builds roll out)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
