export const PREVIEW_CHAR_GUARD = 120_000
export const PREVIEW_LINE_GUARD = 2_000

export function countLines(text: string): number {
  if (!text) return 0
  let lines = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lines += 1
    }
  }
  return lines
}

export function isLargePreview(charCount: number, lineCount: number): boolean {
  return charCount > PREVIEW_CHAR_GUARD || lineCount > PREVIEW_LINE_GUARD
}
