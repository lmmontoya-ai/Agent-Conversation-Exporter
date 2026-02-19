import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/renderer/src/App'
import { sampleSessions, sampleSettings } from '../fixtures/sample-data'
import { useCodexStore } from '../../src/renderer/src/lib/store'

void React

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width
  })
  window.dispatchEvent(new Event('resize'))
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce') ? false : true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  window.codexExporter = {
    getSettings: vi.fn().mockResolvedValue(sampleSettings),
    updateSettings: vi.fn().mockResolvedValue(sampleSettings),
    scanSessions: vi.fn().mockResolvedValue({ sessions: sampleSessions }),
    loadSession: vi.fn().mockResolvedValue({ markdown: '# Mock markdown', warnings: [] }),
    exportMarkdown: vi
      .fn()
      .mockResolvedValue({ written: ['/tmp/a.md'], copied: false, warnings: [] }),
    quickExportLatest: vi
      .fn()
      .mockResolvedValue({ path: '/tmp/latest.md', copied: false, warnings: [] }),
    pickExportPath: vi.fn().mockResolvedValue('/tmp/output.md')
  }

  useCodexStore.setState({
    settings: null,
    sessions: [],
    selectedSessionId: null,
    selectedSessionIds: [],
    previewMarkdown: '',
    previewWarnings: [],
    isLoading: false,
    isExporting: false,
    searchQuery: '',
    sourceFilter: 'all',
    statusNotice: null,
    errorNotice: null,
    mode: 'clean'
  })
})

describe('AppShell responsive snapshots', () => {
  for (const width of [375, 768, 1024, 1440]) {
    it(`renders brutalist layout at width ${width}`, async () => {
      setViewport(width)
      const { container } = render(<App />)

      await waitFor(() => {
        expect(window.codexExporter.scanSessions).toHaveBeenCalled()
      })

      expect(container.firstChild).toMatchSnapshot()
    })
  }
})
