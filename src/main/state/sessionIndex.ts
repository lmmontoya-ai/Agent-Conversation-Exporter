import type { SessionSummary } from '../../shared/types'

export type SessionIndexKind = 'session_file' | 'history_fallback'

export interface SessionIndexRecord {
  sessionId: string
  kind: SessionIndexKind
  filePath: string
  fileSignature?: string
  summary: SessionSummary
}

const sessionIndex = new Map<string, SessionIndexRecord>()

export function setSessionIndex(records: SessionIndexRecord[]): void {
  sessionIndex.clear()
  for (const record of records) {
    sessionIndex.set(record.sessionId, record)
  }
}

export function getSessionIndexRecord(sessionId: string): SessionIndexRecord | undefined {
  return sessionIndex.get(sessionId)
}

export function getAllSessionIndexRecords(): SessionIndexRecord[] {
  return Array.from(sessionIndex.values())
}
