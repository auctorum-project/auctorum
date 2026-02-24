# AUCTORUM

<div align="center">

**Privacidad. Control. Autoría.**

*Sé el autor de tu propia inteligencia artificial.*
*Porque la inteligencia que organiza tu vida debe pertenecerte.*

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Hardware: CERN OHL-S v2](https://img.shields.io/badge/Hardware-CERN%20OHL--S%20v2-green.svg)](https://ohwr.org/cernohl)
[![Standard: IEEE P7012](https://img.shields.io/badge/Standard-IEEE%20P7012-purple.svg)](https://standards.ieee.org/ieee/P7012)
[![Status: Phase 0](https://img.shields.io/badge/Status-Phase%200%20%E2%80%94%20Foundation-orange.svg)]()

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
| Suscripción mensual perpetua | ~ USD/mes en electricidad |
| Si cierran, pierdes tu asistente | Tu servidor no se apaga |

---

## Arquitectura

AUCTORUM implementa una separación formal entre **Modo Kernel** y **Modo Usuario**, inspirada en los principios de diseño de sistemas operativos:
`
┌─────────────────────────────────────────────────────────┐
│  CAPA 5 — USUARIO                                       │
│  iOS · Android · Windows · Linux · macOS · Web · CLI    │
├─────────────────────────────────────────────────────────┤
│  CAPA 4 — VOZ AMBIENT                                   │
│  Dispositivo Gen1/Gen2 · Wyoming Protocol · AirPods     │
├─────────────────────────────────────────────────────────┤
│  CAPA 3 — INTEGRACIONES                                 │
│  WhatsApp · Gmail · Calendar · Spotify · GitHub · HA    │
├─────────────────────────────────────────────────────────┤
│  CAPA 2 — ORQUESTACIÓN (OpenClaw)                       │
│  Router de intenciones · Agentes · Memoria · Seguridad  │
├─────────────────────────────────────────────────────────┤
│  CAPA 1 — INFRAESTRUCTURA (Modo Kernel)                 │
│  Ubuntu 24.04 · Ollama · GTX 1070 · Tailscale · UFW    │
└─────────────────────────────────────────────────────────┘
`

### Stack de modelos LLM (100% local, 0% cloud por defecto)

| Modelo | Función | VRAM |
|---|---|---|
| **Qwen3:8B** | Agente principal — conversación, integraciones, tareas | ~5.5 GB |
| **DeepSeek-R1:8B** | Razonamiento profundo — código complejo, análisis técnico | ~5.5 GB |
| **Llama3.2:3B** | Velocidad — comandos rápidos, pipeline de voz | ~2 GB |
| **Llama3.2:1B** | Aegis Sentinel — auditoría de seguridad exclusivamente | ~0.8 GB |

### Modelo de seguridad — Defensa en profundidad

- 🛡️ **Aegis Sentinel** — LLM ultraligero auditando en tiempo real, detección de Prompt Injection
- 🔒 **Vaultwarden** — credenciales efímeras, sin tokens estáticos en el sistema de archivos
- 🐳 **Docker efímero** — cada skill en contenedor aislado que se destruye al terminar
- 🌐 **Tailscale/Headscale** — red WireGuard cifrada, sin puertos expuestos al internet público
- 🚪 **Glass Break Protocol** — confirmación explícita obligatoria antes de enviar datos a modelos cloud
- 🔥 **UFW + CrowdSec** — firewall + inteligencia colectiva de amenazas

---

## Estado del proyecto

**Fase 0 — Fundación** (iniciada el 23 de febrero de 2026)

### ✅ Completado — Día 1

- [x] Repositorio uctorum-project creado con licencia AGPL-3.0
- [x] Ubuntu 24.04 LTS instalado en servidor de escritorio (dual boot)
- [x] NVIDIA GTX 1070 verificada — Driver 535.288.01, CUDA 12.2
- [x] Ollama instalado como servicio del sistema
- [x] Qwen3:8B corriendo con GPU (5.5 GB VRAM activos, inferencia verificada en español)
- [x] DeepSeek-R1:8B instalado para razonamiento profundo
- [x] Llama3.2:3B instalado para velocidad y pipeline de voz
- [x] Llama3.2:1B instalado para Aegis Sentinel
- [x] Node.js 22.22.0 instalado
- [x] Tailscale conectando servidor (100.121.31.99), Alienware e iPhone
- [x] Ollama accesible desde red Tailscale verificado desde iPhone
- [x] UFW configurado — deny incoming, Ollama solo desde red Tailscale
- [x] Git configurado en servidor y Alienware

### 🔄 En progreso

- [ ] OpenClaw instalado y configurado
- [ ] Primer commit con documento fundacional

### ⏳ Pendiente — Fase 0

- [ ] WhatsApp conectado — primer mensaje respondido por el agente
- [ ] Gmail + Google Calendar + Spotify + GitHub skill activos
- [ ] Vaultwarden instalado y gestionando credenciales
- [ ] CrowdSec instalado y conectado a Aegis Sentinel básico
- [ ] ARCHITECTURE.md con diagramas Mermaid completos
- [ ] Primer post en r/selfhosted y Ollama Discord

---

## Hardware del servidor (configuración verificada)

| Componente | Especificación |
|---|---|
| CPU | Intel Core i3-7100 (2C/4T, 3.9 GHz) |
| RAM | 16 GB DDR4 |
| GPU | NVIDIA GeForce GTX 1070 — 8 GB VRAM |
| Almacenamiento | 1 TB SSD |
| Sistema Operativo | Ubuntu 24.04 LTS |
| Red privada | Tailscale (WireGuard) |

---

## Repositorios del ecosistema

| Repositorio | Contenido |
|---|---|
| uctorum-project/auctorum | Este repositorio — core, documentación, arquitectura |
| uctorum-project/aegis | Módulo Aegis Sentinel |
| uctorum-project/firmware | ESP32 / Raspberry Pi — wake word, Wyoming |
| uctorum-project/app-ios | App iOS Swift/SwiftUI |
| uctorum-project/app-android | App Android Kotlin/Compose |
| uctorum-project/app-desktop | App desktop Tauri |
| uctorum-project/hardware | KiCad PCB Gen 2, STL, BOM |
| uctorum-project/integrations | Skills oficiales |
| uctorum-project/installer | Script de instalación automatizado |

---

## Roadmap
`
Fase 0 — Fundación        ████████░░  Semanas 1-4    (en curso)
Fase 1 — MVP Público      ░░░░░░░░░░  Meses 2-5      100 usuarios
Fase 2 — Comunidad        ░░░░░░░░░░  Meses 6-10     1,000 instalaciones
Fase 3 — Escala           ░░░░░░░░░░  Meses 11-18    B2B + crowdfunding
`

---

## Licencia

- **Software**: [AGPL-3.0](LICENSE) — cualquier modificación, incluso como servicio, debe publicarse bajo la misma licencia
- **Hardware**: CERN OHL-S v2 — equivalente de AGPL para diseños físicos
- **Alineado con**: IEEE P7012 — Machine Readable Personal Privacy Terms

---

<div align="center">

*Armando Javier Flores Salazar — Fundador y Arquitecto Principal*
*ITESM Campus Saltillo — Saltillo, Coahuila, México — 2026*

**AUCTORUM** — Del latín *auctor*: quien organiza, quien hace crecer, quien crea.

</div>
