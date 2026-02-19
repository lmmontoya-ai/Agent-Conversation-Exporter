import type { AppSettings, PaneWidths } from '../../../shared/types'

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280
} as const

export type BreakpointName = 'mobile' | 'tablet' | 'laptop' | 'desktop'

export function getBreakpointName(width: number): BreakpointName {
  if (width < BREAKPOINTS.mobile) return 'mobile'
  if (width < BREAKPOINTS.tablet) return 'tablet'
  if (width < BREAKPOINTS.desktop) return 'laptop'
  return 'desktop'
}

export function clampPaneWidths(widths: PaneWidths): PaneWidths {
  return {
    left: Math.max(260, Math.min(520, Math.round(widths.left))),
    right: Math.max(280, Math.min(520, Math.round(widths.right)))
  }
}

export function shouldReduceMotion(settings: AppSettings): boolean {
  if (settings.reducedMotion === true) return true
  if (settings.reducedMotion === false) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
