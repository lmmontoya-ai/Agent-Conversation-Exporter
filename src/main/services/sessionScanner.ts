import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import fg from 'fast-glob'
import type { SessionSource, SessionSummary } from '../../shared/types'
import { forEachJsonLine } from './jsonl'
import type { SessionIndexRecord } from '../state/sessionIndex'
import { stripSystemXml } from './textCleaner'
import {
  flushSessionScanCache,
  getCachedSessionSummary,
  pruneSessionScanCache,
  setCachedSessionSummary
} from './sessionScanCache'

interface RawEntry {
  timestamp?: string
  type?: string
  payload?: Record<string, unknown>
}

interface HistoryEntry {
  session_id?: string
  ts?: number
  text?: string
}

export interface SessionScanStats {
  totalFiles: number
  parsedFiles: number
  cacheHits: number
  durationMs: number
}

export interface ScanSessionFilesResult {
  records: SessionIndexRecord[]
  stats: SessionScanStats
}

const homeDir = os.homedir()
const homeBase = path.basename(homeDir)
const genericProjectBases = new Set([homeBase, '.codex', 'codex', '.', ''])

function normalizeSegment(value: string): string {
  return value.trim().replace(/^[./\\]+|[./\\]+$/g, '')
}

function extractRepositoryName(repositoryUrl: string | undefined): string | null {
  if (!repositoryUrl) return null
  const normalized = normalizeSegment(repositoryUrl)
  if (!normalized) return null

  const slashIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf(':'))
  const tail = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized
  const cleaned = normalizeSegment(tail.replace(/\.git$/i, ''))
  return cleaned || null
}

function deriveProjectName(cwd: string | undefined, repositoryUrl: string | undefined): string {
  const repositoryName = extractRepositoryName(repositoryUrl)
  if (!cwd) return repositoryName ?? 'Unknown'

  const normalized = cwd.replace(/[\\/]+$/, '')
  const base = path.basename(normalized)
  if (!base || base === '.' || base === path.sep) return repositoryName ?? 'Unknown'
  if (normalized === homeDir || genericProjectBases.has(base)) {
    return repositoryName ?? 'Unknown'
  }
  return base
}

function safeIso(value: unknown, fallback: string): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString()
  }
  return fallback
}

function toFileSignature(stats: { size: number; mtimeMs: number }): string {
  return `${stats.size}:${Math.trunc(stats.mtimeMs)}`
}

function classifySource(source: unknown, originator: unknown): SessionSource {
  const sourceText = String(source ?? '').toLowerCase()
  const originText = String(originator ?? '').toLowerCase()

  if (sourceText === 'cli' || originText.includes('codex_cli')) {
    return 'cli'
  }

  if (originText.includes('codex desktop') || sourceText === 'vscode') {
    return 'desktop'
  }

  return 'other'
}

function extractMessageText(content: unknown): string {
  if (!Array.isArray(content)) return ''

  const chunks: string[] = []
  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const typed = item as Record<string, unknown>
    const type = String(typed.type ?? '')
    if (type === 'input_text' || type === 'output_text') {
      const text = String(typed.text ?? '').trim()
      if (text) chunks.push(text)
    } else if (type === 'input_image' || type === 'image') {
      chunks.push('[Image]')
    }
  }

  return chunks.join('\n\n').trim()
}

function fallbackSessionIdFromFilename(filePath: string): string {
  const base = path.basename(filePath, '.jsonl')
  const maybeId = base.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0]
  return maybeId ?? base
}

