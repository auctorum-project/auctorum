import { useState } from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import { MobileHeader } from '@/components/MobileHeader'
import { BottomNav, type PageId } from '@/components/BottomNav'
import { DashboardPage } from '@/pages/DashboardPage'
import { OllamaPage } from '@/pages/OllamaPage'
import { OpenClawPage } from '@/pages/OpenClawPage'
import { MemoryPage } from '@/pages/MemoryPage'
import { EditorPage } from '@/pages/EditorPage'
import { LogsPage } from '@/pages/LogsPage'
import { NetworkPage } from '@/pages/NetworkPage'
import { SandboxPage } from '@/pages/SandboxPage'
import { SettingsPage } from '@/pages/SettingsPage'

function AppContent() {
  const [activePage, setActivePage] = useState<PageId>('dashboard')

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />
      case 'ollama': return <OllamaPage />
      case 'openclaw': return <OpenClawPage />
      case 'memory': return <MemoryPage />
      case 'editor': return <EditorPage />
      case 'logs': return <LogsPage />
      case 'network': return <NetworkPage />
      case 'sandbox': return <SandboxPage />
      case 'settings': return <SettingsPage onNavigate={setActivePage} />
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      <MobileHeader />
      <main className="flex-1 overflow-hidden relative" style={{ paddingBottom: 'calc(60px + var(--sab))' }}>
        {renderPage()}
      </main>
      <BottomNav activePage={activePage} onNavigate={setActivePage} />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
