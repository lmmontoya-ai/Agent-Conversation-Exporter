import { format } from 'date-fns'
import { PREVIEW_CHAR_GUARD, PREVIEW_LINE_GUARD, countLines } from '../../shared/preview'
import type { ExportMode, PreviewDetail, SessionTranscript, ToolEvent } from '../../shared/types'

interface RenderMarkdownOptions {
  detail?: PreviewDetail
}

interface RenderedMarkdownResult {
  markdown: string
  truncated: boolean
  hasMore: boolean
}

function codeFence(text: string, language = ''): string {
  const maxTicks = Math.max(
    3,
    ...Array.from(text.match(/`+/g) ?? []).map((token) => token.length + 1)
  )
  const ticks = '`'.repeat(maxTicks)
  return `${ticks}${language}\n${text}\n${ticks}`
}

function roleHeading(role: string): string {
  const upper = role.toUpperCase()
  if (upper === 'USER') return 'User'
  if (upper === 'ASSISTANT') return 'Assistant'
  if (upper === 'DEVELOPER') return 'Developer'
  if (upper === 'SYSTEM') return 'System'
  return role
}

function renderMetadata(transcript: SessionTranscript): string {
  return [
    `- Session ID: \`${transcript.sessionId}\``,
    `- Source: \`${transcript.source}\``,
    `- Created: ${format(new Date(transcript.createdAt), 'yyyy-MM-dd HH:mm:ss')}`,
    `- Updated: ${format(new Date(transcript.updatedAt), 'yyyy-MM-dd HH:mm:ss')}`,
    `- CWD: ${transcript.cwd ?? 'N/A'}`,
    `- Partial: ${transcript.partial ? 'yes' : 'no'}`
  ].join('\n')
}

function renderToolEvent(event: ToolEvent): string {
  const title = event.name ? `${event.type} (${event.name})` : event.type
  const payload =
    typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload, null, 2)
  return [
    `<details>`,
    `<summary>${title} · ${format(new Date(event.timestamp), 'HH:mm:ss')}</summary>`,
    '',
    codeFence(payload, 'json'),
    '</details>'
  ].join('\n')
}

function renderWarnings(warnings: string[]): string {
  if (warnings.length === 0) return ''
  return ['## Warnings', '', ...warnings.map((warning) => `> [!] ${warning}`), ''].join('\n')
}

function renderCleanTranscript(
  transcript: SessionTranscript,
  detail: PreviewDetail
): RenderedMarkdownResult {
  const lines: string[] = []
  let charCount = 0
  let lineCount = 0
  let truncatedByBudget = false

  const pushLine = (line = ''): boolean => {
    lines.push(line)
    charCount += line.length + 1
    lineCount += 1
    if (detail !== 'preview') return false
    if (charCount <= PREVIEW_CHAR_GUARD && lineCount <= PREVIEW_LINE_GUARD) return false
    truncatedByBudget = true
    return true
  }

  const pushBlock = (block: string): boolean => {
    lines.push(block)
    charCount += block.length + 1
    lineCount += countLines(block)
    if (detail !== 'preview') return false
    if (charCount <= PREVIEW_CHAR_GUARD && lineCount <= PREVIEW_LINE_GUARD) return false
    truncatedByBudget = true
    return true
  }

  pushLine(`# ${transcript.title}`)
  pushLine()
  pushBlock(renderMetadata(transcript))
  pushLine()
  pushLine('---')
  pushLine()

  for (const message of transcript.messages) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue
    }

    if (pushLine(`## ${roleHeading(message.role)}`)) break
    if (pushLine(`> ${format(new Date(message.timestamp), 'yyyy-MM-dd HH:mm:ss')}`)) break
    if (pushLine()) break
    if (pushBlock(message.text)) break
    if (pushLine()) break
  }

  const warningBlock = renderWarnings(transcript.warnings)
  if (warningBlock) pushBlock(warningBlock)

  const hasMore = Boolean(transcript.hasMore || truncatedByBudget)
  if (hasMore && detail === 'preview') {
    pushLine()
    pushLine('> [!] Preview truncated. Load full preview for complete content.')
  }

  return {
    markdown: `${lines.join('\n').trim()}\n`,
    truncated: hasMore,
    hasMore
  }
}

function renderDevelopTranscript(
  transcript: SessionTranscript,
  detail: PreviewDetail
): RenderedMarkdownResult {
  const lines: string[] = []
  let charCount = 0
  let lineCount = 0
  let truncatedByBudget = false

  const pushLine = (line = ''): boolean => {
    lines.push(line)
    charCount += line.length + 1
    lineCount += 1
    if (detail !== 'preview') return false
    if (charCount <= PREVIEW_CHAR_GUARD && lineCount <= PREVIEW_LINE_GUARD) return false
    truncatedByBudget = true
    return true
  }

  const pushBlock = (block: string): boolean => {
    lines.push(block)
    charCount += block.length + 1
    lineCount += countLines(block)
    if (detail !== 'preview') return false
    if (charCount <= PREVIEW_CHAR_GUARD && lineCount <= PREVIEW_LINE_GUARD) return false
    truncatedByBudget = true
    return true
  }

  pushLine(`# ${transcript.title} (Develop)`)
  pushLine()
  pushBlock(renderMetadata(transcript))
  pushLine()
  pushLine('---')
  pushLine()

  for (const message of transcript.messages) {
    if (
      pushLine(
        `### ${roleHeading(message.role)} · ${format(new Date(message.timestamp), 'yyyy-MM-dd HH:mm:ss')}`
      )
    )
      break
    if (pushLine()) break
    if (pushBlock(message.text)) break
    if (pushLine()) break
  }

  if (detail === 'full') {
    if (transcript.toolEvents.length > 0) {
      pushLine('## Tool And Event Trace')
      pushLine()
      for (const event of transcript.toolEvents) {
        if (pushBlock(renderToolEvent(event))) break
        if (pushLine()) break
      }
    }
  } else if ((transcript.toolEventTotal ?? 0) > 0) {
    pushLine('## Tool And Event Summary')
    pushLine()
    pushLine(`- Total events captured: ${transcript.toolEventTotal ?? 0}`)
    if (transcript.toolEventSummary) {
      for (const [eventType, count] of Object.entries(transcript.toolEventSummary)) {
        if (pushLine(`- ${eventType}: ${count}`)) break
      }
    }
    pushLine()
  }

  const warningBlock = renderWarnings(transcript.warnings)
  if (warningBlock) pushBlock(warningBlock)

  const hasMore = Boolean(transcript.hasMore || truncatedByBudget)
  if (hasMore && detail === 'preview') {
    pushLine()
    pushLine('> [!] Preview truncated. Load full preview for complete content.')
  }

  return {
    markdown: `${lines.join('\n').trim()}\n`,
    truncated: hasMore,
    hasMore
  }
}

export function renderMarkdown(
  transcript: SessionTranscript,
  mode: ExportMode,
  options?: RenderMarkdownOptions
): RenderedMarkdownResult {
  const detail = options?.detail ?? 'full'
  if (mode === 'develop') {
    return renderDevelopTranscript(transcript, detail)
  }

  return renderCleanTranscript(transcript, detail)
}
