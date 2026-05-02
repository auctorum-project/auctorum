import { useState, useEffect } from 'react'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import {
  Database, Plus, Trash2, Save, X, RefreshCw, Play, Table2,
  HardDrive, Calendar, Tag, AlertCircle
} from 'lucide-react'

interface MemoryEntry {
  id: number
  key: string
  value: string
  updated: string
  source: string
}

interface EventEntry {
  id: number
  timestamp: string
  event_type: string
  details: string
}

interface MemoryDbInfo {
  tables: string[]
  memory_count: number
  events_count: number
  db_size: string
}

interface SqlResult {
  columns: string[]
  rows: string[][]
}

type TabId = 'memory' | 'events' | 'query'

function relativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr.replace(' ', 'T'))
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d ago`
    return dateStr
  } catch {
    return dateStr
  }
}

export function MemoryPage() {
  const [tab, setTab] = useState<TabId>('memory')
  const [dbInfo, setDbInfo] = useState<MemoryDbInfo | null>(null)
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [events, setEvents] = useState<EventEntry[]>([])
  const [creating, setCreating] = useState(false)
  const [newEntry, setNewEntry] = useState({ key: '', value: '', source: 'c2-manual' })
  const [error, setError] = useState<string | null>(null)

  const [sqlText, setSqlText] = useState('SELECT * FROM memory LIMIT 10')
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null)
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [sqlRunning, setSqlRunning] = useState(false)

  const fetchData = async () => {
    try {
      if (isTauri) {
        const [info, mem, evt] = await Promise.all([
          tauriInvoke<MemoryDbInfo>('get_memory_db_info'),
          tauriInvoke<MemoryEntry[]>('get_memory_entries', { limit: 200, offset: 0 }),
          tauriInvoke<EventEntry[]>('get_event_entries', { limit: 100 }),
        ])
        setDbInfo(info)
        setEntries(mem || [])
        setEvents(evt || [])
      } else {
        setDbInfo({ tables: ['memory', 'events'], memory_count: 3, events_count: 5, db_size: '48.2 KB' })
        setEntries([
          { id: 1, key: 'user.name', value: 'cocopsn', updated: '2026-03-01 10:00', source: 'agent' },
          { id: 2, key: 'user.timezone', value: 'America/Monterrey', updated: '2026-03-01 09:00', source: 'agent' },
          { id: 3, key: 'system.mode', value: 'autonomous', updated: '2026-02-28 18:00', source: 'c2-manual' },
        ])
        setEvents([
          { id: 1, timestamp: '2026-03-02 08:00', event_type: 'routine', details: 'Morning routine executed successfully' },
          { id: 2, timestamp: '2026-03-01 22:00', event_type: 'whatsapp', details: 'Message processed from +52...' },
          { id: 3, timestamp: '2026-03-01 18:30', event_type: 'memory', details: 'Key user.timezone updated by agent' },
          { id: 4, timestamp: '2026-03-01 12:00', event_type: 'system', details: 'OpenClaw daemon restarted' },
          { id: 5, timestamp: '2026-03-01 08:00', event_type: 'error', details: 'Ollama connection timeout after 30s' },
        ])
      }
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async (key: string, value: string, source: string) => {
    if (!key.trim()) return
    try {
      if (isTauri) {
        await tauriInvoke('upsert_memory', { entry: { key, value, source } })
      }
      setCreating(false)
      setNewEntry({ key: '', value: '', source: 'c2-manual' })
      fetchData()
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async (key: string) => {
    try {
      if (isTauri) {
        await tauriInvoke('delete_memory', { key })
      } else {
        setEntries(prev => prev.filter(e => e.key !== key))
      }
      fetchData()
    } catch (e) {
      setError(String(e))
    }
  }

  const runSqlQuery = async () => {
    if (!sqlText.trim()) return
    setSqlRunning(true)
    setSqlError(null)
    setSqlResult(null)
    try {
      if (isTauri) {
        const result = await tauriInvoke<SqlResult>('execute_sql_query', { query: sqlText })
        if (result) setSqlResult(result)
      } else {
        const trimmed = sqlText.trim().toUpperCase()
        if (trimmed.startsWith('SELECT')) {
          setSqlResult({
            columns: ['id', 'key', 'value', 'updated', 'source'],
            rows: [
              ['1', 'user.name', 'cocopsn', '2026-03-01 10:00', 'agent'],
              ['2', 'user.timezone', 'America/Monterrey', '2026-03-01 09:00', 'agent'],
              ['3', 'system.mode', 'autonomous', '2026-02-28 18:00', 'c2-manual'],
            ],
          })
        } else {
          setSqlResult({ columns: ['affected_rows'], rows: [['0']] })
        }
      }
    } catch (e) {
      setSqlError(String(e))
    } finally {
      setSqlRunning(false)
    }
  }

  const getEventBadgeClass = (type: string): string => {
    switch (type) {
      case 'routine': return 'badge-green'
      case 'whatsapp': return 'badge-blue'
      case 'memory': return 'badge-yellow'
      case 'system': return 'badge-dim'
      case 'error': return 'badge-red'
      default: return 'badge-dim'
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'memory', label: 'Memory' },
    { id: 'events', label: 'Events' },
    { id: 'query', label: 'SQL Query' },
  ]

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto animate-fade-in">
      {/* Header with DB info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database size={18} style={{ color: 'var(--color-text-dim)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Memory Database
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {dbInfo && (
            <div className="flex items-center gap-2">
              <span className="badge badge-dim">
                <Table2 size={10} />
                {dbInfo.tables.length} tables
              </span>
              <span className="badge badge-blue">
                {dbInfo.memory_count} entries
              </span>
              <span className="badge badge-yellow">
                <Calendar size={10} />
                {dbInfo.events_count} events
              </span>
              <span className="badge badge-dim">
                <HardDrive size={10} />
                {dbInfo.db_size}
              </span>
            </div>
          )}
          <button onClick={fetchData} className="btn btn-ghost btn-sm">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div
          className="card-flat rounded-lg px-4 py-3 flex items-center gap-2 animate-fade-in"
          style={{
            borderColor: 'var(--color-red)',
            background: 'color-mix(in srgb, var(--color-red) 6%, var(--color-bg-secondary))',
          }}
        >
          <AlertCircle size={14} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
          <span className="mono text-xs" style={{ color: 'var(--color-red)' }}>{error}</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="tab-group">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab ${tab === t.id ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MEMORY TAB ── */}
      {tab === 'memory' && (
        <div className="card animate-fade-in overflow-hidden">
          {/* Table toolbar */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Memory entries
            </span>
            <button
              onClick={() => setCreating(true)}
              className="btn btn-primary btn-sm"
            >
              <Plus size={12} />
              Add entry
            </button>
          </div>

          {/* Create form */}
          {creating && (
            <div
              className="px-4 py-4 animate-fade-in"
              style={{
                background: 'var(--color-bg-tertiary)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={newEntry.key}
                    onChange={e => setNewEntry(p => ({ ...p, key: e.target.value }))}
                    placeholder="Key (e.g. user.preference)"
                    className="input input-mono"
                  />
                  <input
                    value={newEntry.source}
                    onChange={e => setNewEntry(p => ({ ...p, source: e.target.value }))}
                    placeholder="Source"
                    className="input input-mono"
                  />
                </div>
                <textarea
                  value={newEntry.value}
                  onChange={e => setNewEntry(p => ({ ...p, value: e.target.value }))}
                  placeholder="Value"
                  rows={3}
                  className="input input-mono"
                  style={{ resize: 'none' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(newEntry.key, newEntry.value, newEntry.source)}
                    className="btn btn-primary btn-sm"
                  >
                    <Save size={12} />
                    Save
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewEntry({ key: '', value: '', source: 'c2-manual' }) }}
                    className="btn btn-ghost btn-sm"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table header */}
          <div
            className="grid gap-3 px-4 table-header"
            style={{ gridTemplateColumns: '2fr 4fr 1.2fr 1fr 48px' }}
          >
            <span>Key</span>
            <span>Value</span>
            <span>Updated</span>
            <span>Source</span>
            <span></span>
          </div>

          {/* Table rows */}
          {entries.length > 0 ? (
            <div>
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className="grid gap-3 px-4 items-center table-row"
                  style={{ gridTemplateColumns: '2fr 4fr 1.2fr 1fr 48px' }}
                >
                  <span className="mono font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {entry.key}
                  </span>
                  <span
                    className="text-sm truncate"
                    style={{ color: 'var(--color-text-secondary)' }}
                    title={entry.value}
                  >
                    {entry.value.length > 100 ? entry.value.slice(0, 100) + '...' : entry.value}
                  </span>
                  <span className="mono text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    {relativeTime(entry.updated)}
                  </span>
                  <span className="badge badge-dim">
                    <Tag size={9} />
                    {entry.source}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.key)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-text-dim)', padding: '4px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Database size={22} />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                No memory entries found
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-dim)', opacity: 0.7 }}>
                Click "Add entry" to create your first memory record.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── EVENTS TAB ── */}
      {tab === 'events' && (
        <div className="card animate-fade-in overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Event audit log
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {events.length} events
            </span>
          </div>

          {/* Table header */}
          <div
            className="grid gap-3 px-4 table-header"
            style={{ gridTemplateColumns: '160px 100px 1fr' }}
          >
            <span>Timestamp</span>
            <span>Type</span>
            <span>Details</span>
          </div>

          {events.length > 0 ? (
            <div>
              {events.map(evt => (
                <div
                  key={evt.id}
                  className="grid gap-3 px-4 items-center table-row"
                  style={{ gridTemplateColumns: '160px 100px 1fr' }}
                >
                  <span className="mono text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    {evt.timestamp}
                  </span>
                  <span className={`badge ${getEventBadgeClass(evt.event_type)}`}>
                    {evt.event_type}
                  </span>
                  <span className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {evt.details}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Calendar size={22} />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                No events recorded
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── SQL QUERY TAB ── */}
      {tab === 'query' && (
        <div className="space-y-4 animate-fade-in">
          <div className="card overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                SQL query runner
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                Ctrl+Enter to execute
              </span>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={sqlText}
                onChange={e => setSqlText(e.target.value)}
                placeholder="SELECT * FROM memory LIMIT 10"
                rows={5}
                spellCheck={false}
                className="code-block w-full outline-none"
                style={{
                  resize: 'none',
                  lineHeight: '1.7',
                  color: 'var(--color-text-primary)',
                }}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    runSqlQuery()
                  }
                }}
              />

              {/* SQL Error */}
              {sqlError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg animate-fade-in" style={{
                  background: 'color-mix(in srgb, var(--color-red) 8%, var(--color-bg-primary))',
                  border: '1px solid color-mix(in srgb, var(--color-red) 20%, transparent)',
                }}>
                  <AlertCircle size={13} style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: 1 }} />
                  <span className="mono text-xs" style={{ color: 'var(--color-red)' }}>{sqlError}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={runSqlQuery}
                  disabled={sqlRunning || !sqlText.trim()}
                  className="btn btn-primary btn-sm"
                >
                  <Play size={11} />
                  {sqlRunning ? 'Running...' : 'Run query'}
                </button>
              </div>
            </div>
          </div>

          {/* SQL Results */}
          {sqlResult && (
            <div className="card animate-fade-in overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Results
                </span>
                <div className="flex items-center gap-2">
                  <span className="badge badge-dim">{sqlResult.rows.length} rows</span>
                  <span className="badge badge-dim">{sqlResult.columns.length} columns</span>
                </div>
              </div>

              {sqlResult.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  {/* Column headers */}
                  <div
                    className="flex table-header"
                    style={{ minWidth: 'max-content' }}
                  >
                    {sqlResult.columns.map((col, ci) => (
                      <span
                        key={ci}
                        className="flex-shrink-0 px-4"
                        style={{ minWidth: '140px' }}
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                  {/* Result rows */}
                  {sqlResult.rows.map((row, ri) => (
                    <div
                      key={ri}
                      className="flex table-row"
                      style={{ minWidth: 'max-content' }}
                    >
                      {row.map((cell, ci) => (
                        <span
                          key={ci}
                          className="mono text-xs flex-shrink-0 px-4"
                          style={{
                            minWidth: '140px',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {cell}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px 24px' }}>
                  <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                    Query returned no rows
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
