import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { type PageId } from '@/components/BottomNav'
import {
  Settings, Server, Globe, Save, Wifi,
  CheckCircle, XCircle, Loader2, Shield, Database, Code2, ScrollText
} from 'lucide-react'

interface AppSettings {
  host: string
  user: string
  port: number
  keyPath: string
  ollamaPort: number
  gatewayPort: number
}

const defaultSettings: AppSettings = {
  host: '100.x.x.x',
  user: 'cocopsn',
  port: 22,
  keyPath: '~/.ssh/id_ed25519',
  ollamaPort: 11434,
  gatewayPort: 8080,
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; latency: number }
  | { status: 'error'; message: string }

interface SettingsPageProps {
  onNavigate: (page: PageId) => void
}

const morePages: { id: PageId; icon: React.ComponentType<{ size?: number }>; label: string; desc: string }[] = [
  { id: 'openclaw', icon: Shield, label: 'OpenClaw', desc: 'Daemon, permissions, routines' },
  { id: 'memory', icon: Database, label: 'Memory', desc: 'Entries, events, SQL query' },
  { id: 'editor', icon: Code2, label: 'Editor', desc: 'Workspace file editor' },
  { id: 'logs', icon: ScrollText, label: 'Logs', desc: 'Gateway and agent logs' },
]

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [savedSnapshot, setSavedSnapshot] = useState<string>(JSON.stringify(defaultSettings))
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const isDirty = JSON.stringify(settings) !== savedSnapshot

  // Validation
  const hostValid = settings.host.trim().length > 0
  const userValid = settings.user.trim().length > 0
  const portValid = settings.port >= 1 && settings.port <= 65535
  const ollamaPortValid = settings.ollamaPort >= 1 && settings.ollamaPort <= 65535
  const gatewayPortValid = settings.gatewayPort >= 1 && settings.gatewayPort <= 65535
  const formValid = hostValid && userValid && portValid && ollamaPortValid && gatewayPortValid

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await api<AppSettings>('/settings')
        if (loaded) {
          setSettings(loaded)
          setSavedSnapshot(JSON.stringify(loaded))
        }
      } catch {
        // Keep defaults
      }
    }
    load()
  }, [])

  const updateField = useCallback((field: keyof AppSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: field === 'port' || field === 'ollamaPort' || field === 'gatewayPort'
        ? parseInt(value) || 0
        : value,
    }))
  }, [])

  const handleTestConnection = async () => {
    setTestState({ status: 'testing' })
    const start = Date.now()
    try {
      await api<{ ok: boolean; latency: number; hostname: string }>('/system/test')
      const latency = Date.now() - start
      setTestState({ status: 'success', latency })
    } catch (e) {
      setTestState({ status: 'error', message: e instanceof Error ? e.message : 'Connection failed' })
    }
    setTimeout(() => setTestState({ status: 'idle' }), 5000)
  }

  const handleSave = async () => {
    if (!formValid) return
    setSaveStatus('saving')
    try {
      await api('/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      })
      setSavedSnapshot(JSON.stringify(settings))
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  return (
    <div className="p-4 h-full overflow-y-auto animate-fade-in space-y-5">
      {/* Page title */}
      <div className="flex items-center gap-2">
        <Settings size={16} style={{ color: 'var(--color-text-dim)' }} />
        <h1 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Settings
        </h1>
      </div>

      {/* More Pages navigation */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            More pages
          </span>
        </div>
        <div>
          {morePages.map(page => {
            const Icon = page.icon
            return (
              <button
                key={page.id}
                onClick={() => onNavigate(page.id)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left tap-highlight"
                style={{
                  borderBottom: '1px solid var(--color-border-dim)',
                  background: 'transparent',
                  border: 'none',
                  borderBottomWidth: 1,
                  borderBottomStyle: 'solid',
                  borderBottomColor: 'var(--color-border-dim)',
                }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--color-bg-tertiary)',
                  }}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {page.label}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    {page.desc}
                  </span>
                </div>
                <span style={{ color: 'var(--color-text-dim)' }}>
                  <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                    <path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Server Connection */}
      <div className="card overflow-hidden animate-fade-in delay-1">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Server size={14} style={{ color: 'var(--color-text-dim)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Server Connection
            </span>
          </div>
          <TestConnectionButton
            state={testState}
            onClick={handleTestConnection}
            disabled={testState.status === 'testing'}
          />
        </div>
        <div className="p-4 space-y-4">
          {/* Host */}
          <FieldGroup label="Host address">
            <input
              className="input input-mono"
              type="text"
              value={settings.host}
              onChange={e => updateField('host', e.target.value)}
              placeholder="e.g. 100.x.x.x"
            />
          </FieldGroup>

          {/* Username + Port */}
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="SSH user">
              <input
                className="input input-mono"
                type="text"
                value={settings.user}
                onChange={e => updateField('user', e.target.value)}
                placeholder="e.g. cocopsn"
              />
            </FieldGroup>
            <FieldGroup label="SSH port">
              <input
                className="input input-mono"
                type="number"
                value={settings.port}
                onChange={e => updateField('port', e.target.value)}
                placeholder="22"
                min={1}
                max={65535}
              />
            </FieldGroup>
          </div>

          {/* SSH Key */}
          <FieldGroup label="SSH key path">
            <input
              className="input input-mono"
              type="text"
              value={settings.keyPath}
              onChange={e => updateField('keyPath', e.target.value)}
              placeholder="~/.ssh/id_ed25519"
            />
          </FieldGroup>
        </div>
      </div>

      {/* Services */}
      <div className="card overflow-hidden animate-fade-in delay-2">
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <Globe size={14} style={{ color: 'var(--color-text-dim)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Services
          </span>
        </div>
        <div className="p-4 space-y-4">
          <FieldGroup label="Ollama port">
            <input
              className="input input-mono"
              type="number"
              value={settings.ollamaPort}
              onChange={e => updateField('ollamaPort', e.target.value)}
              placeholder="11434"
              min={1}
              max={65535}
            />
            <EndpointPreview host={settings.host} port={settings.ollamaPort} />
          </FieldGroup>

          <FieldGroup label="Gateway port">
            <input
              className="input input-mono"
              type="number"
              value={settings.gatewayPort}
              onChange={e => updateField('gatewayPort', e.target.value)}
              placeholder="18789"
              min={1}
              max={65535}
            />
            <EndpointPreview host={settings.host} port={settings.gatewayPort} />
          </FieldGroup>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3 animate-fade-in delay-3 pb-4">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!isDirty || !formValid || saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : saveStatus === 'saved' ? (
            <CheckCircle size={15} />
          ) : (
            <Save size={15} />
          )}
          {saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save changes'}
        </button>
        {saveStatus === 'saved' && (
          <span className="animate-fade-in" style={{ color: 'var(--color-green)', fontSize: 13 }}>
            Settings saved.
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="animate-fade-in" style={{ color: 'var(--color-red)', fontSize: 13 }}>
            Failed to save.
          </span>
        )}
      </div>
    </div>
  )
}

/* Sub-components */

function FieldGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 500, display: 'block' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function EndpointPreview({ host, port }: { host: string; port: number }) {
  return (
    <div className="mono" style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
      http://{host || '...'}:{port || '...'}
    </div>
  )
}

function TestConnectionButton({
  state,
  onClick,
  disabled,
}: {
  state: TestState
  onClick: () => void
  disabled: boolean
}) {
  let icon: React.ReactNode
  let label: string

  switch (state.status) {
    case 'idle':
      icon = <Wifi size={12} />
      label = 'Test'
      break
    case 'testing':
      icon = <Loader2 size={12} className="animate-spin" />
      label = 'Testing...'
      break
    case 'success':
      icon = <CheckCircle size={12} />
      label = `${state.latency}ms`
      break
    case 'error':
      icon = <XCircle size={12} />
      label = 'Failed'
      break
  }

  return (
    <button
      className="btn btn-sm btn-secondary"
      onClick={onClick}
      disabled={disabled}
      style={{ gap: 4 }}
    >
      {icon}
      {label}
    </button>
  )
}
