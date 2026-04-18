# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Stage 1: Build the frontend (Vite → static assets under frontend/dist)
# ----------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci

COPY common ./common
COPY frontend ./frontend
RUN cd frontend && npm run build

# ----------------------------------------------------------------------------
# Stage 2: Install backend runtime dependencies
#
# Native modules (@homebridge/node-pty-prebuilt-multiarch, sqlite3) may need
# to be compiled on musl when no prebuilt binary matches. Keep the toolchain
# out of the final image by doing the install in a throwaway stage.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS backend-deps
WORKDIR /build

RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ----------------------------------------------------------------------------
# Stage 3: Runtime image
# ----------------------------------------------------------------------------
FROM node:22-alpine
WORKDIR /app

# Deckhouse spawns `docker compose ...` via child_process; both the CLI and
# the compose v2 plugin must be available in PATH. The daemon itself runs on
# the host and is reached through the mounted /var/run/docker.sock.
RUN apk add --no-cache docker-cli docker-cli-compose

COPY --from=backend-deps /build/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY backend ./backend
COPY common ./common
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

ENV DECKHOUSE_PORT=5001 \
    DECKHOUSE_HOSTNAME=0.0.0.0 \
    DECKHOUSE_DATA_DIR=/app/data
# DECKHOUSE_STACKS_DIR is intentionally left unset — it MUST be passed in via
# compose because the value has to equal the host bind-mount path exactly
# (see deploy/compose.yaml for the full explanation).

EXPOSE 5001
CMD ["npm", "start"]
