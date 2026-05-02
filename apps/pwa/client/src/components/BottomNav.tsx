import {
  Activity, Bot, Shield, Database, Code2, ScrollText,
  Network, MessageSquare, Settings
} from 'lucide-react'

export type PageId = 'dashboard' | 'ollama' | 'openclaw' | 'memory' | 'editor' | 'logs' | 'network' | 'sandbox' | 'settings'

const primaryNav: { id: PageId; icon: React.ComponentType<{size?: number}>; label: string }[] = [
  { id: 'dashboard', icon: Activity, label: 'Home' },
  { id: 'sandbox', icon: MessageSquare, label: 'Chat' },
  { id: 'ollama', icon: Bot, label: 'Ollama' },
  { id: 'network', icon: Network, label: 'Network' },
  { id: 'settings', icon: Settings, label: 'More' },
]

interface BottomNavProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
}

export function BottomNav({ activePage, onNavigate }: BottomNavProps) {
  const isActive = (id: PageId) => {
    if (id === 'settings') {
      return ['settings', 'openclaw', 'memory', 'editor', 'logs'].includes(activePage)
    }
    return activePage === id
  }

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {primaryNav.map(({ id, icon: Icon, label }) => {
          const active = isActive(id)
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="flex flex-col items-center gap-0.5 no-select tap-highlight"
              style={{
                flex: 1,
                padding: '4px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: active ? 'var(--color-accent)' : 'var(--color-text-dim)',
                transition: 'color 0.15s ease',
              }}
            >
              <Icon size={22} />
              <span style={{ fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
