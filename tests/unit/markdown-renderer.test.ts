import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../../src/main/services/markdownRenderer'
import type { SessionTranscript } from '../../src/shared/types'

const transcript: SessionTranscript = {
  sessionId: 'abc123',
  source: 'desktop',
  title: 'Sample Session',
  createdAt: '2026-02-18T00:00:00.000Z',
  updatedAt: '2026-02-18T00:10:00.000Z',
  partial: false,
  messages: [
    { id: '1', role: 'user', text: 'Hello', timestamp: '2026-02-18T00:01:00.000Z' },
    { id: '2', role: 'assistant', text: 'Hi there', timestamp: '2026-02-18T00:02:00.000Z' }
  ],
  toolEvents: [
    { id: '3', timestamp: '2026-02-18T00:03:00.000Z', type: 'function_call', payload: { x: 1 } }
  ],
  warnings: []
}

describe('renderMarkdown', () => {
  it('renders clean markdown with user and assistant sections only', () => {
    const output = renderMarkdown(transcript, 'clean')
    expect(output.markdown).toContain('## User')
    expect(output.markdown).toContain('## Assistant')
    expect(output.markdown).not.toContain('Tool And Event Trace')
    expect(output.hasMore).toBe(false)
    expect(output.truncated).toBe(false)
  })

  it('renders develop markdown with tool trace', () => {
    const output = renderMarkdown(transcript, 'develop')
    expect(output.markdown).toContain('# Sample Session (Develop)')
    expect(output.markdown).toContain('## Tool And Event Trace')
    expect(output.markdown).toContain('<details>')
    expect(output.hasMore).toBe(false)
    expect(output.truncated).toBe(false)
  })
})
