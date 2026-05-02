# Auctorum C2 -- Architecture Document

**Version**: 0.2.0
**Date**: 2026-03-03

---

## 1. System Overview

Auctorum C2 is a desktop application for managing and monitoring an AI agent infrastructure running on a remote Linux server. It provides real-time telemetry, model management, database operations, file editing, log monitoring, network visibility, and a chat sandbox -- all through a single unified interface.

```
+---------------------------+          SSH / HTTP          +---------------------------+
|    Windows Desktop        | <-------------------------> |    Ubuntu 24.04 Server    |
|                           |                              |                           |
|  +---------------------+ |     SSH (port 22)            |  - OpenClaw daemon        |
|  | Auctorum C2 (.exe)  |------------------------------>|  - Ollama (port 11434)    |
|  |                     | |     HTTP (port 11434)        |  - SQLite (memory.db)     |
|  |  Tauri v2 + React   |------------------------------>|  - Tailscale mesh         |
|  +---------------------+ |     HTTP (port 18789)        |  - Gateway (port 18789)   |
|                           |------------------------------>|                           |
+---------------------------+                              +---------------------------+
            |
            | Tailscale VPN (100.x.x.x)
            |
```

### Transport Protocols

| Protocol | Used For | Port |
|----------|----------|------|
| SSH      | System metrics, OpenClaw control, SQLite queries, file operations, log tailing, Tailscale status | 22 |
| HTTP     | Ollama API (model list, chat, unload), Gateway sessions | 11434, 18789 |

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React     | 19.2    | UI framework |
| TypeScript| 5.9     | Type safety |
| Vite      | 7.3     | Build tooling and HMR |
| TailwindCSS| 4.2    | Utility CSS |
| Lucide React| 0.576 | Icon library |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Tauri     | 2.10    | Desktop framework (Rust) |
| Rust      | 1.77+   | Backend language |
| tokio     | 1.x     | Async runtime |
| reqwest   | 0.12    | HTTP client |
| serde     | 1.0     | Serialization |
| tauri-plugin-dialog| 2.x | Native file picker |
| tauri-plugin-shell | 2.x | Shell access |

---

## 3. Directory Structure

```
auctorum-c2/
|-- src/                        # React frontend
|   |-- App.tsx                 # Root component with page router
|   |-- index.css               # Design system (CSS custom properties)
|   |-- main.tsx                # React entry point
|   |-- components/
|   |   |-- Panel.tsx           # Reusable card/panel component
|   |   |-- Sidebar.tsx         # Navigation sidebar (collapsible)
|   |   |-- Titlebar.tsx        # Custom window titlebar
|   |-- context/
|   |   |-- ThemeContext.tsx     # Theme state management
|   |-- lib/
|   |   |-- tauri.ts            # Tauri invoke wrapper with isTauri guard
|   |   |-- utils.ts            # Utility functions
|   |-- pages/
|       |-- DashboardPage.tsx   # System telemetry
|       |-- OllamaPage.tsx      # Model management
|       |-- OpenClawPage.tsx    # Daemon control
|       |-- MemoryPage.tsx      # SQLite CRUD + SQL runner
|       |-- EditorPage.tsx      # Remote file editor
|       |-- LogsPage.tsx        # Log viewer
|       |-- NetworkPage.tsx     # Tailscale + Gateway
|       |-- SandboxPage.tsx     # Chat interface
|       |-- SettingsPage.tsx    # Connection configuration
|
|-- src-tauri/                  # Rust backend
|   |-- src/
|   |   |-- lib.rs              # Tauri plugin registration + handler registration
|   |   |-- ssh.rs              # SSH execution layer (shell_escape, ssh_exec)
|   |   |-- commands/
|   |       |-- mod.rs          # Module declarations
|   |       |-- sysinfo_cmd.rs  # CPU, RAM, GPU, temps via Python/proc
|   |       |-- ollama.rs       # Ollama REST API (tags, ps, generate)
|   |       |-- openclaw.rs     # systemctl control + Aegis permissions
|   |       |-- sqlite_mem.rs   # SQLite queries via SSH
|   |       |-- workspace.rs    # Remote file tree, read, write
|   |       |-- logs.rs         # Remote log listing and tailing
|   |       |-- settings.rs     # Local config file management
|   |       |-- network.rs      # Tailscale status, Gateway sessions
|   |       |-- sandbox.rs      # Ollama chat API
|   |-- Cargo.toml
|   |-- tauri.conf.json         # Tauri configuration + CSP
|   |-- capabilities/
|       |-- default.json        # Permission grants
|
|-- SECURITY_AUDIT.md           # Security audit report
|-- ARCHITECTURE.md             # This document
```

