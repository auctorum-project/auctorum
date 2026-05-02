# Auctorum C2 — Desktop Command Center

Desktop application for managing and monitoring the Auctorum AI infrastructure running on a remote Linux server.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4
- **Backend**: Tauri 2 (Rust) — SSH transport layer
- **Design**: Enterprise Dark Mode, glassmorphism, 4 theme variants

## Features

- Real-time system telemetry (CPU, RAM, GPU via SSH)
- Ollama model management (list, load/unload, chat)
- OpenClaw daemon control (start/stop/restart)
- SQLite memory database CRUD + SQL runner
- Remote file editor (scoped to workspace)
- Log viewer with live tailing
- Tailscale network topology
- Chat sandbox with inference metrics

## Development

```bash
npm install
npm run dev          # Vite dev server (browser mode with mock data)
npm run tauri dev    # Full Tauri development with hot reload
```

## Build

```bash
npm run tauri build  # Produces Windows installer (.exe / .msi)
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full system documentation.
See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) for the security audit report.
