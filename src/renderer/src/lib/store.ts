import { create } from 'zustand'
import type {
  AppSettings,
  ExportMode,
  SessionSource,
  SessionSummary
} from '../../../shared/types'
import { clampPaneWidths } from './ui-preferences'

interface CodexStore {
  settings: AppSettings | null
  sessions: SessionSummary[]
  mode: ExportMode
  selectedSessionId: string | null
  selectedSessionIds: string[]
  previewMarkdown: string
  previewWarnings: string[]
  isLoading: boolean
  isExporting: boolean
  searchQuery: string
  sourceFilters: Set<SessionSource>
  includeRemoved: boolean
  statusNotice: string | null
  errorNotice: string | null
  init: () => Promise<void>
  refreshSessions: () => Promise<void>
  completeOnboarding: () => Promise<void>
  setSearchQuery: (query: string) => void
  toggleSourceFilter: (source: SessionSource) => void
  setIncludeRemoved: (include: boolean) => void
  setMode: (mode: ExportMode) => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  toggleBatchSession: (sessionId: string) => void
  clearBatchSelection: () => void
  exportCurrentToFile: () => Promise<void>
  copyCurrentToClipboard: () => Promise<void>
  exportBatchToDirectory: () => Promise<void>
  quickExportLatest: () => Promise<void>
  addDataRoot: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  setPaneWidths: (left: number, right: number) => Promise<void>
  clearStatus: () => void
}

async function loadPreview(sessionId: string, mode: ExportMode) {
  return window.codexExporter.loadSession(sessionId, mode, { detail: 'full' })
}

function applyError(set: (partial: Partial<CodexStore>) => void, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error'
  set({ errorNotice: message, isLoading: false, isExporting: false })
}

