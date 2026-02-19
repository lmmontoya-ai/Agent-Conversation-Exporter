import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface ToastProps {
  message: string | null
  variant: 'success' | 'error'
  onDismiss: () => void
}

export function Toast({ message, variant, onDismiss }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!message) return

    const delay = variant === 'error' ? 4000 : 2000
    timerRef.current = setTimeout(onDismiss, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [message, variant, onDismiss])

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={onDismiss}
            className="pointer-events-auto absolute top-12 right-3 cursor-pointer overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center gap-2.5 py-2 pr-4 pl-0">
              <div
                className="w-[2px] self-stretch rounded-full"
                style={{
                  backgroundColor:
                    variant === 'error' ? 'var(--danger)' : 'var(--accent)'
                }}
              />
              <span
                className="text-[13px] font-medium"
                style={{
                  color:
                    variant === 'error' ? 'var(--danger)' : 'var(--fg-muted)'
                }}
              >
                {message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  )
}
