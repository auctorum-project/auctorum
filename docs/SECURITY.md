# Seguridad — AUCTORUM

> Última actualización: Mayo 2026

---

## Filosofía de Seguridad

AUCTORUM sigue el principio de **defensa en profundidad**: múltiples capas de seguridad independientes, donde la falla de una capa no compromete el sistema completo. A diferencia de servicios cloud donde confías en el proveedor, aquí **tú controlas cada capa**.

---

## Modelo de Amenazas

### Actores de amenaza considerados

| Actor | Motivación | Vectores |
|---|---|---|
| Atacante externo | Acceso a datos/compute | Escaneo de puertos, brute force SSH |
| Prompt injection | Manipulación del agente | Mensajes WhatsApp maliciosos, emails crafteados |
| Malware local | Acceso al servidor | Exploits del OS, dependencias comprometidas |
| Insider (dispositivo robado) | Acceso físico | Disco no cifrado, sesiones activas |

### Fuera de alcance (aceptado)

- Side-channel attacks en GPU (requiere acceso físico)
- Supply chain de NVIDIA drivers (confianza en vendor)
- Compromiso de Tailscale coordination server (mitigado con Headscale futuro)

---

## Capas de Seguridad Implementadas

### Capa 1 — Red y Firewall

```bash
# UFW — política deny-all con excepciones explícitas
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 100.64.0.0/10 to any port 11434  # Ollama solo Tailscale
sudo ufw allow from 100.64.0.0/10 to any port 22     # SSH solo Tailscale
sudo ufw enable
```

**Principios:**
- **Zero puertos expuestos** al internet público
- Todo el tráfico pasa por Tailscale (WireGuard, cifrado punto a punto)
- El gateway OpenClaw escucha **solo en loopback** (`127.0.0.1:18789`)
- No hay port forwarding ni Tailscale Funnel habilitado
- Ollama no es accesible desde internet — solo desde la mesh Tailscale

### Capa 2 — Transporte SSH (C2 → Servidor)

El C2 Desktop se conecta al servidor exclusivamente via SSH sobre Tailscale:

```
Configuración SSH aplicada:
├── StrictHostKeyChecking=accept-new    # TOFU — rechaza keys cambiadas
├── IdentitiesOnly=yes                  # Solo la key especificada
├── BatchMode=yes                       # Sin prompts interactivos
├── ConnectTimeout=10                   # Timeout de 10 segundos
└── LogLevel=ERROR                      # Logging mínimo
```

**No se usa password authentication.** Solo key-based auth con la key privada almacenada localmente en la máquina del usuario.

### Capa 3 — Sanitización de Entrada

Todo input del usuario pasa por un pipeline de validación antes de ejecutarse en el servidor:

```
Input del usuario
    │
    ▼
┌──────────────────────────────┐
│  1. Validación de path       │  Rechaza: .., null bytes, backticks, $(
│     validate_workspace_path() │  Scope: solo ~/.openclaw/workspace/
├──────────────────────────────┤
│  2. Filtrado SQL             │  Solo permite: SELECT, PRAGMA
│     contains_sql_keyword()    │  Rechaza: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE
│                              │  Rechaza: punto y coma (previene chaining)
├──────────────────────────────┤
│  3. Shell escaping           │  Wrapping en single quotes POSIX
│     shell_escape()           │  Patrón: 'value' con '\'' para quotes internos
├──────────────────────────────┤
│  4. Base64 encoding          │  Para contenido de archivos y JSON payloads
│                              │  Elimina todos los metacaracteres de shell
├──────────────────────────────┤
│  5. Transporte SSH           │  Comando como argumento de SSH (no stdin)
│     ssh_exec()               │
└──────────────────────────────┘
```

### Capa 4 — Seguridad del Agente (OpenClaw)

| Control | Implementación |
|---|---|
| Exec default mode | **Deny** — el agente no puede ejecutar comandos sin aprobación |
| Prompt mode | **Ask** — confirmación explícita requerida |
| Skill CLI auto-allow | **Disabled** — cada skill requiere aprobación |
| DM policy | **Allowlist** — solo números autorizados pueden interactuar |
| Paired devices | 4 dispositivos con tokens individuales |
| Session limit | Gateway detecta contexto al 90% y reinicia sesión |

### Capa 5 — Aegis Sentinel (Auditoría LLM)

Llama3.2:1B corre como un modelo ultraligero (~0.8 GB VRAM) dedicado exclusivamente a:

- Validar que los prompts del usuario no contengan injection attacks
- Auditar las respuestas del modelo principal antes de ejecutar acciones
- Detectar intentos de jailbreak o manipulación
- Logging de eventos de seguridad

**Principio:** El modelo que audita es diferente del modelo que ejecuta — un modelo no puede auditarse a sí mismo.

### Capa 6 — Glass Break Protocol

Cualquier operación que envíe datos a modelos cloud (fallback providers) requiere:

1. Confirmación explícita del usuario
2. Logging del evento con timestamp y datos enviados
3. Opción de revisar qué se enviaría antes de confirmar

