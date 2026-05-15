# Guía de Instalación — AUCTORUM

> Guía completa para instalar y configurar AUCTORUM desde cero en hardware propio.
> Tiempo estimado: 2-3 horas. Dificultad: Intermedia (requiere terminal Linux).

---

## Requisitos Previos

### Hardware

| Componente | Mínimo | Recomendado | Notas |
|---|---|---|---|
| GPU NVIDIA | GTX 1060 6GB | GTX 1070+ / RTX 3060+ | CUDA compute 6.1+ |
| RAM | 8 GB | 16 GB | Los modelos usan VRAM, no RAM |
| CPU | Cualquier x64 con 2+ cores | i5/Ryzen 5+ | Solo para pipeline de I/O |
| SSD | 50 GB libres | 100 GB+ | Modelos pesan ~5 GB cada uno |
| Red | WiFi | Ethernet estable | Para Tailscale y descargas |

### Software

| Requisito | Versión |
|---|---|
| Ubuntu / Debian | 22.04+ / 12+ (Ubuntu 24.04 LTS recomendado) |
| Driver NVIDIA | 525+ (535+ recomendado) |
| CUDA Toolkit | 12.x (viene con el driver) |
| Node.js | 20 LTS o 22 LTS |
| Git | 2.x |

---

## Fase 1 — Sistema Operativo

### Opción A: Instalación dedicada (recomendada)

