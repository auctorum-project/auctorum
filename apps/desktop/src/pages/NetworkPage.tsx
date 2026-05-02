import { useState, useEffect, useCallback } from 'react'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatBytes } from '@/lib/utils'
import { Panel } from '@/components/Panel'
import {
  Globe, Wifi, Server, ArrowUpDown, ArrowDown, ArrowUp, WifiOff
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface TailscaleNode {
  hostname: string
  dns_name: string
  tailscale_ip: string
  os: string
  online: boolean
  relay: string
  rx_bytes: number
  tx_bytes: number
}

interface TailscaleStatus {
  online: boolean
  self_node: TailscaleNode | null
  peers: TailscaleNode[]
  tailnet_name: string
  raw_error: string | null
}

interface GatewaySession {
  id: string
  connected_at: string
  agent_name: string
  status: string
}

// ── Mock Data ──────────────────────────────────────────────────────

function mockTailscaleStatus(): TailscaleStatus {
  return {
    online: true,
    self_node: {
      hostname: 'auctorum-server',
      dns_name: 'auctorum-server.tail1234.ts.net',
      tailscale_ip: '100.x.x.x',
      os: 'linux',
      online: true,
      relay: 'mad',
      rx_bytes: 1_284_392_017,
      tx_bytes: 867_201_443,
    },
    peers: [
      {
        hostname: 'dev-workstation',
        dns_name: 'dev-workstation.tail1234.ts.net',
        tailscale_ip: '100.64.0.2',
        os: 'windows',
        online: true,
        relay: 'mad',
        rx_bytes: 523_881_200,
        tx_bytes: 312_448_700,
      },
      {
        hostname: 'nas-storage',
        dns_name: 'nas-storage.tail1234.ts.net',
        tailscale_ip: '100.64.0.3',
        os: 'linux',
        online: true,
        relay: 'fra',
        rx_bytes: 2_104_938_111,
        tx_bytes: 1_890_221_044,
      },
      {
        hostname: 'macbook-air',
        dns_name: 'macbook-air.tail1234.ts.net',
        tailscale_ip: '100.64.0.4',
        os: 'macOS',
        online: false,
        relay: 'lhr',
        rx_bytes: 78_442_100,
        tx_bytes: 44_210_300,
      },
      {
        hostname: 'rpi-gateway',
        dns_name: 'rpi-gateway.tail1234.ts.net',
        tailscale_ip: '100.64.0.5',
        os: 'linux',
        online: true,
        relay: 'mad',
        rx_bytes: 412_003_900,
        tx_bytes: 198_882_100,
      },
      {
        hostname: 'android-phone',
        dns_name: 'android-phone.tail1234.ts.net',
        tailscale_ip: '100.64.0.6',
        os: 'android',
        online: false,
        relay: 'cdg',
        rx_bytes: 15_320_400,
        tx_bytes: 8_110_200,
      },
    ],
    tailnet_name: 'auctorum.tail1234.ts.net',
    raw_error: null,
  }
}

function mockGatewaySessions(): GatewaySession[] {
  return [
    {
      id: 'sess-a7f3c9d1e82b',
      connected_at: new Date(Date.now() - 3_600_000).toISOString(),
      agent_name: 'openclaw-primary',
      status: 'active',
    },
    {
      id: 'sess-e2b84f10c3a7',
      connected_at: new Date(Date.now() - 900_000).toISOString(),
      agent_name: 'sandbox-agent',
      status: 'active',
    },
  ]
}

// ── Helpers ────────────────────────────────────────────────────────

function osLabel(os: string): string {
  const lower = os.toLowerCase()
  if (lower.includes('linux')) return 'Linux'
  if (lower.includes('windows') || lower.includes('win')) return 'Win'
  if (lower.includes('mac') || lower.includes('darwin')) return 'macOS'
  if (lower.includes('android')) return 'Android'
  if (lower.includes('ios')) return 'iOS'
  return os
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── Component ──────────────────────────────────────────────────────

export function NetworkPage() {
  const [tsStatus, setTsStatus] = useState<TailscaleStatus | null>(null)
  const [sessions, setSessions] = useState<GatewaySession[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      if (isTauri) {
        const [ts, gw] = await Promise.all([
          tauriInvoke<TailscaleStatus>('get_tailscale_status'),
          tauriInvoke<GatewaySession[]>('get_gateway_sessions'),
        ])
        if (ts) setTsStatus(ts)
        if (gw) setSessions(gw)
      } else {
        setTsStatus(mockTailscaleStatus())
        setSessions(mockGatewaySessions())
      }
    } catch (e) {
      console.error('Network fetch error:', e)
      setTsStatus({
        online: false,
        self_node: null,
        peers: [],
        tailnet_name: '',
        raw_error: String(e),
      })
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
          <Globe size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto' }} />
          <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
            Loading network status...
          </p>
        </div>
      </div>
    )
  }

  const selfNode = tsStatus?.self_node ?? null
  const peers = tsStatus?.peers ?? []
  const sortedPeers = [...peers].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1
    return a.hostname.localeCompare(b.hostname)
  })

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto animate-fade-in">

      {/* ── Mesh Network ── */}
      <Panel
        title="Mesh Network"
        icon={<Globe size={16} />}
        collapsible
        className="delay-1"
        headerRight={
          <div className="flex items-center gap-2">
            {tsStatus?.tailnet_name && (
              <span className="badge badge-dim">{tsStatus.tailnet_name}</span>
            )}
            <span className={`badge ${tsStatus?.online ? 'badge-green' : 'badge-red'}`}>
              <span className={`status-dot-sm ${tsStatus?.online ? 'status-online' : 'status-offline'}`} />
              {tsStatus?.online ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Error state */}
          {tsStatus?.raw_error && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <WifiOff size={24} />
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Could not connect to Tailscale
              </p>
              <p className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
                {tsStatus.raw_error}
              </p>
            </div>
          )}

          {/* Self Node */}
          {selfNode && (
            <div className="card-interactive p-5 animate-fade-in delay-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--color-bg-tertiary)' }}
                  >
                    <Server size={20} style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {selfNode.hostname}
                      </span>
                      <span className="status-dot status-online" />
                    </div>
                    <p className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 12, marginTop: 2 }}>
                      {selfNode.dns_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div>
                    <span className="mono" style={{ color: 'var(--color-accent)', fontSize: 13 }}>
                      {selfNode.tailscale_ip}
                    </span>
                    <div className="flex items-center gap-3 mt-1">
                      <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
                        {osLabel(selfNode.os)}
                      </span>
                      <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
                        Relay: {selfNode.relay.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <ArrowDown size={12} style={{ color: 'var(--color-green)' }} />
                      <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        {formatBytes(selfNode.rx_bytes)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ArrowUp size={12} style={{ color: 'var(--color-cyan)' }} />
                      <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        {formatBytes(selfNode.tx_bytes)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Peers Table */}
          {sortedPeers.length > 0 && (
            <div style={{ margin: '-16px', marginTop: 0 }}>
              <div
                className="table-header grid items-center"
                style={{ gridTemplateColumns: '28px 1.3fr 1fr 70px 70px 100px 100px' }}
              >
                <span />
                <span>HOSTNAME</span>
                <span>IP ADDRESS</span>
                <span>OS</span>
                <span>RELAY</span>
                <span className="text-right">RX</span>
                <span className="text-right">TX</span>
              </div>

              {sortedPeers.map((peer, i) => (
                <div
                  key={peer.hostname}
                  className="table-row grid items-center animate-fade-in"
                  style={{
                    gridTemplateColumns: '28px 1.3fr 1fr 70px 70px 100px 100px',
                    opacity: peer.online ? 1 : 0.5,
                    animationDelay: `${(i + 3) * 40}ms`,
                  }}
                >
                  <div className="flex items-center justify-center">
                    <span className={`status-dot-sm ${peer.online ? 'status-online' : 'status-offline'}`} />
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>
                      {peer.hostname}
                    </span>
                  </div>
                  <span className="mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {peer.tailscale_ip}
                  </span>
                  <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
                    {osLabel(peer.os)}
                  </span>
                  <span className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
                    {peer.relay.toUpperCase()}
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    <ArrowDown size={10} style={{ color: 'var(--color-green)' }} />
                    <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                      {formatBytes(peer.rx_bytes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <ArrowUp size={10} style={{ color: 'var(--color-cyan)' }} />
                    <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                      {formatBytes(peer.tx_bytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* ── Gateway Sessions ── */}
      <Panel
        title="Gateway Sessions"
        icon={<Wifi size={16} />}
        collapsible
        className="delay-4"
        headerRight={
          <span className="badge badge-dim">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </span>
        }
      >
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ArrowUpDown size={22} />
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
              No active sessions
            </p>
            <p style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
              Gateway sessions will appear here when agents connect.
            </p>
          </div>
        ) : (
          <div style={{ margin: '-16px' }}>
            <div
              className="table-header grid items-center"
              style={{ gridTemplateColumns: '1.2fr 1fr 0.8fr 90px' }}
            >
              <span>SESSION ID</span>
              <span>AGENT NAME</span>
              <span>CONNECTED</span>
              <span className="text-right">STATUS</span>
            </div>

            {sessions.map((sess, i) => (
              <div
                key={sess.id}
                className="table-row grid items-center animate-fade-in"
                style={{
                  gridTemplateColumns: '1.2fr 1fr 0.8fr 90px',
                  animationDelay: `${(i + 5) * 40}ms`,
                }}
              >
                <span
                  className="mono truncate"
                  style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}
                  title={sess.id}
                >
                  {sess.id}
                </span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>
                  {sess.agent_name}
                </span>
                <span className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
                  {relativeTime(sess.connected_at)}
                </span>
                <div className="flex justify-end">
                  <span className={`badge ${sess.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                    <span className={`status-dot-sm ${sess.status === 'active' ? 'status-online' : 'status-offline'}`} />
                    {sess.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