export const useCodexStore = create<CodexStore>((set, get) => ({
  settings: null,
  sessions: [],
  mode: 'clean',
  selectedSessionId: null,
  selectedSessionIds: [],
  previewMarkdown: '',
  previewWarnings: [],
  isLoading: false,
  isExporting: false,
  searchQuery: '',
  sourceFilters: new Set<SessionSource>(['desktop']),
  includeRemoved: false,
  statusNotice: null,
  errorNotice: null,
  init: async () => {
    set({ isLoading: true, errorNotice: null })
    try {
      const settings = await window.codexExporter.getSettings()
      const scan = await window.codexExporter.scanSessions()
      const firstSession = scan.sessions[0]
      let previewMarkdown = ''
      let previewWarnings: string[] = []

      if (firstSession) {
        const preview = await loadPreview(firstSession.sessionId, settings.defaultExportMode)
        previewMarkdown = preview.markdown
        previewWarnings = preview.warnings
      }

      // Silently mark onboarding complete for existing users who already have sessions
      const nextSettings =
        scan.sessions.length > 0 && !settings.hasCompletedOnboarding
          ? await window.codexExporter.updateSettings({ hasCompletedOnboarding: true })
          : settings

      set({
        settings: nextSettings,
        sessions: scan.sessions,
        mode: settings.defaultExportMode,
        selectedSessionId: firstSession?.sessionId ?? null,
        previewMarkdown,
        previewWarnings,
        isLoading: false,
        selectedSessionIds: [],
        errorNotice: null
      })
    } catch (error) {
      applyError(set, error)
    }
  },
  refreshSessions: async () => {
    set({ isLoading: true, errorNotice: null })
    try {
      const scan = await window.codexExporter.scanSessions()
      const currentSelected = get().selectedSessionId
      const nextSelected =
        (currentSelected &&
          scan.sessions.find((session) => session.sessionId === currentSelected)?.sessionId) ||
        scan.sessions[0]?.sessionId ||
        null

      let previewMarkdown = ''
      let previewWarnings: string[] = []

      if (nextSelected) {
        const preview = await loadPreview(nextSelected, get().mode)
        previewMarkdown = preview.markdown
        previewWarnings = preview.warnings
      }

      set({
        sessions: scan.sessions,
        selectedSessionId: nextSelected,
        previewMarkdown,
        previewWarnings,
        isLoading: false
      })
    } catch (error) {
      applyError(set, error)
    }
  },
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleSourceFilter: (source) => {
    set((state) => {
      const next = new Set(state.sourceFilters)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return { sourceFilters: next }
    })
  },
  setIncludeRemoved: (includeRemoved) => set({ includeRemoved }),
  setMode: async (mode) => {
    set({ mode, errorNotice: null })
    try {
      const selected = get().selectedSessionId
      if (selected) {
        const preview = await loadPreview(selected, mode)
        set({
          previewMarkdown: preview.markdown,
          previewWarnings: preview.warnings
        })
      }
      await get().updateSettings({ defaultExportMode: mode })
    } catch (error) {
      applyError(set, error)
    }
  },
  selectSession: async (sessionId) => {
    set({ selectedSessionId: sessionId, isLoading: true, errorNotice: null })
    try {
      const preview = await loadPreview(sessionId, get().mode)
      set({
        previewMarkdown: preview.markdown,
        previewWarnings: preview.warnings,
        isLoading: false
      })
    } catch (error) {
      applyError(set, error)
    }
  },
  toggleBatchSession: (sessionId) => {
    set((state) => {
      const exists = state.selectedSessionIds.includes(sessionId)
      return {
        selectedSessionIds: exists
          ? state.selectedSessionIds.filter((item) => item !== sessionId)
          : [...state.selectedSessionIds, sessionId]
      }
    })
  },
  clearBatchSelection: () => set({ selectedSessionIds: [], statusNotice: null }),
  exportCurrentToFile: async () => {
    const selected = get().selectedSessionId
    if (!selected) {
      set({ errorNotice: 'Select a session first.' })
      return
    }

    const destination = await window.codexExporter.pickExportPath('file')
    if (!destination) return

    set({ isExporting: true, errorNotice: null })
    try {
      const result = await window.codexExporter.exportMarkdown({
        sessionIds: [selected],
        mode: get().mode,
        strategy: 'single_file',
        destinationPath: destination
      })

      set({
        isExporting: false,
        statusNotice: `Exported to ${result.written[0] ?? destination}`,
        previewWarnings: result.warnings
      })
    } catch (error) {
      applyError(set, error)
    }
  },
  copyCurrentToClipboard: async () => {
    const selected = get().selectedSessionId
    if (!selected) {
      set({ errorNotice: 'Select a session first.' })
      return
    }

    set({ isExporting: true, errorNotice: null })
    try {
      const result = await window.codexExporter.exportMarkdown({
        sessionIds: [selected],
        mode: get().mode,
        strategy: 'single_file',
        copyToClipboard: true
      })

      set({
        isExporting: false,
        statusNotice: 'Copied markdown to clipboard.',
        previewWarnings: result.warnings
      })
    } catch (error) {
      applyError(set, error)
    }
  },
  exportBatchToDirectory: async () => {
    const selected = get().selectedSessionIds
    if (selected.length === 0) {
      set({ errorNotice: 'Select at least one session for batch export.' })
      return
    }

    const destination = await window.codexExporter.pickExportPath('directory')
    if (!destination) return

    set({ isExporting: true, errorNotice: null })
    try {
      const result = await window.codexExporter.exportMarkdown({
        sessionIds: selected,
        mode: get().mode,
        strategy: 'one_file_per_session',
        destinationPath: destination
      })

      set({
        isExporting: false,
        statusNotice: `Batch exported ${result.written.length} files.`,
        previewWarnings: result.warnings
      })
    } catch (error) {
      applyError(set, error)
    }
  },
  quickExportLatest: async () => {
    set({ isExporting: true, errorNotice: null })
    try {
      const result = await window.codexExporter.quickExportLatest(get().mode)
      set({
        isExporting: false,
        statusNotice: result.path
          ? `Quick exported to ${result.path}`
          : 'No session available for quick export.',
        previewWarnings: result.warnings
      })
    } catch (error) {
      applyError(set, error)
    }
  },
  addDataRoot: async () => {
    const selectedDirectory = await window.codexExporter.pickExportPath('directory')
    if (!selectedDirectory) return

    const current = get().settings
    if (!current) return

    const dataRoots = Array.from(new Set([...current.dataRoots, selectedDirectory]))
    await get().updateSettings({ dataRoots })
    await get().refreshSessions()
    set({ statusNotice: `Added data root: ${selectedDirectory}` })
  },
  updateSettings: async (patch) => {
    try {
      const settings = await window.codexExporter.updateSettings(patch)
      set({ settings })
    } catch (error) {
      applyError(set, error)
    }
  },
  setPaneWidths: async (left, right) => {
    const clamped = clampPaneWidths({ left, right })
    await get().updateSettings({ paneWidths: clamped })
  },
  completeOnboarding: async () => {
    try {
      const settings = await window.codexExporter.updateSettings({ hasCompletedOnboarding: true })
      set({ settings })
      await get().refreshSessions()
    } catch (error) {
      applyError(set, error)
    }
  },
  clearStatus: () => set({ statusNotice: null, errorNotice: null })
}))

export function getFilteredSessions(
  sessions: SessionSummary[],
  query: string,
  sourceFilters: Set<SessionSource>,
  includeRemoved: boolean
): SessionSummary[] {
  const normalizedQuery = query.trim().toLowerCase()

  return sessions.filter((session) => {
    // Filter by workspace membership
    if (!includeRemoved && !session.inWorkspace) return false

    // Filter by source (empty set = show all)
    if (sourceFilters.size > 0 && !sourceFilters.has(session.source)) return false

    if (!normalizedQuery) return true

    const haystack =
      `${session.projectName} ${session.title ?? ''} ${session.sessionId} ${session.cwd ?? ''}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}
