import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { Panel } from '@/components/Panel'
import {
  Box, RefreshCw, Loader2, Trash2, HardDrive, Circle
} from 'lucide-react'

interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
}

interface OllamaRunningModel {
  name: string
  size: number
  size_vram: number
  expires_at: string
}

interface OllamaStatus {
  online: boolean
  models: OllamaModel[]
  running: OllamaRunningModel[]
  endpoint: string
}

const TOTAL_GPU_VRAM = 8192 * 1024 * 1024

function barColorForVram(pct: number): string {
  if (pct > 90) return 'var(--color-red)'
  if (pct > 70) return 'var(--color-orange)'
  return 'var(--color-green)'
}

export function OllamaPage() {
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [unloading, setUnloading] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const s = await api<OllamaStatus>('/ollama/status')
      setStatus(s)
    } catch (e) {
      console.error('Ollama fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleUnload = async (name: string) => {
    setUnloading(name)
    try {
      await api('/ollama/unload', {
        method: 'POST',
        body: JSON.stringify({ model: name }),
      })
      setTimeout(fetchStatus, 1000)
    } catch (e) {
      console.error('Unload error:', e)
    } finally {
      setUnloading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-text-dim)', margin: '0 auto' }} />
          <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
            Connecting to Ollama...
          </p>
        </div>
      </div>
    )
  }

  const totalVram = status?.running.reduce((sum, m) => sum + m.size_vram, 0) ?? 0
  const runningNames = new Set(status?.running.map(r => r.name) ?? [])

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto animate-fade-in">
      {/* Status header card */}
      <Panel
        title="Ollama"
        icon={<Box size={14} />}
        collapsible
        headerRight={
          <div className="flex items-center gap-2">
            {status?.online ? (
              <span className="badge badge-green">
                <span className="status-dot-sm status-online" />
                Online
              </span>
            ) : (
              <span className="badge badge-red">
                <span className="status-dot-sm status-offline" />
                Offline
              </span>
            )}
            <button
              onClick={fetchStatus}
              className="btn btn-ghost btn-sm"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        }
      >
        {!status?.online ? (
          <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
            Ollama is not running. Start it with <span className="mono">ollama serve</span>.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4" style={{ fontSize: 13 }}>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--color-text-dim)' }}>Models</span>
              <span className="mono" style={{ color: 'var(--color-text-primary)' }}>
                {status.models.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--color-text-dim)' }}>Loaded</span>
              <span className="mono" style={{ color: status.running.length > 0 ? 'var(--color-green)' : 'var(--color-text-primary)' }}>
                {status.running.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--color-text-dim)' }}>Vram</span>
              <span className="mono" style={{ color: 'var(--color-text-primary)' }}>
                {formatBytes(totalVram)}
              </span>
            </div>
          </div>
        )}
      </Panel>

      {/* Active Models section */}
      {status?.running && status.running.length > 0 && (
        <Panel
          title="Active models"
          icon={<HardDrive size={14} />}
          collapsible
          className="delay-1"
          headerRight={
            <span className="badge badge-green">
              {status.running.length} loaded
            </span>
          }
        >
          <div className="space-y-3">
            {status.running.map((model) => {
              const vramPct = (model.size_vram / TOTAL_GPU_VRAM) * 100
              return (
                <div
                  key={model.name}
                  className="card-flat rounded-lg p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="status-dot-sm status-online flex-shrink-0" />
                      <span
                        className="mono truncate"
                        style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}
                        title={model.name}
                      >
                        {model.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnload(model.name)}
                      disabled={unloading === model.name}
                      className="btn btn-danger btn-sm flex-shrink-0"
                    >
                      {unloading === model.name ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      {unloading === model.name ? 'Unloading' : 'Unload'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                    <span>Size: <span className="mono">{formatBytes(model.size)}</span></span>
                    <span>Vram: <span className="mono">{formatBytes(model.size_vram)}</span></span>
                  </div>
                  <div className="metric-bar">
                    <div
                      className="metric-bar-fill"
                      style={{
                        width: `${Math.min(vramPct, 100)}%`,
                        background: barColorForVram(vramPct),
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Model Inventory */}
      <Panel title="Model inventory" icon={<Box size={14} />} collapsible className="delay-2">
        {status?.models && status.models.length > 0 ? (
          <div className="space-y-0">
            {status.models.map((model) => {
              const isActive = runningNames.has(model.name)
              return (
                <div
                  key={model.digest}
                  className="py-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--color-border-dim)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <Circle size={7} fill="var(--color-green)" stroke="none" className="flex-shrink-0" />
                      )}
                      <span
                        className="mono truncate"
                        style={{ color: 'var(--color-text-primary)', fontSize: 13 }}
                        title={model.name}
                      >
                        {model.name}
                      </span>
                      {isActive && (
                        <span className="badge badge-green flex-shrink-0" style={{ fontSize: 10 }}>active</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1" style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                      <span className="mono">{formatBytes(model.size)}</span>
                      <span className="mono">{model.digest.slice(0, 12)}</span>
                      <span>{model.modified_at.split('T')[0]}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Box size={20} />
            </div>
            <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
              No models found
            </span>
          </div>
        )}
      </Panel>
    </div>
  )
}
