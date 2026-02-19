import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'warning'
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  const toneClassName =
    tone === 'accent'
      ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
      : tone === 'warning'
        ? 'bg-[var(--warning-muted)] text-[var(--warning)]'
        : 'bg-[var(--bg-surface)] text-[var(--fg-muted)]'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide',
        toneClassName,
        className
      )}
    >
      {children}
    </span>
  )
}