async function parseSessionFileSummary(
  filePath: string,
  archived: boolean,
  stats: { birthtime: Date; mtime: Date; size: number; mtimeMs: number }
): Promise<SessionIndexRecord | null> {
  let sessionId = fallbackSessionIdFromFilename(filePath)
  let source: SessionSource = 'other'
  let cwd: string | undefined
  let repositoryUrl: string | undefined
  let createdAt = stats.birthtime.toISOString()
  let updatedAt = stats.mtime.toISOString()
  let messageCount = 0
  let title = ''

  await forEachJsonLine<RawEntry>(filePath, (entry) => {
    const entryType = entry.type ?? ''
    const timestamp = safeIso(entry.timestamp, updatedAt)
    if (timestamp > updatedAt) updatedAt = timestamp

    if (entryType === 'session_meta') {
      const payload = entry.payload ?? {}
      sessionId = String(payload.id ?? sessionId)
      source = classifySource(payload.source, payload.originator)
      cwd = typeof payload.cwd === 'string' ? payload.cwd : cwd
      const gitPayload =
        payload.git && typeof payload.git === 'object'
          ? (payload.git as Record<string, unknown>)
          : undefined
      repositoryUrl =
        typeof gitPayload?.repository_url === 'string' ? gitPayload.repository_url : repositoryUrl
      createdAt = safeIso(payload.timestamp, createdAt)
      return
    }

    if (entryType === 'response_item') {
      const payload = (entry.payload ?? {}) as Record<string, unknown>
      if (payload.type !== 'message') return
      const role = String(payload.role ?? '')
      if (role !== 'user' && role !== 'assistant') return
      messageCount += 1
      if (!title && role === 'user') {
        const cleaned = stripSystemXml(extractMessageText(payload.content))
        if (cleaned) title = cleaned.slice(0, 80)
      }
    }
  })

  const summary: SessionSummary = {
    sessionId,
    filePath,
    source,
    createdAt,
    updatedAt,
    cwd,
    projectName: deriveProjectName(cwd, repositoryUrl),
    title,
    messageCount,
    partial: false,
    archived,
    inWorkspace: false
  }

  return {
    sessionId,
    kind: 'session_file',
    filePath,
    fileSignature: toFileSignature(stats),
    summary
  }
}

async function parseHistoryFallbacks(
  historyPath: string,
  existingSessionIds: Set<string>,
  fileSignature: string | undefined
): Promise<SessionIndexRecord[]> {
  const groups = new Map<
    string,
    {
      createdAt: string
      updatedAt: string
      messageCount: number
      title: string
    }
  >()

  await forEachJsonLine<HistoryEntry>(historyPath, (entry) => {
    if (!entry.session_id || existingSessionIds.has(entry.session_id)) return

    const tsIso = safeIso(entry.ts, new Date(0).toISOString())
    const group = groups.get(entry.session_id)

    if (!group) {
      groups.set(entry.session_id, {
        createdAt: tsIso,
        updatedAt: tsIso,
        messageCount: 1,
        title: String(entry.text ?? '').slice(0, 80)
      })
      return
    }

    group.messageCount += 1
    if (tsIso < group.createdAt) group.createdAt = tsIso
    if (tsIso > group.updatedAt) group.updatedAt = tsIso
    if (!group.title && entry.text) group.title = entry.text.slice(0, 80)
  })

  const records: SessionIndexRecord[] = []
  for (const [sessionId, group] of groups) {
    records.push({
      sessionId,
      kind: 'history_fallback',
      filePath: historyPath,
      fileSignature,
      summary: {
        sessionId,
        filePath: historyPath,
        source: 'other',
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        projectName: 'Unknown',
        title: group.title,
        messageCount: group.messageCount,
        partial: true,
        archived: false,
        inWorkspace: false
      }
    })
  }

  return records
}

function choosePreferredSummary(
  existing: SessionIndexRecord,
  incoming: SessionIndexRecord
): SessionIndexRecord {
  if (!existing.summary.partial && incoming.summary.partial) return existing
  if (existing.summary.partial && !incoming.summary.partial) return incoming
  return incoming.summary.updatedAt > existing.summary.updatedAt ? incoming : existing
}

async function resolveJsonlFiles(rootPath: string): Promise<string[]> {
  const stat = await fs.stat(rootPath)
  if (stat.isFile()) return [rootPath]
  if (!stat.isDirectory()) return []

  return fg('**/*.jsonl', {
    cwd: rootPath,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false
  })
}

interface CodexGlobalState {
  threadTitles: Map<string, string>
  workspaceRoots: string[]
}