**Por defecto, todo es local.** Cloud es opt-in, nunca opt-out.

---

## Auditoría de Seguridad del C2 Desktop

Auditoría formal completada en marzo 2026. Resultados:

### Vulnerabilidades encontradas y remediadas

#### CRITICAL — Command Injection via SSH (CWE-78)
- **Problema:** Strings del usuario interpolados directamente en comandos SSH
- **Fix:** `shell_escape()` con wrapping POSIX en todas las llamadas
- **Verificación:** Input `hello'; rm -rf /; echo '` → output safe: `'hello'"'"'; rm -rf /; echo '"'"''`

#### HIGH — SQL Injection en Memory Database (CWE-89)
- **Problema:** Queries SQL arbitrarios aceptados sin filtrado
- **Fix:** Prefix validation (solo SELECT/PRAGMA), semicolon rejection, keyword blocking con word-boundary matching

#### HIGH — Path Traversal en Workspace (CWE-22)
- **Problema:** Paths del frontend sin validación permitían leer/escribir fuera del workspace
- **Fix:** `validate_workspace_path()` rechaza `..`, null bytes, backticks, `$(`, y verifica scope

#### HIGH — Path Traversal en Logs (CWE-22)
- **Problema:** Similar al workspace — paths de log sin validación
- **Fix:** `validate_log_path()` con whitelist de directorios permitidos

### Estado final

| Severidad | Estado |
|---|---|
| Critical | 0 abiertos |
| High | 0 abiertos |
| Medium | 0 abiertos |
| Low | 2 aceptados (requisitos de runtime Tauri/Vite) |

**Rating global: BAJO** ✅

→ Reporte detallado: [`apps/desktop/SECURITY_AUDIT.md`](../apps/desktop/SECURITY_AUDIT.md)

---

## Configuración Recomendada de Hardening

### Servidor Ubuntu

```bash
# 1. Actualizaciones automáticas de seguridad
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 2. SSH hardening
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# 3. Fail2ban para SSH
sudo apt install fail2ban
sudo systemctl enable fail2ban

# 4. Firewall (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 100.64.0.0/10 to any port 22
sudo ufw allow from 100.64.0.0/10 to any port 11434
sudo ufw enable

# 5. Limitar acceso a Ollama
# En /etc/systemd/system/ollama.service:
# Environment="OLLAMA_HOST=100.121.31.99:11434"

# 6. Verificar que gateway solo escucha en loopback
ss -tlnp | grep 18789
# Debe mostrar: 127.0.0.1:18789 (NO 0.0.0.0:18789)
```

### Tailscale

```bash
# Verificar ACLs — solo tus dispositivos pueden conectarse
tailscale status

# Deshabilitar subnet routing (no compartir red local)
# Deshabilitar exit node (no rutear tráfico de otros)
# Habilitar MagicDNS para resolución interna
```

### OpenClaw

```json
// ~/.openclaw/config/aegis.json
{
  "exec": {
    "default": "deny",
    "allowlist": []
  },
  "channels": {
    "whatsapp": {
      "dm_policy": "allowlist",
      "allowed": ["+5218445387404"]
    }
  },
  "skills": {
    "auto_allow_cli": false
  }
}
```

---

## Riesgos Conocidos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| WhatsApp ban (Baileys reverse-engineering) | Media | Alto (pérdida de canal) | Canal redundante (Telegram), migración a WhatsApp Business API como fallback |
| Prompt injection via WhatsApp | Alta | Medio | Aegis Sentinel + allowlist + exec=deny |
| Robo de laptop con sesión activa | Baja | Alto | BitLocker + Tailscale device removal + Glass Break |
| Falla de GPU | Baja | Alto | Fallback a CPU (lento pero funcional) + cloud opt-in |
| Corrupción de memory.db | Baja | Medio | Backups automatizados + WAL mode |
| Compromiso de dependencias npm | Media | Alto | `npm audit`, lockfile, CrowdSec (futuro) |

---

## Política de Disclosure

Si encuentras una vulnerabilidad en AUCTORUM:

1. **No** la publiques en issues públicos
2. Envía un email a: armandofloressal@gmail.com con subject "AUCTORUM Security"
3. Incluye: descripción, pasos de reproducción, impacto estimado
4. Tiempo de respuesta esperado: 72 horas
5. Crédito público otorgado una vez parcheado (si lo deseas)

---

## Checklist de Seguridad Pre-Deploy

- [ ] UFW habilitado con política deny-all
- [ ] SSH solo por key (password deshabilitado)
- [ ] OpenClaw gateway en 127.0.0.1 (no 0.0.0.0)
- [ ] Tailscale activo y verificado
- [ ] Ollama solo accesible via Tailscale
- [ ] Aegis permissions: exec=deny, skills auto-allow=false
- [ ] WhatsApp DM policy: allowlist
- [ ] Glass Break Protocol activo
- [ ] Backups de memory.db configurados
- [ ] `npm audit` sin vulnerabilidades críticas
- [ ] NVIDIA driver actualizado
- [ ] No hay tokens/passwords en archivos del workspace
