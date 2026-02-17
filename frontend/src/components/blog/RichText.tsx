'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface RichTextProps {
  content: string // Markdown string from Strapi
  className?: string
}

interface LightboxState {
  src: string
  alt: string
}

function Lightbox({ image, onClose }: { image: LightboxState; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
        aria-label="Zamknij"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image — stop click propagation so clicking on image doesn't close */}
      <div
        className="w-full h-full flex flex-col items-center justify-center"
        style={{ maxWidth: '95vw', maxHeight: '95vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className="object-contain rounded-xl shadow-2xl"
          style={{ maxWidth: '95vw', maxHeight: '90vh', width: 'auto', height: 'auto' }}
        />
        {image.alt && (
          <p className="text-center text-white/70 text-sm mt-3 italic">{image.alt}</p>
        )}
      </div>
    </div>
  )
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
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const openLightbox = useCallback((src: string, alt: string) => setLightbox({ src, alt }), [])
  const closeLightbox = useCallback(() => setLightbox(null), [])

  if (!content) return null

  // Strip leading H1 — the page component already renders the title
  const cleaned = content.replace(/^#\s+.+\n*/m, '')

  return (
    <>
    {lightbox && <Lightbox image={lightbox} onClose={closeLightbox} />}
    <div className={`prose prose-emerald prose-lg max-w-none ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
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
            const resolvedSrc = src || ''
            const altText = alt || `Ilustracja artykułu - ${resolvedSrc.split('/').pop()?.split('_')[0] || 'obraz'}`

            if (process.env.NODE_ENV === 'development' && !alt) {
              console.warn(`[SEO] Missing alt tag for image: ${resolvedSrc}`)
            }

            return (
              <figure className="my-8 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedSrc}
                  alt={altText}
                  className="rounded-xl border border-emerald-100 shadow-md w-full cursor-zoom-in transition-all duration-200 group-hover:shadow-lg group-hover:border-emerald-200"
                  loading="lazy"
                  onClick={() => openLightbox(resolvedSrc, altText)}
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
          table: ({ children }) => (
            <div className="overflow-x-auto my-8">
              <table className="min-w-full divide-y divide-emerald-200 border border-emerald-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-emerald-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white divide-y divide-emerald-100">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-emerald-50/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-6 py-3 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-6 py-4 text-sm text-emerald-800">
              {children}
            </td>
          ),
        }}
      >
        {cleaned}
      </Markdown>
    </div>
    </>
  )
}
