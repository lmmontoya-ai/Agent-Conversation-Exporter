import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

export const PROSE_CLASS =
  'prose prose-invert max-w-none prose-headings:font-heading prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[var(--fg)] prose-p:text-[var(--fg-muted)] prose-p:leading-relaxed prose-a:text-[var(--accent)] prose-a:no-underline hover:prose-a:underline prose-strong:text-[var(--fg)] prose-code:rounded prose-code:bg-[var(--bg-surface)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[var(--accent)] prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-[var(--radius)] prose-pre:bg-[var(--bg-surface)] prose-pre:border prose-pre:border-[var(--border)]'

export const MarkdownSection = memo(function MarkdownSection({
  markdown
}: {
  markdown: string
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {markdown}
    </ReactMarkdown>
  )
})

export default function RenderedMarkdown({ markdown }: { markdown: string }) {
  return (
    <article className={PROSE_CLASS}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {markdown}
      </ReactMarkdown>
    </article>
  )
}
