import fs from 'node:fs'
import readline from 'node:readline'

interface ForEachJsonLineOptions {
  shouldParseLine?: (line: string, lineNumber: number) => boolean
}

export async function forEachJsonLine<T = unknown>(
  filePath: string,
  handler: (parsed: T, lineNumber: number) => void | 'stop' | Promise<void | 'stop'>,
  options?: ForEachJsonLineOptions
): Promise<string[]> {
  const warnings: string[] = []
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  let lineNumber = 0
  for await (const line of rl) {
    lineNumber += 1
    const trimmed = line.trim()
    if (!trimmed) continue
    if (options?.shouldParseLine && !options.shouldParseLine(trimmed, lineNumber)) {
      continue
    }

    try {
      const parsed = JSON.parse(trimmed) as T
      const result = await handler(parsed, lineNumber)
      if (result === 'stop') {
        break
      }
    } catch {
      warnings.push(`Skipped malformed JSON in ${filePath}:${lineNumber}`)
    }
  }

  return warnings
}
