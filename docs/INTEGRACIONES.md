# Integraciones — AUCTORUM

> Guía de configuración para todas las integraciones disponibles en el ecosistema AUCTORUM.
> Cada integración es un "skill" de OpenClaw que conecta el agente con servicios externos.

---

## Visión General

AUCTORUM se integra con servicios externos a través de **skills** — módulos aislados que el agente puede invocar para realizar acciones. Todas las integraciones siguen estos principios:

1. **Opt-in explícito** — Nada se activa sin tu autorización
2. **Credenciales seguras** — Almacenadas en `~/.openclaw/config/` (futuro: Vaultwarden)
3. **Mínimo privilegio** — Cada skill solicita solo los permisos que necesita
4. **Auditable** — Cada acción queda registrada en el log del gateway

---

## Estado de Integraciones

| Integración | Estado | Skill | Requiere |
|---|---|---|---|
| **WhatsApp** | ✅ Operativa | builtin | Número telefónico + QR scan |
| **Gmail** | ✅ Operativa | `google-workspace` | Google Cloud OAuth |
| **Google Calendar** | ✅ Operativa | `google-workspace` | Google Cloud OAuth |
| **Telegram** | ⚙️ Disponible | builtin | Bot token de @BotFather |
| **Spotify** | ⚙️ Disponible | `spotify` | Spotify Developer App |
| **GitHub** | ⚙️ Disponible | `github` | Personal Access Token |
| **Home Assistant** | ⚙️ Disponible | `homeassistant` | HA Long-lived token |
| **Weather** | ✅ Operativa | `weather` | Ninguno (API pública) |
| **Healthcheck** | ✅ Operativa | `healthcheck` | Ninguno |
| **Skill Creator** | ✅ Operativa | `skill-creator` | Ninguno |
| **Browser Control** | ⚙️ Disponible | `browser` | Puerto 18791 |
| **Cron Jobs** | ✅ Habilitado | builtin | Configuración en gateway |
| **Voice (Whisper)** | 📋 Planificado | `voice` | Whisper modelo local |
| **1Password** | 📋 Planificado | `1password` | CLI + service account |
| **Slack** | 📋 Planificado | `slack` | Bolt framework token |

---

## WhatsApp

### Descripción
Permite al agente recibir y responder mensajes de WhatsApp. Usa la librería Baileys (reverse-engineering del protocolo WhatsApp Web) para conectarse sin costo.

### Configuración

```bash
# Agregar canal WhatsApp
openclaw channel add whatsapp

# Se muestra un código QR en terminal
# En tu teléfono: WhatsApp > ⋮ > Dispositivos vinculados > Vincular dispositivo
# Escanea el QR

# Verificar conexión
openclaw channel status whatsapp
```

### Configuración de seguridad

```bash
# IMPORTANTE: Restringir quién puede hablar con el agente
openclaw config set channels.whatsapp.dm_policy allowlist

# Agregar números permitidos (formato internacional)
openclaw config set channels.whatsapp.allowed '["+5218445387404", "+521XXXXXXXXXX"]'
```

### Políticas de DM disponibles

| Política | Comportamiento |
|---|---|
| `allowlist` | Solo los números en la lista pueden interactuar (RECOMENDADO) |
| `open` | Cualquiera puede escribir al agente (RIESGO: prompt injection) |
| `paired_only` | Solo dispositivos paired |

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Ban de WhatsApp (uso de Baileys) | Usar número secundario; no enviar mensajes masivos |
| Prompt injection via mensajes | Aegis Sentinel + allowlist + exec=deny |
| Pérdida de sesión | Re-escanear QR; sesión persiste en disco |

### Datos de la integración operativa

- **Cuenta:** "Auctorum"
- **Protocolo:** Baileys (WhatsApp Web reverse-engineered)
- **Sesiones soportadas:** DM directos + grupos
- **Procesamiento:** Inbound → web-auto-reply pipeline con correlation tracking

---

## Google Workspace (Gmail + Calendar)

