import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { Panel } from '@/components/Panel'
import {
  Shield, Terminal, Mail, Search, HardDrive, MessageCircle,
  RotateCw, OctagonX, CheckCircle2, XCircle, Settings2,
  Calendar, Save, ScrollText, Cpu, Sliders
} from 'lucide-react'

interface OpenClawStatus {
  active: boolean
  status: string
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

export function OpenClawPage() {
  const [status, setStatus] = useState<OpenClawStatus | null>(null)
  const [permissions, setPermissions] = useState<AegisPermissions | null>(null)
  const [config, setConfig] = useState<GatewayConfig>(defaultConfig)
  const [configDirty, setConfigDirty] = useState(false)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [gatewayLogs, setGatewayLogs] = useState<string[]>([])
  const [actionResult, setActionResult] = useState<{ message: string; success: boolean } | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const [saving, setSaving] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchAll = async () => {
    try {
      const [s, p, c, r, l] = await Promise.all([
        api<OpenClawStatus>('/openclaw/status').catch(() => ({ active: false, status: 'unknown' })),
        api<{ permissions: Record<string, boolean> }>('/openclaw/permissions').catch(() => ({ permissions: {} })),
        api<{ gateway: GatewayConfig }>('/openclaw/config').catch(() => ({ gateway: {} })),
        api<{ routines: Routine[] }>('/openclaw/routines').catch(() => ({ routines: [] })),
        api<{ lines: string[] }>('/openclaw/logs').catch(() => ({ lines: [] })),
      ])

      setStatus(s)

      if (p.permissions) {
        setPermissions({
          bash_enabled: p.permissions.bash_enabled ?? false,
          gmail_enabled: p.permissions.gmail_enabled ?? false,
          web_search_enabled: p.permissions.web_search_enabled ?? false,
          file_write_enabled: p.permissions.file_write_enabled ?? false,
          whatsapp_enabled: p.permissions.whatsapp_enabled ?? false,
        })
      }

      if (c.gateway && Object.keys(c.gateway).length > 0) {
        setConfig({ ...defaultConfig, ...c.gateway })
        setConfigDirty(false)
      }

      setRoutines(r.routines || [])
      setGatewayLogs(l.lines || [])
    } catch (e) {
      console.error('OpenClaw fetch error:', e)
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
      const result = await api<{ success: boolean; message: string }>('/openclaw/restart', { method: 'POST' })
      setActionResult({ message: result.message || 'Restart signal sent', success: true })
      fetchAll()
    } catch (e) {
      setActionResult({ message: `Failed to restart: ${e}`, success: false })
    }
  }

  const handleKillSwitch = async () => {
    try {
      const result = await api<{ success: boolean; message: string }>('/openclaw/kill', { method: 'POST' })
      setActionResult({ message: result.message || 'Emergency stop executed', success: true })
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
      await api('/openclaw/permissions', {
        method: 'POST',
        body: JSON.stringify({ permissions: updated }),
      })
      setPermissions(updated)
    } catch (e) {
      console.error('Permission toggle error:', e)
    }
  }

  const updateConfig = <K extends keyof GatewayConfig>(key: K, value: GatewayConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setConfigDirty(true)
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      await api('/openclaw/config', {
        method: 'POST',
        body: JSON.stringify({ gateway: config }),
      })
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
      await api('/openclaw/routines', {
        method: 'POST',
        body: JSON.stringify({ routines: updated }),
      })
    } catch (e) {
      console.error('Routine toggle error:', e)
    }
  }

  const permissionItems: {
    key: keyof AegisPermissions
    label: string
    description: string
    icon: React.ReactNode
  }[] = [
    { key: 'bash_enabled', label: 'Bash execution', description: 'Execute shell commands', icon: <Terminal size={16} /> },
    { key: 'gmail_enabled', label: 'Gmail access', description: 'Read and send emails', icon: <Mail size={16} /> },
    { key: 'web_search_enabled', label: 'Web search', description: 'Perform web searches', icon: <Search size={16} /> },
    { key: 'file_write_enabled', label: 'File write', description: 'Write to workspace', icon: <HardDrive size={16} /> },
    { key: 'whatsapp_enabled', label: 'WhatsApp', description: 'Send/receive messages', icon: <MessageCircle size={16} /> },
  ]

  const enabledCount = permissions
    ? Object.values(permissions).filter(Boolean).length
    : 0

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto animate-fade-in">
      {/* Daemon Status */}
      <Panel
        title="Daemon Status"
        icon={<Shield size={16} />}
        collapsible
        className="delay-1"
        headerRight={
          <span className={`badge ${status?.active ? 'badge-green' : 'badge-red'}`}>
            <span className={`status-dot-sm ${status?.active ? 'status-online' : 'status-offline'}`} />
            {status?.active ? 'Active' : 'Inactive'}
          </span>
        }
      >
        <div className="space-y-4">
          {status?.status && (
            <div className="code-block">
              <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
                {status.status}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleRestart} className="btn btn-secondary btn-sm">
              <RotateCw size={13} />
              Restart
            </button>
            {!confirmStop ? (
              <button onClick={() => setConfirmStop(true)} className="btn btn-danger btn-sm">
                <OctagonX size={13} />
                Emergency Stop
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-fade-in"
                style={{
                  background: 'color-mix(in srgb, var(--color-yellow) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-yellow) 25%, transparent)',
                  borderRadius: 8, padding: '4px 10px',
                }}
              >
                <span style={{ color: 'var(--color-yellow)', fontSize: 12 }}>Confirm?</span>
                <button onClick={handleKillSwitch} className="btn btn-danger btn-sm">Yes</button>
                <button onClick={() => setConfirmStop(false)} className="btn btn-ghost btn-sm">No</button>
              </div>
            )}
          </div>
          {actionResult && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg animate-fade-in"
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
              <span style={{ color: actionResult.success ? 'var(--color-green)' : 'var(--color-red)', fontSize: 12 }}>
                {actionResult.message}
              </span>
            </div>
          )}
        </div>
      </Panel>

