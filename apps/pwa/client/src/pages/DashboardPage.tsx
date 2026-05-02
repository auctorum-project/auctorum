import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { formatBytes, formatUptime } from '@/lib/utils'
import { Panel } from '@/components/Panel'
import {
  Server, Clock, Cpu, Zap, Thermometer, MemoryStick, Activity
} from 'lucide-react'

interface SystemMetrics {
  cpu: { name: string; usage: number; frequency: number; cores: number[] }
  memory: { total_ram: number; used_ram: number; free_ram: number; total_swap: number; used_swap: number }
  gpu: { name: string; vram_total: number; vram_used: number; vram_free: number; temperature: number; utilization: number; power_draw: number; available: boolean }
  cpu_temp: number
  uptime: number
  hostname: string
}

function barColor(pct: number): string {
  if (pct > 90) return 'var(--color-red)'
  if (pct > 70) return 'var(--color-orange)'
  return 'var(--color-green)'
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const m = await api<SystemMetrics>('/system/metrics')
        setMetrics(m)
        setHistory(prev => [...prev.slice(-59), m.cpu.usage])
      } catch (e) {
        console.error('Failed to fetch metrics:', e)
      }
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Cpu size={32} style={{ color: 'var(--color-text-dim)', margin: '0 auto' }} />
          <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
            Loading telemetry...
          </p>
        </div>
      </div>
    )
  }

  const ramPct = (metrics.memory.used_ram / metrics.memory.total_ram) * 100
  const swapPct = metrics.memory.total_swap > 0
    ? (metrics.memory.used_swap / metrics.memory.total_swap) * 100
    : 0
  const vramPct = metrics.gpu.available
    ? (metrics.gpu.vram_used / metrics.gpu.vram_total) * 100
    : 0

  const sparklinePath = (() => {
    if (history.length < 2) return ''
    const w = 600
    const h = 60
    const step = w / 59
    const points = history.map((v, i) => {
      const x = i * step
      const y = h - (v / 100) * h
      return `${x},${y}`
    })
    return `M${points.join(' L')}`
  })()

  const sparklineFill = (() => {
    if (history.length < 2) return ''
    const w = 600
    const h = 60
    const step = w / 59
    const points = history.map((v, i) => {
      const x = i * step
      const y = h - (v / 100) * h
      return `${x},${y}`
    })
    const lastX = (history.length - 1) * step
    return `M${points.join(' L')} L${lastX},${h} L0,${h} Z`
  })()

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto animate-fade-in">
      {/* Top row: 2x2 stat cards on mobile */}
      <div className="grid grid-cols-2 gap-3 grid-stats">
        <StatCard
          icon={<Server size={16} />}
          label="Hostname"
          value={metrics.hostname}
          className="delay-1"
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Uptime"
          value={formatUptime(metrics.uptime)}
          className="delay-2"
        />
        <StatCard
          icon={<Cpu size={16} />}
          label="CPU usage"
          value={`${metrics.cpu.usage.toFixed(1)}%`}
          valueColor={metrics.cpu.usage > 80 ? 'var(--color-red)' : undefined}
          className="delay-3"
        />
        <StatCard
          icon={<Zap size={16} />}
          label="GPU usage"
          value={metrics.gpu.available ? `${metrics.gpu.utilization}%` : 'N/A'}
          valueColor={metrics.gpu.available ? undefined : 'var(--color-text-dim)'}
          className="delay-4"
        />
      </div>

      {/* CPU Cores panel */}
      <Panel
        title="CPU cores"
        icon={<Cpu size={14} />}
        collapsible
        className="delay-3"
        headerRight={
          <span
            className="mono"
            style={{
              color: 'var(--color-text-dim)',
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              maxWidth: 160,
            }}
            title={metrics.cpu.name}
          >
            {metrics.cpu.name}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {metrics.cpu.cores.map((usage, i) => {
            const pct = Math.min(usage, 100)
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
                    Core {i}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="metric-bar">
                  <div
                    className="metric-bar-fill"
                    style={{ width: `${pct}%`, background: barColor(pct) }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Memory panel */}
      <Panel title="Memory" icon={<MemoryStick size={14} />} collapsible className="delay-4">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Ram</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {formatBytes(metrics.memory.used_ram)} / {formatBytes(metrics.memory.total_ram)}
              </span>
            </div>
            <div className="metric-bar metric-bar-lg">
              <div
                className="metric-bar-fill"
                style={{ width: `${ramPct}%`, background: barColor(ramPct) }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Swap</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {formatBytes(metrics.memory.used_swap)} / {formatBytes(metrics.memory.total_swap)}
              </span>
            </div>
            <div className="metric-bar metric-bar-lg">
              <div
                className="metric-bar-fill"
                style={{ width: `${swapPct}%`, background: barColor(swapPct) }}
              />
            </div>
          </div>
          <div
            className="flex items-center justify-between pt-2"
            style={{ borderTop: '1px solid var(--color-border-dim)' }}
          >
            <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
              Free: {formatBytes(metrics.memory.free_ram)}
            </span>
            <span className="badge badge-dim" style={{ fontSize: 11 }}>
              {ramPct > 85 ? 'High pressure' : ramPct > 60 ? 'Moderate' : 'Normal'}
            </span>
          </div>
        </div>
      </Panel>

      {/* GPU panel */}
      <Panel
        title="GPU"
        icon={<Zap size={14} />}
        collapsible
        className="delay-5"
        headerRight={
          metrics.gpu.available ? (
            <span className="badge badge-green">
              <span className="status-dot-sm status-online" />
              Available
            </span>
          ) : (
            <span className="badge badge-dim">Unavailable</span>
          )
        }
      >
        {metrics.gpu.available ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span
                className="mono"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
                title={metrics.gpu.name}
              >
                {metrics.gpu.name}
              </span>
            </div>
            {/* VRAM bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Vram</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {metrics.gpu.vram_used} MB / {metrics.gpu.vram_total} MB
                </span>
              </div>
              <div className="metric-bar metric-bar-lg">
                <div
                  className="metric-bar-fill"
                  style={{ width: `${vramPct}%`, background: barColor(vramPct) }}
                />
              </div>
            </div>
            {/* Temp + Power in a row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="flex items-center gap-1.5">
                  <Thermometer size={14} style={{ color: 'var(--color-text-dim)' }} />
                  <span
                    className="mono"
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      color: metrics.gpu.temperature > 70 ? 'var(--color-red)' : 'var(--color-text-primary)',
                    }}
                  >
                    {Math.round(metrics.gpu.temperature)}C
                  </span>
                </div>
                <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>Temperature</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1">
                <span
                  className="mono"
                  style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)' }}
                >
                  {metrics.gpu.power_draw.toFixed(1)}W
                </span>
                <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>Power draw</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '24px' }}>
            <span style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
              No GPU detected. nvidia-smi is not available on this host.
            </span>
          </div>
        )}
      </Panel>

      {/* CPU History sparkline */}
      <Panel
        title="CPU history"
        icon={<Activity size={14} />}
        collapsible
        className="delay-6"
        headerRight={
          <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
            Last 2 minutes
          </span>
        }
      >
        <svg
          ref={svgRef}
          viewBox="0 0 600 60"
          className="w-full"
          style={{ height: 60 }}
          preserveAspectRatio="none"
        >
          {sparklineFill && (
            <path
              d={sparklineFill}
              fill="var(--color-accent)"
              opacity={0.08}
            />
          )}
          {sparklinePath && (
            <path
              d={sparklinePath}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      </Panel>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  valueColor,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueColor?: string
  className?: string
}) {
  return (
    <div className={`card animate-fade-in p-3 flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--color-text-dim)' }}>{icon}</span>
        <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
          {label}
        </span>
      </div>
      <span
        className="mono"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: valueColor || 'var(--color-text-primary)',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
