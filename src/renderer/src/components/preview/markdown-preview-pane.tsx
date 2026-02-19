import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, FileText, Share, Copy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ExportMode } from '../../../../shared/types'
import { MarkdownSection, PROSE_CLASS } from './rendered-markdown'
import { cn } from '../../lib/cn'

type ViewMode = 'raw' | 'rendered'

const RAW_CHUNK_LINES = 300
const RENDERED_INITIAL_SECTIONS = 10

interface MarkdownPreviewPaneProps {
  markdown: string
  warnings: string[]
  mode: ExportMode
  onModeChange: (mode: ExportMode) => void
  isLoading: boolean
  title: string
  projectName: string
  selectedBatchCount: number
  onExport: () => void
  onCopy: () => void
  headerActions?: ReactNode
}

const exportModes: { key: ExportMode; label: string }[] = [
  { key: 'clean', label: 'Clean' },
  { key: 'develop', label: 'Develop' }
]

const viewModes: { key: ViewMode; label: string }[] = [
  { key: 'raw', label: 'Raw' },
  { key: 'rendered', label: 'Rendered' }
]

function Dropdown<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (value: T) => void
  options: { key: T; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const activeLabel = options.find((o) => o.key === value)?.label ?? options[0]?.label ?? ''

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: rect.right - 140
    })
  }, [])

  const toggle = useCallback(() => {
    if (!open) updatePosition()
    setOpen((prev) => !prev)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return
      setOpen(false)
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-colors duration-100 active:scale-[0.98]',
          open
            ? 'border-[var(--border-hover)] bg-[var(--bg-hover)] text-[var(--fg)]'
            : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg-muted)] hover:border-[var(--border-hover)] hover:text-[var(--fg)]'
        )}
      >
        <span className="text-[13px] font-medium">{activeLabel}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-[var(--fg-subtle)] transition-transform duration-100',
            open && 'rotate-180'
          )}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                transformOrigin: 'top right',
                zIndex: 9999
              }}
              className="w-[140px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] font-[family-name:var(--font-sans)] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            >
              <div className="p-1">
                {options.map((o, i) => (
                  <motion.div
                    key={o.key}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.12, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.key)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-[5px] transition-colors duration-100 active:scale-[0.97]',
                        o.key === value ? 'bg-[var(--accent-muted)]' : 'hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      <Check
                        className={cn(
                          'h-3 w-3 flex-shrink-0 text-[var(--fg-subtle)]',
                          o.key === value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span
                        className={cn(
                          'text-[13px]',
                          o.key === value ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)]'
                        )}
                      >
                        {o.label}
                      </span>
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

export function MarkdownPreviewPane({
  markdown,
  warnings,
  mode,
  onModeChange,
  isLoading,
  title,
  projectName,
  selectedBatchCount,
  onExport,
  onCopy,
  headerActions
}: MarkdownPreviewPaneProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('raw')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rawSentinelRef = useRef<HTMLDivElement>(null)
  const renderedSentinelRef = useRef<HTMLDivElement>(null)

  // ─── Raw mode: progressive line rendering ───
  const lines = useMemo(() => markdown.split('\n'), [markdown])
  const [visibleLineCount, setVisibleLineCount] = useState(RAW_CHUNK_LINES)

  // ─── Rendered mode: progressive section rendering ───
  const markdownSections = useMemo(() => {
    if (!markdown) return []
    return markdown.split(/(?=\n## )/)
  }, [markdown])
  const [visibleSectionCount, setVisibleSectionCount] = useState(RENDERED_INITIAL_SECTIONS)

  // Reset progressive state when content changes
  useEffect(() => {
    setVisibleLineCount(RAW_CHUNK_LINES)
    setVisibleSectionCount(RENDERED_INITIAL_SECTIONS)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [markdown])

  // IntersectionObserver for raw mode
  useEffect(() => {
    if (viewMode !== 'raw' || !markdown) return
    const sentinel = rawSentinelRef.current
    const root = scrollContainerRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleLineCount((prev) => Math.min(prev + RAW_CHUNK_LINES, lines.length))
        }
      },
      { root, rootMargin: '400px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [viewMode, lines.length, visibleLineCount, markdown])

  // IntersectionObserver for rendered mode
  useEffect(() => {
    if (viewMode !== 'rendered' || !markdown) return
    const sentinel = renderedSentinelRef.current
    const root = scrollContainerRef.current
    if (!sentinel || !root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleSectionCount((prev) =>
            Math.min(prev + RENDERED_INITIAL_SECTIONS, markdownSections.length)
          )
        }
      },
      { root, rootMargin: '400px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [viewMode, markdownSections.length, visibleSectionCount, markdown])

  const visibleRawText = useMemo(
    () => lines.slice(0, visibleLineCount).join('\n'),
    [lines, visibleLineCount]
  )

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--bg-raised)]">
      {/* Header: title + view dropdown + export dropdown */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-2">
        {/* Session title + project */}
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-[var(--fg)]">{title}</span>
              {projectName && (
                <span className="flex-shrink-0 text-[13px] text-[var(--fg-subtle)]">
                  {projectName}
                </span>
              )}
            </div>
          ) : isLoading ? (
            <div style={{ animation: 'skeleton-enter 120ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both' }}>
              <div className="h-3.5 w-2/5 animate-pulse rounded bg-[var(--bg-hover)]" />
            </div>
          ) : (
            <span className="text-[13px] text-[var(--fg-subtle)]">No session selected</span>
          )}
        </div>

        {/* View mode dropdown (Raw / Rendered) */}
        <Dropdown<ViewMode> value={viewMode} onChange={setViewMode} options={viewModes} />

        {/* Export mode dropdown (Clean / Forensic) */}
        <Dropdown<ExportMode> value={mode} onChange={onModeChange} options={exportModes} />

        {/* Copy */}
        <button
          onClick={onCopy}
          disabled={!title}
          className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[var(--fg-muted)] transition-colors duration-100 hover:border-[var(--border-hover)] hover:text-[var(--fg)] active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40"
          title="Copy to clipboard"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          disabled={!title}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[var(--accent-fg)] transition-colors duration-100 hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Share className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">
            Export{selectedBatchCount >= 2 ? ` (${selectedBatchCount})` : ''}
          </span>
        </button>

        {/* Responsive action buttons slot */}
        {headerActions && <div className="flex items-center gap-0.5">{headerActions}</div>}
      </div>

      {/* Scrollable content area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto px-5 py-4">
        {warnings.length > 0 ? (
          <div className="mb-4 rounded-[var(--radius)] bg-[var(--warning-muted)] px-3 py-2.5 text-sm text-[var(--warning)]">
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <div style={{ animation: 'skeleton-enter 120ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both' }}>
            <div className="animate-pulse space-y-6 py-2">
              <div className="space-y-2">
                <div className="h-5 w-2/3 rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-1/4 rounded bg-[var(--bg-hover)] opacity-50" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-[90%] rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-[75%] rounded bg-[var(--bg-hover)]" />
              </div>
              <div className="h-4 w-2/5 rounded bg-[var(--bg-hover)]" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-[85%] rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-[60%] rounded bg-[var(--bg-hover)]" />
              </div>
              <div className="h-20 w-full rounded-md bg-[var(--bg-hover)] opacity-40" />
              <div className="space-y-2">
                <div className="h-3 w-[95%] rounded bg-[var(--bg-hover)]" />
                <div className="h-3 w-[80%] rounded bg-[var(--bg-hover)]" />
              </div>
            </div>
          </div>
        ) : markdown ? (
          viewMode === 'raw' ? (
            <>
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-[var(--fg-muted)]">
                {visibleRawText}
              </pre>
              {visibleLineCount < lines.length && (
                <div ref={rawSentinelRef} className="h-1" />
              )}
            </>
          ) : (
            <>
              <article className={PROSE_CLASS}>
                {markdownSections.slice(0, visibleSectionCount).map((section, i) => (
                  <MarkdownSection key={i} markdown={section} />
                ))}
              </article>
              {visibleSectionCount < markdownSections.length && (
                <div ref={renderedSentinelRef} className="h-1" />
              )}
            </>
          )
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full flex-col items-center justify-center pb-16"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-surface)]">
              <FileText className="h-5 w-5 text-[var(--fg-subtle)]" />
            </div>
            <p className="text-sm text-[var(--fg-subtle)]">Select a session to preview</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
