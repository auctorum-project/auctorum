import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface PanelProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  headerRight?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
}

export function Panel({
  title,
  icon,
  children,
  className = '',
  headerRight,
  collapsible = false,
  defaultCollapsed = false,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className={`card animate-fade-in overflow-hidden ${className}`}>
      <div
        className={`flex items-center justify-between px-4 py-3${collapsible ? ' panel-header-toggle' : ''}`}
        style={{ borderBottom: collapsed ? 'none' : '1px solid var(--color-border)' }}
        onClick={collapsible ? () => setCollapsed(c => !c) : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <ChevronDown
              size={14}
              className={`panel-chevron${collapsed ? ' collapsed' : ''}`}
            />
          )}
          {icon && (
            <span style={{ color: 'var(--color-text-dim)' }}>{icon}</span>
          )}
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
          >
            {title}
          </span>
        </div>
        {headerRight && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ minWidth: 0, overflow: 'hidden', marginLeft: 12 }}
          >
            {headerRight}
          </div>
        )}
      </div>
      <div className={`panel-collapse-body${collapsed ? ' collapsed' : ''}`}>
        <div className="panel-collapse-inner">
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  const colorClass = active ? 'badge-green' : 'badge-red'
  return (
    <span className={`badge ${colorClass}`}>
      <span
        className={`status-dot-sm ${active ? 'status-online' : 'status-offline'}`}
      />
      {label && <span>{label}</span>}
    </span>
  )
}

export function MetricBar({
  value,
  max,
  label,
}: {
  value: number
  max: number
  label: string
  color?: string
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0

  const barColor =
    pct > 90
      ? 'var(--color-red)'
      : pct > 70
        ? 'var(--color-yellow)'
        : 'var(--color-green)'

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </span>
        <span
          className="text-xs tabular-nums mono"
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="metric-bar">
        <div
          className="metric-bar-fill"
          style={{
            width: `${pct}%`,
            background: barColor,
          }}
        />
      </div>
    </div>
  )
}
