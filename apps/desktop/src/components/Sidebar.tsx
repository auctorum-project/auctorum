import {
  Activity, Bot, Shield, Database, Code2, ScrollText,
  Network, MessageSquare, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { AuctorumLogo } from '@/components/Titlebar'

export type PageId =
  | 'dashboard'
  | 'ollama'
  | 'openclaw'
  | 'memory'
  | 'editor'
  | 'logs'
  | 'network'
  | 'sandbox'
  | 'settings'

interface NavItem {
  id: PageId
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Activity size={18} /> },
  { id: 'ollama', label: 'Ollama', icon: <Bot size={18} /> },
  { id: 'openclaw', label: 'OpenClaw', icon: <Shield size={18} /> },
  { id: 'memory', label: 'Memory', icon: <Database size={18} /> },
  { id: 'editor', label: 'Editor', icon: <Code2 size={18} /> },
  { id: 'logs', label: 'Logs', icon: <ScrollText size={18} /> },
  { id: 'network', label: 'Network', icon: <Network size={18} /> },
  { id: 'sandbox', label: 'Sandbox', icon: <MessageSquare size={18} /> },
]

const settingsItem: NavItem = {
  id: 'settings',
  label: 'Settings',
  icon: <Settings size={18} />,
}

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const renderNavButton = (item: NavItem) => {
    const active = activePage === item.id
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className="group flex items-center gap-2.5 w-full text-left cursor-pointer relative"
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          marginLeft: '8px',
          marginRight: '8px',
          borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent',
          background: active ? 'var(--color-bg-hover)' : 'transparent',
          color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          if (!active) {
            e.currentTarget.style.background = 'var(--color-bg-hover)'
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }
        }}
      >
        <span className="flex-shrink-0" style={{ opacity: active ? 1 : 0.7 }}>
          {item.icon}
        </span>
        {!collapsed && (
          <span className="text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
            {item.label}
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      className="flex flex-col h-full flex-shrink-0"
      style={{
        width: collapsed ? 52 : 200,
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border)',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Logo area */}
      <div
        className="flex items-center gap-2.5 px-3 py-3 justify-center"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <AuctorumLogo size={collapsed ? 24 : 26} />
        {!collapsed && (
          <div className="flex flex-col">
            <span
              className="text-xs font-bold tracking-widest"
              style={{ color: 'var(--color-text-primary)', lineHeight: 1.2 }}
            >
              AUCTORUM
            </span>
            <span
              className="text-[10px] tracking-wider"
              style={{ color: 'var(--color-text-dim)', lineHeight: 1.2 }}
            >
              COMMAND CENTER
            </span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(item => renderNavButton(item))}
      </nav>

      {/* Separator + Settings */}
      <div className="flex flex-col gap-0.5 pb-1">
        <div
          className="mx-4 mb-1"
          style={{ height: '1px', background: 'var(--color-border)' }}
        />
        {renderNavButton(settingsItem)}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-2.5 cursor-pointer transition-colors duration-150"
        style={{
          color: 'var(--color-text-dim)',
          borderTop: '1px solid var(--color-border)',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-dim)')}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  )
}
