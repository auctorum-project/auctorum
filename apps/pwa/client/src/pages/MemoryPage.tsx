import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import {
  Database, Plus, Trash2, Save, X, RefreshCw, Play, Table2,
  HardDrive, Calendar, Tag, AlertCircle
} from 'lucide-react'

interface MemoryEntry {
  key: string
  value: string
  updated: string
  category?: string
  metadata?: string
}

interface EventEntry {
  id: number
  timestamp: string
  event_type: string
  details: string
}

interface MemoryDbInfo {
  tables: string[]
  memoryCount: number
  eventsCount: number
  dbPath: string
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
  const [newEntry, setNewEntry] = useState({ key: '', value: '', category: 'general' })
  const [error, setError] = useState<string | null>(null)

  const [sqlText, setSqlText] = useState('SELECT * FROM memory LIMIT 10')
  const [sqlResult, setSqlResult] = useState<Record<string, string>[] | null>(null)
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [sqlRunning, setSqlRunning] = useState(false)

  const fetchData = async () => {
    try {
      const [info, mem, evt] = await Promise.all([
        api<MemoryDbInfo>('/memory/info'),
        api<MemoryEntry[]>('/memory/entries'),
        api<EventEntry[]>('/memory/events'),
      ])
      setDbInfo(info)
      setEntries(mem || [])
      setEvents(evt || [])
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    if (!newEntry.key.trim()) return
    try {
      await api('/memory/upsert', {
        method: 'POST',
        body: JSON.stringify({ key: newEntry.key, value: newEntry.value, category: newEntry.category }),
      })
      setCreating(false)
      setNewEntry({ key: '', value: '', category: 'general' })
      fetchData()
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async (key: string) => {
    try {
      await api(`/memory/${encodeURIComponent(key)}`, { method: 'DELETE' })
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
      const result = await api<Record<string, string>[]>('/memory/query', {
        method: 'POST',
        body: JSON.stringify({ sql: sqlText }),
      })
      setSqlResult(result)
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
    { id: 'query', label: 'SQL' },
  ]

  const sqlColumns = sqlResult && sqlResult.length > 0 ? Object.keys(sqlResult[0]) : []

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} style={{ color: 'var(--color-text-dim)' }} />
          <h1 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Memory</h1>
        </div>
        <div className="flex items-center gap-2">
          {dbInfo && (
            <>
              <span className="badge badge-blue" style={{ fontSize: 10 }}>{dbInfo.memoryCount} entries</span>
              <span className="badge badge-yellow" style={{ fontSize: 10 }}>{dbInfo.eventsCount} events</span>
            </>
          )}
          <button onClick={fetchData} className="btn btn-ghost btn-sm"><RefreshCw size={13} /></button>
        </div>
      </div>

      {error && (
        <div className="card-flat rounded-lg px-3 py-2 flex items-center gap-2 animate-fade-in"
          style={{ borderColor: 'var(--color-red)', background: 'color-mix(in srgb, var(--color-red) 6%, var(--color-bg-secondary))' }}>
          <AlertCircle size={13} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
          <span className="mono text-xs" style={{ color: 'var(--color-red)' }}>{error}</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="tab-group">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab ${tab === t.id ? 'active' : ''}`}>{t.label}</button>
        ))}
      </div>

      {/* MEMORY TAB */}
      {tab === 'memory' && (
        <div className="card animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Entries</span>
            <button onClick={() => setCreating(true)} className="btn btn-primary btn-sm"><Plus size={12} /> Add</button>
          </div>

          {creating && (
            <div className="px-4 py-3 animate-fade-in space-y-3" style={{ background: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-border)' }}>
              <input value={newEntry.key} onChange={e => setNewEntry(p => ({ ...p, key: e.target.value }))} placeholder="Key" className="input input-mono" />
              <textarea value={newEntry.value} onChange={e => setNewEntry(p => ({ ...p, value: e.target.value }))} placeholder="Value" rows={2} className="input input-mono" style={{ resize: 'none' }} />
              <div className="flex gap-2">
                <button onClick={handleSave} className="btn btn-primary btn-sm"><Save size={12} /> Save</button>
                <button onClick={() => { setCreating(false); setNewEntry({ key: '', value: '', category: 'general' }) }} className="btn btn-ghost btn-sm"><X size={12} /> Cancel</button>
              </div>
            </div>
          )}

          {entries.length > 0 ? (
            <div>
              {entries.map(entry => (
                <div key={entry.key} className="px-4 py-3 flex items-start justify-between gap-2" style={{ borderBottom: '1px solid var(--color-border-dim)' }}>
                  <div className="min-w-0 flex-1">
                    <span className="mono font-medium block truncate" style={{ color: 'var(--color-text-primary)', fontSize: 13 }}>{entry.key}</span>
                    <span className="text-xs block mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }} title={entry.value}>
                      {entry.value.length > 80 ? entry.value.slice(0, 80) + '...' : entry.value}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="mono text-xs" style={{ color: 'var(--color-text-dim)' }}>{relativeTime(entry.updated)}</span>
                      {entry.category && <span className="badge badge-dim" style={{ fontSize: 10 }}><Tag size={8} />{entry.category}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(entry.key)} className="btn btn-ghost btn-sm flex-shrink-0" style={{ color: 'var(--color-text-dim)', padding: '4px' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px' }}>
              <div className="empty-state-icon"><Database size={22} /></div>
              <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>No memory entries found</p>
            </div>
          )}
        </div>
      )}

      {/* EVENTS TAB */}
      {tab === 'events' && (
        <div className="card animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Event log</span>
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{events.length} events</span>
          </div>
          {events.length > 0 ? (
            <div>
              {events.map(evt => (
                <div key={evt.id} className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border-dim)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono text-xs" style={{ color: 'var(--color-text-dim)' }}>{evt.timestamp}</span>
                    <span className={`badge ${getEventBadgeClass(evt.event_type)}`} style={{ fontSize: 10 }}>{evt.event_type}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{evt.details}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px' }}>
              <div className="empty-state-icon"><Calendar size={22} /></div>
              <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>No events recorded</p>
            </div>
          )}
        </div>
      )}

      {/* SQL QUERY TAB */}
      {tab === 'query' && (
        <div className="space-y-4 animate-fade-in">
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>SQL query runner</span>
            </div>
            <div className="p-4 space-y-3">
              <textarea value={sqlText} onChange={e => setSqlText(e.target.value)} placeholder="SELECT * FROM memory LIMIT 10" rows={4} spellCheck={false} className="code-block w-full outline-none" style={{ resize: 'none', lineHeight: '1.7', color: 'var(--color-text-primary)' }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSqlQuery() } }}
              />
              {sqlError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg animate-fade-in" style={{ background: 'color-mix(in srgb, var(--color-red) 8%, var(--color-bg-primary))', border: '1px solid color-mix(in srgb, var(--color-red) 20%, transparent)' }}>
                  <AlertCircle size={13} style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: 1 }} />
                  <span className="mono text-xs" style={{ color: 'var(--color-red)' }}>{sqlError}</span>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={runSqlQuery} disabled={sqlRunning || !sqlText.trim()} className="btn btn-primary btn-sm">
                  <Play size={11} />
                  {sqlRunning ? 'Running...' : 'Run query'}
                </button>
              </div>
            </div>
          </div>

          {sqlResult && (
            <div className="card animate-fade-in overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Results</span>
                <span className="badge badge-dim">{sqlResult.length} rows</span>
              </div>
              {sqlResult.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="flex table-header" style={{ minWidth: 'max-content' }}>
                    {sqlColumns.map((col, ci) => (
                      <span key={ci} className="flex-shrink-0 px-3" style={{ minWidth: '120px' }}>{col}</span>
                    ))}
                  </div>
                  {sqlResult.map((row, ri) => (
                    <div key={ri} className="flex table-row" style={{ minWidth: 'max-content' }}>
                      {sqlColumns.map((col, ci) => (
                        <span key={ci} className="mono text-xs flex-shrink-0 px-3" style={{ minWidth: '120px', color: 'var(--color-text-secondary)' }}>
                          {String(row[col] ?? '')}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>Query returned no rows</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
