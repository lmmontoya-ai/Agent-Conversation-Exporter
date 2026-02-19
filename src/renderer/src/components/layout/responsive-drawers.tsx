import * as Dialog from '@radix-ui/react-dialog'
import type { PropsWithChildren, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ResponsiveDrawerProps extends PropsWithChildren {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  side?: 'left' | 'right'
  trigger?: ReactNode
}

export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  side = 'left',
  trigger,
  children
}: ResponsiveDrawerProps) {
  const slideX = side === 'left' ? -280 : 280

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, x: slideX }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideX }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`fixed ${side === 'left' ? 'left-0' : 'right-0'} top-0 z-50 flex h-full w-[min(88vw,400px)] flex-col bg-[var(--bg-raised)] shadow-[var(--shadow-lg)]`}
              >
                <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <Dialog.Title className="font-heading text-sm font-semibold text-[var(--fg)]">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--fg)] active:scale-[0.93]">
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
