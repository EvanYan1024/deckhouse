# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Deckhouse is a self-hosted Docker Compose manager with a built-in file browser. It provides a web UI for managing Docker Compose stacks, editing files, viewing logs, and running container terminals.

## Commands

```bash
# Development (runs backend + frontend concurrently)
npm run dev

# Backend only (tsx watch with hot reload)
npm run dev:backend

# Frontend only (Vite dev server)
npm run dev:frontend

# Type checking (backend + common)
npm run check-ts

# Frontend linting
cd frontend && npm run lint

# Production build
npm run build:frontend
npm run start
```

No test framework is configured yet. Node >= 22 required.

## Architecture

### Communication Model

All client-server communication uses **Socket.IO** (not REST). The frontend emits events, which route through socket handlers to execute operations and return results via callbacks.

```
Browser (React 19 + Socket.IO client)
  ↕ Socket.IO WebSocket
Backend (Express 5 + Socket.IO server, port 5001)
  ↕ child_process.spawn / Node fs
Docker CLI + Filesystem
```

### Backend (`backend/`)

- **Entry point:** `index.ts` → `deckhouse-server.ts` (Express + Socket.IO server)
- **Two handler layers:**
  - `socket-handlers/` — direct socket handlers (auth, stack list)
    - `main-socket-handler.ts` — login, setup, token refresh, server info
    - `agent-proxy-socket-handler.ts` — routes events to local or (future) remote agents
  - `agent-socket-handlers/` — handlers behind the agent proxy
    - `docker-socket-handler.ts` — deploy, start, stop, restart, delete, logs, exec
    - `file-socket-handler.ts` — file CRUD, search, upload/download
- **`stack.ts`** — Stack model wrapping Docker Compose CLI operations
- **`file-manager/`** — File operations with security sandboxing
  - `file-manager.ts` — list, read, write, create, delete, rename (auto-detects text vs binary)
  - `path-validator.ts` — prevents path traversal; validates against allowed root directories

### Frontend (`frontend/`)

- **Vite 8 + React 19 + TailwindCSS 4** — path alias `@/*` maps to `src/*`
- **Pages:** `dashboard.tsx` (stack list), `compose.tsx` (stack detail with YAML/ENV/files/logs/terminal), `create-stack.tsx`, `login.tsx`, `setup.tsx`, `settings.tsx`
- **State:** Zustand stores in `stores/` — `socket-store.ts` (connection + stack data), `auth-store.ts` (JWT), `theme-store.ts`
- **Hooks:** `use-file-manager.ts` (file ops), `use-stack.ts` (docker ops)
- **UI:** shadcn/ui components in `components/ui/`, CodeMirror for editing, xterm.js for terminal

### Shared (`common/`)

- `agent-socket.ts` — event emitter abstraction for routing socket events to handlers
- `types.ts` — shared TypeScript interfaces (StackInfo, FileEntry, FileContent, AgentInfo)

### Data Storage

- **Users/auth:** JSON file at `data/users.json`, JWT secret at `data/jwt-secret.txt`
- **Stacks:** each stack is a directory under `stacks/<name>/` containing `compose.yaml` and optional `.env`

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DECKHOUSE_PORT` | 5001 | Server port |
| `DECKHOUSE_HOSTNAME` | 0.0.0.0 | Bind address |
| `DECKHOUSE_STACKS_DIR` | ./stacks | Root directory for compose stacks |
| `DECKHOUSE_DATA_DIR` | ./data | User data and secrets |

## Key Patterns

- **Socket event flow:** Client emits → `AgentProxySocketHandler` → `AgentSocket` → `DockerSocketHandler`/`FileSocketHandler` → callback with `{ok, msg, ...data}`
- **Path security:** All file operations go through `PathValidator` which resolves symlinks and checks against allowed roots. Never bypass this.
- **Docker operations:** Executed via `child_process.spawn` calling the `docker` CLI directly (not Docker API).
- **Auth:** JWT tokens with 48h expiry, bcryptjs password hashing. Token stored client-side in Zustand with localStorage persistence.

## Design System

See `DESIGN.md` for the full design spec. Key points:
- Warm cream backgrounds (#f7f4ed), charcoal text (#1c1c1c)
- 8px spacing unit, generous section gaps
- shadcn/ui as component foundation with custom theming
