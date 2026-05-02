import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '@/lib/api'
import {
  FileCode, Folder, FolderOpen, File, FileText, Save, RotateCw,
  ChevronRight, ChevronDown, Circle, Check, AlertCircle, X
} from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

function getFileIconColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'py': return 'var(--color-yellow)'
    case 'sh': case 'bash': return 'var(--color-green)'
    case 'md': case 'txt': return 'var(--color-accent)'
    case 'json': return 'var(--color-orange)'
    case 'yaml': case 'yml': return 'var(--color-pink)'
    case 'js': case 'jsx': return 'var(--color-yellow)'
    case 'ts': case 'tsx': return 'var(--color-cyan)'
    default: return 'var(--color-text-dim)'
  }
}

function FileIcon({ filename, size = 13 }: { filename: string; size?: number }) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const color = getFileIconColor(filename)
  switch (ext) {
    case 'py':
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'sh':
    case 'bash':
      return <FileCode size={size} style={{ color }} />
    case 'md':
    case 'txt':
      return <FileText size={size} style={{ color }} />
    default:
      return <File size={size} style={{ color }} />
  }
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md': return 'markdown'
    case 'sh': return 'shell'
    case 'py': return 'python'
    case 'js': return 'javascript'
    case 'ts': return 'typescript'
    case 'json': return 'json'
    case 'yaml': case 'yml': return 'yaml'
    default: return 'plaintext'
  }
}

