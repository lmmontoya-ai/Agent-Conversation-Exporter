import { PREVIEW_CHAR_GUARD, PREVIEW_LINE_GUARD, countLines } from '../../shared/preview'
import type {
  ExportMode,
  PreviewDetail,
  SessionMessage,
  SessionTranscript,
  ToolEvent
} from '../../shared/types'
import { getSessionIndexRecord } from '../state/sessionIndex'
import { forEachJsonLine } from './jsonl'
import { stripSystemXml } from './textCleaner'

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

interface ParseSessionTranscriptOptions {
  mode?: ExportMode
  detail?: PreviewDetail
}

const TOOL_RESPONSE_TYPES = new Set([
  'function_call',
  'function_call_output',
  'custom_tool_call',
  'custom_tool_call_output',
  'web_search_call',
  'reasoning'
])

function isoFromUnknown(value: unknown, fallback: string): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString()
  }
  return fallback
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
      continue
    }

    if (type === 'input_image' || type === 'image') {
      const url = String(typed.url ?? typed.path ?? '').trim()
      chunks.push(url ? `![image](${url})` : '[Image omitted]')
    }
  }

  return chunks.join('\n\n').trim()
}

function readableTitle(messageText: string, fallback: string): string {
  const trimmed = messageText.trim()
  if (!trimmed) return fallback
  return trimmed.replace(/\s+/g, ' ').slice(0, 80)
}

function shouldParseLineForMode(line: string, mode: ExportMode): boolean {
  if (line.includes('"type":"session_meta"')) return true
  if (mode === 'clean') {
    return line.includes('"type":"response_item","payload":{"type":"message"')
  }
  return line.includes('"type":"response_item"') || line.includes('"type":"event_msg"')
}

export async function parseSessionTranscript(
  sessionId: string,
  options?: ParseSessionTranscriptOptions
): Promise<SessionTranscript> {
  const mode = options?.mode ?? 'clean'
  const detail = options?.detail ?? 'full'
  const previewMode = detail === 'preview'

  const indexRecord = getSessionIndexRecord(sessionId)
  if (!indexRecord) {
    throw new Error(`Session not indexed: ${sessionId}`)
  }

  const summary = indexRecord.summary
  const messages: SessionMessage[] = []
  const toolEvents: ToolEvent[] = []
  const warnings: string[] = []
  const toolSummary = new Map<string, number>()
  let toolEventTotal = 0
  let truncated = false
  let previewCharBudget = 0
  let previewLineBudget = 0

  const includeFullToolPayloads = mode === 'develop' && detail === 'full'
  const includeToolSummary = mode === 'develop' && detail === 'preview'

  const bumpPreviewBudget = (text: string): boolean => {
    if (!previewMode) return false
    previewCharBudget += text.length + 64
    previewLineBudget += countLines(text) + 4
    return previewCharBudget > PREVIEW_CHAR_GUARD || previewLineBudget > PREVIEW_LINE_GUARD
  }

  const bumpToolSummary = (eventType: string): void => {
    toolEventTotal += 1
    toolSummary.set(eventType, (toolSummary.get(eventType) ?? 0) + 1)
  }

  if (indexRecord.kind === 'history_fallback') {
    const malformed = await forEachJsonLine<HistoryEntry>(
      summary.filePath,
      (entry, lineNumber): void | 'stop' => {
        if (entry.session_id !== sessionId) return
        const text = String(entry.text ?? '').trim()
        if (!text) return

        messages.push({
          id: `${sessionId}:history:${lineNumber}`,
          role: 'user',
          text,
          timestamp: isoFromUnknown(entry.ts, summary.updatedAt)
        })

        if (bumpPreviewBudget(text)) {
          truncated = true
          return 'stop'
        }

        return undefined
      }
    )
    warnings.push(...malformed)

    messages.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))

    if (truncated) {
      warnings.push('Preview truncated. Load full preview for complete transcript.')
    }

    return {
      sessionId,
      source: summary.source,
      title:
        summary.title ?? readableTitle(messages[0]?.text ?? '', `Session ${sessionId.slice(0, 8)}`),
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      cwd: summary.cwd,
      partial: true,
      messages,
      toolEvents,
      warnings: ['Using history fallback; transcript may be incomplete.', ...warnings],
      hasMore: truncated,
      truncated
    }
  }

  let parsedTitle = summary.title ?? ''

  const malformed = await forEachJsonLine<RawEntry>(
    summary.filePath,
    (entry, lineNumber): void | 'stop' => {
      const entryType = entry.type ?? ''
      const timestamp = isoFromUnknown(entry.timestamp, summary.updatedAt)

      if (entryType === 'session_meta') {
        const payload = entry.payload ?? {}
        if (!parsedTitle && typeof payload.cwd === 'string') {
          parsedTitle = `Session in ${payload.cwd}`
        }
        return
      }

      if (entryType === 'response_item') {
        const payload = (entry.payload ?? {}) as Record<string, unknown>
        const payloadType = String(payload.type ?? '')

        if (payloadType === 'message') {
          const role = String(payload.role ?? '')
          if (
            role !== 'user' &&
            role !== 'assistant' &&
            role !== 'developer' &&
            role !== 'system'
          ) {
            return
          }

          const rawText = extractMessageText(payload.content)
          if (!rawText) return

          const text = stripSystemXml(rawText)
          if (!text) return

          if (!parsedTitle && role === 'user') {
            parsedTitle = readableTitle(text, `Session ${sessionId.slice(0, 8)}`)
          }

          messages.push({
            id: `${sessionId}:message:${lineNumber}`,
            role,
            text,
            timestamp
          })

          if (bumpPreviewBudget(text)) {
            truncated = true
            return 'stop'
          }

          return
        }

        if (TOOL_RESPONSE_TYPES.has(payloadType)) {
          if (includeFullToolPayloads) {
            toolEvents.push({
              id: `${sessionId}:tool:${lineNumber}`,
              timestamp,
              type: payloadType,
              name: typeof payload.name === 'string' ? payload.name : undefined,
              payload
            })
          } else if (includeToolSummary) {
            bumpToolSummary(payloadType)
          }
        }
        return
      }

      if (entryType === 'event_msg') {
        const payload = entry.payload ?? {}
        const eventType = typeof payload.type === 'string' ? payload.type : 'event_msg'
        if (includeFullToolPayloads) {
          toolEvents.push({
            id: `${sessionId}:event:${lineNumber}`,
            timestamp,
            type: eventType,
            payload
          })
        } else if (includeToolSummary) {
          bumpToolSummary(eventType)
        }
      }

      return undefined
    },
    {
      shouldParseLine: (line) => shouldParseLineForMode(line, mode)
    }
  )

  warnings.push(...malformed)

  if (truncated) {
    warnings.push('Preview truncated. Load full preview for complete transcript.')
  }

  messages.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
  toolEvents.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))

  const toolEventSummary =
    includeToolSummary && toolSummary.size > 0
      ? Object.fromEntries(
          Array.from(toolSummary.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
        )
      : undefined

  return {
    sessionId,
    source: summary.source,
    title: parsedTitle || `Session ${sessionId.slice(0, 8)}`,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    cwd: summary.cwd,
    partial: summary.partial,
    messages,
    toolEvents,
    toolEventTotal: includeToolSummary ? toolEventTotal : undefined,
    toolEventSummary,
    warnings,
    hasMore: truncated,
    truncated
  }
}
