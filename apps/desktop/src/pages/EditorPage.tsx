import { useState, useEffect, useRef, useMemo } from 'react'
import { tauriInvoke, isTauri } from '@/lib/tauri'
import { formatBytes } from '@/lib/utils'
import {
  FileCode, Folder, FolderOpen, File, FileText, Save, RotateCw,
  ChevronRight, ChevronDown, Circle, Check, AlertCircle
} from 'lucide-react'

interface FileNode {
  name: string
  path: string
  is_dir: boolean
  children: FileNode[] | null
  size: number
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
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [modified, setModified] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const fetchTree = async () => {
    try {
      const t = isTauri
        ? await tauriInvoke<FileNode>('get_workspace_tree')
        : {
            name: 'workspace', path: '/home/user/.openclaw/workspace', is_dir: true, size: 0, children: [
              { name: 'AGENTS.md', path: '/home/user/.openclaw/workspace/AGENTS.md', is_dir: false, size: 2048, children: null },
              { name: 'morning_routine.sh', path: '/home/user/.openclaw/workspace/morning_routine.sh', is_dir: false, size: 512, children: null },
              { name: 'memory.py', path: '/home/user/.openclaw/workspace/memory.py', is_dir: false, size: 1024, children: null },
              { name: 'config.json', path: '/home/user/.openclaw/workspace/config.json', is_dir: false, size: 384, children: null },
              { name: 'scripts', path: '/home/user/.openclaw/workspace/scripts', is_dir: true, size: 0, children: [
                { name: 'backup.sh', path: '/home/user/.openclaw/workspace/scripts/backup.sh', is_dir: false, size: 256, children: null },
                { name: 'deploy.py', path: '/home/user/.openclaw/workspace/scripts/deploy.py', is_dir: false, size: 768, children: null },
              ]},
              { name: 'prompts', path: '/home/user/.openclaw/workspace/prompts', is_dir: true, size: 0, children: [
                { name: 'system.md', path: '/home/user/.openclaw/workspace/prompts/system.md', is_dir: false, size: 4096, children: null },
              ]},
            ]
          } as FileNode
      setTree(t)
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) })
    }
  }

  useEffect(() => { fetchTree() }, [])

  const openFile = async (path: string) => {
    try {
      const content = isTauri
        ? await tauriInvoke<string>('read_workspace_file', { path })
        : '# Agent Configuration\n\nThis is a mock file for browser preview.\n\n## Instructions\nEdit agent behavior here.\n\n## Parameters\n- model: llama3.1:70b\n- temperature: 0.7\n- max_tokens: 4096\n\n## Memory\nThe agent maintains persistent memory in SQLite.\nEntries are key-value pairs with source attribution.\n\n## Routines\n- morning_routine: 08:00 daily\n- evening_summary: 22:00 daily\n- heartbeat: every 5 minutes'
      setSelectedFile(path)
      setFileContent(content || '')
      setModified(false)
      setStatus(null)
    } catch (e) {
      setStatus({ type: 'error', msg: String(e) })
    }
  }

  const saveFile = async () => {
    if (!selectedFile || !modified) return
    setSaving(true)
    try {
      if (isTauri) {
        await tauriInvoke('write_workspace_file', { path: selectedFile, content: fileContent })
      }
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
      if (isTauri) {
        await tauriInvoke('write_workspace_file', { path: selectedFile, content: fileContent })
      }
      setModified(false)
      try {
        if (isTauri) {
          const result = await tauriInvoke<string>('openclaw_restart')
          setStatus({ type: 'success', msg: result || 'Saved and restarted OpenClaw' })
        } else {
          setStatus({ type: 'success', msg: 'Saved and restarted OpenClaw (simulated)' })
        }
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

  const fileName = selectedFile?.split('/').pop() || selectedFile?.split('\\').pop() || ''
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
    <div className="flex h-full animate-fade-in">
      {/* ── File tree sidebar ── */}
      <div
        className="flex-shrink-0 h-full overflow-y-auto flex flex-col"
        style={{
          width: '240px',
          background: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <div
          className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <Folder size={14} style={{ color: 'var(--color-text-dim)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Workspace
          </span>
        </div>
        {tree ? (
          <div className="py-1 flex-1 overflow-y-auto">
            <TreeNode node={tree} depth={0} onSelect={openFile} selectedPath={selectedFile} />
          </div>
        ) : (
          <div className="px-4 py-6 text-xs" style={{ color: 'var(--color-text-dim)' }}>
            Loading workspace...
          </div>
        )}
      </div>

      {/* ── Editor area ── */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2.5">
            {selectedFile ? (
              <>
                <FileIcon filename={fileName} size={14} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {fileName}
                </span>
                {lang && (
                  <span className="badge badge-dim">{lang}</span>
                )}
                {modified && (
                  <Circle
                    size={8}
                    fill="var(--color-yellow)"
                    stroke="var(--color-yellow)"
                    style={{ flexShrink: 0 }}
                  />
                )}
              </>
            ) : (
              <span className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                No file selected
              </span>
            )}
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2">
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
                Save & restart
              </button>
            </div>
          )}
        </div>

        {/* Status bar */}
        {status && (
          <div
            className="flex items-center gap-2 px-4 py-2 text-xs animate-fade-in flex-shrink-0"
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
            {status.msg}
          </div>
        )}

        {/* Editor or empty state */}
        {selectedFile ? (
          <div className="flex-1 flex min-h-0" style={{ background: 'var(--color-bg-primary)' }}>
            {/* Line numbers gutter */}
            <div
              ref={lineNumbersRef}
              className="flex-shrink-0 overflow-hidden select-none py-3 pr-3"
              style={{
                width: '48px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: '1.65',
                color: 'var(--color-text-dim)',
                background: 'var(--color-bg-secondary)',
                borderRight: '1px solid var(--color-border-dim)',
                textAlign: 'right',
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1} style={{ height: '19.8px' }}>
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
              className="flex-1 w-full outline-none py-3 px-4"
              style={{
                resize: 'none',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
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
                Browse the workspace tree on the left. Ctrl+S to save, Tab to indent.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Recursive Tree Node ── */

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

  if (node.is_dir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full py-[5px] text-left transition-colors cursor-pointer"
          style={{
            paddingLeft: `${depth * 14 + 12}px`,
            paddingRight: '8px',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
            background: 'transparent',
            border: 'none',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
      className="flex items-center gap-1.5 w-full py-[5px] text-left transition-colors cursor-pointer"
      style={{
        paddingLeft: `${depth * 14 + 26}px`,
        paddingRight: '8px',
        color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        background: isSelected ? 'var(--color-bg-active)' : 'transparent',
        fontSize: '13px',
        border: 'none',
        fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'var(--color-bg-active)' : 'transparent' }}
    >
      <FileIcon filename={node.name} size={14} />
      <span className="truncate">{node.name}</span>
      {node.size > 0 && (
        <span
          className="ml-auto text-[10px] flex-shrink-0"
          style={{ color: 'var(--color-text-dim)' }}
        >
          {formatBytes(node.size)}
        </span>
      )}
    </button>
  )
}
