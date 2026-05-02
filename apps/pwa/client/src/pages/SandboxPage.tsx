import { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { BottomSheet } from '@/components/BottomSheet'
import {
  Brain, ArrowUp, Trash2, ChevronDown, Hash, Zap, Timer, BarChart3, MessageCircle
} from 'lucide-react'

interface ChatMessage {
  role: string
  content: string
}

interface ChatResponse {
  message: { role: string; content: string }
  model: string
  total_duration: number
  eval_count: number
}

interface OllamaModel {
  name: string
  size: number
  digest: string
  modified_at: string
}

interface InferenceEntry {
  id: string
  timestamp: Date
  model: string
  durationMs: number
  tokens: number
  tokensPerSec: number
}

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
}

export function SandboxPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [inferenceEntries, setInferenceEntries] = useState<InferenceEntry[]>([])
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch Models
  const fetchModels = useCallback(async () => {
    try {
      const result = await api<{ models: OllamaModel[] }>('/ollama/models')
      const names = result.models?.map(m => m.name) || []
      if (names.length > 0) {
        setModels(names)
        if (!selectedModel || !names.includes(selectedModel)) {
          setSelectedModel(names[0])
        }
      }
    } catch (e) {
      console.error('Failed to fetch models:', e)
    }
  }, [selectedModel])

  useEffect(() => { fetchModels() }, [fetchModels])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Click outside dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // Send Message
  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading || !selectedModel) return

    const userMsg: DisplayMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    const newHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: trimmed },
    ]
    setChatHistory(newHistory)
    setInput('')
    setLoading(true)

    try {
      const resp = await api<ChatResponse>('/ollama/chat', {
        method: 'POST',
        body: JSON.stringify({
          model: selectedModel,
          messages: newHistory,
        }),
      })

      const responseContent = resp.message?.content || 'No response received.'
      const totalDuration = resp.total_duration || 0
      const evalCount = resp.eval_count || 0

      const durationMs = totalDuration / 1_000_000
      const tokensPerSec = durationMs > 0 ? (evalCount / (durationMs / 1000)) : 0

      const entry: InferenceEntry = {
        id: `inf-${Date.now()}`,
        timestamp: new Date(),
        model: selectedModel,
        durationMs,
        tokens: evalCount,
        tokensPerSec,
      }
      setInferenceEntries(prev => [entry, ...prev])

      const assistantMsg: DisplayMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        model: selectedModel,
      }
      setMessages(prev => [...prev, assistantMsg])
      setChatHistory(prev => [...prev, { role: 'assistant', content: responseContent }])
    } catch (e) {
      const errorMsg: DisplayMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Connection error: ${String(e)}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages([])
    setChatHistory([])
    setInferenceEntries([])
  }

  // Aggregate stats
  const totalTokens = inferenceEntries.reduce((s, e) => s + e.tokens, 0)
  const avgSpeed = inferenceEntries.length > 0
    ? inferenceEntries.reduce((s, e) => s + e.tokensPerSec, 0) / inferenceEntries.length
    : 0
  const totalTime = inferenceEntries.reduce((s, e) => s + e.durationMs, 0)

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Top Bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3 py-2"
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Model selector dropdown */}
          <div ref={dropdownRef} className="relative flex-1" style={{ maxWidth: 220 }}>
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="input flex items-center gap-2 cursor-pointer w-full"
              style={{
                padding: '6px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                borderColor: modelDropdownOpen ? 'var(--color-accent)' : undefined,
              }}
            >
              <span className="flex-1 text-left truncate">
                {selectedModel || 'Select model...'}
              </span>
              <ChevronDown
                size={13}
                style={{
                  color: 'var(--color-text-dim)',
                  transform: modelDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            {modelDropdownOpen && models.length > 0 && (
              <div
                className="absolute top-full left-0 mt-1 w-full rounded-lg overflow-hidden z-50"
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                {models.map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedModel(m)
                      setModelDropdownOpen(false)
                    }}
                    className="w-full text-left px-3 py-2.5 cursor-pointer tap-highlight"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: m === selectedModel ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      background: m === selectedModel ? 'var(--color-bg-active)' : 'transparent',
                      border: 'none',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {messages.length > 0 && (
            <button onClick={clearChat} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
              <Trash2 size={13} />
            </button>
          )}
          {inferenceEntries.length > 0 && (
            <button
              onClick={() => setMetricsOpen(true)}
              className="btn btn-ghost btn-sm"
              style={{ padding: 4, color: 'var(--color-accent)' }}
            >
              <BarChart3 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Brain size={24} />
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                Start a conversation
              </p>
              <p style={{ color: 'var(--color-text-dim)', fontSize: 12, maxWidth: 280, lineHeight: 1.6, textAlign: 'center' }}>
                Select a model and send a message to begin chatting with your local Ollama instance.
              </p>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div
              style={{
                maxWidth: '85%',
                background:
                  msg.role === 'user'
                    ? 'var(--color-accent)'
                    : 'var(--color-bg-secondary)',
                color:
                  msg.role === 'user'
                    ? 'white'
                    : 'var(--color-text-primary)',
                border:
                  msg.role === 'assistant'
                    ? '1px solid var(--color-border)'
                    : 'none',
                padding: '10px 14px',
                borderRadius:
                  msg.role === 'user'
                    ? '12px 4px 12px 12px'
                    : '4px 12px 12px 12px',
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
              <div
                className="flex items-center gap-2 mt-1.5 mono"
                style={{
                  fontSize: 10,
                  color: msg.role === 'user'
                    ? 'rgba(255,255,255,0.6)'
                    : 'var(--color-text-dim)',
                }}
              >
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.model && (
                  <>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span>{msg.model}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading: 3 animated dots */}
        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                padding: '12px 18px',
                borderRadius: '4px 12px 12px 12px',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 6, height: 6,
                    background: 'var(--color-text-dim)',
                    animation: 'dot-bounce 1.2s ease-in-out infinite',
                  }}
                />
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 6, height: 6,
                    background: 'var(--color-text-dim)',
                    animation: 'dot-bounce 1.2s ease-in-out 0.2s infinite',
                  }}
                />
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 6, height: 6,
                    background: 'var(--color-text-dim)',
                    animation: 'dot-bounce 1.2s ease-in-out 0.4s infinite',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div
        className="flex-shrink-0 px-3 py-2"
        style={{
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div
          className="flex items-end gap-2 rounded-xl"
          style={{
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            padding: '6px 6px 6px 12px',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={
              selectedModel
                ? `Message ${selectedModel}...`
                : 'Select a model first...'
            }
            rows={1}
            disabled={!selectedModel}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--color-text-primary)',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: 'var(--font-sans)',
              minHeight: 28,
              maxHeight: 120,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !selectedModel}
            className="btn btn-primary btn-sm"
            style={{
              borderRadius: 8,
              width: 34,
              height: 34,
              padding: 0,
              opacity: (!input.trim() || loading || !selectedModel) ? 0.35 : 1,
              flexShrink: 0,
            }}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>

      {/* Inference Metrics BottomSheet (replaces desktop side panel) */}
      <BottomSheet
        open={metricsOpen}
        onClose={() => setMetricsOpen(false)}
        title="Inference Metrics"
      >
        <div className="space-y-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {inferenceEntries.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              <div className="empty-state-icon" style={{ width: 40, height: 40 }}>
                <MessageCircle size={18} />
              </div>
              <p style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>
                Inference metrics will appear here after sending messages.
              </p>
            </div>
          ) : (
            <>
              {/* Aggregate stats */}
              <div className="card-flat rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>Total tokens</span>
                  <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    {totalTokens}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>Avg speed</span>
                  <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    {avgSpeed.toFixed(1)} tok/s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>Total time</span>
                  <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}>
                    {(totalTime / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Individual entries */}
              {inferenceEntries.map(entry => {
                const barPct = Math.min((entry.tokensPerSec / 100) * 100, 100)
                const barColor = entry.tokensPerSec > 60
                  ? 'var(--color-green)'
                  : entry.tokensPerSec > 30
                    ? 'var(--color-yellow)'
                    : 'var(--color-orange)'

                return (
                  <div key={entry.id} className="card-flat rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="mono" style={{ color: 'var(--color-accent)', fontSize: 11 }}>
                        {entry.model}
                      </span>
                      <span className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 10 }}>
                        {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Timer size={10} style={{ color: 'var(--color-text-dim)' }} />
                          <span style={{ color: 'var(--color-text-dim)', fontSize: 10 }}>Duration</span>
                        </div>
                        <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                          {entry.durationMs < 1000
                            ? `${Math.round(entry.durationMs)}ms`
                            : `${(entry.durationMs / 1000).toFixed(1)}s`}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Hash size={10} style={{ color: 'var(--color-text-dim)' }} />
                          <span style={{ color: 'var(--color-text-dim)', fontSize: 10 }}>Tokens</span>
                        </div>
                        <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                          {entry.tokens}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Zap size={10} style={{ color: 'var(--color-text-dim)' }} />
                          <span style={{ color: 'var(--color-text-dim)', fontSize: 10 }}>Speed</span>
                        </div>
                        <span className="mono" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                          {entry.tokensPerSec.toFixed(1)}/s
                        </span>
                      </div>
                    </div>

                    <div className="metric-bar">
                      <div
                        className="metric-bar-fill"
                        style={{ width: `${barPct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