export async function loadCodexGlobalState(): Promise<CodexGlobalState> {
  const globalStatePath = path.join(os.homedir(), '.codex', '.codex-global-state.json')
  try {
    const raw = await fs.readFile(globalStatePath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>

    const threadTitlesSection = parsed['thread-titles'] as
      | { titles?: Record<string, string> }
      | undefined
    const threadTitles = threadTitlesSection?.titles
      ? new Map(Object.entries(threadTitlesSection.titles))
      : new Map<string, string>()

    const savedRoots = parsed['electron-saved-workspace-roots']
    const workspaceRoots = Array.isArray(savedRoots)
      ? savedRoots.filter((r): r is string => typeof r === 'string')
      : []

    return { threadTitles, workspaceRoots }
  } catch {
    return { threadTitles: new Map(), workspaceRoots: [] }
  }
}

export async function scanSessionFiles(dataRoots: string[]): Promise<ScanSessionFilesResult> {
  const startedAt = Date.now()
  const bySessionId = new Map<string, SessionIndexRecord>()
  const normalizedRoots = Array.from(new Set(dataRoots.filter(Boolean)))
  const seenFilePaths = new Set<string>()
  const stats: SessionScanStats = {
    totalFiles: 0,
    parsedFiles: 0,
    cacheHits: 0,
    durationMs: 0
  }

  for (const root of normalizedRoots) {
    const absoluteRoot = path.resolve(root)
    const baseName = path.basename(absoluteRoot)

    if (baseName === 'history.jsonl') {
      continue
    }

    let files: string[] = []
    try {
      files = await resolveJsonlFiles(absoluteRoot)
    } catch {
      continue
    }

    stats.totalFiles += files.length

    for (const filePath of files) {
      if (path.basename(filePath) === 'history.jsonl') continue
      const absoluteFilePath = path.resolve(filePath)
      seenFilePaths.add(absoluteFilePath)

      let fileStats: { birthtime: Date; mtime: Date; size: number; mtimeMs: number }
      try {
        const stat = await fs.stat(absoluteFilePath)
        fileStats = {
          birthtime: stat.birthtime,
          mtime: stat.mtime,
          size: stat.size,
          mtimeMs: stat.mtimeMs
        }
      } catch {
        continue
      }

      const fileSignature = toFileSignature(fileStats)
      const archived =
        absoluteRoot.includes('archived_sessions') || absoluteFilePath.includes('archived_sessions')

      const cachedSummary = getCachedSessionSummary(absoluteFilePath, fileSignature)
      const parsed =
        cachedSummary !== null
          ? ({
              sessionId: cachedSummary.sessionId,
              kind: 'session_file',
              filePath: absoluteFilePath,
              fileSignature,
              summary: {
                ...cachedSummary,
                filePath: absoluteFilePath,
                archived,
                inWorkspace: false
              }
            } as SessionIndexRecord)
          : await parseSessionFileSummary(absoluteFilePath, archived, fileStats)

      if (!parsed) continue

      if (cachedSummary !== null) {
        stats.cacheHits += 1
      } else {
        stats.parsedFiles += 1
        setCachedSessionSummary(absoluteFilePath, fileSignature, parsed.summary)
      }

      const existing = bySessionId.get(parsed.sessionId)
      bySessionId.set(
        parsed.sessionId,
        existing ? choosePreferredSummary(existing, parsed) : parsed
      )
    }
  }

  const existingSessionIds = new Set(bySessionId.keys())
  for (const root of normalizedRoots) {
    const absoluteRoot = path.resolve(root)
    const isHistoryRoot = path.basename(absoluteRoot) === 'history.jsonl'
    if (!isHistoryRoot) continue

    let historySignature: string | undefined
    try {
      const stat = await fs.stat(absoluteRoot)
      historySignature = toFileSignature({ size: stat.size, mtimeMs: stat.mtimeMs })
    } catch {
      historySignature = undefined
    }

    const historyRecords = await parseHistoryFallbacks(
      absoluteRoot,
      existingSessionIds,
      historySignature
    )
    for (const record of historyRecords) {
      const existing = bySessionId.get(record.sessionId)
      bySessionId.set(
        record.sessionId,
        existing ? choosePreferredSummary(existing, record) : record
      )
    }
  }

  pruneSessionScanCache(seenFilePaths)
  flushSessionScanCache()

  const records = Array.from(bySessionId.values()).sort((a, b) =>
    a.summary.updatedAt < b.summary.updatedAt ? 1 : -1
  )

  stats.durationMs = Date.now() - startedAt

  return { records, stats }
}
