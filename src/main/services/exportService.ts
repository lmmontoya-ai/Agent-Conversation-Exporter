import fs from 'node:fs/promises'
import path from 'node:path'
import { clipboard } from 'electron'
import type { ExportMode, ExportRequest, ExportResult, SessionSummary } from '../../shared/types'

interface MarkdownBundle {
  sessionId: string
  title: string
  markdown: string
  warnings: string[]
}

type MarkdownLoader = (sessionId: string, mode: ExportMode) => Promise<MarkdownBundle>

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

function dateStamp(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(
    2,
    '0'
  )}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
}

function defaultFileName(prefix: string): string {
  return `${prefix}_${dateStamp()}.md`
}

export async function exportMarkdownFiles(
  request: ExportRequest,
  loadMarkdown: MarkdownLoader,
  defaultDirectory: string
): Promise<ExportResult> {
  const bundles = await Promise.all(
    request.sessionIds.map((sessionId) => loadMarkdown(sessionId, request.mode))
  )

  const warnings = bundles.flatMap((bundle) => bundle.warnings)
  const written: string[] = []

  if (request.strategy === 'single_file') {
    const combined = bundles
      .map((bundle) => `<!-- Session ${bundle.sessionId} -->\n\n${bundle.markdown.trim()}\n`)
      .join('\n\n---\n\n')

    if (request.copyToClipboard) {
      clipboard.writeText(combined)
    }

    if (request.destinationPath) {
      await fs.mkdir(path.dirname(request.destinationPath), { recursive: true })
      await fs.writeFile(request.destinationPath, combined, 'utf8')
      written.push(request.destinationPath)
    }

    if (!request.copyToClipboard && !request.destinationPath) {
      const outputPath = path.join(defaultDirectory, defaultFileName('codex_export'))
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, combined, 'utf8')
      written.push(outputPath)
    }

    return {
      written,
      copied: Boolean(request.copyToClipboard),
      warnings
    }
  }

  const destinationDir = request.destinationPath || defaultDirectory
  await fs.mkdir(destinationDir, { recursive: true })

  for (const bundle of bundles) {
    const stem = slugify(bundle.title || bundle.sessionId) || bundle.sessionId
    const fileName = `${stem}_${bundle.sessionId.slice(0, 8)}.md`
    const outputPath = path.join(destinationDir, fileName)
    await fs.writeFile(outputPath, bundle.markdown, 'utf8')
    written.push(outputPath)
  }

  if (request.copyToClipboard) {
    const summary = bundles.map((bundle) => bundle.markdown.trim()).join('\n\n---\n\n')
    clipboard.writeText(summary)
  }

  return {
    written,
    copied: Boolean(request.copyToClipboard),
    warnings
  }
}

export function buildLatestQuickExportRequest(
  session: SessionSummary,
  mode: ExportMode
): ExportRequest {
  return {
    sessionIds: [session.sessionId],
    mode,
    strategy: 'single_file'
  }
}
