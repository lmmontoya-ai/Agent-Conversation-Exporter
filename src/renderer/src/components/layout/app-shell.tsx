import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Menu, ListChecks, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Toast } from '../ui/toast'
import { OnboardingFlow } from '../onboarding/OnboardingFlow'
import { SessionListVirtualized } from '../sessions/session-list-virtualized'
import { SidebarMenu } from '../sessions/sidebar-menu'
import { MarkdownPreviewPane } from '../preview/markdown-preview-pane'
import { ResponsiveDrawer } from './responsive-drawers'
import { getFilteredSessions, useCodexStore } from '../../lib/store'
import { getBreakpointName, shouldReduceMotion } from '../../lib/ui-preferences'
import { cn } from '../../lib/cn'

function ResizeHandle({
  onMouseDown
}: {
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="group flex w-2 cursor-col-resize items-center justify-center"
    >
      <div className="h-full w-px bg-[var(--border)] transition-colors duration-150 group-hover:w-0.5 group-hover:bg-[var(--accent)]" />
    </div>
  )
}

export function AppShell() {
  const {
    settings,
    sessions,
    mode,
    selectedSessionId,
    selectedSessionIds,
    previewMarkdown,
    previewWarnings,
    isLoading,
    searchQuery,
    sourceFilters,
    includeRemoved,
    statusNotice,
    errorNotice,
    init,
    refreshSessions,
    completeOnboarding,
    setSearchQuery,
    toggleSourceFilter,
    setIncludeRemoved,
    setMode,
    selectSession,
    toggleBatchSession,
    clearBatchSelection,
    exportCurrentToFile,
    copyCurrentToClipboard,
    exportBatchToDirectory,
    addDataRoot,
    setPaneWidths,
    clearStatus
  } = useCodexStore()

  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [drawerSessionsOpen, setDrawerSessionsOpen] = useState(false)
  const [leftWidth, setLeftWidth] = useState(320)
  const [batchMode, setBatchMode] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev)
    setSearchQuery('')
  }, [setSearchQuery])

  useEffect(() => {
    if (!searchOpen) return
    const id = setTimeout(() => searchInputRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [searchOpen])

  useEffect(() => {
    void init()
  }, [init])

  // Dev-only: Cmd+Shift+O resets onboarding so you can re-test the flow
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const handler = async (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'o') {
        const updated = await window.codexExporter.updateSettings({ hasCompletedOnboarding: false })
        useCodexStore.setState({ settings: updated })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!settings) return
    setLeftWidth(settings.paneWidths.left)
  }, [settings])

  const showOnboarding = settings !== null && !settings.hasCompletedOnboarding && !isLoading

  const breakpoint = getBreakpointName(viewportWidth)
  const isDesktop = breakpoint === 'desktop'
  const isLaptop = breakpoint === 'laptop'
  const isTablet = breakpoint === 'tablet'
  const isMobile = breakpoint === 'mobile'
  const compact = settings?.density === 'compact'
  const reduceMotion = settings ? shouldReduceMotion(settings) : false
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const filteredSessions = useMemo(
    () => getFilteredSessions(sessions, deferredSearchQuery, sourceFilters, includeRemoved),
    [sessions, deferredSearchQuery, sourceFilters, includeRemoved]
  )

  const removedCount = useMemo(() => sessions.filter((s) => !s.inWorkspace).length, [sessions])

  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId)
  const sessionTitle =
    selectedSession?.title || (selectedSessionId ? `Session ${selectedSessionId.slice(0, 8)}` : '')
  const sessionProject = selectedSession?.projectName ?? ''

  const responsiveHeaderActions: ReactNode =
    isTablet || isMobile ? (
      <button
        onClick={() => setDrawerSessionsOpen(true)}
        className="rounded-md p-1 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] active:scale-[0.95]"
      >
        <Menu className="h-4 w-4" />
      </button>
    ) : undefined

  const startResizeLeft = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    const startX = event.clientX
    const initialLeft = leftWidth
    let nextLeft = initialLeft

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      nextLeft = initialLeft + deltaX
      setLeftWidth(nextLeft)
    }

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      await setPaneWidths(nextLeft, settings?.paneWidths.right ?? 340)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const sessionsPanel = (
    <div className="flex h-full flex-col bg-[var(--bg-raised)]">
      {/* ─── Sessions toolbar ─── */}
      <div className="flex flex-shrink-0 items-center gap-1 px-3 py-2">
        {/* Left: label or inline search input */}
        <div className="relative min-w-0 flex-1">
          {/* "Threads" / "N selected" label — hidden when search is open */}
          <span
            className={cn(
              'block text-[13px] text-[var(--fg-muted)] transition-opacity duration-150',
              searchOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
            )}
          >
            {batchMode ? `${selectedSessionIds.length} selected` : 'Threads'}
          </span>

          {/* Inline search input — expands from right to left */}
          <div
            className={cn(
              'absolute inset-y-0 right-0 flex items-center overflow-hidden transition-[width] duration-200 ease-out',
              searchOpen ? 'w-full' : 'w-0'
            )}
          >
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onBlur={() => {
                if (!searchQuery) setSearchOpen(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchQuery('')
                  setSearchOpen(false)
                }
              }}
              placeholder="Search..."
              className="h-6 w-full min-w-0 bg-transparent text-[13px] text-[var(--fg)] placeholder-[var(--fg-subtle)] outline-none"
            />
          </div>
        </div>

        {/* Right: action icons */}
        <div className="flex flex-shrink-0 items-center gap-0.5">
          {batchMode && selectedSessionIds.length > 0 && (
            <button
              onClick={() => clearBatchSelection()}
              className="rounded-md px-2 py-0.5 text-[11px] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
            >
              Clear
            </button>
          )}
          <button
            onMouseDown={(e) => {
              if (searchOpen) e.preventDefault()
            }}
            onClick={toggleSearch}
            className={cn(
              'rounded-md p-1 transition-colors active:scale-[0.95]',
              searchOpen
                ? 'text-[var(--accent)] hover:bg-[var(--bg-hover)]'
                : 'text-[var(--fg-subtle)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
            )}
            title="Search sessions"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setBatchMode(!batchMode)}
            className={cn(
              'rounded-md p-1 transition-colors active:scale-[0.95]',
              batchMode
                ? 'text-[var(--accent)] hover:bg-[var(--bg-hover)]'
                : 'text-[var(--fg-subtle)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]'
            )}
            title={batchMode ? 'Exit select mode' : 'Select sessions'}
          >
            <ListChecks className="h-3.5 w-3.5" />
          </button>
          <SidebarMenu
            sourceFilters={sourceFilters}
            onToggleSource={toggleSourceFilter}
            includeArchived={settings?.includeArchived ?? false}
            onToggleArchived={async () => {
              await useCodexStore
                .getState()
                .updateSettings({ includeArchived: !(settings?.includeArchived ?? false) })
              await refreshSessions()
            }}
            includeRemoved={includeRemoved}
            removedCount={removedCount}
            onToggleRemoved={() => setIncludeRemoved(!includeRemoved)}
            onRefresh={() => void refreshSessions()}
            onAddFolder={() => void addDataRoot()}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* ─── Virtualized list ─── */}
      <div className="min-h-0 flex-1">
        <SessionListVirtualized
          sessions={filteredSessions}
          selectedSessionId={selectedSessionId}
          selectedSessionIds={selectedSessionIds}
          batchMode={batchMode}
          onSelect={(sessionId) => {
            void selectSession(sessionId)
            setDrawerSessionsOpen(false)
          }}
          onToggleBatch={toggleBatchSession}
          compact={compact}
          isLoading={isLoading}
        />
      </div>
    </div>
  )

  const handleExport = useCallback(() => {
    if (selectedSessionIds.length >= 2) {
      void exportBatchToDirectory()
    } else {
      void exportCurrentToFile()
    }
  }, [selectedSessionIds.length, exportBatchToDirectory, exportCurrentToFile])

  const handleCopy = useCallback(() => {
    void copyCurrentToClipboard()
  }, [copyCurrentToClipboard])

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
      {/* ─── Main content ─── */}
      <main className="min-h-0 flex-1 p-2">
        {isDesktop ? (
          <div className="flex h-full">
            <div style={{ width: leftWidth }} className="h-full min-w-[260px]">
              {sessionsPanel}
            </div>
            <ResizeHandle onMouseDown={startResizeLeft} />
            <motion.div
              className="min-w-0 flex-1"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={reduceMotion ? {} : { opacity: 1 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <MarkdownPreviewPane
                markdown={previewMarkdown}
                warnings={previewWarnings}
                mode={mode}
                onModeChange={(nextMode) => void setMode(nextMode)}
                isLoading={isLoading}
                title={sessionTitle}
                projectName={sessionProject}
                selectedBatchCount={selectedSessionIds.length}
                onExport={handleExport}
                onCopy={handleCopy}
              />
            </motion.div>
          </div>
        ) : isLaptop ? (
          <div className="flex h-full">
            <div className="h-full w-[300px] min-w-[260px]">{sessionsPanel}</div>
            <ResizeHandle onMouseDown={startResizeLeft} />
            <div className="min-w-0 flex-1">
              <MarkdownPreviewPane
                markdown={previewMarkdown}
                warnings={previewWarnings}
                mode={mode}
                onModeChange={(nextMode) => void setMode(nextMode)}
                isLoading={isLoading}
                title={sessionTitle}
                projectName={sessionProject}
                selectedBatchCount={selectedSessionIds.length}
                onExport={handleExport}
                onCopy={handleCopy}
              />
            </div>
          </div>
        ) : (
          <div className="h-full">
            <MarkdownPreviewPane
              markdown={previewMarkdown}
              warnings={previewWarnings}
              mode={mode}
              onModeChange={(nextMode) => void setMode(nextMode)}
              isLoading={isLoading}
              title={sessionTitle}
              projectName={sessionProject}
              selectedBatchCount={selectedSessionIds.length}
              onExport={handleExport}
              onCopy={handleCopy}
              headerActions={responsiveHeaderActions}
            />
          </div>
        )}
      </main>

      {/* ─── Drawers ─── */}
      {(isTablet || isMobile) && (
        <ResponsiveDrawer
          open={drawerSessionsOpen}
          onOpenChange={setDrawerSessionsOpen}
          title="Sessions"
          side="left"
        >
          {sessionsPanel}
        </ResponsiveDrawer>
      )}

      <Toast
        message={errorNotice ?? statusNotice}
        variant={errorNotice ? 'error' : 'success'}
        onDismiss={clearStatus}
      />

      {showOnboarding && (
        <OnboardingFlow onComplete={() => void completeOnboarding()} />
      )}
    </div>
  )
}
