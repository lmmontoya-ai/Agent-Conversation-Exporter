import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, ChevronRight, Folder, FolderOpen, Archive } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionSummary } from '../../../../shared/types'
import { cn } from '../../lib/cn'

interface SessionListVirtualizedProps {
  sessions: SessionSummary[]
  selectedSessionId: string | null
  selectedSessionIds: string[]
  batchMode: boolean
  onSelect: (sessionId: string) => void
  onToggleBatch: (sessionId: string) => void
  compact?: boolean
  isLoading?: boolean
}

type GroupedRow =
  | { kind: 'section'; key: string; label: string; count: number }
  | { kind: 'header'; key: string; projectName: string; count: number }
  | { kind: 'session'; key: string; session: SessionSummary; projectName: string; indexInGroup: number }

interface ProjectGroup {
  projectName: string
  sessions: SessionSummary[]
  latestAt: string
}

/* ── Compact relative time (9h, 1w, 2d, etc.) ── */
function shortTimeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(months / 12)}y`
}

function groupByProject(sessions: SessionSummary[]): ProjectGroup[] {
  const byProject = new Map<string, ProjectGroup>()

  for (const session of sessions) {
    const projectName = session.projectName || 'Unknown'
    const existing = byProject.get(projectName)

    if (!existing) {
      byProject.set(projectName, {
        projectName,
        sessions: [session],
        latestAt: session.updatedAt
      })
      continue
    }

    existing.sessions.push(session)
    if (session.updatedAt > existing.latestAt) {
      existing.latestAt = session.updatedAt
    }
  }

  return Array.from(byProject.values())
    .map((group) => ({
      ...group,
      sessions: group.sessions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    }))
    .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1))
}

function pushProjectRows(
  rows: GroupedRow[],
  groups: ProjectGroup[],
  collapsed: Set<string>,
  keyPrefix: string
): void {
  for (const group of groups) {
    rows.push({
      kind: 'header',
      key: `${keyPrefix}:header:${group.projectName}`,
      projectName: group.projectName,
      count: group.sessions.length
    })

    if (collapsed.has(group.projectName)) continue

    for (let i = 0; i < group.sessions.length; i++) {
      rows.push({
        kind: 'session',
        key: `session:${group.sessions[i]!.sessionId}`,
        session: group.sessions[i]!,
        projectName: group.projectName,
        indexInGroup: i
      })
    }
  }
}

function buildGroupedRows(sessions: SessionSummary[], collapsed: Set<string>): GroupedRow[] {
  const active = sessions.filter((s) => !s.archived)
  const archived = sessions.filter((s) => s.archived)

  const activeGroups = groupByProject(active)
  const archivedGroups = groupByProject(archived)

  const rows: GroupedRow[] = []

  pushProjectRows(rows, activeGroups, collapsed, 'active')

  if (archivedGroups.length > 0) {
    rows.push({
      kind: 'section',
      key: 'section:archived',
      label: 'Archived',
      count: archived.length
    })

    pushProjectRows(rows, archivedGroups, collapsed, 'archived')
  }

  return rows
}

const ROW_HEIGHT_SECTION = 32
const ROW_HEIGHT_HEADER = 30
const ROW_HEIGHT_SESSION = 32

function rowHeight(row: GroupedRow): number {
  if (row.kind === 'section') return ROW_HEIGHT_SECTION
  if (row.kind === 'header') return ROW_HEIGHT_HEADER
  return ROW_HEIGHT_SESSION
}

export function SessionListVirtualized({
  sessions,
  selectedSessionId,
  selectedSessionIds,
  batchMode,
  onSelect,
  onToggleBatch,
  isLoading
}: SessionListVirtualizedProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [collapsingProject, setCollapsingProject] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const toggleCollapse = useCallback((projectName: string) => {
    setIsAnimating(true)
    if (animTimerRef.current) clearTimeout(animTimerRef.current)
    animTimerRef.current = setTimeout(() => setIsAnimating(false), 500)

    setCollapsed((prev) => {
      if (prev.has(projectName)) {
        // Expanding — immediate
        const next = new Set(prev)
        next.delete(projectName)
        setExpandedProject(projectName)
        setCollapsingProject(null)
        return next
      } else {
        // Collapsing — start exit animation, delay actual removal
        setCollapsingProject(projectName)
        setExpandedProject(null)
        return prev
      }
    })
  }, [])

  // Delayed collapse after exit animation completes
  useEffect(() => {
    if (!collapsingProject) return
    const id = setTimeout(() => {
      setCollapsed((prev) => {
        const next = new Set(prev)
        next.add(collapsingProject)
        return next
      })
      setCollapsingProject(null)
    }, 80)
    return () => clearTimeout(id)
  }, [collapsingProject])

  useEffect(() => {
    if (!expandedProject) return
    const id = setTimeout(() => setExpandedProject(null), 400)
    return () => clearTimeout(id)
  }, [expandedProject])

  const selectedSet = useMemo(() => new Set(selectedSessionIds), [selectedSessionIds])
  const rows = useMemo(() => buildGroupedRows(sessions, collapsed), [sessions, collapsed])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rowHeight(rows[index]!),
    overscan: 12
  })

  if (isLoading && sessions.length === 0) {
    return (
      <div style={{ animation: 'skeleton-enter 120ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both' }}>
      <div className="animate-pulse space-y-0.5 px-2 pt-1">
        <div className="flex items-center gap-1.5 px-1 py-1.5">
          <div className="h-3 w-3 rounded-sm bg-[var(--bg-hover)]" />
          <div className="h-3 w-3 rounded-sm bg-[var(--bg-hover)]" />
          <div className="h-3 rounded bg-[var(--bg-hover)]" style={{ width: '52%' }} />
        </div>
        {[72, 88, 60].map((w, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1 pl-7">
            <div className="h-3 flex-1 rounded bg-[var(--bg-hover)]" style={{ maxWidth: `${w}%` }} />
            <div className="h-2.5 w-6 rounded bg-[var(--bg-hover)] opacity-60" />
          </div>
        ))}
        <div className="mt-2 flex items-center gap-1.5 px-1 py-1.5">
          <div className="h-3 w-3 rounded-sm bg-[var(--bg-hover)]" />
          <div className="h-3 w-3 rounded-sm bg-[var(--bg-hover)]" />
          <div className="h-3 rounded bg-[var(--bg-hover)]" style={{ width: '38%' }} />
        </div>
        {[80, 65].map((w, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1 pl-7">
            <div className="h-3 flex-1 rounded bg-[var(--bg-hover)]" style={{ maxWidth: `${w}%` }} />
            <div className="h-2.5 w-6 rounded bg-[var(--bg-hover)] opacity-60" />
          </div>
        ))}
      </div>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        className="relative"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          transition: isAnimating ? 'height 200ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined
        }}
      >
        {rowVirtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          if (!row) return null

          /* ── Archived section divider ── */
          if (row.kind === 'section') {
            return (
              <div
                key={row.key}
                className="absolute left-0 top-0 w-full"
                style={{
                  transform: `translateY(${item.start}px)`,
                  height: item.size,
                  transition: isAnimating ? 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined
                }}
              >
                <div className="flex items-center gap-2 px-3 pt-4 pb-1">
                  <div className="h-px flex-1 bg-[var(--border)]" />
                  <span className="flex items-center gap-1 text-[11px] text-[var(--fg-subtle)]">
                    <Archive className="h-3 w-3" />
                    {row.label}
                  </span>
                  <div className="h-px flex-1 bg-[var(--border)]" />
                </div>
              </div>
            )
          }

          /* ── Project header (collapsible) ── */
          if (row.kind === 'header') {
            const isCollapsed = collapsed.has(row.projectName)
            const isCollapsing = collapsingProject === row.projectName
            return (
              <div
                key={row.key}
                className="absolute left-0 top-0 w-full"
                style={{
                  transform: `translateY(${item.start}px)`,
                  height: item.size,
                  transition: isAnimating ? 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleCollapse(row.projectName)}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)] active:scale-[0.98]"
                >
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 flex-shrink-0 transition-transform duration-150',
                      !isCollapsed && !isCollapsing && 'rotate-90'
                    )}
                  />
                  {isCollapsed || isCollapsing ? (
                    <Folder className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                  )}
                  <span className="truncate text-[13px]">{row.projectName}</span>
                </button>
              </div>
            )
          }

          /* ── Session row ── */
          const { session } = row
          const isActive = session.sessionId === selectedSessionId
          const isSelectedForBatch = selectedSet.has(session.sessionId)
          const shouldAnimateIn = expandedProject === row.projectName
          const shouldAnimateOut = collapsingProject === row.projectName

          const sessionButton = (
            <button
              type="button"
              onClick={() =>
                batchMode
                  ? onToggleBatch(session.sessionId)
                  : onSelect(session.sessionId)
              }
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors duration-100',
                batchMode ? 'pl-3' : 'pl-7',
                isActive && !batchMode
                  ? 'bg-[var(--accent-muted)] text-[var(--fg)]'
                  : batchMode && isSelectedForBatch
                    ? 'bg-[var(--accent-muted)] text-[var(--fg)]'
                    : 'text-[var(--fg)] hover:bg-[var(--bg-hover)]'
              )}
            >
              {batchMode && (
                <Checkbox.Root
                  checked={isSelectedForBatch}
                  tabIndex={-1}
                  className={cn(
                    'pointer-events-none inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm transition-colors',
                    isSelectedForBatch
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border border-[var(--border-hover)] bg-transparent'
                  )}
                  aria-label={`Select ${session.sessionId}`}
                >
                  <Checkbox.Indicator>
                    <Check className="h-2.5 w-2.5" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
              )}

              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[13px]',
                  isActive && !batchMode
                    ? 'text-[var(--fg)]'
                    : 'text-[var(--fg-muted)]'
                )}
              >
                {session.title || `Session ${session.sessionId.slice(0, 8)}`}
              </span>

              <span className="flex-shrink-0 text-[11px] tabular-nums text-[var(--fg-subtle)]">
                {shortTimeAgo(session.updatedAt)}
              </span>
            </button>
          )

          return (
            <div
              key={row.key}
              className="absolute left-0 top-0 w-full"
              style={{
                transform: `translateY(${item.start}px)`,
                height: item.size,
                transition: isAnimating ? 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined
              }}
            >
              {shouldAnimateIn || shouldAnimateOut ? (
                <motion.div
                  initial={shouldAnimateIn ? { opacity: 0, x: -6 } : undefined}
                  animate={shouldAnimateOut ? { opacity: 0, x: -6 } : { opacity: 1, x: 0 }}
                  transition={
                    shouldAnimateIn
                      ? { duration: 0.15, ease: [0.16, 1, 0.3, 1], delay: row.indexInGroup * 0.04 }
                      : { duration: 0.07, ease: [0.16, 1, 0.3, 1] }
                  }
                >
                  {sessionButton}
                </motion.div>
              ) : (
                sessionButton
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
