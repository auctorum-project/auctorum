import { type ReactNode } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  if (!open) return null

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className={`bottom-sheet ${open ? '' : 'closed'}`}>
        <div className="bottom-sheet-handle" />
        {title && (
          <div className="px-4 pb-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {title}
            </span>
          </div>
        )}
        <div className="p-4">
          {children}
        </div>
      </div>
    </>
  )
}
