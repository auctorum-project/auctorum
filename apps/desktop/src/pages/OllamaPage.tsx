import { useState, useEffect } from 'react'
import { tauriInvoke, isTauri } from '@/lib/tauri'
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

const TOTAL_GPU_VRAM = 8192 * 1024 * 1024 // 8 GB in bytes for mock bar display

export function OllamaPage() {
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [unloading, setUnloading] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const s = isTauri
        ? await tauriInvoke<OllamaStatus>('get_ollama_status')
        : {
            online: true,
            endpoint: 'localhost:11434',
            models: [
              { name: 'llama3.2:latest', size: 2_000_000_000, digest: 'abc123def456789abc', modified_at: '2026-02-28T00:00:00Z' },
              { name: 'mistral:7b', size: 4_000_000_000, digest: 'def789abc012345def', modified_at: '2026-02-25T00:00:00Z' },
              { name: 'codellama:13b', size: 7_300_000_000, digest: 'f1a2b3c4d5e6a7b8c9', modified_at: '2026-02-20T00:00:00Z' },
            ],
            running: [
              { name: 'llama3.2:latest', size: 2_000_000_000, size_vram: 1_800_000_000, expires_at: '2026-03-02T12:00:00Z' },
            ],
          } as OllamaStatus
      setStatus(s)
    } catch (e) {
      console.error(e)
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
      if (isTauri) {
        await tauriInvoke('ollama_force_unload', { modelName: name })
      }
      setTimeout(fetchStatus, 1000)
    } catch (e) {
      console.error(e)
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
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto animate-fade-in">
      {/* Status header card */}
      <Panel
        title="Ollama"
        icon={<Box size={14} />}
        collapsible
        headerRight={
          <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-6" style={{ fontSize: 13 }}>
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
              <span style={{ color: 'var(--color-text-dim)' }}>Vram in use</span>
              <span className="mono" style={{ color: 'var(--color-text-primary)' }}>
                {formatBytes(totalVram)}
              </span>
            </div>
            <div style={{ marginLeft: 'auto' }} className="flex items-center gap-2">
              <span style={{ color: 'var(--color-text-dim)' }}>Endpoint</span>
              <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>
                {status.endpoint}
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
                  className="card-flat rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1 space-y-2.5">
                    <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                      <span className="status-dot-sm status-online flex-shrink-0" />
                      <span
                        className="mono"
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={model.name}
                      >
                        {model.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4" style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
                      <span>Size: <span className="mono">{formatBytes(model.size)}</span></span>
                      <span>Vram: <span className="mono">{formatBytes(model.size_vram)}</span></span>
                      <span>Expires: <span className="mono">{model.expires_at ? new Date(model.expires_at).toLocaleString() : 'N/A'}</span></span>
                    </div>
                    <div style={{ maxWidth: 300 }}>
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
                  </div>
                  <button
                    onClick={() => handleUnload(model.name)}
                    disabled={unloading === model.name}
                    className="btn btn-danger btn-sm"
                  >
                    {unloading === model.name ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    {unloading === model.name ? 'Unloading...' : 'Unload'}
                  </button>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Model Inventory table */}
      <Panel title="Model inventory" icon={<Box size={14} />} collapsible className="delay-2">
        {status?.models && status.models.length > 0 ? (
          <div style={{ margin: '-16px' }}>
            {/* Table header */}
            <div className="grid grid-cols-4 gap-4 table-header">
              <span>Name</span>
              <span>Size</span>
              <span>Digest</span>
              <span>Modified</span>
            </div>
            {/* Table rows */}
            {status.models.map((model) => {
              const isActive = runningNames.has(model.name)
              return (
                <div
                  key={model.digest}
                  className="grid grid-cols-4 gap-4 table-row items-center"
                  style={{ fontSize: 13 }}
                >
                  <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    {isActive && (
                      <Circle size={7} fill="var(--color-green)" stroke="none" className="flex-shrink-0" />
                    )}
                    <span
                      className="mono"
                      style={{
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={model.name}
                    >
                      {model.name}
                    </span>
                    {isActive && (
                      <span className="badge badge-green flex-shrink-0" style={{ fontSize: 10 }}>active</span>
                    )}
                  </span>
                  <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatBytes(model.size)}
                  </span>
                  <span className="mono" style={{ color: 'var(--color-text-dim)' }}>
                    {model.digest.slice(0, 12)}
                  </span>
                  <span style={{ color: 'var(--color-text-dim)' }}>
                    {model.modified_at.split('T')[0]}
                  </span>
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

function barColorForVram(pct: number): string {
  if (pct > 90) return 'var(--color-red)'
  if (pct > 70) return 'var(--color-orange)'
  return 'var(--color-green)'
}