      {/* Gateway Configuration */}
      <Panel
        title="Gateway Config"
        icon={<Settings2 size={16} />}
        collapsible
        defaultCollapsed
        className="delay-2"
        headerRight={
          configDirty ? (
            <span className="badge badge-yellow">Unsaved</span>
          ) : (
            <span className="badge badge-dim">Synced</span>
          )
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label style={{ color: 'var(--color-text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={12} /> Model
            </label>
            <input type="text" value={config.model} onChange={e => updateConfig('model', e.target.value)} className="input-field mono" placeholder="llama3.2:latest" />
          </div>
          <div className="space-y-1.5">
            <label style={{ color: 'var(--color-text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={12} /> Temperature
              <span className="mono" style={{ color: 'var(--color-accent)', marginLeft: 'auto' }}>{config.temperature.toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="2" step="0.05" value={config.temperature} onChange={e => updateConfig('temperature', parseFloat(e.target.value))} className="slider-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Max tokens</label>
              <input type="number" value={config.max_tokens} onChange={e => updateConfig('max_tokens', parseInt(e.target.value) || 0)} className="input-field mono" min={1} max={131072} />
            </div>
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Context window</label>
              <input type="number" value={config.context_window} onChange={e => updateConfig('context_window', parseInt(e.target.value) || 0)} className="input-field mono" min={512} max={131072} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>API port</label>
              <input type="number" value={config.api_port} onChange={e => updateConfig('api_port', parseInt(e.target.value) || 18789)} className="input-field mono" min={1024} max={65535} />
            </div>
            <div className="space-y-1.5">
              <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Log level</label>
              <select value={config.log_level} onChange={e => updateConfig('log_level', e.target.value)} className="input-field">
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>System prompt</label>
            <textarea value={config.system_prompt} onChange={e => updateConfig('system_prompt', e.target.value)} className="input-field mono" rows={3} placeholder="Enter system prompt..." style={{ resize: 'vertical', minHeight: 60 }} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => updateConfig('auto_restart', !config.auto_restart)} className={`toggle ${config.auto_restart ? 'active' : ''}`} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Auto-restart</span>
            </div>
            <div className="flex-1" />
            <button onClick={saveConfig} disabled={!configDirty || saving} className="btn btn-primary btn-sm">
              <Save size={12} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Panel>

      {/* Agent Permissions */}
      <Panel
        title="Permissions"
        icon={<Shield size={16} />}
        collapsible
        className="delay-3"
        headerRight={<span className="badge badge-blue">{enabledCount}/{permissionItems.length}</span>}
      >
        <div className="space-y-1" style={{ margin: '-16px', marginTop: '-8px' }}>
          {permissionItems.map(({ key, label, description, icon }) => {
            const enabled = permissions?.[key] ?? false
            return (
              <div key={key} className="flex items-center justify-between px-4 py-3 tap-highlight" onClick={() => togglePermission(key)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: enabled ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-bg-tertiary)',
                      color: enabled ? 'var(--color-accent)' : 'var(--color-text-dim)',
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 500 }}>{label}</p>
                    <p style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>{description}</p>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); togglePermission(key) }} className={`toggle ${enabled ? 'active' : ''}`} />
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Routines */}
      <Panel
        title="Routines"
        icon={<Calendar size={16} />}
        collapsible
        className="delay-4"
        headerRight={<span className="badge badge-dim">{routines.filter(r => r.enabled).length} active</span>}
      >
        {routines.length > 0 ? (
          <div className="space-y-1" style={{ margin: '-16px', marginTop: '-8px' }}>
            {routines.map((routine) => (
              <div key={routine.id} className="flex items-center justify-between px-4 py-3 tap-highlight" onClick={() => toggleRoutine(routine.id)}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: routine.enabled ? 'color-mix(in srgb, var(--color-green) 10%, transparent)' : 'var(--color-bg-tertiary)',
                      color: routine.enabled ? 'var(--color-green)' : 'var(--color-text-dim)',
                    }}
                  >
                    <Calendar size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate" style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 500 }}>{routine.name}</p>
                      <span className="mono flex-shrink-0" style={{ color: 'var(--color-text-dim)', fontSize: 10, background: 'var(--color-bg-tertiary)', padding: '1px 5px', borderRadius: 4 }}>
                        {routine.schedule}
                      </span>
                    </div>
                    <p className="truncate" style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>{routine.description}</p>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); toggleRoutine(routine.id) }} className={`toggle flex-shrink-0 ${routine.enabled ? 'active' : ''}`} style={{ marginLeft: 8 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div className="empty-state-icon"><Calendar size={20} /></div>
            <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>No routines configured</span>
          </div>
        )}
      </Panel>

      {/* Gateway Logs */}
      <Panel title="Gateway Logs" icon={<ScrollText size={16} />} collapsible defaultCollapsed className="delay-5"
        headerRight={<span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>Last 40 lines</span>}
      >
        {gatewayLogs.length > 0 ? (
          <pre className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 250, overflowY: 'auto', margin: 0 }}>
            {gatewayLogs.join('\n')}
          </pre>
        ) : (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div className="empty-state-icon"><ScrollText size={20} /></div>
            <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>No gateway logs available</span>
          </div>
        )}
      </Panel>
    </div>
  )
}