### Descripción
Permite al agente leer emails, buscar en Gmail, crear/leer eventos de calendario, y responder a solicitudes como "revisa mis últimos correos" o "agenda una reunión mañana".

### Prerequisitos

1. Cuenta de Google
2. Proyecto en Google Cloud Console
3. APIs habilitadas: Gmail API + Calendar API
4. Credenciales OAuth 2.0 (tipo: Desktop Application)

### Paso 1 — Google Cloud Console

```
1. Ve a console.cloud.google.com
2. Crea proyecto: "Auctorum Personal AI"
3. Ve a APIs & Services > Library
4. Busca y habilita:
   - Gmail API
   - Google Calendar API
5. Ve a APIs & Services > Credentials
6. Create Credentials > OAuth 2.0 Client ID
   - Application type: Desktop app
   - Nombre: "Auctorum Agent"
7. Descarga el JSON → renombra a google-credentials.json
```

### Paso 2 — Configurar en OpenClaw

```bash
# Copiar credenciales al servidor
scp google-credentials.json usuario@[IP_TAILSCALE]:~/.openclaw/config/

# Habilitar el skill
openclaw skill enable google-workspace

# El wizard abrirá una URL de autorización en tu navegador
# Autoriza el acceso con tu cuenta de Google
# El token se guarda automáticamente

# Verificar
openclaw skill status google-workspace
# Debe decir: eligible
```

### Paso 3 — Scopes autorizados

| Scope | Permite |
|---|---|
| `gmail.readonly` | Leer emails y buscar |
| `gmail.send` | Enviar emails (si habilitado) |
| `calendar.events` | Leer y crear eventos |
| `calendar.readonly` | Solo lectura de calendario |

### Uso confirmado

El agente puede responder solicitudes como:
- "Revisa mis últimos 3 correos no leídos"
- "¿Qué tengo agendado mañana?"
- "Agenda una reunión con X el viernes a las 3pm"

---

## Telegram

### Descripción
Canal alternativo/complementario a WhatsApp. Más estable (API oficial, sin riesgo de ban) pero menor adopción en México.

### Configuración

```bash
# 1. Crear bot con @BotFather en Telegram
#    - /newbot
#    - Nombre: "Auctorum"
#    - Username: auctorum_ai_bot (o similar)
#    - Copiar el token

# 2. Configurar en OpenClaw
openclaw channel add telegram
# Ingresa el bot token cuando lo pida

# 3. Iniciar conversación con tu bot en Telegram
# Envía /start

# 4. Configurar seguridad
openclaw config set channels.telegram.dm_policy paired_only
```

---

## Spotify

### Descripción
Permite al agente controlar reproducción de música: play, pause, skip, buscar canciones, crear playlists.

### Configuración

```bash
# 1. Crear app en developer.spotify.com
#    - Nombre: "Auctorum"
#    - Redirect URI: http://localhost:8888/callback
#    - Copiar Client ID y Client Secret

# 2. Habilitar en OpenClaw
openclaw skill enable spotify
# Ingresa Client ID y Secret
# Autoriza via OAuth (abre browser)

# 3. Verificar
openclaw skill status spotify
```

### Comandos soportados

- "Pon música relajante"
- "¿Qué canción está sonando?"
- "Pausa la música"
- "Siguiente canción"
- "Busca [artista/canción]"

---

## GitHub

### Descripción
Permite al agente interactuar con repositorios: ver issues, crear PRs, leer código, revisar notificaciones.

### Configuración

```bash
# 1. Crear Personal Access Token en github.com/settings/tokens
#    Scopes recomendados: repo, read:org, notifications

# 2. Configurar
openclaw skill enable github
# Ingresa el token

# 3. Verificar
openclaw skill status github
```

---

## Home Assistant

### Descripción
Control de dispositivos domóticos: luces, termostatos, sensores, automatizaciones.

### Configuración

