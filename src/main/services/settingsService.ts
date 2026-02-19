import os from 'node:os'
import path from 'node:path'
import Store from 'electron-store'
import type { AppSettings } from '../../shared/types'

const home = os.homedir()

const defaultSettings: AppSettings = {
  dataRoots: [
    path.join(home, '.codex', 'sessions'),
    path.join(home, '.codex', 'archived_sessions'),
    path.join(home, '.codex', 'history.jsonl')
  ],
  includeArchived: true,
  defaultExportMode: 'clean',
  defaultExportDirectory: path.join(home, 'Downloads'),
  theme: 'brutalist',
  paneWidths: {
    left: 320,
    right: 340
  },
  density: 'comfortable',
  reducedMotion: 'system',
  hasCompletedOnboarding: false
}

// `electron-store` can be exposed as either the constructor itself or `{ default: constructor }`
// depending on module interop in the Electron runtime bundle.
const StoreCtor = (
  (Store as unknown as { default?: typeof Store }).default ?? Store
) as typeof Store

const settingsStore = new StoreCtor<AppSettings>({
  name: 'codex-exporter-settings',
  defaults: defaultSettings
})

function sanitizePaneWidth(width: number, fallback: number): number {
  if (!Number.isFinite(width)) return fallback
  return Math.max(260, Math.min(520, Math.round(width)))
}

function normalizeDataRoot(root: string): string {
  const trimmed = root.trim()
  if (!trimmed) return ''
  if (trimmed === '~') return home
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(home, trimmed.slice(2))
  }
  return path.resolve(trimmed)
}

function sanitizeSettings(input: AppSettings): AppSettings {
  const roots = Array.from(
    new Set([
      ...defaultSettings.dataRoots,
      ...input.dataRoots.filter(Boolean).map((root) => normalizeDataRoot(root))
    ])
  )
  const paneWidths = {
    left: sanitizePaneWidth(input.paneWidths.left, defaultSettings.paneWidths.left),
    right: sanitizePaneWidth(input.paneWidths.right, defaultSettings.paneWidths.right)
  }

  // Migrate legacy 'forensic' export mode (renamed to 'develop')
  const exportMode =
    (input.defaultExportMode as string) === 'forensic' ? 'develop' : input.defaultExportMode

  return {
    ...defaultSettings,
    ...input,
    defaultExportMode: exportMode === 'clean' || exportMode === 'develop' ? exportMode : 'clean',
    dataRoots: roots.length > 0 ? roots : defaultSettings.dataRoots,
    paneWidths,
    theme: 'brutalist'
  }
}

export function getSettings(): AppSettings {
  return sanitizeSettings(settingsStore.store)
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const merged = sanitizeSettings({ ...getSettings(), ...patch })
  settingsStore.set(merged)
  return merged
}
