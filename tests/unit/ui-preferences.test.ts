import { describe, expect, it } from 'vitest'
import { clampPaneWidths, getBreakpointName } from '../../src/renderer/src/lib/ui-preferences'

describe('ui preferences', () => {
  it('clamps pane widths to brutalist limits', () => {
    expect(clampPaneWidths({ left: 100, right: 999 })).toEqual({ left: 260, right: 520 })
  })

  it('resolves breakpoint names correctly', () => {
    expect(getBreakpointName(375)).toBe('mobile')
    expect(getBreakpointName(900)).toBe('tablet')
    expect(getBreakpointName(1100)).toBe('laptop')
    expect(getBreakpointName(1440)).toBe('desktop')
  })
})
