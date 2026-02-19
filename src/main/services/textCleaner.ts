/**
 * Strips system-injected XML blocks from message text.
 *
 * Codex sessions embed metadata like `<environment_context>` and
 * `<system-reminder>` in user/assistant messages.  These should be
 * stripped from titles and from "clean" markdown exports.
 */

const SYSTEM_XML_RE =
  /<(?:environment_context|system-reminder|environment-details|system_instructions|tool_result)[\s>][\s\S]*?<\/(?:environment_context|system-reminder|environment-details|system_instructions|tool_result)>/gi

/**
 * Remove well-known system XML blocks and collapse leftover whitespace.
 */
export function stripSystemXml(text: string): string {
  return text.replace(SYSTEM_XML_RE, '').replace(/\n{3,}/g, '\n\n').trim()
}
