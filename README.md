# AUCTORUM

<div align="center">

<img src="assets/logoauctorum.png" alt="Auctorum Logo" width="200"/>

**Privacidad. Control. Autoría.**

*Sé el autor de tu propia inteligencia artificial.*
*Porque la inteligencia que organiza tu vida debe pertenecerte.*

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Hardware: CERN OHL-S v2](https://img.shields.io/badge/Hardware-CERN%20OHL--S%20v2-green.svg)](https://ohwr.org/cernohl)
[![Standard: IEEE P7012](https://img.shields.io/badge/Standard-IEEE%20P7012-purple.svg)](https://standards.ieee.org/ieee/P7012)
[![Status: Phase 0 Complete](https://img.shields.io/badge/Status-Phase%200%20%E2%9C%93%20Complete-brightgreen.svg)]()
[![OpenClaw: Operational](https://img.shields.io/badge/OpenClaw-Operational-success.svg)]()
[![Models: 4 LLMs Local](https://img.shields.io/badge/Models-4%20LLMs%20Local-blue.svg)]()

</div>

---

## ¿Qué es AUCTORUM?

AUCTORUM es una plataforma de inteligencia artificial personal de código abierto que corre **completamente en tu hardware**. No es un asistente de IA más — es la infraestructura que invierte la relación entre el usuario y su AI.

En el modelo actual, **tú eres el producto**. Tus conversaciones, tus hábitos, tu identidad — todo alimenta modelos de negocio que no controlas. AUCTORUM invierte esa ecuación:

| Modelo Corporativo | AUCTORUM |
|---|---|
| Tu AI vive en servidores de la empresa | Tu AI vive en tu hardware |
| La empresa define los términos | Tú defines los términos (IEEE P7012) |
| Sin transparencia sobre tus datos | Código 100% auditable |
| Suscripción mensual perpetua | ~$2-3 USD/mes en electricidad |
| Si cierran, pierdes tu asistente | Tu servidor no se apaga |
| Tus datos entrenan modelos ajenos | Tus datos se quedan contigo |

---

## Estado Actual — Mayo 2026

### Fase 0 — Fundación ✅ COMPLETA

El sistema está **completamente operativo** desde febrero 2026:

- **Gateway OpenClaw** funcionando 24/7 con uptime tracking
- **WhatsApp** conectado y respondiendo mensajes via IA (cuenta "Auctorum")
- **4 modelos LLM** corriendo localmente en GPU (Qwen3:8B principal)
- **Gmail + Google Calendar** integrados y funcionales
- **Tailscale mesh** conectando 4 dispositivos (servidor, Alienware, iPhone, paired devices)
- **C2 Desktop App** completamente funcional (9 módulos operativos)
- **PWA Mobile** operativa para acceso desde iPhone
- **Auditoría de seguridad** completada — todos los hallazgos críticos remediados

### Fase 1 — Expansión 🔄 EN PROGRESO

- [ ] Aegis Sentinel como módulo independiente
- [ ] Vaultwarden para gestión de credenciales
- [ ] CrowdSec + inteligencia colectiva de amenazas
- [ ] Hardware Gen 1 — ESP32 wake word con Wyoming Protocol
- [ ] Installer script automatizado
- [ ] Release público v0.1.0

---

## Arquitectura

AUCTORUM implementa una separación formal entre **Modo Kernel** y **Modo Usuario**, inspirada en los principios de diseño de sistemas operativos:

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 5 — SUPERFICIES DE USUARIO                                │
│  C2 Desktop (Tauri) · PWA Mobile · WhatsApp · CLI               │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 4 — VOZ AMBIENT (Planificada)                             │
│  Dispositivo Gen1/Gen2 · Wyoming Protocol · AirPods             │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 3 — INTEGRACIONES                                         │
│  WhatsApp ✓ · Gmail ✓ · Calendar ✓ · Spotify · GitHub · HA     │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 2 — ORQUESTACIÓN (OpenClaw Gateway)                       │
│  Router de intenciones · Agentes · Memoria · Skills · Cron      │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 1 — INFRAESTRUCTURA (Modo Kernel)                         │
│  Ubuntu 24.04 · Ollama · GTX 1070 8GB · Tailscale · UFW        │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de una petición

```
Usuario (WhatsApp/C2/PWA)
    │
    ▼
┌──────────────────────────────────────────┐
│  OpenClaw Gateway (ws://127.0.0.1:18789) │
│  ├── Parseo de intención                 │
│  ├── Selección de modelo                 │
│  ├── Aegis audit (seguridad)             │
│  └── Ejecución de skill/herramienta      │
└──────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────┐
│  Ollama (http://127.0.0.1:11434)         │
│  ├── Qwen3:8B (principal)                │
│  ├── DeepSeek-R1:8B (razonamiento)       │
│  ├── Llama3.2:3B (velocidad)             │
│  └── Llama3.2:1B (Aegis Sentinel)        │
└──────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────┐
│  Capa de persistencia                    │
│  ├── SQLite (memory.db) — memoria        │
│  ├── Workspace (archivos del agente)     │
│  └── Logs (/tmp/openclaw/*.log)          │
└──────────────────────────────────────────┘
```

---

## Stack Tecnológico

### Modelos LLM (100% local, 0% cloud por defecto)

| Modelo | Función | VRAM | Contexto |
|---|---|---|---|
| **Qwen3:8B** | Agente principal — conversación, integraciones, tareas | ~5.5 GB | 16K |
| **DeepSeek-R1:8B** | Razonamiento profundo — código complejo, análisis técnico | ~5.5 GB | 16K |
| **Llama3.2:3B** | Velocidad — comandos rápidos, pipeline de voz | ~2 GB | 8K |
| **Llama3.2:1B** | Aegis Sentinel — auditoría de seguridad en tiempo real | ~0.8 GB | 4K |

### Infraestructura

| Componente | Tecnología | Estado |
|---|---|---|
| Sistema Operativo | Ubuntu 24.04 LTS | ✅ Operativo |
| Runtime LLM | Ollama (servicio systemd) | ✅ Operativo |
| Orquestador | OpenClaw Gateway v2026.2.22-2 | ✅ Operativo |
| Red privada | Tailscale (WireGuard mesh) | ✅ 4 dispositivos |
| Firewall | UFW (deny incoming, Tailscale-only) | ✅ Configurado |
| Mensajería | WhatsApp via Baileys (reverse-engineered) | ✅ Conectado |
| Email/Calendar | Google Workspace OAuth | ✅ Funcional |
| Memoria | SQLite (key-value + events) | ✅ Operativo |

### Aplicaciones de Control

| App | Stack | Estado |
|---|---|---|
| **C2 Desktop** | Tauri 2.10 (Rust) + React 19 + TypeScript + Vite + Tailwind | ✅ v0.2.0 |
| **PWA Mobile** | React 18 + Express + Tailwind (bridge pattern) | ✅ Operativa |

---

## Aplicaciones

### C2 Desktop — Centro de Comando

Aplicación Tauri para Windows que unifica toda la gestión de la infraestructura AI en una sola interfaz. Se conecta al servidor via SSH + HTTP sobre Tailscale VPN.

**9 módulos operativos:**

| Módulo | Función |
|--------|---------|
| Dashboard | Telemetría en tiempo real (CPU/RAM/GPU/temperatura) — polling 3s |
| Ollama | Gestión de modelos (listar, cargar/descargar VRAM, estado) — polling 5s |
| OpenClaw | Control del daemon (start/stop/restart) + permisos Aegis |
| Memory | CRUD de base de datos SQLite + ejecutor de queries SQL read-only |
| Editor | Editor de archivos remoto (scoped a ~/.openclaw/workspace/) |
| Logs | Visor de logs con tailing en vivo |
| Network | Topología Tailscale + sesiones WebSocket del Gateway |
| Sandbox | Chat con selección de modelo + métricas de inferencia (tokens/s) |
| Settings | Configuración de conexión (host, SSH, puertos) |

**4 temas visuales:** Default (Vercel dark/blue), Monokai (warm/orange), Emerald (green), Nord (frost blue)

→ Documentación completa: [`apps/desktop/ARCHITECTURE.md`](apps/desktop/ARCHITECTURE.md)

### PWA Mobile — Acceso desde iPhone/Android

Progressive Web App con patrón bridge: React frontend → HTTP REST → Node.js/Express → SSH/Ollama. Diseño OLED-optimized para pantallas móviles.

→ Documentación: [`apps/pwa/README.md`](apps/pwa/README.md)

---

## Modelo de Seguridad — Defensa en Profundidad

```
┌─────────────────────────────────────────────────────────┐
│  CAPA 6 — CONFIRMACIÓN HUMANA                           │
│  Glass Break Protocol: opt-in explícito para cloud      │
├─────────────────────────────────────────────────────────┤
│  CAPA 5 — AUDITORÍA EN TIEMPO REAL                      │
│  Aegis Sentinel (LLM 1B) validando prompts/respuestas   │
├─────────────────────────────────────────────────────────┤
│  CAPA 4 — SANITIZACIÓN DE ENTRADA                       │
│  Path validation + SQL filtering + Shell escaping       │
├─────────────────────────────────────────────────────────┤
│  CAPA 3 — AISLAMIENTO                                   │
│  Skills en Docker efímero · Workspace scoping           │
├─────────────────────────────────────────────────────────┤
│  CAPA 2 — RED PRIVADA                                   │
│  Tailscale WireGuard · Sin puertos públicos expuestos   │
├─────────────────────────────────────────────────────────┤
│  CAPA 1 — FIREWALL + HARDENING                          │
│  UFW deny all · CrowdSec (planificado)                  │
└─────────────────────────────────────────────────────────┘
```

### Auditoría de Seguridad del C2 (Marzo 2026)

| Severity | Encontrados | Corregidos | Aceptados | Abiertos |
|----------|:-----------:|:----------:|:---------:|:--------:|
| Critical | 1 | 1 | 0 | **0** |
| High | 3 | 3 | 0 | **0** |
| Medium | 3 | 3 | 0 | **0** |
| Low | 3 | 1 | 2 | **0** |

**Rating final: BAJO** — todos los hallazgos críticos y altos remediados.

→ Reporte completo: [`apps/desktop/SECURITY_AUDIT.md`](apps/desktop/SECURITY_AUDIT.md)
→ Guía de seguridad: [`docs/SECURITY.md`](docs/SECURITY.md)

---

## Hardware del Servidor (Verificado y Operativo)

| Componente | Especificación |
|---|---|
| CPU | Intel Core i3-7100 (2C/4T, 3.9 GHz) |
| RAM | 16 GB DDR4 |
| GPU | NVIDIA GeForce GTX 1070 — 8 GB VRAM |
| Almacenamiento | 1 TB SSD |
| Sistema Operativo | Ubuntu 24.04 LTS |
| Driver NVIDIA | 535.288.01, CUDA 12.2 |
| Red privada | Tailscale (WireGuard, IP: 100.121.31.99) |
| Node.js | 22.22.0 |
| Ollama | Servicio systemd, escuchando en puerto 11434 |

### Rendimiento medido

- Qwen3:8B: ~30-50 tokens/segundo en GTX 1070
- Latencia SSH (C2 → servidor): <50ms via Tailscale
- Consumo eléctrico estimado: ~$2-3 USD/mes

---

## Documentación

| Documento | Descripción |
|---|---|
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Guía completa de instalación (12 fases) |
| [`docs/INTEGRACIONES.md`](docs/INTEGRACIONES.md) | Configuración de todas las integraciones |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Modelo de amenazas + hardening + checklist |
| [`docs/fundacional/`](docs/fundacional/) | Documentos fundacionales — visión y constitución |
| [`docs/arquitectura/`](docs/arquitectura/) | Especificaciones técnicas y diagramas |
| [`docs/roadmap/`](docs/roadmap/) | Plan de ejecución por fases |
| [`docs/bitacoras/`](docs/bitacoras/) | Bitácoras diarias de desarrollo (Días 1-4) |
| [`docs/presentacion/`](docs/presentacion/) | Material de presentación |

---

## Repositorios del Ecosistema

| Repositorio | Contenido | Estado |
|---|---|---|
| **auctorum-project/auctorum** | Core — apps, documentación, arquitectura | ✅ Activo |
| auctorum-project/aegis | Módulo Aegis Sentinel (auditoría LLM) | 📋 Planificado |
| auctorum-project/firmware | ESP32 / Raspberry Pi — wake word, Wyoming | 📋 Planificado |
| auctorum-project/app-ios | App iOS nativa (Swift/SwiftUI) | 📋 Planificado |
| auctorum-project/app-android | App Android (Kotlin/Compose) | 📋 Planificado |
| auctorum-project/hardware | KiCad PCB Gen 2, STL, BOM | 📋 Planificado |
| auctorum-project/integrations | Skills oficiales del ecosistema | 📋 Planificado |
| auctorum-project/installer | Script de instalación automatizado | 📋 Planificado |

---

## Roadmap

```
Fase 0 — Fundación        ██████████  COMPLETA       Infraestructura operativa
Fase 1 — MVP Público      ████░░░░░░  EN PROGRESO    100 usuarios target
Fase 2 — Comunidad        ░░░░░░░░░░  Planificada    1,000 instalaciones
Fase 3 — Escala           ░░░░░░░░░░  Planificada    B2B + crowdfunding
```

### Fase 0 — Fundación ✅ (Feb-Mar 2026)
- [x] Ubuntu 24.04 LTS en servidor dedicado (dual boot)
- [x] NVIDIA GTX 1070 verificada — Driver 535.288.01, CUDA 12.2
- [x] Ollama como servicio systemd
- [x] 4 modelos LLM corriendo localmente (Qwen3:8B + DeepSeek-R1:8B + Llama3.2:3B + Llama3.2:1B)
- [x] Node.js 22.22.0 instalado
- [x] Tailscale mesh (servidor + laptop + iPhone + dispositivos)
- [x] UFW configurado — deny incoming, Ollama solo via Tailscale
- [x] OpenClaw Gateway instalado y configurado (v2026.2.22-2)
- [x] WhatsApp conectado — mensajes respondidos por IA
- [x] Gmail + Google Calendar integrados y funcionales
- [x] C2 Desktop App v0.2.0 completamente funcional (9 módulos)
- [x] PWA Mobile operativa
- [x] Auditoría de seguridad del C2 completada (0 vulnerabilidades abiertas)
- [x] Repositorio organizado con documentación estructurada
- [x] Git configurado en servidor y Alienware

### Fase 1 — MVP Público 🔄 (Abr-Jul 2026)
- [x] 4 dispositivos paired con tokens de operador
- [x] Skills elegibles: Google Workspace, healthcheck, skill-creator, weather
- [ ] Aegis Sentinel como módulo independiente publicable
- [ ] Vaultwarden para gestión de credenciales
- [ ] CrowdSec + inteligencia colectiva
- [ ] Hardware Gen 1 (ESP32 wake word + Wyoming Protocol)
- [ ] Script de instalación automatizado (`installer`)
- [ ] Documentación pública completa (inglés + español)
- [ ] Release v0.1.0 en GitHub
- [ ] Post en r/selfhosted y Ollama Discord

### Fase 2 — Comunidad (2026 Q4)
- [ ] 1,000 instalaciones verificadas
- [ ] Marketplace de skills comunitarios
- [ ] App iOS nativa (SwiftUI)
- [ ] App Android (Kotlin/Compose)
- [ ] Hardware Gen 2 (PCB dedicado)

### Fase 3 — Escala (2027)
- [ ] B2B offering para empresas
- [ ] Crowdfunding para hardware
- [ ] Headscale como alternativa a Tailscale (full self-hosted)
- [ ] Federation entre instancias AUCTORUM

---

## Instalación Rápida

> Guía completa: [`docs/INSTALACION.md`](docs/INSTALACION.md)

### Requisitos mínimos

| Componente | Mínimo | Recomendado |
|---|---|---|
| GPU | NVIDIA con 6 GB VRAM | NVIDIA con 8+ GB VRAM |
| RAM | 8 GB | 16 GB |
| Almacenamiento | 50 GB SSD | 100+ GB SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |
| Red | Conexión a internet para Tailscale | Ethernet estable |

### Inicio rápido

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Descargar modelos
ollama pull qwen3:8b
ollama pull deepseek-r1:8b
ollama pull llama3.2:3b
ollama pull llama3.2:1b

# 3. Instalar Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# 4. Instalar OpenClaw
npm install -g @openclaw/gateway
openclaw init

# 5. Verificar
ollama list          # 4 modelos instalados
tailscale status     # Conectado a la mesh
openclaw status      # Gateway activo
```

→ Guía detallada con seguridad: [`docs/INSTALACION.md`](docs/INSTALACION.md)

---

## Costo de Operación

| Concepto | Costo |
|---|---|
| OpenClaw Gateway | $0 (open source) |
| Ollama + Modelos | $0 (open source + open weights) |
| Tailscale (personal) | $0 (hasta 100 dispositivos) |
| Google Workspace APIs | $0 (cuota gratuita) |
| WhatsApp (Baileys) | $0 (sin Business API) |
| Electricidad (~80W 24/7) | ~$2-3 USD/mes |
| **Total** | **~$2-3 USD/mes** |

Comparación: ChatGPT Plus ($20/mes) + Google One AI ($20/mes) + Notion AI ($10/mes) = $50/mes → AUCTORUM ahorra ~95%.

---

## Licencia

- **Software**: [AGPL-3.0](LICENSE) — cualquier modificación, incluso como servicio, debe publicarse bajo la misma licencia
- **Hardware**: CERN OHL-S v2 — equivalente de AGPL para diseños físicos
- **Alineado con**: IEEE P7012 — Machine Readable Personal Privacy Terms
- **Filosofía**: Si usas AUCTORUM para ofrecer un servicio, el código del servicio también debe ser libre

---

## Contribuir

AUCTORUM está en desarrollo activo. Las contribuciones son bienvenidas en:

1. **Documentación** — traducciones, guías, tutoriales
2. **Skills** — nuevas integraciones para el Gateway
3. **Apps** — clientes para plataformas no cubiertas
4. **Hardware** — diseños para dispositivos de voz
5. **Seguridad** — auditorías, pentesting, reportes de vulnerabilidades

Antes de contribuir, lee la [guía de seguridad](docs/SECURITY.md) y asegúrate de que tu contribución no introduce dependencias de servicios cloud obligatorios.

---

<div align="center">

*Armando Javier Flores Salazar — Fundador y Arquitecto Principal*
*ITESM Campus Saltillo — Saltillo, Coahuila, México — 2026*

**AUCTORUM** — Del latín *auctor*: quien organiza, quien hace crecer, quien crea.

*"La soberanía digital no es un lujo — es un derecho."*

</div>
