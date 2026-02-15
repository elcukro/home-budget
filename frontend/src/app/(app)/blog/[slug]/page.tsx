import { getPost, getAllPosts, getStrapiMediaUrl } from '@/lib/strapi'
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
