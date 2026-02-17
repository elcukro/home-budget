import { getPost, getAllPosts, getStrapiMediaUrl, getRelatedPosts } from '@/lib/strapi'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { RichText } from '@/components/blog/RichText'
import { Metadata } from 'next'

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

// Generate static paths for all blog posts
export async function generateStaticParams() {
  try {
    const posts = await getAllPosts()
    return posts.map((post: any) => ({
      slug: post.slug,
    }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  try {
    const { slug } = await params
    const post = await getPost(slug)
    if (!post) {
      return {
        title: 'Post nie znaleziony',
      }
    }

    const coverImageUrl =
      typeof post.coverImage === 'object' && post.coverImage
        ? getStrapiMediaUrl(post.coverImage.url)
        : ''

    return {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      keywords: post.seoKeywords,
      alternates: {
        canonical: `/blog/${slug}`,
      },
      openGraph: {
        title: post.seoTitle || post.title,
        description: post.seoDescription || post.excerpt,
        images: coverImageUrl
          ? [
              {
                url: coverImageUrl,
                width: 1200,
                height: 630,
              },
            ]
          : [],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: post.seoTitle || post.title,
        description: post.seoDescription || post.excerpt,
        images: coverImageUrl ? [coverImageUrl] : [],
      },
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'Post nie znaleziony',
    }
  }
}

const categoryLabels: Record<string, string> = {
  budgeting: 'Budżetowanie',
  savings: 'Oszczędzanie',
  debt: 'Kredyty i długi',
  investing: 'Inwestowanie',
  taxes: 'Podatki',
  tools: 'Narzędzia',
}

/**
 * Calculate reading time for Polish text
 * Average reading speed: 200 words per minute (Polish is slightly slower than English)
 * @param markdown - Blog post markdown content
 * @returns Reading time in minutes
 */
function calculateReadingTime(markdown: string): number {
  // Remove markdown syntax
  const plainText = markdown
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links but keep text
    .replace(/[#*_~`]/g, '') // Remove markdown formatting
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Count words (split by whitespace)
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;

  // Calculate reading time (200 words per minute for Polish)
  const minutes = Math.ceil(wordCount / 200);

  return Math.max(1, minutes); // Minimum 1 minute
}

/**
 * Extract FAQ questions and answers from markdown content
 * Matches headings that start with question words (Czy, Jak, Co, etc.)
 * @param markdown - Blog post markdown content
 * @returns Array of {question, answer} objects
 */
function extractFAQFromContent(markdown: string) {
  const faqs: Array<{question: string; answer: string}> = [];

  // Match ### Czy/Jak/Co/Dlaczego... headings (with optional numbering like "6.1. ")
  const faqRegex = /^### (?:\d+\.?\d*\.\s*)?((?:Czy|Jak|Co|Dlaczego|Kiedy|Gdzie|Ile|Jakie?) .+?)$([\s\S]*?)(?=^### |\Z)/gm;

  let match;
  while ((match = faqRegex.exec(markdown)) !== null) {
    const question = match[1].trim();
    let answer = match[2].trim()
      .replace(/\n+/g, ' ')  // Remove newlines
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove markdown links
      .replace(/[*_~`]/g, '')  // Remove markdown formatting
      .substring(0, 500);  // Limit to 500 chars for schema

    // Clean up excessive whitespace
    answer = answer.replace(/\s+/g, ' ').trim();

    if (answer.length > 0) {
      faqs.push({ question, answer });
    }
  }

  return faqs;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  let post: any
  const { slug } = await params

  try {
    post = await getPost(slug)
  } catch (error) {
    console.error('Error fetching post:', error)
    notFound()
  }

  if (!post) {
    notFound()
  }

  const coverImageUrl =
    typeof post.coverImage === 'object' && post.coverImage
      ? getStrapiMediaUrl(post.coverImage.url)
      : ''

  const authorName =
    typeof post.author === 'object' && post.author ? post.author.name : 'FiredUp Team'

  const authorAvatar =
    typeof post.author === 'object' && post.author?.avatar
      ? getStrapiMediaUrl(
          typeof post.author.avatar === 'object'
            ? post.author.avatar.url
            : post.author.avatar
        )
      : null

  const categoryLabel = categoryLabels[post.category] || post.category

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    image: coverImageUrl,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'FiredUp',
      logo: {
        '@type': 'ImageObject',
        url: 'https://firedup.app/logo.png',
      },
    },
    description: post.excerpt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://firedup.app/blog/${post.slug}`,
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Strona główna',
        item: 'https://firedup.app',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: 'https://firedup.app/blog',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `https://firedup.app/blog/${post.slug}`,
      },
    ],
  }

  // Extract FAQ from content for rich snippets
  const faqItems = extractFAQFromContent(post.content);
  const faqJsonLd = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <article>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-emerald-700/70 mb-8">
            <Link href="/" className="hover:text-emerald-700">
              Home
            </Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-emerald-700">
              Blog
            </Link>
            <span>/</span>
            <span className="text-emerald-900 line-clamp-1">{post.title}</span>
          </nav>

          {/* Cover Image */}
          {coverImageUrl && (
            <div className="relative w-full h-96 rounded-2xl overflow-hidden mb-8 border border-emerald-100 shadow-lg shadow-emerald-100/50">
              <Image
                src={coverImageUrl}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 896px"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Category Badge */}
          <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full mb-4">
            {categoryLabel}
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold text-emerald-900 mb-4">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-xl text-emerald-700/80 mb-8 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-emerald-100">
            <div className="flex items-center gap-3">
              {authorAvatar && (
                <div className="relative w-10 h-10 rounded-full overflow-hidden">
                  <Image
                    src={authorAvatar}
                    alt={authorName}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                <div className="text-emerald-900 font-medium text-sm">
                  {authorName}
                </div>
                <div className="text-emerald-700/60 text-xs">
                  {new Date(post.publishedAt).toLocaleDateString('pl-PL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <RichText content={post.content} />

          {/* Related Posts */}
          {await (async () => {
            const relatedPosts = await getRelatedPosts(post.category, post.slug, 3);

            if (relatedPosts.length === 0) return null;

            return (
              <div className="mt-12 pt-8 border-t border-emerald-100">
                <h3 className="text-2xl font-bold text-emerald-900 mb-6">
                  📚 Powiązane artykuły
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedPosts.map((related: any) => (
                    <Link
                      key={related.slug}
                      href={`/blog/${related.slug}`}
                      className="group block p-4 bg-white border border-emerald-100 rounded-xl hover:shadow-lg hover:border-emerald-300 transition-all"
                    >
                      <div className="text-xs text-emerald-600 mb-2">
                        {categoryLabels[related.category as keyof typeof categoryLabels] || related.category}
                      </div>
                      <div className="font-semibold text-emerald-900 group-hover:text-emerald-600 transition-colors line-clamp-2">
                        {related.title}
                      </div>
                      <div className="text-sm text-emerald-700/70 mt-2 line-clamp-2">
                        {related.excerpt}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Back to Blog Button */}
          <div className="mt-12 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium rounded-full transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Powrót do bloga
            </Link>
          </div>
        </div>
      </article>
    </>
  )
}
