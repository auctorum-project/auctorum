import { useState, useRef, useEffect, useCallback } from 'react'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import {
  Brain, Send, ArrowUp, Trash2, ChevronDown, Hash, Zap, Timer, PanelRightOpen, PanelRightClose, MessageCircle
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: string
  content: string
}

interface ChatResponse {
  content: string
  model: string
  total_duration: number
  eval_count: number
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

// ── Mock Helpers ───────────────────────────────────────────────────

const MOCK_MODELS = ['llama3.2:latest', 'mistral:7b', 'codellama:13b']

const MOCK_RESPONSES: Record<string, string> = {
  default:
    'I understand your request. As a local AI agent running through Ollama, I can help with a wide variety of tasks including code analysis, text generation, reasoning, and general knowledge questions.\n\nThis response is simulated in browser mode. In Tauri mode, this would connect to your local Ollama instance and use the selected model for inference.',
  hello:
    'Hello! I am your local AI assistant running in the Auctorum sandbox environment. I can help with code, analysis, and general tasks. What would you like to work on today?',
  code:
    'Here is a simple example:\n\n```python\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nfor i in range(10):\n    print(f"fib({i}) = {fibonacci(i)}")\n```\n\nThis recursive implementation computes Fibonacci numbers. For production use, consider memoization or an iterative approach for better performance.',
}

function getMockResponse(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return MOCK_RESPONSES.hello
  }
  if (lower.includes('code') || lower.includes('function') || lower.includes('program')) {
    return MOCK_RESPONSES.code
  }
  return MOCK_RESPONSES.default
}

// ── Component ──────────────────────────────────────────────────────

