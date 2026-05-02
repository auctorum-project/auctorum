import { useState, useEffect, useCallback } from 'react'
import { isTauri, tauriInvoke } from '@/lib/tauri'
import {
  Settings, Server, Globe, Save, FolderOpen,
  CheckCircle, XCircle, Loader2, Wifi, Info
} from 'lucide-react'

interface AppSettings {
  host: string
  ssh_user: string
  ssh_port: number
  ssh_key_path: string
  ollama_port: number
  gateway_port: number
}

const defaultSettings: AppSettings = {
  host: '100.x.x.x',
  ssh_user: 'cocopsn',
  ssh_port: 22,
  ssh_key_path: '~/.ssh/id_ed25519',
  ollama_port: 11434,
  gateway_port: 8080,
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; latency: number }
  | { status: 'error'; message: string }

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [savedSnapshot, setSavedSnapshot] = useState<string>(JSON.stringify(defaultSettings))
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const isDirty = JSON.stringify(settings) !== savedSnapshot

  // Validation
  const hostValid = settings.host.trim().length > 0
  const sshUserValid = settings.ssh_user.trim().length > 0
  const sshPortValid = settings.ssh_port >= 1 && settings.ssh_port <= 65535
  const ollamaPortValid = settings.ollama_port >= 1 && settings.ollama_port <= 65535
  const gatewayPortValid = settings.gateway_port >= 1 && settings.gateway_port <= 65535
  const formValid = hostValid && sshUserValid && sshPortValid && ollamaPortValid && gatewayPortValid

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
      if (!isTauri) return
      try {
        const loaded = await tauriInvoke<AppSettings>('get_settings')
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
      [field]: field === 'ssh_port' || field === 'ollama_port' || field === 'gateway_port'
        ? parseInt(value) || 0
        : value,
    }))
  }, [])

  const handleTestConnection = async () => {
    setTestState({ status: 'testing' })
    const start = Date.now()
    try {
      if (isTauri) {
        await tauriInvoke<string>('test_connection')
      } else {
        // Simulate in browser
        await new Promise(r => setTimeout(r, 800))
      }
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
      if (isTauri) {
        await tauriInvoke('save_settings', { settings })
      } else {
        await new Promise(r => setTimeout(r, 500))
      }
      setSavedSnapshot(JSON.stringify(settings))
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  const handleBrowseKey = async () => {
    if (!isTauri) return
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        filters: [{ name: 'SSH Keys', extensions: ['pem', 'pub', 'key', ''] }],
      })
      if (selected && typeof selected === 'string') {
        updateField('ssh_key_path', selected)
      }
    } catch (e) {
      console.error('File picker error:', e)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 h-full overflow-y-auto animate-fade-in">
      {/* Page title */}
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2.5">
          <Settings size={18} style={{ color: 'var(--color-text-dim)' }} />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Settings
          </h1>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          Configure your server connection and services.
        </p>
      </div>

      {/* Browser-mode info banner */}
      {!isTauri && (
        <div
          className="card-flat rounded-lg p-3 mb-6 flex items-center gap-3 animate-fade-in"
          style={{
            borderColor: 'var(--color-accent)',
            borderWidth: 1,
            borderStyle: 'solid',
          }}
        >
          <Info size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Running in browser preview mode. Settings are read-only.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Section 1: Server Connection */}
        <div className="card animate-fade-in delay-1">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <Server size={14} style={{ color: 'var(--color-text-dim)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Server Connection
              </span>
            </div>
            {/* Test Connection button */}
            <TestConnectionButton
              state={testState}
              onClick={handleTestConnection}
              disabled={!isTauri || testState.status === 'testing'}
            />
          </div>
          <div className="p-4 space-y-5">
            {/* Host IP */}
            <FieldGroup
              label="Host address"
              description="The IP address of your Ubuntu server."
            >
              <input
                className={`input input-mono ${!hostValid ? 'border-red-500' : ''}`}
                type="text"
                value={settings.host}
                onChange={e => updateField('host', e.target.value)}
                placeholder="e.g. 192.168.1.100"
                disabled={!isTauri}
              />
            </FieldGroup>

            {/* SSH Username + Port on one row */}
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup
                label="SSH username"
                description="Your user account on the server."
              >
                <input
                  className="input input-mono"
                  type="text"
                  value={settings.ssh_user}
                  onChange={e => updateField('ssh_user', e.target.value)}
                  placeholder="e.g. user"
                  disabled={!isTauri}
                />
              </FieldGroup>
              <FieldGroup
                label="SSH port"
                description="Usually 22 unless configured otherwise."
              >
                <input
                  className="input input-mono"
                  type="number"
                  value={settings.ssh_port}
                  onChange={e => updateField('ssh_port', e.target.value)}
                  placeholder="22"
                  min={1}
                  max={65535}
                  disabled={!isTauri}
                />
              </FieldGroup>
            </div>

            {/* SSH Key */}
            <FieldGroup
              label="SSH key"
              description={isTauri ? 'Path to your private SSH key file.' : 'File picker requires the desktop app.'}
            >
              <div className="flex gap-2">
                <input
                  className="input input-mono flex-1"
                  type="text"
                  value={settings.ssh_key_path}
                  readOnly
                  placeholder={isTauri ? 'Select a key file...' : 'Requires desktop app'}
                  disabled={!isTauri}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleBrowseKey}
                  disabled={!isTauri}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <FolderOpen size={14} />
                  Browse
                </button>
              </div>
            </FieldGroup>
          </div>
        </div>

        {/* Section 2: Services */}
        <div className="card animate-fade-in delay-2">
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <Globe size={14} style={{ color: 'var(--color-text-dim)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Services
            </span>
          </div>
          <div className="p-4 space-y-5">
            <FieldGroup
              label="Ollama port"
              description="Port for the Ollama inference server."
            >
              <input
                className="input input-mono"
                type="number"
                value={settings.ollama_port}
                onChange={e => updateField('ollama_port', e.target.value)}
                placeholder="11434"
                min={1}
                max={65535}
                disabled={!isTauri}
              />
              <EndpointPreview host={settings.host} port={settings.ollama_port} />
            </FieldGroup>

            <FieldGroup
              label="Gateway port"
              description="Port for the Auctorum gateway service."
            >
              <input
                className="input input-mono"
                type="number"
                value={settings.gateway_port}
                onChange={e => updateField('gateway_port', e.target.value)}
                placeholder="18789"
                min={1}
                max={65535}
                disabled={!isTauri}
              />
              <EndpointPreview host={settings.host} port={settings.gateway_port} />
            </FieldGroup>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 animate-fade-in delay-3">
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
              Settings saved successfully.
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="animate-fade-in" style={{ color: 'var(--color-red)', fontSize: 13 }}>
              Failed to save settings.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function FieldGroup({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 500, display: 'block' }}>
        {label}
      </label>
      {children}
      <p style={{ color: 'var(--color-text-dim)', fontSize: 12, marginTop: 4 }}>
        {description}
      </p>
    </div>
  )
}

function EndpointPreview({ host, port }: { host: string; port: number }) {
  return (
    <div className="mono" style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>
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
  let badgeClass = 'badge-dim'

  switch (state.status) {
    case 'idle':
      icon = <Wifi size={13} />
      label = 'Test connection'
      badgeClass = 'badge-dim'
      break
    case 'testing':
      icon = <Loader2 size={13} className="animate-spin" />
      label = 'Testing...'
      badgeClass = 'badge-yellow'
      break
    case 'success':
      icon = <CheckCircle size={13} />
      label = `Connected (${state.latency}ms)`
      badgeClass = 'badge-green'
      break
    case 'error':
      icon = <XCircle size={13} />
      label = state.message || 'Failed'
      badgeClass = 'badge-red'
      break
  }

  return (
    <button
      className={`btn btn-sm btn-secondary`}
      onClick={onClick}
      disabled={disabled}
      style={{ gap: 6 }}
    >
      {icon}
      {label}
    </button>
  )
}
