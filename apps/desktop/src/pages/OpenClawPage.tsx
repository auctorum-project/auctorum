import { useState, useEffect, useRef } from 'react'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { Panel } from '@/components/Panel'
import {
  Shield, Terminal, Mail, Search, HardDrive, MessageCircle,
  RotateCw, OctagonX, CheckCircle2, XCircle, Settings2,
  Calendar, Save, ScrollText, Cpu, Sliders
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface OpenClawStatus {
  daemon_active: boolean
  status_text: string
}

interface AegisPermissions {
  bash_enabled: boolean
  gmail_enabled: boolean
  web_search_enabled: boolean
  file_write_enabled: boolean
  whatsapp_enabled: boolean
}

interface GatewayConfig {
  model: string
  temperature: number
  max_tokens: number
  context_window: number
  system_prompt: string
  api_port: number
  log_level: string
  auto_restart: boolean
}

interface Routine {
  id: string
  name: string
  schedule: string
  description: string
  enabled: boolean
}

// ── Helpers ────────────────────────────────────────────────────────

const defaultConfig: GatewayConfig = {
  model: 'llama3.2:latest',
  temperature: 0.7,
  max_tokens: 2048,
  context_window: 4096,
  system_prompt: '',
  api_port: 18789,
  log_level: 'info',
  auto_restart: true,
}

const mockRoutines: Routine[] = [
  { id: 'r1', name: 'Daily health check', schedule: '0 8 * * *', description: 'Check system health and report anomalies', enabled: true },
  { id: 'r2', name: 'Memory cleanup', schedule: '0 3 * * 0', description: 'Purge stale memory entries older than 30 days', enabled: true },
  { id: 'r3', name: 'Log rotation', schedule: '0 0 * * *', description: 'Rotate and compress gateway log files', enabled: false },
]

// ── Component ──────────────────────────────────────────────────────

export function OpenClawPage() {
  const [status, setStatus] = useState<OpenClawStatus | null>(null)
  const [permissions, setPermissions] = useState<AegisPermissions | null>(null)
  const [config, setConfig] = useState<GatewayConfig>(defaultConfig)
  const [configDirty, setConfigDirty] = useState(false)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [gatewayLogs, setGatewayLogs] = useState<string>('')
  const [actionResult, setActionResult] = useState<{ message: string; success: boolean } | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [saving, setSaving] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchAll = async () => {
    try {
      if (isTauri) {
        const [s, p, c, r, l] = await Promise.all([
          tauriInvoke<OpenClawStatus>('get_openclaw_status'),
          tauriInvoke<AegisPermissions>('get_aegis_permissions'),
          tauriInvoke<GatewayConfig>('get_gateway_config'),
          tauriInvoke<Routine[]>('get_openclaw_routines'),
          tauriInvoke<string>('get_gateway_logs', { lines: 40 }),
        ])
        if (s) setStatus(s)
        if (p) setPermissions(p)
        if (c) { setConfig(c); setConfigDirty(false) }
        if (r) setRoutines(r)
        if (l) setGatewayLogs(l)
      } else {
        setStatus({ daemon_active: true, status_text: 'active since Mon 2026-03-02 08:00:01 UTC' })
        setPermissions({
          bash_enabled: true,
          gmail_enabled: false,
          web_search_enabled: true,
          file_write_enabled: true,
          whatsapp_enabled: false,
        })
        setConfig(defaultConfig)
        setRoutines(mockRoutines)
        setGatewayLogs('[2026-03-02 08:00:01] Gateway started on port 18789\n[2026-03-02 08:00:02] Model loaded: llama3.2:latest\n[2026-03-02 08:15:33] Request processed in 1.2s\n[2026-03-02 09:01:12] Routine "Daily health check" executed successfully\n[2026-03-02 10:30:45] Request processed in 0.8s')
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 8000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (confirmStop) {
      confirmTimerRef.current = setTimeout(() => setConfirmStop(false), 5000)
    }
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }
  }, [confirmStop])

  useEffect(() => {
    if (actionResult) {
      const t = setTimeout(() => setActionResult(null), 4000)
      return () => clearTimeout(t)
    }
  }, [actionResult])

  const handleRestart = async () => {
    try {
      if (isTauri) {
        const result = await tauriInvoke<string>('openclaw_restart')
        setActionResult({ message: result || 'Restart signal sent', success: true })
      } else {
        setActionResult({ message: 'Restart signal sent successfully', success: true })
      }
      fetchAll()
    } catch (e) {
      setActionResult({ message: `Failed to restart: ${e}`, success: false })
    }
  }

  const handleKillSwitch = async () => {
    try {
      if (isTauri) {
        const result = await tauriInvoke<string>('openclaw_kill_switch')
        setActionResult({ message: result || 'Emergency stop executed', success: true })
      } else {
        setStatus({ daemon_active: false, status_text: 'daemon stopped by kill switch' })
        setActionResult({ message: 'Emergency stop executed', success: true })
      }
      setConfirmStop(false)
      fetchAll()
    } catch (e) {
      setActionResult({ message: `Kill switch failed: ${e}`, success: false })
      setConfirmStop(false)
    }
  }

  const togglePermission = async (key: keyof AegisPermissions) => {
    if (!permissions) return
    const updated = { ...permissions, [key]: !permissions[key] }
    try {
      if (isTauri) {
        await tauriInvoke('set_aegis_permissions', { permissions: updated })
      }
      setPermissions(updated)
    } catch (e) {
      console.error(e)
    }
  }

  const updateConfig = <K extends keyof GatewayConfig>(key: K, value: GatewayConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setConfigDirty(true)
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      if (isTauri) {
        await tauriInvoke('set_gateway_config', { config })
      }
      setConfigDirty(false)
      setActionResult({ message: 'Gateway configuration saved', success: true })
    } catch (e) {
      setActionResult({ message: `Failed to save config: ${e}`, success: false })
    } finally {
      setSaving(false)
    }
  }

  const toggleRoutine = async (id: string) => {
    const updated = routines.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    setRoutines(updated)
    try {
      if (isTauri) {
        await tauriInvoke('set_openclaw_routines', { routines: updated })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const permissionItems: {
    key: keyof AegisPermissions
    label: string
    description: string
    icon: React.ReactNode
  }[] = [
    { key: 'bash_enabled', label: 'Bash execution', description: 'Execute shell commands on the host', icon: <Terminal size={16} /> },
    { key: 'gmail_enabled', label: 'Gmail access', description: 'Read and send emails via Gmail API', icon: <Mail size={16} /> },
    { key: 'web_search_enabled', label: 'Web search', description: 'Perform web searches for information', icon: <Search size={16} /> },
    { key: 'file_write_enabled', label: 'File write', description: 'Write files to the workspace directory', icon: <HardDrive size={16} /> },
    { key: 'whatsapp_enabled', label: 'WhatsApp', description: 'Send and receive WhatsApp messages', icon: <MessageCircle size={16} /> },
  ]

  const enabledCount = permissions
    ? Object.values(permissions).filter(Boolean).length
    : 0

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto animate-fade-in">

      {/* ── Daemon Status Card ── */}
      <Panel
        title="Daemon Status"
        icon={<Shield size={16} />}
        collapsible
        className="delay-1"
        headerRight={
          <span className={`badge ${status?.daemon_active ? 'badge-green' : 'badge-red'}`}>
            <span className={`status-dot-sm ${status?.daemon_active ? 'status-online' : 'status-offline'}`} />
            {status?.daemon_active ? 'Active' : 'Inactive'}
          </span>
        }
      >
        <div className="space-y-4">
          {status?.status_text && (
            <div className="code-block">
              <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>
                {status.status_text}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleRestart} className="btn btn-secondary">
              <RotateCw size={14} />
              Restart
            </button>

            {!confirmStop ? (
              <button
                onClick={() => setConfirmStop(true)}
                className="btn btn-danger"
              >
                <OctagonX size={14} />
                Emergency Stop
              </button>
            ) : (
              <div
                className="flex items-center gap-2 animate-fade-in"
                style={{
                  background: 'color-mix(in srgb, var(--color-yellow) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-yellow) 25%, transparent)',
                  borderRadius: 8,
                  padding: '6px 12px',
                }}
              >
                <span style={{ color: 'var(--color-yellow)', fontSize: 13 }}>
                  Confirm stop?
                </span>
                <button
                  onClick={handleKillSwitch}
                  className="btn btn-danger btn-sm"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmStop(false)}
                  className="btn btn-ghost btn-sm"
                >
                  No
                </button>
              </div>
            )}
          </div>

          {actionResult && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg animate-fade-in"
              style={{
                background: actionResult.success
                  ? 'color-mix(in srgb, var(--color-green) 8%, transparent)'
                  : 'color-mix(in srgb, var(--color-red) 8%, transparent)',
                border: `1px solid ${actionResult.success
                  ? 'color-mix(in srgb, var(--color-green) 20%, transparent)'
                  : 'color-mix(in srgb, var(--color-red) 20%, transparent)'}`,
              }}
            >
              {actionResult.success
                ? <CheckCircle2 size={14} style={{ color: 'var(--color-green)' }} />
                : <XCircle size={14} style={{ color: 'var(--color-red)' }} />}
              <span
                style={{
                  color: actionResult.success ? 'var(--color-green)' : 'var(--color-red)',
                  fontSize: 13,
                }}
              >
                {actionResult.message}
              </span>
            </div>
          )}
        </div>
      </Panel>

      {/* ── Gateway Configuration ── */}
      <Panel
        title="Gateway Configuration"
        icon={<Settings2 size={16} />}
        collapsible
        className="delay-2"
        headerRight={
          configDirty ? (
            <span className="badge badge-yellow">Unsaved changes</span>
          ) : (
            <span className="badge badge-dim">Synced</span>
          )
        }
      >
        <div className="space-y-5">
          {/* Row 1: Model + Temperature */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={12} /> Model
              </label>
              <input
                type="text"
                value={config.model}
                onChange={e => updateConfig('model', e.target.value)}
                className="input-field mono"
                placeholder="llama3.2:latest"
              />
            </div>
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sliders size={12} /> Temperature
                <span className="mono" style={{ color: 'var(--color-accent)', marginLeft: 'auto' }}>
                  {config.temperature.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={config.temperature}
                onChange={e => updateConfig('temperature', parseFloat(e.target.value))}
                className="slider-input"
              />
            </div>
          </div>

          {/* Row 2: Max tokens + Context window */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Max tokens</label>
              <input
                type="number"
                value={config.max_tokens}
                onChange={e => updateConfig('max_tokens', parseInt(e.target.value) || 0)}
                className="input-field mono"
                min={1}
                max={131072}
              />
            </div>
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Context window</label>
              <input
                type="number"
                value={config.context_window}
                onChange={e => updateConfig('context_window', parseInt(e.target.value) || 0)}
                className="input-field mono"
                min={512}
                max={131072}
              />
            </div>
          </div>

          {/* Row 3: API port + Log level + Auto restart */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>API port</label>
              <input
                type="number"
                value={config.api_port}
                onChange={e => updateConfig('api_port', parseInt(e.target.value) || 18789)}
                className="input-field mono"
                min={1024}
                max={65535}
              />
            </div>
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Log level</label>
              <select
                value={config.log_level}
                onChange={e => updateConfig('log_level', e.target.value)}
                className="input-field"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Auto-restart</label>
              <div className="flex items-center gap-2 h-9">
                <button
                  onClick={() => updateConfig('auto_restart', !config.auto_restart)}
                  className={`toggle ${config.auto_restart ? 'active' : ''}`}
                  aria-label="Toggle auto-restart"
                />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                  {config.auto_restart ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* System prompt */}
          <div className="space-y-1.5">
            <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>System prompt</label>
            <textarea
              value={config.system_prompt}
              onChange={e => updateConfig('system_prompt', e.target.value)}
              className="input-field mono"
              rows={4}
              placeholder="Enter the system prompt for the agent..."
              style={{ resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={saveConfig}
              disabled={!configDirty || saving}
              className="btn btn-primary"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            {configDirty && (
              <button
                onClick={() => { fetchAll() }}
                className="btn btn-ghost"
              >
                Discard
              </button>
            )}
          </div>
        </div>
      </Panel>

      {/* ── Agent Permissions Card ── */}
      <Panel
        title="Agent Permissions"
        icon={<Shield size={16} />}
        collapsible
        className="delay-3"
        headerRight={
          <span className="badge badge-blue">
            {enabledCount} / {permissionItems.length} enabled
          </span>
        }
      >
        <div className="space-y-1" style={{ margin: '-16px', marginTop: '-8px' }}>
          <p style={{ color: 'var(--color-text-dim)', fontSize: 12, padding: '0 20px 8px' }}>
            Control what the AI agent can access
          </p>
          {permissionItems.map(({ key, label, description, icon }, idx) => {
            const enabled = permissions?.[key] ?? false
            return (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-3.5 rounded-lg transition-colors animate-fade-in"
                style={{
                  animationDelay: `${(idx + 2) * 40}ms`,
                  background: 'transparent',
                  margin: '0 8px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      background: enabled
                        ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                        : 'var(--color-bg-tertiary)',
                      color: enabled
                        ? 'var(--color-accent)'
                        : 'var(--color-text-dim)',
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 500 }}>
                      {label}
                    </p>
                    <p style={{ color: 'var(--color-text-dim)', fontSize: 12, marginTop: 1 }}>
                      {description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => togglePermission(key)}
                  className={`toggle ${enabled ? 'active' : ''}`}
                  aria-label={`Toggle ${label}`}
                />
              </div>
            )
          })}
        </div>
      </Panel>

      {/* ── Routines ── */}
      <Panel
        title="Scheduled Routines"
        icon={<Calendar size={16} />}
        collapsible
        className="delay-4"
        headerRight={
          <span className="badge badge-dim">
            {routines.filter(r => r.enabled).length} active
          </span>
        }
      >
        {routines.length > 0 ? (
          <div className="space-y-1" style={{ margin: '-16px', marginTop: '-8px' }}>
            {routines.map((routine) => (
              <div
                key={routine.id}
                className="flex items-center justify-between px-4 py-3.5 rounded-lg transition-colors"
                style={{ margin: '0 8px' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: routine.enabled
                        ? 'color-mix(in srgb, var(--color-green) 10%, transparent)'
                        : 'var(--color-bg-tertiary)',
                      color: routine.enabled
                        ? 'var(--color-green)'
                        : 'var(--color-text-dim)',
                    }}
                  >
                    <Calendar size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        style={{
                          color: 'var(--color-text-primary)',
                          fontSize: 13,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {routine.name}
                      </p>
                      <span
                        className="mono flex-shrink-0"
                        style={{
                          color: 'var(--color-text-dim)',
                          fontSize: 11,
                          background: 'var(--color-bg-tertiary)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {routine.schedule}
                      </span>
                    </div>
                    <p style={{ color: 'var(--color-text-dim)', fontSize: 12, marginTop: 1 }}>
                      {routine.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleRoutine(routine.id)}
                  className={`toggle flex-shrink-0 ${routine.enabled ? 'active' : ''}`}
                  aria-label={`Toggle ${routine.name}`}
                  style={{ marginLeft: 12 }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Calendar size={20} />
            </div>
            <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
              No routines configured
            </span>
          </div>
        )}
      </Panel>

      {/* ── Gateway Logs ── */}
      <Panel
        title="Gateway Logs"
        icon={<ScrollText size={16} />}
        collapsible
        defaultCollapsed
        className="delay-5"
        headerRight={
          <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
            Last 40 lines
          </span>
        }
      >
        {gatewayLogs ? (
          <pre
            className="mono"
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 300,
              overflowY: 'auto',
              margin: 0,
            }}
          >
            {gatewayLogs}
          </pre>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ScrollText size={20} />
            </div>
            <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
              No gateway logs available
            </span>
          </div>
        )}
      </Panel>
    </div>
  )
}
