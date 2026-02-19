import type { PropsWithChildren } from 'react'
import { cn } from '../../lib/cn'

interface PanelProps extends PropsWithChildren {
  className?: string
  title?: string
}

export function Panel({ className, title, children }: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius-lg)] bg-[var(--bg-raised)] p-4',
        className
      )}
    >
      {title ? (
        <div className="mb-3 border-b border-[var(--border)] pb-2">
          <h2 className="font-heading text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-subtle)]">
            {title}
          </h2>
        </div>
      ) : null}
      {children}
    </section>
  )
}