```bash
# 1. En Home Assistant: Profile > Long-Lived Access Tokens > Create
# 2. Configurar
openclaw skill enable homeassistant
# Ingresa:
#   - URL de tu instancia HA (ej: http://192.168.1.50:8123)
#   - Long-lived token

# 3. Verificar
openclaw skill status homeassistant
```

### Comandos soportados

- "Prende las luces de la sala"
- "¿Qué temperatura hay en la casa?"
- "Activa el modo nocturno"
- "Apaga todo"

---

## Browser Control

### Descripción
Control de navegador headless para automatización web: navegar páginas, extraer información, llenar formularios.

### Configuración

```bash
# El browser control corre en puerto 18791 por defecto
# Verificar que está activo
curl http://127.0.0.1:18791/api/status

# Si no está activo, habilitar en config del gateway
openclaw config set browser.enabled true
openclaw restart
```

---

## Cron Jobs

### Descripción
Tareas programadas que el agente ejecuta automáticamente (ej: resumen matutino, check de emails periódico).

### Configuración

```bash
# Verificar que cron está habilitado
openclaw config get cron.enabled
# Debe ser: true

# Agregar un job
openclaw cron add --name "morning-briefing" \
  --schedule "0 7 * * *" \
  --prompt "Dame un resumen de mis emails y calendario para hoy"

# Listar jobs
openclaw cron list

# Eliminar un job
openclaw cron remove morning-briefing
```

### Ejemplos de cron jobs útiles

| Job | Cron | Prompt |
|---|---|---|
| Briefing matutino | `0 7 * * *` | "Resumen de emails no leídos y agenda del día" |
| Recordatorio hidratación | `0 */2 * * *` | "Recuérdame tomar agua" (via WhatsApp) |
| Backup de memoria | `0 3 * * *` | Interno: snapshot de memory.db |
| Weather check | `0 6 * * *` | "¿Cómo estará el clima hoy en Saltillo?" |

---

## Voice / Wake Word (Planificado — Fase 2)

### Descripción
Activación por voz ("Hey Auctorum") usando hardware dedicado (ESP32 o Raspberry Pi) con Wyoming Protocol para integración con el gateway.

### Stack planificado

| Componente | Tecnología |
|---|---|
| Wake word | openWakeWord / Porcupine (on-chip) |
| STT | Whisper (local via Ollama o faster-whisper) |
| TTS | Piper (local, voces en español) |
| Protocolo | Wyoming (Home Assistant compatible) |
| Hardware Gen 1 | ESP32-S3 + INMP441 mic + MAX98357 speaker |
| Hardware Gen 2 | PCB dedicado (KiCad, CERN OHL-S v2) |

---

## Crear Skills Personalizados

OpenClaw soporta la creación de skills personalizados usando el `skill-creator`:

```bash
# El skill-creator es un meta-skill que genera nuevos skills
openclaw skill run skill-creator

# O manualmente, crear un directorio en:
~/.openclaw/skills/mi-skill/
├── manifest.json     # Metadata y permisos requeridos
├── index.js          # Lógica del skill
└── README.md         # Documentación
```

### Estructura de un skill

```json
// manifest.json
{
  "name": "mi-skill",
  "version": "1.0.0",
  "description": "Descripción de lo que hace",
  "permissions": ["network", "filesystem:read"],
  "triggers": ["keyword:mi-comando"],
  "author": "tu-nombre"
}
```

---

## Presupuesto de Integraciones

| Integración | Costo |
|---|---|
| WhatsApp (Baileys) | $0 |
| Gmail API | $0 (cuota gratuita: 1B unidades/día) |
| Calendar API | $0 (cuota gratuita: 1M queries/día) |
| Telegram Bot | $0 |
| Spotify Dev | $0 |
| GitHub Token | $0 |
| Home Assistant | $0 (self-hosted) |
| Weather API | $0 (OpenWeather free tier) |
| **Total integraciones** | **$0/mes** |

El único costo operativo es la electricidad del servidor (~$2-3 USD/mes).
