import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: resolve('src/renderer/src/test/setup.ts'),
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']
  }
})
