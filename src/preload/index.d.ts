import { ElectronAPI } from '@electron-toolkit/preload'
import type { CodexExporterApi } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    codexExporter: CodexExporterApi
  }
}
