const isTauri = !!(window as any).__TAURI_INTERNALS__

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export { isTauri }