1. Descarga Ubuntu 24.04 LTS Server desde [ubuntu.com](https://ubuntu.com/download/server)
2. Instala en el disco dedicado al servidor AI
3. Configuración mínima — no instales desktop environment

### Opción B: Dual boot

1. Instala Ubuntu 24.04 junto al sistema existente
2. Asigna al menos 100 GB de partición

### Post-instalación

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas esenciales
sudo apt install -y build-essential curl wget git htop nvtop

# Verificar GPU
nvidia-smi
# Debe mostrar tu GPU con driver version y CUDA version
```

---

## Fase 2 — Driver NVIDIA y CUDA

Si `nvidia-smi` no funciona:

```bash
# Instalar driver recomendado
sudo apt install -y nvidia-driver-535

# Reiniciar
sudo reboot

# Verificar
nvidia-smi
# Output esperado:
# +-------------------------+
# | NVIDIA-SMI 535.xxx      |
# | Driver Version: 535.xxx |
# | CUDA Version: 12.x     |
# +-------------------------+
# | GeForce GTX 1070  8GB   |
# +-------------------------+
```

---

## Fase 3 — Ollama (Runtime LLM)

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verificar que está corriendo como servicio
sudo systemctl status ollama
# Debe decir: active (running)

# Descargar modelos (toma 10-20 min por modelo según conexión)
ollama pull qwen3:8b          # Agente principal (~5.5 GB)
ollama pull deepseek-r1:8b    # Razonamiento (~5.5 GB)
ollama pull llama3.2:3b       # Velocidad (~2 GB)
ollama pull llama3.2:1b       # Aegis Sentinel (~0.8 GB)

# Verificar
ollama list
# Debe listar los 4 modelos con sus tamaños

# Test rápido
ollama run qwen3:8b "Hola, ¿estás funcionando?"
# Debe responder en español de forma coherente
# Ctrl+D para salir
```

### Configurar Ollama para red Tailscale

```bash
# Editar servicio para que escuche en la IP de Tailscale
sudo systemctl edit ollama

# Agregar:
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"

# Guardar y reiniciar
sudo systemctl daemon-reload
sudo systemctl restart ollama

# Verificar que escucha
ss -tlnp | grep 11434
```

> **IMPORTANTE:** El firewall UFW (configurado más adelante) protegerá el puerto 11434 — solo será accesible desde la red Tailscale.

---

## Fase 4 — Node.js

```bash
# Instalar Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version    # v22.x.x
npm --version     # 10.x.x
```

---

## Fase 5 — Tailscale (Red Privada)

Tailscale crea un túnel WireGuard cifrado entre todos tus dispositivos. Es lo que permite acceder al servidor desde tu laptop e iPhone **sin exponer puertos al internet**.

```bash
# Instalar
curl -fsSL https://tailscale.com/install.sh | sh

# Conectar (abre un link de autenticación)
sudo tailscale up

# Verificar
tailscale status
# Debe mostrar tu servidor con una IP 100.x.x.x

# Anotar la IP de Tailscale del servidor:
tailscale ip -4
# Ejemplo: 100.121.31.99
```

### En tu laptop/desktop (Windows/macOS):

1. Instala Tailscale desde [tailscale.com/download](https://tailscale.com/download)
2. Inicia sesión con la misma cuenta
3. Verifica que ves el servidor: `tailscale status`

### En iPhone:

1. Instala "Tailscale" desde App Store
2. Inicia sesión con la misma cuenta
3. Verifica conectividad: Settings → dispositivo del servidor debería aparecer

### Verificar conectividad

```bash
# Desde tu laptop, hacer ping al servidor por Tailscale:
ping 100.121.31.99    # (o la IP que anotaste)

# Verificar acceso a Ollama desde laptop:
curl http://100.121.31.99:11434/api/tags
# Debe retornar JSON con lista de modelos
```

---

## Fase 6 — Firewall (UFW)

```bash
# Instalar UFW si no está
sudo apt install -y ufw

# Configurar políticas base
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH solo desde Tailscale
sudo ufw allow from 100.64.0.0/10 to any port 22

# Permitir Ollama solo desde Tailscale
sudo ufw allow from 100.64.0.0/10 to any port 11434

# Habilitar
sudo ufw enable

# Verificar
sudo ufw status verbose
```

> **100.64.0.0/10** es el rango CGNAT que Tailscale usa para sus IPs. Esto permite tráfico desde CUALQUIER dispositivo en tu red Tailscale.

---

## Fase 7 — OpenClaw Gateway

OpenClaw es el orquestador que conecta tus modelos LLM con canales de comunicación (WhatsApp, Telegram) y herramientas (Gmail, Calendar, etc.).

```bash
# Instalar globalmente
npm install -g @openclaw/gateway

# Inicializar (wizard interactivo)
openclaw init

# El wizard preguntará:
# - Nombre del agente: "main" (o el que prefieras)
# - Modelo por defecto: qwen3:8b
# - Endpoint de Ollama: http://127.0.0.1:11434
# - Directorio de workspace: ~/.openclaw/workspace
# - Puerto del gateway: 18789

# Verificar instalación
openclaw status

# Iniciar el gateway
openclaw start

# Verificar que está corriendo
curl http://127.0.0.1:18789/api/health
# Debe retornar: {"status": "ok"}
```

### Configurar como servicio systemd

```bash
# Crear unit file
sudo tee /etc/systemd/user/openclaw-gateway.service << 'EOF'
[Unit]
Description=OpenClaw AI Gateway
After=network.target ollama.service

[Service]
Type=simple
ExecStart=/usr/bin/openclaw start
Restart=on-failure
RestartSec=5
WorkingDirectory=%h/.openclaw
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

# Habilitar e iniciar
systemctl --user daemon-reload
systemctl --user enable openclaw-gateway
systemctl --user start openclaw-gateway

# Verificar
systemctl --user status openclaw-gateway
```

---

## Fase 8 — Seguridad del Gateway

```bash
# Configurar permisos de seguridad
cat > ~/.openclaw/config/aegis.json << 'EOF'
{
  "exec": {
    "default": "deny"
  },
  "skills": {
    "auto_allow_cli": false
  },
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789
  }
}
EOF

# Verificar que el gateway SOLO escucha en loopback
ss -tlnp | grep 18789
# CORRECTO:   127.0.0.1:18789
# INCORRECTO: 0.0.0.0:18789  ← esto expondría al internet
```

---

## Fase 9 — WhatsApp (Opcional)

> ⚠️ WhatsApp usa Baileys (reverse-engineering del protocolo). Existe riesgo de ban. Usa un número secundario si te preocupa.

```bash
# Iniciar conexión WhatsApp
openclaw channel add whatsapp

# Se generará un código QR en terminal
# Escanéalo con WhatsApp > Dispositivos vinculados > Vincular dispositivo

# Verificar conexión
openclaw channel status whatsapp
# Debe decir: connected

# Configurar política de DMs (IMPORTANTE)
openclaw config set channels.whatsapp.dm_policy allowlist
openclaw config set channels.whatsapp.allowed '["+521XXXXXXXXXX"]'
```

---

## Fase 10 — Gmail y Google Calendar (Opcional)

### Crear proyecto en Google Cloud Console

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un nuevo proyecto (ej: "Auctorum Personal")
3. Habilita las APIs:
   - Gmail API
   - Google Calendar API
4. Crea credenciales OAuth 2.0:
   - Tipo: Aplicación de escritorio
   - Descarga el JSON de credenciales

### Configurar en OpenClaw

```bash
# Copiar credenciales al servidor
scp google-credentials.json usuario@100.121.31.99:~/.openclaw/config/

# Autorizar (abre URL de OAuth)
openclaw skill enable google-workspace
# Sigue las instrucciones para autorizar acceso

# Verificar
openclaw skill status google-workspace
# Debe decir: eligible
```

---

## Fase 11 — C2 Desktop (Windows)

El C2 es la aplicación de escritorio que te da control visual sobre toda la infraestructura.

### Desde release pre-compilado (cuando esté disponible)

```
Descarga auctorum-c2-setup.exe desde GitHub Releases
Instala y configura:
  - Host: [IP Tailscale de tu servidor]
  - SSH User: [tu usuario]
  - SSH Key: [path a tu key privada]
  - Ollama Port: 11434
  - Gateway Port: 18789
```

### Desde código fuente

```bash
# Requisitos: Rust + Node.js + Visual Studio Build Tools

# Clonar
git clone https://github.com/auctorum-project/auctorum.git
cd auctorum/apps/desktop

# Instalar dependencias
npm install

# Desarrollo (browser mode con mock data)
npm run dev

# Desarrollo completo (con Tauri + Rust)
npm run tauri dev

# Build para producción
npm run tauri build
# Output: src-tauri/target/release/bundle/
```

---

## Fase 12 — Verificación Final

### Checklist de verificación

```bash
# En el servidor:
nvidia-smi                              # GPU activa
ollama list                             # 4 modelos
systemctl --user status openclaw-gateway # active (running)
tailscale status                        # Conectado
sudo ufw status                         # active, rules correctas
ss -tlnp | grep 18789                   # 127.0.0.1 (loopback only)
curl http://127.0.0.1:18789/api/health  # {"status": "ok"}

# Desde tu laptop (vía Tailscale):
curl http://[IP_TAILSCALE]:11434/api/tags   # Lista de modelos
ssh usuario@[IP_TAILSCALE] "echo ok"        # SSH funciona
```

### Test de chat

```bash
# Envía un mensaje a tu número de WhatsApp vinculado
# El agente debería responder via Qwen3:8B

# O usa el C2 Desktop > Sandbox > selecciona qwen3:8b > escribe un mensaje
```

---

## Solución de Problemas

| Problema | Solución |
|---|---|
| `nvidia-smi` no funciona | Reinstala driver: `sudo apt install nvidia-driver-535` + reboot |
| Ollama no arranca | `journalctl -u ollama` para ver logs. Verificar driver NVIDIA |
| Modelo muy lento | Verificar que usa GPU: `nvidia-smi` durante inferencia debe mostrar uso de VRAM |
| Tailscale no conecta | `tailscale up --reset` y re-autenticar |
| Gateway en 0.0.0.0 | Editar aegis.json, set `gateway.host` a `127.0.0.1`, reiniciar |
| WhatsApp desconectado | `openclaw channel restart whatsapp` — puede requerir re-escanear QR |
| SSH connection refused | Verificar que UFW permite puerto 22 desde 100.64.0.0/10 |
| C2 "connection failed" | Verificar IP en Settings, que SSH key es correcta, que Tailscale está activo |

---

## Actualizaciones

```bash
# Actualizar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Actualizar modelos
ollama pull qwen3:8b
ollama pull deepseek-r1:8b

# Actualizar OpenClaw
npm update -g @openclaw/gateway
systemctl --user restart openclaw-gateway

# Actualizar sistema
sudo apt update && sudo apt upgrade -y
```

---

## Próximos Pasos

Una vez que tu instancia está operativa:

1. **Personaliza el agente** — Edita la personalidad y contexto en `~/.openclaw/config/`
2. **Agrega integraciones** — Ver [`INTEGRACIONES.md`](INTEGRACIONES.md) para todas las opciones
3. **Configura el C2** — Conecta tu app de escritorio para monitoreo visual
4. **Hardening** — Sigue la guía en [`SECURITY.md`](SECURITY.md) para máxima seguridad
