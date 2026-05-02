import { useTheme, type ThemeName } from '@/context/ThemeContext'
import { Palette } from 'lucide-react'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

type ConnectionStatus = 'connected' | 'disconnected' | 'checking'

export function MobileHeader() {
  const { theme, setTheme } = useTheme()
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  const [latency, setLatency] = useState<number | null>(null)

  const themes: ThemeName[] = ['dracula', 'monokai', 'matrix', 'nord']
  const nextTheme = () => {
    const idx = themes.indexOf(theme)
    setTheme(themes[(idx + 1) % themes.length])
  }

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api<{ ok: boolean; latency: number }>('/system/test')
        setStatus(res.ok ? 'connected' : 'disconnected')
        setLatency(res.latency ?? null)
      } catch {
        setStatus('disconnected')
        setLatency(null)
      }
    }
    check()
    const iv = setInterval(check, 15000)
    return () => clearInterval(iv)
  }, [])

  const dotClass = status === 'connected' ? 'status-online' : status === 'disconnected' ? 'status-offline' : 'status-neutral'

  return (
    <div
      className="flex items-center justify-between px-4 no-select"
      style={{
        height: 48,
        paddingTop: 'var(--sat)',
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-2">
        <AuctorumLogo size={22} />
        <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
          AUCTORUM
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`status-dot-sm ${dotClass}`} />
        {status === 'connected' && latency && (
          <span className="mono" style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
            {latency}ms
          </span>
        )}
        <button
          onClick={nextTheme}
          className="tap-highlight"
          style={{
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: 'none', border: 'none',
            color: 'var(--color-text-dim)', cursor: 'pointer',
          }}
        >
          <Palette size={16} />
        </button>
      </div>
    </div>
  )
}

export function AuctorumLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M222 218 C168 180 90 125 50 90 C80 115 162 168 218 204Z" fill="var(--color-accent)" />
      <path d="M230 225 C185 196 118 148 82 122 C108 140 178 186 226 214Z" fill="var(--color-accent)" opacity="0.55" />
      <path d="M290 218 C344 180 422 125 462 90 C432 115 350 168 294 204Z" fill="var(--color-accent)" />
      <path d="M282 225 C327 196 394 148 430 122 C404 140 334 186 286 214Z" fill="var(--color-accent)" opacity="0.55" />
      <path fillRule="evenodd" d="M256 82 L275 126 L256 168 L237 126Z M256 102 L267 126 L256 150 L245 126Z" fill="currentColor" />
      <path d="M237 160 C228 180 216 200 216 218 C216 236 234 262 244 284 L242 322 C238 350 226 380 222 408 L246 386 C252 358 255 340 256 326 C257 340 260 358 266 386 L290 408 C286 380 274 350 270 322 L268 284 C278 262 296 236 296 218 C296 200 284 180 275 160 L256 168Z" fill="currentColor" />
    </svg>
  )
}
