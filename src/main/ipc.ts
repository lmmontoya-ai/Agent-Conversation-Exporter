import path from 'node:path'
import { dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import { countLines, isLargePreview } from '../shared/preview'
import type {
  AppSettings,
  ExportMode,
  ExportRequest,
  LoadSessionOptions,
  MarkdownPreviewResult,
  PreviewDetail,
  QuickExportResult,
  ScanResult,
  SessionSummary,
  SessionTranscript
} from '../shared/types'
import { getAllSessionIndexRecords, setSessionIndex } from './state/sessionIndex'
import { buildLatestQuickExportRequest, exportMarkdownFiles } from './services/exportService'
import { renderMarkdown } from './services/markdownRenderer'
import { parseSessionTranscript } from './services/sessionParser'
import { loadCodexGlobalState, scanSessionFiles } from './services/sessionScanner'
import { getSettings, updateSettings } from './services/settingsService'

let cachedSessions: SessionSummary[] = []
const transcriptCache = new Map<string, SessionTranscript>()
const markdownCache = new Map<string, ReturnType<typeof buildMarkdownBundle>>()
const sessionSignatures = new Map<string, string | undefined>()

const TRANSCRIPT_CACHE_LIMIT = 48
const MARKDOWN_CACHE_LIMIT = 96

function lruGet<T>(cache: Map<string, T>, key: string): T | undefined {
  const value = cache.get(key)
  if (value === undefined) return undefined
  cache.delete(key)
  cache.set(key, value)
  return value
}

function lruSet<T>(cache: Map<string, T>, key: string, value: T, limit: number): void {
  if (cache.has(key)) {
    cache.delete(key)
  }
  cache.set(key, value)
  if (cache.size <= limit) return
  const oldestKey = cache.keys().next().value as string | undefined
  if (oldestKey) {
    cache.delete(oldestKey)
  }
}

function invalidateSessionCaches(sessionId: string): void {
  for (const key of transcriptCache.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      transcriptCache.delete(key)
    }
  }
  for (const key of markdownCache.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      markdownCache.delete(key)
    }
  }
}

function buildMarkdownBundle(
  sessionId: string,
  title: string,
  markdown: string,
  warnings: string[],
  hasMore: boolean,
  truncated: boolean
) {
  const charCount = markdown.length
  const lineCount = countLines(markdown)

  return {
    sessionId,
    title,
    markdown,
    warnings,
    charCount,
    lineCount,
    isLargePreview: isLargePreview(charCount, lineCount),
    hasMore,
    truncated
  }
}

function buildTranscriptCacheKey(sessionId: string, mode: ExportMode, detail: PreviewDetail): string {
  return `${sessionId}:${mode}:${detail}`
}

function buildMarkdownCacheKey(sessionId: string, mode: ExportMode, detail: PreviewDetail): string {
  return `${sessionId}:${mode}:${detail}`
}

function matchWorkspaceRoot(cwd: string | undefined, roots: string[]): string | null {
  if (!cwd) return null
  for (const root of roots) {
    if (cwd === root || cwd.startsWith(root + '/') || cwd.startsWith(root + '\\')) {
      return path.basename(root)
    }
  }
  return null
}

