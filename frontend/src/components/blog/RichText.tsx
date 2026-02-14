import React from 'react'
import Markdown from 'react-markdown'

interface RichTextProps {
  content: string // Markdown string from Strapi
  className?: string
}

/**
 * Renders Markdown content from Strapi CMS.
 *
 * Image URLs: Keeps Strapi-relative paths like `/uploads/...` as-is.
 * Next.js rewrites in next.config.js proxy `/uploads/*` to Strapi,
 * so images work from any client (not just localhost).
 *
 * Strips leading H1 to avoid duplicating the page title.
 */
export function RichText({ content, className = '' }: RichTextProps) {
  if (!content) return null

  // Strip leading H1 — the page component already renders the title
  const cleaned = content.replace(/^#\s+.+\n*/m, '')

  return (
    <div className={`prose prose-emerald prose-lg max-w-none ${className}`}>
      <Markdown
        components={{
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold text-emerald-900 mb-4 mt-10 pb-2 border-b border-emerald-100">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold text-emerald-800 mb-3 mt-6">{children}</h3>
          ),
          p: ({ children, node }) => {
            // If paragraph contains an image, render as div to avoid
            // invalid <p><figure>...</figure></p> nesting (hydration error).
            // In MDAST, images have type 'image'.
            const hasImage = node?.children?.some((child: any) => child.type === 'image' || child.tagName === 'img')
            if (hasImage) {
              return <div className="mb-4">{children}</div>
            }
            return <p className="mb-4 leading-relaxed text-emerald-900/80">{children}</p>
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-500 pl-6 py-2 my-6 italic text-emerald-700/80 bg-emerald-50/50 rounded-r-lg">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children }) => {
            const isBlock = codeClassName?.startsWith('language-')
            if (isBlock) {
              return (
                <code className={codeClassName}>{children}</code>
              )
            }
            return (
              <code className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-sm">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="bg-emerald-900 text-emerald-50 p-4 rounded-lg overflow-x-auto mb-4 text-sm">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-emerald-600 hover:text-emerald-700 underline font-medium"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-4 space-y-1.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-1.5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-emerald-800/90 leading-relaxed pl-1">{children}</li>
          ),
          hr: () => <hr className="my-10 border-emerald-100" />,
          img: ({ src, alt }) => {
            // Keep relative paths as-is — Next.js rewrites /uploads/* to Strapi.
            // This works from any client, not just the Docker host.
            const resolvedSrc = src || ''

            return (
              <figure className="my-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedSrc}
                  alt={alt || ''}
                  className="rounded-xl border border-emerald-100 shadow-md w-full"
                  loading="lazy"
                />
                {alt && (
                  <figcaption className="text-center text-sm text-emerald-600/70 mt-2 italic">
                    {alt}
                  </figcaption>
                )}
              </figure>
            )
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-emerald-900">{children}</strong>
          ),
        }}
      >
        {cleaned}
      </Markdown>
    </div>
  )
}
