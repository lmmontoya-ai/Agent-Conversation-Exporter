import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98]',
  secondary:
    'bg-[var(--bg-surface)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]',
  ghost:
    'bg-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]',
  danger:
    'bg-[var(--danger-muted)] text-[var(--danger)] hover:bg-[rgba(251,113,133,0.22)]',
  warning:
    'bg-[var(--warning-muted)] text-[var(--warning)] hover:bg-[rgba(251,191,36,0.22)]'
}

export function Button({ className, variant = 'ghost', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3.5 text-sm font-medium transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40',
        variantClassName[variant],
        className
      )}
      {...props}
    />
  )
}