export function SandboxPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(true)
  const [inferenceEntries, setInferenceEntries] = useState<InferenceEntry[]>([])
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Fetch Models ─────────────────────────────────────────────────

  const fetchModels = useCallback(async () => {
    try {
      if (isTauri) {
        const names = await tauriInvoke<string[]>('get_available_models')
        if (names && names.length > 0) {
          setModels(names)
          if (!selectedModel || !names.includes(selectedModel)) {
            setSelectedModel(names[0])
          }
        }
      } else {
        setModels(MOCK_MODELS)
        if (!selectedModel) setSelectedModel(MOCK_MODELS[0])
      }
    } catch (e) {
      console.error('Failed to fetch models:', e)
      setModels(MOCK_MODELS)
      if (!selectedModel) setSelectedModel(MOCK_MODELS[0])
    }
  }, [selectedModel])

  useEffect(() => { fetchModels() }, [fetchModels])

  // ── Auto-scroll ──────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Click outside dropdown ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Auto-resize textarea ─────────────────────────────────────────

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // ── Send Message ─────────────────────────────────────────────────

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
      let responseContent: string
      let totalDuration = 0
      let evalCount = 0

      if (isTauri) {
        const resp = await tauriInvoke<ChatResponse>('sandbox_chat', {
          model: selectedModel,
          messages: newHistory,
        })
        if (resp) {
          responseContent = resp.content
          totalDuration = resp.total_duration
          evalCount = resp.eval_count
        } else {
          responseContent = 'No response received from backend.'
          totalDuration = 0
          evalCount = 0
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 800))
        responseContent = getMockResponse(trimmed)
        totalDuration = Math.floor(800_000_000 + Math.random() * 3_000_000_000)
        evalCount = Math.floor(40 + Math.random() * 160)
      }

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
    <div className="flex h-full animate-fade-in">

      {/* ═══════════════ LEFT: Chat Interface ═══════════════ */}
      <div className="flex-1 flex flex-col h-full min-w-0">

        {/* ── Top Bar ── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 py-2.5"
          style={{
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Model selector dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                className="input flex items-center gap-2 cursor-pointer"
                style={{
                  width: 'auto',
                  minWidth: 200,
                  padding: '6px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  borderColor: modelDropdownOpen ? 'var(--color-accent)' : undefined,
                }}
              >
                <span className="flex-1 text-left truncate">
                  {selectedModel || 'Select model...'}
                </span>
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--color-text-dim)',
                    transform: modelDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
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
                      className="w-full text-left px-3 py-2 cursor-pointer transition-colors"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: m === selectedModel ? 'var(--color-accent)' : 'var(--color-text-primary)',
                        background: m === selectedModel ? 'var(--color-bg-active)' : 'transparent',
                        border: 'none',
                      }}
                      onMouseEnter={e => {
                        if (m !== selectedModel) e.currentTarget.style.background = 'var(--color-bg-hover)'
                      }}
                      onMouseLeave={e => {
                        if (m !== selectedModel) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={clearChat} className="btn btn-ghost btn-sm">
                <Trash2 size={13} />
                Clear
              </button>
            )}
            <button
              onClick={() => setMetricsOpen(!metricsOpen)}
              className="btn btn-ghost btn-sm"
              style={{ color: metricsOpen ? 'var(--color-accent)' : undefined }}
            >
              {metricsOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>

        {/* ── Messages Area ── */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
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
                <p style={{ color: 'var(--color-text-dim)', fontSize: 12, maxWidth: 320, lineHeight: 1.6 }}>
                  Select a model and send a message to begin chatting with {isTauri ? 'your local Ollama instance' : 'simulated responses'}.
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
                className="max-w-[75%]"
                style={{
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

        {/* ── Input Bar ── */}
        <div
          className="flex-shrink-0 px-4 py-3"
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
              padding: '6px 6px 6px 14px',
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
                width: 32,
                height: 32,
                padding: 0,
                opacity: (!input.trim() || loading || !selectedModel) ? 0.35 : 1,
              }}
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ RIGHT: Inference Metrics Panel ═══════════════ */}
      {metricsOpen && (
        <div
          className="flex-shrink-0 flex flex-col h-full overflow-hidden animate-fade-in"
          style={{
            width: 280,
            background: 'var(--color-bg-secondary)',
            borderLeft: '1px solid var(--color-border)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <Brain size={14} style={{ color: 'var(--color-text-dim)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Inference
              </span>
            </div>
            <span className="badge badge-dim">
              {inferenceEntries.length}
            </span>
          </div>

          {/* Entries list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {inferenceEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="empty-state" style={{ padding: '24px 16px' }}>
                  <div className="empty-state-icon" style={{ width: 40, height: 40 }}>
                    <MessageCircle size={18} />
                  </div>
                  <p style={{ color: 'var(--color-text-dim)', fontSize: 12, maxWidth: 200 }}>
                    Inference metrics will appear here after sending messages.
                  </p>
                </div>
              </div>
            ) : (
              inferenceEntries.map((entry, i) => {
                const barPct = Math.min((entry.tokensPerSec / 100) * 100, 100)
                const barColor = entry.tokensPerSec > 60
                  ? 'var(--color-green)'
                  : entry.tokensPerSec > 30
                    ? 'var(--color-yellow)'
                    : 'var(--color-orange)'

                return (
                  <div
                    key={entry.id}
                    className="card-flat rounded-lg p-3 space-y-2.5 animate-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {/* Model + time */}
                    <div className="flex items-center justify-between">
                      <span className="mono" style={{ color: 'var(--color-accent)', fontSize: 11 }}>
                        {entry.model}
                      </span>
                      <span className="mono" style={{ color: 'var(--color-text-dim)', fontSize: 10 }}>
                        {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Metrics row */}
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

                    {/* Throughput bar */}
                    <div className="metric-bar">
                      <div
                        className="metric-bar-fill"
                        style={{ width: `${barPct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer: Aggregate stats */}
          {inferenceEntries.length > 0 && (
            <div
              className="flex-shrink-0 px-4 py-3 space-y-1.5"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
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
          )}
        </div>
      )}
    </div>
  )
}
