import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { ScrollText, RefreshCw, Trash2, ArrowDownToLine } from 'lucide-react'

interface LogFile {
  permissions: string
  size: number
  date: string
  name: string
}

type Severity = 'all' | 'error' | 'warn' | 'info'

export function LogsPage() {
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [selectedLog, setSelectedLog] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [filter, setFilter] = useState<Severity>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const files = await api<LogFile[]>('/logs/files') || []
        setLogFiles(files)
        if (files.length > 0 && !selectedLog) {
          setSelectedLog(files[0].name)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchFiles()
  }, [])

  const fetchLines = useCallback(async () => {
    if (!selectedLog) return
    try {
      const result = await api<{ file: string; lines: string[] }>(
        `/logs/tail?file=${encodeURIComponent(selectedLog)}&lines=500`
      )
      setLines(result.lines || [])
    } catch (e) {
      console.error(e)
    }
  }, [selectedLog])

  useEffect(() => {
    fetchLines()
    const interval = setInterval(fetchLines, 3000)
    return () => clearInterval(interval)
  }, [fetchLines])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  const getSeverity = (line: string): Severity => {
    const upper = line.toUpperCase()
    if (upper.includes('ERROR') || upper.includes('FATAL')) return 'error'
    if (upper.includes('WARN') || upper.includes('WARNING')) return 'warn'
    if (upper.includes('INFO')) return 'info'
    return 'all'
  }

  const getSeverityColor = (sev: Severity): string => {
    switch (sev) {
      case 'error': return 'var(--color-red)'
      case 'warn': return 'var(--color-yellow)'
      case 'info': return 'var(--color-accent)'
      default: return 'var(--color-text-secondary)'
    }
  }

  const filteredLines = filter === 'all'
    ? lines
    : lines.filter(l => getSeverity(l) === filter)

  const errorCount = lines.filter(l => getSeverity(l) === 'error').length
  const warnCount = lines.filter(l => getSeverity(l) === 'warn').length

  const handleClear = () => setLines([])

  const severityFilters: { id: Severity; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'error', label: 'Error' },
    { id: 'warn', label: 'Warn' },
    { id: 'info', label: 'Info' },
  ]

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar - stacked for mobile */}
      <div
        className="flex-shrink-0 space-y-2 px-3 py-2"
        style={{
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Row 1: File selector + controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedLog || ''}
            onChange={e => setSelectedLog(e.target.value)}
            className="input flex-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              padding: '6px 8px',
            }}
          >
            {logFiles.map(f => (
              <option key={f.name} value={f.name}>
                {f.name.split('/').pop()} ({formatBytes(f.size)})
              </option>
            ))}
          </select>

          <button onClick={handleClear} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
            <Trash2 size={13} />
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="btn btn-ghost btn-sm"
            style={{
              padding: 4,
              color: autoScroll ? 'var(--color-green)' : 'var(--color-text-dim)',
            }}
          >
            <ArrowDownToLine size={13} />
          </button>

          <button onClick={fetchLines} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Row 2: Severity filter pills + badges */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="tab-group flex-shrink-0">
            {severityFilters.map(sev => (
              <button
                key={sev.id}
                onClick={() => setFilter(sev.id)}
                className={`tab ${filter === sev.id ? 'active' : ''}`}
              >
                {sev.label}
              </button>
            ))}
          </div>

          {errorCount > 0 && (
            <span className="badge badge-red flex-shrink-0" style={{ fontSize: 10 }}>{errorCount} err</span>
          )}
          {warnCount > 0 && (
            <span className="badge badge-yellow flex-shrink-0" style={{ fontSize: 10 }}>{warnCount} warn</span>
          )}
        </div>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-1 py-1"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="empty-state">
              <div className="empty-state-icon">
                <ScrollText size={22} />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                {logFiles.length === 0
                  ? 'No log files found'
                  : lines.length === 0
                    ? 'Log is empty'
                    : 'No matching entries'
                }
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-dim)', opacity: 0.6 }}>
                {logFiles.length === 0
                  ? 'No log files detected on the remote host.'
                  : lines.length === 0
                    ? 'Waiting for new log entries...'
                    : `No ${filter} level entries found. Try a different filter.`
                }
              </p>
            </div>
          </div>
        ) : (
          <div>
            {filteredLines.map((line, i) => {
              const sev = getSeverity(line)
              const sevColor = getSeverityColor(sev)
              return (
                <div
                  key={i}
                  className="flex items-start px-1 py-[2px]"
                  style={{
                    borderLeft: `3px solid ${sev === 'all' ? 'transparent' : sevColor}`,
                    marginLeft: '2px',
                    borderRadius: '2px',
                  }}
                >
                  {/* Line number */}
                  <span
                    className="mono flex-shrink-0 text-right select-none"
                    style={{
                      color: 'var(--color-text-dim)',
                      fontSize: '10px',
                      width: '32px',
                      marginRight: '8px',
                      marginTop: '1px',
                      opacity: 0.5,
                    }}
                  >
                    {i + 1}
                  </span>
                  {/* Log text */}
                  <span
                    className="mono break-all"
                    style={{
                      color: sevColor,
                      fontSize: '11px',
                      lineHeight: '1.6',
                    }}
                  >
                    {line}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0 text-xs"
        style={{
          background: 'var(--color-bg-secondary)',
          borderTop: '1px solid var(--color-border)',
          color: 'var(--color-text-dim)',
        }}
      >
        <span>
          {filteredLines.length} / {lines.length} lines
          {filter !== 'all' && ` (${filter})`}
        </span>
        <div className="flex items-center gap-3">
          {autoScroll && (
            <span className="flex items-center gap-1" style={{ color: 'var(--color-green)' }}>
              <span className="status-dot-sm status-online" />
              Live
            </span>
          )}
          <span>3s</span>
        </div>
      </div>
    </div>
  )
}
