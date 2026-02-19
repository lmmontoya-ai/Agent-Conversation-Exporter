import path from 'node:path'
import Store from 'electron-store'
import type { SessionSummary } from '../../shared/types'

interface CachedSessionSummary {
  signature: string
  summary: SessionSummary
}

interface SessionScanCacheSchema {
  entries: Record<string, CachedSessionSummary>
}

const StoreCtor = ((Store as unknown as { default?: typeof Store }).default ??
  Store) as typeof Store

const cacheStore = new StoreCtor<SessionScanCacheSchema>({
  name: 'session-scan-cache',
  defaults: { entries: {} }
})

const cachedEntries = new Map<string, CachedSessionSummary>(
  Object.entries(cacheStore.get('entries') ?? {})
)

let dirty = false

function normalizeFilePath(filePath: string): string {
  return path.resolve(filePath)
}

function cloneSummary(summary: SessionSummary): SessionSummary {
  return { ...summary }
}

export function getCachedSessionSummary(
  filePath: string,
  signature: string
): SessionSummary | null {
  const key = normalizeFilePath(filePath)
  const cached = cachedEntries.get(key)
  if (!cached || cached.signature !== signature) {
    return null
  }

  return cloneSummary(cached.summary)
}

export function setCachedSessionSummary(
  filePath: string,
  signature: string,
  summary: SessionSummary
): void {
  const key = normalizeFilePath(filePath)
  cachedEntries.set(key, {
    signature,
    summary: cloneSummary(summary)
  })
  dirty = true
}

export function pruneSessionScanCache(validFilePaths: Set<string>): void {
  for (const key of cachedEntries.keys()) {
    if (!validFilePaths.has(key)) {
      cachedEntries.delete(key)
      dirty = true
    }
  }
}

export function flushSessionScanCache(): void {
  if (!dirty) return
  cacheStore.set('entries', Object.fromEntries(cachedEntries.entries()))
  dirty = false
}