export function EditorPage() {
  const [tree, setTree] = useState<FileNode | null>(null)
  const [treeOpen, setTreeOpen] = useState(true)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [modified, setModified] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const fetchTree = async () => {
    try {
      const t = await api<FileNode>('/editor/tree')
      setTree(t)
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) })
    }
  }

  useEffect(() => { fetchTree() }, [])

  const openFile = async (path: string) => {
    try {
      const result = await api<{ path: string; content: string }>(`/editor/file?path=${encodeURIComponent(path)}`)
      setSelectedFile(path)
      setFileContent(result.content || '')
      setModified(false)
      setStatus(null)
      // On mobile, collapse tree when file is selected
      setTreeOpen(false)
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) })
    }
  }

  const saveFile = async () => {
    if (!selectedFile || !modified) return
    setSaving(true)
    try {
      await api('/editor/file', {
        method: 'POST',
        body: JSON.stringify({ path: selectedFile, content: fileContent }),
      })
      setModified(false)
      setStatus({ type: 'success', msg: 'File saved successfully' })
      setTimeout(() => setStatus(null), 2500)
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) })
    } finally {
      setSaving(false)
    }
  }

  const saveAndRestart = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await api('/editor/file', {
        method: 'POST',
        body: JSON.stringify({ path: selectedFile, content: fileContent }),
      })
      setModified(false)
      try {
        await api('/openclaw/restart', { method: 'POST' })
        setStatus({ type: 'success', msg: 'Saved and restarted OpenClaw' })
      } catch (e) {
        setStatus({ type: 'error', msg: String(e) })
      }
      setTimeout(() => setStatus(null), 3000)
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) })
    } finally {
      setSaving(false)
    }
  }

  const fileName = selectedFile?.split('/').pop() || ''
  const lang = fileName ? getLanguage(fileName) : ''

  const lineCount = useMemo(() => {
    if (!fileContent) return 1
    return fileContent.split('\n').length
  }, [fileContent])

  const handleEditorScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedFile ? (
            <>
              <FileIcon filename={fileName} size={14} />
              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {fileName}
              </span>
              {lang && (
                <span className="badge badge-dim flex-shrink-0" style={{ fontSize: 10 }}>{lang}</span>
              )}
              {modified && (
                <Circle size={8} fill="var(--color-yellow)" stroke="var(--color-yellow)" style={{ flexShrink: 0 }} />
              )}
            </>
          ) : (
            <span className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
              No file selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setTreeOpen(!treeOpen)}
            className="btn btn-ghost btn-sm"
            style={{ padding: 4 }}
          >
            <Folder size={14} />
          </button>
          {selectedFile && (
            <>
              <button
                onClick={saveFile}
                disabled={saving || !modified}
                className="btn btn-primary btn-sm"
              >
                <Save size={12} />
                Save
              </button>
              <button
                onClick={saveAndRestart}
                disabled={saving}
                className="btn btn-secondary btn-sm"
              >
                <RotateCw size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      {status && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-xs animate-fade-in flex-shrink-0"
          style={{
            background: status.type === 'success'
              ? 'color-mix(in srgb, var(--color-green) 8%, var(--color-bg-secondary))'
              : 'color-mix(in srgb, var(--color-red) 8%, var(--color-bg-secondary))',
            borderBottom: '1px solid var(--color-border-dim)',
            color: status.type === 'success' ? 'var(--color-green)' : 'var(--color-red)',
          }}
        >
          {status.type === 'success'
            ? <Check size={13} style={{ flexShrink: 0 }} />
            : <AlertCircle size={13} style={{ flexShrink: 0 }} />
          }
          <span className="flex-1 truncate">{status.msg}</span>
          <button onClick={() => setStatus(null)} className="btn btn-ghost btn-sm" style={{ padding: 2 }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Collapsible file tree (mobile-adapted: top section instead of sidebar) */}
      {treeOpen && (
        <div
          className="flex-shrink-0 overflow-y-auto animate-fade-in"
          style={{
            maxHeight: '40vh',
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border-dim)' }}>
            <Folder size={13} style={{ color: 'var(--color-text-dim)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Workspace</span>
          </div>
          {tree ? (
            <div className="py-1">
              <TreeNode node={tree} depth={0} onSelect={openFile} selectedPath={selectedFile} />
            </div>
          ) : (
            <div className="px-3 py-4 text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Loading workspace...
            </div>
          )}
        </div>
      )}

      {/* Editor or empty state */}
      {selectedFile ? (
        <div className="flex-1 flex min-h-0" style={{ background: 'var(--color-bg-primary)' }}>
          {/* Line numbers gutter */}
          <div
            ref={lineNumbersRef}
            className="flex-shrink-0 overflow-hidden select-none py-3 pr-2"
            style={{
              width: '40px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              lineHeight: '1.65',
              color: 'var(--color-text-dim)',
              background: 'var(--color-bg-secondary)',
              borderRight: '1px solid var(--color-border-dim)',
              textAlign: 'right',
            }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1} style={{ height: '18.15px' }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={fileContent}
            onChange={e => { setFileContent(e.target.value); setModified(true) }}
            onScroll={handleEditorScroll}
            spellCheck={false}
            className="flex-1 w-full outline-none py-3 px-3"
            style={{
              resize: 'none',
              background: 'transparent',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              lineHeight: '1.65',
              tabSize: 2,
              border: 'none',
            }}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                saveFile()
              }
              if (e.key === 'Tab') {
                e.preventDefault()
                const start = e.currentTarget.selectionStart
                const end = e.currentTarget.selectionEnd
                const value = e.currentTarget.value
                setFileContent(value.substring(0, start) + '  ' + value.substring(end))
                requestAnimationFrame(() => {
                  if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2
                  }
                })
              }
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileCode size={24} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
              Select a file to begin editing
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-dim)', opacity: 0.6 }}>
              Tap the folder icon to browse the workspace.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* Recursive Tree Node */

function TreeNode({
  node,
  depth,
  onSelect,
  selectedPath,
}: {
  node: FileNode
  depth: number
  onSelect: (path: string) => void
  selectedPath: string | null
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isSelected = node.path === selectedPath

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full py-[6px] text-left tap-highlight"
          style={{
            paddingLeft: `${depth * 14 + 12}px`,
            paddingRight: '8px',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {expanded
            ? <ChevronDown size={11} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
            : <ChevronRight size={11} style={{ color: 'var(--color-text-dim)', flexShrink: 0 }} />
          }
          {expanded
            ? <FolderOpen size={14} style={{ color: 'var(--color-yellow)', flexShrink: 0 }} />
            : <Folder size={14} style={{ color: 'var(--color-yellow)', flexShrink: 0 }} />
          }
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onSelect={onSelect} selectedPath={selectedPath} />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className="flex items-center gap-1.5 w-full py-[6px] text-left tap-highlight"
      style={{
        paddingLeft: `${depth * 14 + 26}px`,
        paddingRight: '8px',
        color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        background: isSelected ? 'var(--color-bg-active)' : 'transparent',
        fontSize: '13px',
        border: 'none',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <FileIcon filename={node.name} size={14} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}
