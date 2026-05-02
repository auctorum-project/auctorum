import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme, type ThemeName } from '@/context/ThemeContext'
import { isTauri, tauriInvoke } from '@/lib/tauri'
import { Minus, Square, X, Palette, Copy } from 'lucide-react'
import logoUrl from '@/assets/logo.png'

type ConnectionStatus = 'connected' | 'disconnected' | 'browser'

// Cache the window reference to avoid repeated dynamic imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedWindow: any = null

async function getWindow(): Promise<any> {
  if (!isTauri) return null
  if (cachedWindow) return cachedWindow
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    cachedWindow = getCurrentWindow()
    return cachedWindow
  } catch {
    return null
  }
}

export function Titlebar() {
  const { theme, setTheme } = useTheme()
  const [connStatus, setConnStatus] = useState<ConnectionStatus>(
    isTauri ? 'disconnected' : 'browser'
  )
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [hostname, setHostname] = useState<string>(
    isTauri ? '' : 'Browser Preview'
  )
  const [isMaximized, setIsMaximized] = useState(false)
  const titlebarRef = useRef<HTMLDivElement>(null)

  const themes: ThemeName[] = ['dracula', 'monokai', 'matrix', 'nord']
  const nextTheme = () => {
    const idx = themes.indexOf(theme)
    setTheme(themes[(idx + 1) % themes.length])
  }

  // Connection health check every 15s
  const checkConnection = useCallback(async () => {
    if (!isTauri) {
      setConnStatus('browser')
      setHostname('Browser Preview')
      return
    }
    try {
      const start = performance.now()
      const result = await tauriInvoke<string>('test_connection')
      const elapsed = Math.round(performance.now() - start)
      if (result) {
        setConnStatus('connected')
        setLatencyMs(elapsed)
        // Extract hostname from the result
        const lines = result.split('\n')
        const firstLine = lines[0] || ''
        const match = firstLine.match(/OK -- (.+?) \(/)
        setHostname(match ? match[1] : 'Remote Host')
      } else {
        setConnStatus('disconnected')
        setLatencyMs(null)
      }
    } catch {
      setConnStatus('disconnected')
      setLatencyMs(null)
    }
  }, [])

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 15_000)
    return () => clearInterval(interval)
  }, [checkConnection])

  // Track maximized state
  useEffect(() => {
    if (!isTauri) return
    let unlisten: (() => void) | null = null

    ;(async () => {
      const win = await getWindow()
      if (!win) return
      setIsMaximized(await win.isMaximized())
      const { listen } = await import('@tauri-apps/api/event')
      // Tauri v2: listen to resize events to track maximize state
      unlisten = await listen('tauri://resize', async () => {
        if (win) setIsMaximized(await win.isMaximized())
      })
    })()

    return () => { unlisten?.() }
  }, [])

  // Window controls — direct, no await in the hot path
  const minimize = () => { getWindow().then(w => w?.minimize()) }
  const toggleMaximize = () => { getWindow().then(w => w?.toggleMaximize()) }
  const close = () => { getWindow().then(w => w?.close()) }

  // Manual drag region handling to avoid intercepting button clicks
  useEffect(() => {
    if (!isTauri) return
    const el = titlebarRef.current
    if (!el) return

    const handleMouseDown = async (e: MouseEvent) => {
      // Only drag if the user clicked on the drag region itself or elements marked as drag
      const target = e.target as HTMLElement
      if (target.closest('[data-no-drag]')) return

      // Double-click to toggle maximize
      if (e.detail === 2) {
        toggleMaximize()
        return
      }

      const win = await getWindow()
      if (win) win.startDragging()
    }

    el.addEventListener('mousedown', handleMouseDown)
    return () => el.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const statusDotClass =
    connStatus === 'connected'
      ? 'status-online'
      : connStatus === 'disconnected'
        ? 'status-offline'
        : 'status-neutral'

  return (
    <div
      ref={titlebarRef}
      className="relative flex items-center justify-between select-none px-3"
      style={{
        height: '40px',
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* Left: Logo + App name */}
      <div className="flex items-center gap-2.5">
        <AuctorumLogo size={22} />
        <span
          className="text-sm font-semibold tracking-wide"
          style={{ color: 'var(--color-text-primary)' }}
        >
          AUCTORUM
        </span>
      </div>

      {/* Center: Connection status */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className={`status-dot-sm ${statusDotClass}`} />
        <span
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {hostname}
        </span>
        {connStatus === 'connected' && latencyMs !== null && (
          <span
            className="text-xs mono"
            style={{ color: 'var(--color-text-dim)' }}
          >
            {latencyMs}ms
          </span>
        )}
      </div>

      {/* Right: Theme + Window controls — must not be drag regions */}
      <div className="flex items-center gap-1" data-no-drag style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Theme cycle */}
        <button
          onClick={nextTheme}
          className="flex items-center justify-center cursor-pointer rounded-md transition-colors duration-150"
          title={`Theme: ${theme}`}
          style={{
            width: 32,
            height: 32,
            color: 'var(--color-text-dim)',
            background: 'transparent',
            border: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-bg-hover)'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-dim)'
          }}
        >
          <Palette size={14} />
        </button>

        {/* Window controls */}
        {isTauri && (
          <div className="flex ml-1">
            <button
              onClick={minimize}
              className="flex items-center justify-center cursor-pointer rounded-sm transition-colors duration-150"
              style={{
                width: 36,
                height: 32,
                color: 'var(--color-text-dim)',
                background: 'transparent',
                border: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-bg-hover)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-dim)'
              }}
            >
              <Minus size={14} />
            </button>
            <button
              onClick={toggleMaximize}
              className="flex items-center justify-center cursor-pointer rounded-sm transition-colors duration-150"
              style={{
                width: 36,
                height: 32,
                color: 'var(--color-text-dim)',
                background: 'transparent',
                border: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-bg-hover)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-dim)'
              }}
            >
              {isMaximized ? <Copy size={12} /> : <Square size={12} />}
            </button>
            <button
              onClick={close}
              className="flex items-center justify-center cursor-pointer rounded-sm transition-colors duration-150"
              style={{
                width: 36,
                height: 32,
                color: 'var(--color-text-dim)',
                background: 'transparent',
                border: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#e81123'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-dim)'
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Auctorum Logo Component ──────────────────────────────────
// Uses the actual logo PNG with transparent background for
// pixel-perfect accuracy.
function AuctorumLogo({ size = 24 }: { size?: number }) {
  return (
    <img
      src={logoUrl}
      alt="Auctorum"
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        imageRendering: 'auto',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      draggable={false}
    />
  )
}

export { AuctorumLogo }
