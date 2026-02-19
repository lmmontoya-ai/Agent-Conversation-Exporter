import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, RefreshCw, FolderPlus, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SessionSource } from '../../../../shared/types'
import { cn } from '../../lib/cn'

interface SidebarMenuProps {
  sourceFilters: Set<SessionSource>
  onToggleSource: (source: SessionSource) => void
  includeArchived: boolean
  onToggleArchived: () => void
  includeRemoved: boolean
  removedCount: number
  onToggleRemoved: () => void
  onRefresh: () => void
  onAddFolder: () => void
  isLoading: boolean
}

const sources: { key: SessionSource; label: string }[] = [
  { key: 'desktop', label: 'Desktop' },
  { key: 'cli', label: 'CLI' },
  { key: 'other', label: 'Other' }
]

function isNonDefaultFilter(
  sourceFilters: Set<SessionSource>,
  includeArchived: boolean,
  includeRemoved: boolean
): boolean {
  const defaultSources =
    sourceFilters.size === 1 && sourceFilters.has('desktop')
  return !defaultSources || includeArchived || includeRemoved
}

function ToggleCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded transition-colors duration-100',
        checked
          ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
          : 'border border-[var(--fg-subtle)]/40'
      )}
    >
      {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </span>
  )
}

export function SidebarMenu({
  sourceFilters,
  onToggleSource,
  includeArchived,
  onToggleArchived,
  includeRemoved,
  removedCount,
  onToggleRemoved,
  onRefresh,
  onAddFolder,
  isLoading
}: SidebarMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const hasActiveFilter = isNonDefaultFilter(
    sourceFilters,
    includeArchived,
    includeRemoved
  )

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - 192)
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
          'relative rounded-md p-1 transition-colors duration-100 active:scale-[0.95]',
          open
            ? 'text-[var(--accent)] hover:bg-[var(--bg-hover)]'
            : 'text-[var(--fg-subtle)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
        )}
        title="Filter & actions"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {hasActiveFilter && !open && (
          <span className="absolute -right-0.5 -top-0.5 h-[5px] w-[5px] rounded-full bg-[var(--accent)]" />
        )}
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
              className="w-[192px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] font-[family-name:var(--font-sans)] text-[13px] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            >
              {/* ── Sources: segmented control ── */}
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="p-2 pb-1.5"
              >
                <div className="flex rounded-md bg-[var(--bg)]/60 p-0.5">
                  {sources.map((src) => (
                    <button
                      key={src.key}
                      type="button"
                      onClick={() => onToggleSource(src.key)}
                      className={cn(
                        'flex-1 rounded-[3px] py-[3px] text-center text-[11px] font-medium transition-all duration-100 active:scale-[0.97]',
                        sourceFilters.has(src.key)
                          ? 'bg-[var(--accent-muted)] text-[var(--accent)] shadow-sm'
                          : 'text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]'
                      )}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </motion.div>

              <div className="mx-2 border-t border-[var(--border)]" />

              {/* ── Toggles ── */}
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="p-1"
              >
                <button
                  type="button"
                  onClick={onToggleArchived}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-[5px] text-[13px] text-[var(--fg-muted)] transition-colors duration-100 hover:bg-[var(--bg-hover)] active:scale-[0.97]"
                >
                  <ToggleCheck checked={includeArchived} />
                  Archived
                </button>
                {removedCount > 0 && (
                  <button
                    type="button"
                    onClick={onToggleRemoved}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-[5px] text-[13px] text-[var(--fg-muted)] transition-colors duration-100 hover:bg-[var(--bg-hover)] active:scale-[0.97]"
                  >
                    <ToggleCheck checked={includeRemoved} />
                    <span className="flex-1 text-left">Removed</span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--fg-subtle)]">
                      {removedCount}
                    </span>
                  </button>
                )}
              </motion.div>

              <div className="mx-2 border-t border-[var(--border)]" />

              {/* ── Actions ── */}
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="p-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onRefresh()
                    setOpen(false)
                  }}
                  disabled={isLoading}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-[5px] text-[13px] text-[var(--fg-muted)] transition-colors duration-100 hover:bg-[var(--bg-hover)] active:scale-[0.97] disabled:opacity-40"
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5 flex-shrink-0',
                      isLoading && 'animate-spin'
                    )}
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddFolder()
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-[5px] text-[13px] text-[var(--fg-muted)] transition-colors duration-100 hover:bg-[var(--bg-hover)] active:scale-[0.97]"
                >
                  <FolderPlus className="h-3.5 w-3.5 flex-shrink-0" />
                  Add folder
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