---

## 4. Module Architecture

### 4.1 Dashboard (Telemetry)

**Backend**: `sysinfo_cmd.rs`
**Frontend**: `DashboardPage.tsx`

Collects system metrics from the remote host via SSH. A Python script reads `/proc/stat`, `/proc/cpuinfo`, `/proc/meminfo`, `/sys/class/thermal/`, and runs `nvidia-smi` for GPU data. The script executes a 0.5s CPU sampling window for accurate usage measurement.

**Data flow**:
```
DashboardPage -> tauriInvoke('get_system_metrics')
  -> ssh_exec(host, METRICS_SCRIPT)
    -> Remote: python3 reads /proc/* and nvidia-smi
  <- JSON response parsed into SystemMetrics struct
<- Rendered as metric bars and sparkline
```

**Polling**: 3-second interval in the frontend.

### 4.2 Ollama (Model Management)

**Backend**: `ollama.rs`
**Frontend**: `OllamaPage.tsx`

Communicates directly with Ollama's REST API (no SSH). Uses reqwest HTTP client with configurable endpoint.

**Endpoints used**:
- `GET /api/tags` -- List installed models
- `GET /api/ps` -- List models loaded in VRAM
- `POST /api/generate` -- Force unload (with `keep_alive: 0`)

**Polling**: 5-second interval.

### 4.3 OpenClaw (Daemon Control)

**Backend**: `openclaw.rs`
**Frontend**: `OpenClawPage.tsx`

Controls the OpenClaw agent daemon via `systemctl --user` commands over SSH. Manages Aegis permission configuration stored in `~/.openclaw/config/aegis.json`.

**Operations**:
- Status check: `systemctl --user is-active openclaw-gateway`
- Kill switch: `systemctl --user stop` + `pkill -f openclaw`
- Restart: `systemctl --user restart`
- Permissions: Read/write JSON via base64-encoded transport

### 4.4 Memory Database

**Backend**: `sqlite_mem.rs`
**Frontend**: `MemoryPage.tsx`

CRUD interface for SQLite database at `~/.openclaw/data/memory.db`. All queries are executed via SSH using the `sqlite3` command-line tool with `-json` output format.

**Tables**:
- `memory` -- Key-value pairs with source attribution and timestamps
- `events` -- Audit log with event types and details

**SQL Runner**: Read-only query execution with keyword filtering and semicolon rejection.

### 4.5 Editor (Workspace)

**Backend**: `workspace.rs`
**Frontend**: `EditorPage.tsx`

Remote file editor scoped to `~/.openclaw/workspace/`. Tree traversal uses a Python script over SSH. File content is transferred via base64 encoding.

**Operations**:
- Tree listing: Python `os.listdir` recursive (max depth 5)
- File read: `cat` with shell-escaped path
- File write: base64 encode -> `echo <b64> | base64 -d > path`

### 4.6 Logs

**Backend**: `logs.rs`
**Frontend**: `LogsPage.tsx`

Tails log files from two locations:
- `/tmp/openclaw/*.log`
- `~/.openclaw/logs/*.log`

Uses `tail -n <N>` over SSH with validated and shell-escaped paths.

