import type { AppSettings, SessionSummary } from '../../src/shared/types'

export const sampleSettings: AppSettings = {
  dataRoots: ['/Users/example/.codex/sessions', '/Users/example/.codex/archived_sessions'],
  includeArchived: true,
  defaultExportMode: 'clean',
  defaultExportDirectory: '/Users/example/Downloads',
  theme: 'brutalist',
  paneWidths: { left: 320, right: 340 },
  density: 'comfortable',
  reducedMotion: false
}

export const sampleSessions: SessionSummary[] = [
  {
    sessionId: '019c2576-5a88-7242-b78b-e8971510f337',
    filePath: '/Users/example/.codex/sessions/rollout-1.jsonl',
    source: 'desktop',
    createdAt: '2026-02-03T21:43:59.368Z',
    updatedAt: '2026-02-03T22:10:00.000Z',
    projectName: 'Reproducing-TTT-E2E',
    messageCount: 12,
    title: 'Analyze TTT-E2E paper and prepare report',
    partial: false,
    archived: false
  },
  {
    sessionId: '019c4d7e-88c7-72f1-b3cc-790e6b17ed88',
    filePath: '/Users/example/.codex/archived_sessions/rollout-2.jsonl',
    source: 'cli',
    createdAt: '2026-02-11T16:17:44.136Z',
    updatedAt: '2026-02-11T17:20:00.000Z',
    projectName: 'rundial',
    messageCount: 22,
    title: 'Code review against main',
    partial: false,
    archived: true
  }
]