async function scanSessions(): Promise<ScanResult> {
  const settings = getSettings()
  const [{ records, stats }, globalState] = await Promise.all([
    scanSessionFiles(settings.dataRoots),
    loadCodexGlobalState()
  ])

  const { threadTitles, workspaceRoots } = globalState

  for (const record of records) {
    // Apply Codex-assigned thread titles
    const codexTitle = threadTitles.get(record.sessionId)
    if (codexTitle) {
      record.summary.title = codexTitle
    }

    // Remap project names to workspace root basenames and tag membership
    if (workspaceRoots.length > 0) {
      const rootName = matchWorkspaceRoot(record.summary.cwd, workspaceRoots)
      if (rootName) {
        record.summary.projectName = rootName
        record.summary.inWorkspace = true
      }
    }
  }

  const nextSignatures = new Map<string, string | undefined>()
  for (const record of records) {
    nextSignatures.set(record.sessionId, record.fileSignature)
  }
  for (const [sessionId, previousSignature] of sessionSignatures.entries()) {
    const nextSignature = nextSignatures.get(sessionId)
    if (!nextSignature || nextSignature !== previousSignature) {
      invalidateSessionCaches(sessionId)
    }
  }
  sessionSignatures.clear()
  for (const [sessionId, signature] of nextSignatures.entries()) {
    sessionSignatures.set(sessionId, signature)
  }

  setSessionIndex(records)

  const sessions = records
    .map((record) => record.summary)
    .filter((session) => settings.includeArchived || !session.archived)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

  cachedSessions = sessions

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[sessions:scan] total=${stats.totalFiles} parsed=${stats.parsedFiles} cacheHits=${stats.cacheHits} durationMs=${stats.durationMs}`
    )
  }

  return { sessions }
}

async function getMarkdownBundle(
  sessionId: string,
  mode: ExportMode,
  detail: PreviewDetail = 'full'
) {
  const markdownCacheKey = buildMarkdownCacheKey(sessionId, mode, detail)
  const cachedMarkdownBundle = lruGet(markdownCache, markdownCacheKey)
  if (cachedMarkdownBundle) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[preview:load] session=${sessionId.slice(0, 8)} mode=${mode} detail=${detail} parseMs=0 renderMs=0 truncated=${cachedMarkdownBundle.truncated ? 'yes' : 'no'} cache=hit`
      )
    }
    return cachedMarkdownBundle
  }

  const transcriptCacheKey = buildTranscriptCacheKey(sessionId, mode, detail)
  let transcript = lruGet(transcriptCache, transcriptCacheKey)
  let parseMs = 0
  if (!transcript) {
    const parseStartedAt = Date.now()
    transcript = await parseSessionTranscript(sessionId, { mode, detail })
    parseMs = Date.now() - parseStartedAt
    lruSet(transcriptCache, transcriptCacheKey, transcript, TRANSCRIPT_CACHE_LIMIT)
  }

  const renderStartedAt = Date.now()
  const rendered = renderMarkdown(transcript, mode, { detail })
  const renderMs = Date.now() - renderStartedAt
  const bundle = buildMarkdownBundle(
    sessionId,
    transcript.title,
    rendered.markdown,
    transcript.warnings,
    rendered.hasMore,
    rendered.truncated
  )
  lruSet(markdownCache, markdownCacheKey, bundle, MARKDOWN_CACHE_LIMIT)

  if (process.env.NODE_ENV !== 'production') {
    console.info(
      `[preview:load] session=${sessionId.slice(0, 8)} mode=${mode} detail=${detail} parseMs=${parseMs} renderMs=${renderMs} truncated=${bundle.truncated ? 'yes' : 'no'} cache=miss`
    )
  }

  return bundle
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => getSettings())

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, (_, patch: Partial<AppSettings>) => {
    return updateSettings(patch)
  })

  ipcMain.handle(IPC_CHANNELS.SCAN_SESSIONS, async () => {
    return scanSessions()
  })

  ipcMain.handle(
    IPC_CHANNELS.LOAD_SESSION,
    async (_, sessionId: string, mode: ExportMode, options?: LoadSessionOptions) => {
      const detail = options?.detail ?? 'preview'
      const bundle = await getMarkdownBundle(sessionId, mode, detail)
      const result: MarkdownPreviewResult = {
        markdown: bundle.markdown,
        warnings: bundle.warnings,
        charCount: bundle.charCount,
        lineCount: bundle.lineCount,
        isLargePreview: bundle.isLargePreview,
        truncated: bundle.truncated,
        hasMore: bundle.hasMore
      }
      return result
    }
  )

  ipcMain.handle(IPC_CHANNELS.EXPORT_MARKDOWN, async (_, request: ExportRequest) => {
    const settings = getSettings()
    return exportMarkdownFiles(
      request,
      (sessionId, mode) => getMarkdownBundle(sessionId, mode, 'full'),
      settings.defaultExportDirectory
    )
  })

  ipcMain.handle(
    IPC_CHANNELS.QUICK_EXPORT_LATEST,
    async (_, mode: ExportMode): Promise<QuickExportResult> => {
      if (cachedSessions.length === 0) {
        await scanSessions()
      }

      const latest = cachedSessions[0] ?? getAllSessionIndexRecords()[0]?.summary
      if (!latest) {
        return { copied: false, warnings: ['No sessions found to export.'] }
      }

      const settings = getSettings()
      const request = buildLatestQuickExportRequest(latest, mode)
      const outputPath = path.join(
        settings.defaultExportDirectory,
        `${latest.sessionId.slice(0, 12)}_${new Date().toISOString().slice(0, 10)}.md`
      )

      const result = await exportMarkdownFiles(
        { ...request, destinationPath: outputPath },
        (sessionId, targetMode) => getMarkdownBundle(sessionId, targetMode, 'full'),
        settings.defaultExportDirectory
      )

      return {
        path: result.written[0],
        copied: result.copied,
        warnings: result.warnings
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PICK_EXPORT_PATH, async (_, kind: 'file' | 'directory') => {
    if (kind === 'directory') {
      const result = await dialog.showOpenDialog({
        title: 'Select export directory',
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }

    const result = await dialog.showSaveDialog({
      title: 'Export markdown',
      defaultPath: `codex_export_${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (result.canceled || !result.filePath) return null
    return result.filePath
  })
}
