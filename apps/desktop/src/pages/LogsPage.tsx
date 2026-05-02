import { useState, useEffect, useRef, useCallback } from 'react'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatBytes } from '@/lib/utils'
import { ScrollText, RefreshCw, Trash2, ArrowDownToLine } from 'lucide-react'

interface LogFile {
  name: string
  path: string
  size: number
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
        const files = isTauri
          ? await tauriInvoke<LogFile[]>('list_log_files') || []
          : [
              { name: 'gateway.log', path: '/tmp/openclaw/gateway.log', size: 32768 },
              { name: 'routines.log', path: '/home/user/.openclaw/logs/routines.log', size: 8192 },
              { name: 'agent.log', path: '/tmp/openclaw/agent.log', size: 16384 },
            ]
        setLogFiles(files)
        if (files.length > 0 && !selectedLog) {
          setSelectedLog(files[0].path)
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
      const l = isTauri
        ? await tauriInvoke<string[]>('read_log_tail', { path: selectedLog, lines: 500 }) || []
        : [
            '[2026-03-02 08:00:01] INFO  gateway started on port 18789',
            '[2026-03-02 08:00:02] INFO  WebSocket server ready',
            '[2026-03-02 08:01:15] INFO  session agent:main:main connected',
            '[2026-03-02 08:05:30] WARN  VRAM usage above 75% threshold',
            '[2026-03-02 08:10:00] INFO  cron job morning_routine triggered',
            '[2026-03-02 08:10:05] INFO  executing morning_routine.sh',
            '[2026-03-02 08:10:12] INFO  WhatsApp message received from +5218445387404',
            '[2026-03-02 08:10:15] INFO  agent processing message...',
            '[2026-03-02 08:10:22] INFO  tool_call: web_search("weather monterrey")',
            '[2026-03-02 08:10:30] INFO  response sent via WhatsApp',
            '[2026-03-02 08:15:00] ERROR connection to Ollama timed out after 30s',
            '[2026-03-02 08:15:02] WARN  retrying Ollama connection...',
            '[2026-03-02 08:15:04] INFO  Ollama reconnected successfully',
            '[2026-03-02 08:20:00] INFO  memory.db checkpoint completed',
            '[2026-03-02 08:25:00] INFO  heartbeat: all systems nominal',
          ]
      setLines(l)
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
      {/* ── Toolbar ── */}
      <div
        className="card-flat flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--color-border)',
          borderRadius: 0,
        }}
      >
        {/* File selector */}
        <select
          value={selectedLog || ''}
          onChange={e => setSelectedLog(e.target.value)}
          className="input"
          style={{
            width: '240px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '6px 10px',
          }}
        >
          {logFiles.map(f => (
            <option key={f.path} value={f.path}>
              {f.name} ({formatBytes(f.size)})
            </option>
          ))}
        </select>

        {/* Severity filter pills */}
        <div className="tab-group">
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

        {/* Error/Warn count badges */}
        {errorCount > 0 && (
          <span className="badge badge-red">{errorCount} errors</span>
        )}
        {warnCount > 0 && (
          <span className="badge badge-yellow">{warnCount} warnings</span>
        )}

        <div className="flex-1" />

        {/* Right side controls */}
        <button onClick={handleClear} className="btn btn-ghost btn-sm">
          <Trash2 size={13} />
          Clear
        </button>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`toggle ${autoScroll ? 'active' : ''}`}
          aria-label="Toggle auto-scroll"
        />
        <span className="text-xs" style={{ color: autoScroll ? 'var(--color-text-secondary)' : 'var(--color-text-dim)' }}>
          <ArrowDownToLine size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />
        </span>

        <button onClick={fetchLines} className="btn btn-ghost btn-sm">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── Log output ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-1"
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
                  className="flex items-start px-1 py-[2px] transition-colors"
                  style={{
                    borderLeft: `3px solid ${sev === 'all' ? 'transparent' : sevColor}`,
                    marginLeft: '2px',
                    borderRadius: '2px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Line number */}
                  <span
                    className="mono flex-shrink-0 text-right select-none"
                    style={{
                      color: 'var(--color-text-dim)',
                      fontSize: '11px',
                      width: '40px',
                      marginRight: '12px',
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
                      fontSize: '12px',
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

      {/* ── Status bar ── */}
      <div
        className="card-flat flex items-center justify-between px-4 py-2 flex-shrink-0 text-xs"
        style={{
          borderTop: '1px solid var(--color-border)',
          borderRadius: 0,
          color: 'var(--color-text-dim)',
        }}
      >
        <span>
          {filteredLines.length} / {lines.length} lines
          {filter !== 'all' && ` (filtered: ${filter})`}
        </span>
        <div className="flex items-center gap-4">
          {autoScroll && (
            <span className="flex items-center gap-1.5" style={{ color: 'var(--color-green)' }}>
              <span
                className="status-dot-sm status-online"
              />
              Live
            </span>
          )}
          <span>Poll: 3s</span>
        </div>
      </div>
    </div>
  )
}