### 4.7 Network

**Backend**: `network.rs`
**Frontend**: `NetworkPage.tsx`

Two data sources:
1. **Tailscale**: `tailscale status --json` over SSH -- shows mesh network topology
2. **Gateway**: `curl http://127.0.0.1:<port>/api/sessions` over SSH -- shows WebSocket sessions

### 4.8 Sandbox (Chat)

**Backend**: `sandbox.rs`
**Frontend**: `SandboxPage.tsx`

Chat interface using Ollama's `/api/chat` endpoint. Supports model selection, conversation history, and inference metrics (duration, token count, tokens/sec).

### 4.9 Settings

**Backend**: `settings.rs`
**Frontend**: `SettingsPage.tsx`

Local configuration management. Settings are stored in `~/.auctorum-c2/config.json` on the Windows host. Includes connection test with SSH round-trip latency measurement.

**Configurable fields**: host, SSH user, SSH port, SSH key path, Ollama port, Gateway port.

---

## 5. Security Architecture

### 5.1 Transport Security

All SSH connections use:
- `StrictHostKeyChecking=accept-new` -- TOFU model, rejects changed keys
- `IdentitiesOnly=yes` -- Uses only the specified key
- `BatchMode=yes` -- No interactive password prompts
- `ConnectTimeout=10` -- 10-second connection timeout
- `LogLevel=ERROR` -- Minimal SSH logging

### 5.2 Input Sanitization

```
User Input
    |
    v
[Path Validation]    -- validate_workspace_path() / validate_log_path()
    |                   Rejects: .., null bytes, backticks, $(
    v
[SQL Filtering]      -- Keyword blocking, semicolon rejection
    |                   Allows: SELECT, PRAGMA only
    v
[Shell Escaping]     -- shell_escape() wraps in single quotes
    |                   Pattern: 'value' with '\'' for internal quotes
    v
[Base64 Encoding]    -- For file content and JSON payloads
    |                   Eliminates all shell metacharacters
    v
[SSH Transport]      -- ssh_exec() passes command as SSH argument
```

### 5.3 Tauri Security Model

- Custom CSP restricts script sources to `'self'` (with Tauri-required inline/eval exceptions)
- Shell plugin scope limits executable commands
- Dialog plugin requires explicit capability grants
- Window decorations disabled (custom titlebar prevents OS chrome manipulation)

---

## 6. Theme System

Four themes implemented via CSS custom properties with `[data-theme]` attribute selectors:

| Theme | Description | Accent Color |
|-------|-------------|--------------|
| Default | Vercel-inspired dark | Blue (#3b82f6) |
| Monokai | Warm dark tones | Orange (#fd971f) |
| Emerald | Professional green | Emerald (#10b981) |
| Nord | Arctic cool tones | Frost blue (#88c0d0) |

Theme state managed by `ThemeContext.tsx`, persisted in `localStorage` as `auctorum-theme`.

---

## 7. Browser/Tauri Dual Mode

The application supports running in both Tauri (desktop) and browser (development) modes:

```typescript
// src/lib/tauri.ts
const isTauri = !!(window as any).__TAURI_INTERNALS__

export async function tauriInvoke<T>(cmd: string, args?): Promise<T | null> {
  if (!isTauri) return null  // Returns null in browser mode
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}
```

Every page provides mock data when `isTauri` is false, enabling full UI development and testing without the Rust backend.

---

## 8. Build Configuration

### Development
```bash
npm run dev          # Vite dev server on port 5173
npm run tauri dev    # Full Tauri dev with hot reload
```

### Production
```bash
npm run tauri build  # Produces Windows installer (.exe / .msi)
```

### Release Optimizations (Cargo.toml)
- `strip = true` -- Remove debug symbols
- `lto = true` -- Link-time optimization
- `codegen-units = 1` -- Maximum optimization
- `opt-level = "s"` -- Optimize for size
- `panic = "abort"` -- No unwinding overhead
