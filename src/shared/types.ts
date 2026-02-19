export type ExportMode = 'clean' | 'develop'

export type SessionSource = 'cli' | 'desktop' | 'other'

export type ChatRole = 'user' | 'assistant' | 'developer' | 'system'

export type ExportStrategy = 'single_file' | 'one_file_per_session'

export type PreviewDetail = 'preview' | 'full'

export interface PaneWidths {
  left: number
  right: number
}

export interface AppSettings {
  dataRoots: string[]
  includeArchived: boolean
  defaultExportMode: ExportMode
  defaultExportDirectory: string
  theme: 'brutalist'
  paneWidths: PaneWidths
  density: 'comfortable' | 'compact'
  reducedMotion: boolean | 'system'
  hasCompletedOnboarding: boolean
}

export interface SessionSummary {
  sessionId: string
  filePath: string
  source: SessionSource
  createdAt: string
  updatedAt: string
  cwd?: string
  projectName: string
  title?: string
  messageCount: number
  partial: boolean
  archived: boolean
  inWorkspace: boolean
}

export interface SessionMessage {
  id: string
  role: ChatRole
  text: string
  timestamp: string
}

export interface ToolEvent {
  id: string
  timestamp: string
  type: string
  name?: string
  payload: unknown
}

export interface SessionTranscript {
  sessionId: string
  source: SessionSource
  title: string
  createdAt: string
  updatedAt: string
  cwd?: string
  partial: boolean
  messages: SessionMessage[]
  toolEvents: ToolEvent[]
  toolEventTotal?: number
  toolEventSummary?: Record<string, number>
  warnings: string[]
  hasMore?: boolean
  truncated?: boolean
}

export interface MarkdownPreviewResult {
  markdown: string
  warnings: string[]
  charCount?: number
  lineCount?: number
  isLargePreview?: boolean
  truncated?: boolean
  hasMore?: boolean
}

export interface LoadSessionOptions {
  detail?: PreviewDetail
}

export interface ExportRequest {
  sessionIds: string[]
  mode: ExportMode
  strategy: ExportStrategy
  destinationPath?: string
  copyToClipboard?: boolean
}

export interface ExportResult {
  written: string[]
  copied: boolean
  warnings: string[]
}

export interface ScanResult {
  sessions: SessionSummary[]
}

export interface QuickExportResult {
  path?: string
  copied: boolean
  warnings: string[]
}

export interface CodexExporterApi {
  getSettings: () => Promise<AppSettings>
  updateSettings: (input: Partial<AppSettings>) => Promise<AppSettings>
  scanSessions: () => Promise<ScanResult>
  loadSession: (
    sessionId: string,
    mode: ExportMode,
    options?: LoadSessionOptions
  ) => Promise<MarkdownPreviewResult>
  exportMarkdown: (input: ExportRequest) => Promise<ExportResult>
  quickExportLatest: (mode: ExportMode) => Promise<QuickExportResult>
  pickExportPath: (kind: 'file' | 'directory') => Promise<string | null>
}
