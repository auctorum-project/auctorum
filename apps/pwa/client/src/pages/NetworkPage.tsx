import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { Panel } from '@/components/Panel'
import {
  Globe, Wifi, Server, ArrowUpDown, ArrowDown, ArrowUp, WifiOff, Loader2
} from 'lucide-react'

interface TailscaleSelf {
  id: string
  hostName: string
  dnsName: string
  tailscaleIPs: string[]
  os: string
  online: boolean
  lastSeen: string
  exitNode: boolean
  exitNodeOption: boolean
}

interface TailscalePeer {
  id: string
  hostName: string
  dnsName: string
  tailscaleIPs: string[]
  os: string
  online: boolean
  lastSeen: string
  exitNode: boolean
  exitNodeOption: boolean
  rxBytes: number
  txBytes: number
}

interface TailscaleStatus {
  self: TailscaleSelf
  peers: TailscalePeer[]
  tailnetName: string
  backendState: string
  version: string
  error?: string
}

interface NetworkSession {
  state: string
  recv: string
  send: string
  local: string
  peer: string
  process: string
}

function osLabel(os: string): string {
  const lower = os.toLowerCase()
  if (lower.includes('linux')) return 'Linux'
  if (lower.includes('windows') || lower.includes('win')) return 'Win'
  if (lower.includes('mac') || lower.includes('darwin')) return 'macOS'
  if (lower.includes('android')) return 'Android'
  if (lower.includes('ios')) return 'iOS'
  return os
}

export function NetworkPage() {
  const [tsStatus, setTsStatus] = useState<TailscaleStatus | null>(null)
  const [sessions, setSessions] = useState<NetworkSession[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [ts, sess] = await Promise.all([
        api<TailscaleStatus>('/network/tailscale'),
        api<NetworkSession[]>('/network/sessions'),
      ])
      setTsStatus(ts)
      setSessions(sess || [])
    } catch (e) {
      console.error('Network fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-text-dim)', margin: '0 auto' }} />
          <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
            Loading network status...
          </p>
        </div>
      </div>
    )
  }

  const isOnline = tsStatus?.backendState === 'Running'
  const selfNode = tsStatus?.self ?? null
  const peers = tsStatus?.peers ?? []
  const sortedPeers = [...peers].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1
    return a.hostName.localeCompare(b.hostName)
  })

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto animate-fade-in">
      {/* Mesh Network */}
      <Panel
        title="Mesh Network"
        icon={<Globe size={14} />}
        collapsible
        className="delay-1"
        headerRight={
          <div className="flex items-center gap-2">
            {tsStatus?.tailnetName && (
              <span className="badge badge-dim" style={{ fontSize: 10 }}>{tsStatus.tailnetName}</span>
            )}
            <span className={`badge ${isOnline ? 'badge-green' : 'badge-red'}`}>
              <span className={`status-dot-sm ${isOnline ? 'status-online' : 'status-offline'}`} />
              {isOnline ? 'Connected' : 'Offline'}
            </span>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Error state */}
          {tsStatus?.error && (
            <div className="empty-state" style={{ padding: 16 }}>
              <div className="empty-state-icon">
                <WifiOff size={20} />
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                Could not connect to Tailscale
              </p>
              <p className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
                {tsStatus.error}
              </p>
            </div>
          )}

          {/* Self Node */}
          {selfNode && (
            <div className="card-flat rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Server size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="font-semibold" style={{ color: 'var(--color-text-primary)', fontSize: 14 }}>
                  {selfNode.hostName}
                </span>
                <span className="status-dot-sm status-online" />
              </div>
              <p className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
                {selfNode.dnsName}
              </p>
              <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 11 }}>
                <span className="mono" style={{ color: 'var(--color-accent)' }}>
                  {selfNode.tailscaleIPs?.[0] || 'N/A'}
                </span>
                <span style={{ color: 'var(--color-text-dim)' }}>
                  {osLabel(selfNode.os)}
                </span>
              </div>
            </div>
          )}

          {/* Peers as cards (mobile-friendly) */}
          {sortedPeers.length > 0 && (
            <div className="space-y-2">
              {sortedPeers.map(peer => (
                <div
                  key={peer.id}
                  className="card-flat rounded-lg p-3"
                  style={{ opacity: peer.online ? 1 : 0.5 }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`status-dot-sm ${peer.online ? 'status-online' : 'status-offline'} flex-shrink-0`} />
                      <span className="truncate" style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>
                        {peer.hostName}
                      </span>
                    </div>
                    <span className="badge badge-dim flex-shrink-0" style={{ fontSize: 10 }}>
                      {osLabel(peer.os)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
                    <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>
                      {peer.tailscaleIPs?.[0] || 'N/A'}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <ArrowDown size={10} style={{ color: 'var(--color-green)' }} />
                        <span className="mono" style={{ color: 'var(--color-text-dim)' }}>
                          {formatBytes(peer.rxBytes)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowUp size={10} style={{ color: 'var(--color-cyan)' }} />
                        <span className="mono" style={{ color: 'var(--color-text-dim)' }}>
                          {formatBytes(peer.txBytes)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!selfNode && sortedPeers.length === 0 && !tsStatus?.error && (
            <div className="empty-state" style={{ padding: 16 }}>
              <div className="empty-state-icon">
                <Globe size={20} />
              </div>
              <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>No nodes found</p>
            </div>
          )}
        </div>
      </Panel>

      {/* Gateway Sessions */}
      <Panel
        title="Active Sessions"
        icon={<Wifi size={14} />}
        collapsible
        className="delay-2"
        headerRight={
          <span className="badge badge-dim">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </span>
        }
      >
        {sessions.length === 0 ? (
          <div className="empty-state" style={{ padding: 16 }}>
            <div className="empty-state-icon">
              <ArrowUpDown size={20} />
            </div>
            <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
              No active sessions
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((sess, i) => (
              <div key={i} className="card-flat rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="badge badge-green" style={{ fontSize: 10 }}>
                    <span className="status-dot-sm status-online" />
                    {sess.state}
                  </span>
                  {sess.process && (
                    <span className="mono text-xs" style={{ color: 'var(--color-text-dim)' }}>
                      {sess.process}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
                  <div className="min-w-0 flex-1">
                    <span className="mono block truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {sess.local}
                    </span>
                  </div>
                  <span style={{ color: 'var(--color-text-dim)', padding: '0 8px' }}>to</span>
                  <div className="min-w-0 flex-1 text-right">
                    <span className="mono block truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {sess.peer}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4" style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>
                  <span>Recv: <span className="mono">{sess.recv}</span></span>
                  <span>Send: <span className="mono">{sess.send}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
