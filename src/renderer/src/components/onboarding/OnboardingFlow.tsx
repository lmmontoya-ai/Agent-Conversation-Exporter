import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderOpen, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/cn'

interface OnboardingFlowProps {
  onComplete: () => void
}

interface ScanState {
  status: 'idle' | 'scanning' | 'found' | 'empty'
  sessionCount: number
  projectNames: string[]
}

/* ── Dot progress indicator ── */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === current ? 20 : 6 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'h-1.5 rounded-full transition-colors duration-300',
            i <= current ? 'bg-[var(--accent)]' : 'bg-[var(--border-hover)]'
          )}
        />
      ))}
    </div>
  )
}

/* ── Step 0: Welcome ── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-2 font-[family-name:var(--font-heading)] text-[72px] font-bold leading-none tracking-tighter text-[var(--fg)]"
      >
        ACE
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]"
      >
        Agent Conversation Exporter
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10 max-w-[320px] text-[14px] leading-relaxed text-[var(--fg-muted)]"
      >
        Export your Codex CLI and Desktop conversations as clean, structured Markdown. Ready to share, archive, or publish.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
        onClick={onNext}
        className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
      >
        <span className="text-[13px] font-semibold">Get started</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </motion.button>
    </div>
  )
}

/* ── Step 1: Find sessions ── */
function StepFindSessions({
  onNext,
  onScanComplete
}: {
  onNext: (count: number) => void
  onScanComplete: (count: number, projects: string[]) => void
}) {
  const [scan, setScan] = useState<ScanState>({
    status: 'scanning',
    sessionCount: 0,
    projectNames: []
  })
  const hasScanned = useRef(false)

  const runScan = useCallback(async () => {
    setScan({ status: 'scanning', sessionCount: 0, projectNames: [] })
    try {
      const result = await window.codexExporter.scanSessions()
      const count = result.sessions.length
      const projects = Array.from(
        new Set(result.sessions.map((s) => s.projectName).filter(Boolean))
      ).slice(0, 5) as string[]

      setScan({
        status: count > 0 ? 'found' : 'empty',
        sessionCount: count,
        projectNames: projects
      })
      onScanComplete(count, projects)
    } catch {
      setScan({ status: 'empty', sessionCount: 0, projectNames: [] })
      onScanComplete(0, [])
    }
  }, [onScanComplete])

  useEffect(() => {
    if (hasScanned.current) return
    hasScanned.current = true
    void runScan()
  }, [runScan])

  const handleBrowse = useCallback(async () => {
    const dir = await window.codexExporter.pickExportPath('directory')
    if (!dir) return
    await window.codexExporter.updateSettings({ dataRoots: [dir] })
    await runScan()
  }, [runScan])

  return (
    <div className="flex flex-col items-center text-center">
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mb-1.5 font-[family-name:var(--font-heading)] text-[22px] font-semibold text-[var(--fg)]"
      >
        Finding your sessions
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 text-[13px] text-[var(--fg-subtle)]"
      >
        Scanning{' '}
        <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--fg-muted)]">
          ~/.codex
        </span>{' '}
        for conversations
      </motion.p>

      <div className="mb-8 w-full max-w-[340px]">
        <AnimatePresence mode="wait">
          {scan.status === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="animate-pulse space-y-2.5"
            >
              {[70, 55, 80].map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5"
                >
                  <div className="h-3 w-3 flex-shrink-0 rounded-sm bg-[var(--bg-hover)]" />
                  <div
                    className="h-3 rounded bg-[var(--bg-hover)]"
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
              <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] text-[var(--fg-subtle)]">
                Scanning…
              </p>
            </motion.div>
          )}

          {scan.status === 'found' && (
            <motion.div
              key="found"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left"
            >
              <div className="mb-3 flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-heading)] text-[28px] font-bold text-[var(--accent)]">
                  {scan.sessionCount}
                </span>
                <span className="text-[13px] text-[var(--fg-muted)]">
                  sessions found
                </span>
              </div>
              <div className="space-y-1.5">
                {scan.projectNames.map((name, i) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: i * 0.05,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)]"
                  >
                    <div className="h-1 w-1 flex-shrink-0 rounded-full bg-[var(--accent)] opacity-60" />
                    <span className="truncate font-[family-name:var(--font-mono)]">{name}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {scan.status === 'empty' && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-center"
            >
              <p className="mb-1 text-[13px] font-medium text-[var(--fg)]">
                No sessions found
              </p>
              <p className="text-[12px] leading-relaxed text-[var(--fg-subtle)]">
                Run Codex CLI or Desktop first, or point ACE to a custom sessions folder.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleBrowse()}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2 text-[13px] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--fg)]',
            scan.status === 'scanning' && 'pointer-events-none opacity-40'
          )}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Browse folder
        </button>

        <button
          disabled={scan.status === 'scanning'}
          onClick={() => onNext(scan.sessionCount)}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2 text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="text-[13px] font-semibold">Continue</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ── Step 2: Done ── */
function StepDone({
  sessionCount,
  onLaunch
}: {
  sessionCount: number
  onLaunch: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-5"
      >
        <CheckCircle2
          className="h-12 w-12 text-[var(--accent)]"
          strokeWidth={1.5}
        />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mb-2 font-[family-name:var(--font-heading)] text-[24px] font-semibold text-[var(--fg)]"
      >
        {sessionCount > 0 ? "You're all set" : 'Ready to explore'}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 font-[family-name:var(--font-mono)] text-[13px] text-[var(--accent)]"
      >
        {sessionCount > 0
          ? `${sessionCount} sessions ready to export`
          : 'Add sessions any time from the sidebar'}
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
        onClick={onLaunch}
        className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98]"
      >
        <span className="text-[13px] font-semibold">Open ACE</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </motion.button>
    </div>
  )
}

/* ── Main flow ── */
export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const [finalCount, setFinalCount] = useState(0)

  const handleScanComplete = useCallback((count: number) => {
    setFinalCount(count)
  }, [])

  const TOTAL_STEPS = 3

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg)]">
      {/* Subtle radial glow at top */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% -5%, rgba(110,231,183,0.06) 0%, transparent 70%)'
        }}
      />

      {/* Step content */}
      <div className="relative w-full max-w-[440px] px-6">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <StepWelcome onNext={() => setStep(1)} />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <StepFindSessions
                onNext={(count) => {
                  setFinalCount(count)
                  setStep(2)
                }}
                onScanComplete={handleScanComplete}
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <StepDone sessionCount={finalCount} onLaunch={onComplete} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dot progress */}
      <motion.div
        className="absolute bottom-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <StepDots current={step} total={TOTAL_STEPS} />
      </motion.div>
    </div>
  )
}
