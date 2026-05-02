# Auctorum PWA — Mobile Interface

Progressive Web App for iOS/Android access to the Auctorum AI infrastructure.

## Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4, PWA Manifest
- **Backend**: Node.js + Express (SSH gateway + Ollama proxy)
- **Architecture**: Bridge pattern — React frontend ↔ HTTP REST ↔ Node.js ↔ SSH/Ollama

## Design System

- Enterprise Dark Mode (OLED-optimized)
- Primary: #0a0a0c | Accent: #007BFF
- Glassmorphism, 4 themes (Dracula, Monokai, Matrix, Nord)
- Fonts: Inter (UI), JetBrains Mono (code/data)
- Mobile-first: Bottom nav, BottomSheet, safe area insets

## Development

```bash
# Client
cd client && npm install && npm run dev

# Server
cd server && npm install && npm start
```

## API Endpoints

- `GET /api/system/metrics` — System telemetry via SSH
- `GET /api/ollama/models` — Proxy to Ollama
- `POST /api/ollama/chat` — Chat proxy
- `POST /api/memory/query` — SQLite via SSH
- `GET /api/network/tailscale` — Network status
- `POST /api/shortcuts/siri` — TTS-formatted responses
