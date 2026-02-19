import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/ipc'
import type {
  AppSettings,
  CodexExporterApi,
  ExportMode,
  ExportRequest,
  ExportResult,
  LoadSessionOptions,
  MarkdownPreviewResult,
  QuickExportResult,
  ScanResult
} from '../shared/types'

const codexExporter: CodexExporterApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS) as Promise<AppSettings>,
  updateSettings: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, input) as Promise<AppSettings>,
  scanSessions: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN_SESSIONS) as Promise<ScanResult>,
  loadSession: (sessionId: string, mode: ExportMode, options?: LoadSessionOptions) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.LOAD_SESSION,
      sessionId,
      mode,
      options
    ) as Promise<MarkdownPreviewResult>,
  exportMarkdown: (input: ExportRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_MARKDOWN, input) as Promise<ExportResult>,
  quickExportLatest: (mode: ExportMode) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUICK_EXPORT_LATEST, mode) as Promise<QuickExportResult>,
  pickExportPath: (kind: 'file' | 'directory') =>
    ipcRenderer.invoke(IPC_CHANNELS.PICK_EXPORT_PATH, kind) as Promise<string | null>
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('codexExporter', codexExporter)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error exposed for non-isolated environments.
  window.electron = electronAPI
  // @ts-expect-error exposed for non-isolated environments.
  window.codexExporter = codexExporter
}
