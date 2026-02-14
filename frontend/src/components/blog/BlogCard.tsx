import Link from 'next/link'
import Image from 'next/image'
import { getStrapiMediaUrl } from '@/lib/strapi'

interface BlogCardProps {
  post: {
    id: string | number
    title: string
    slug: string
    excerpt?: string
    coverImage: {
      url: string
      alternativeText?: string | null
    } | string | null
    category: string
    publishedAt: string
    author: {
      name: string
    } | string | null
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

export default function BlogCard({ post }: BlogCardProps) {
  const rawCoverUrl =
    typeof post.coverImage === 'object' && post.coverImage ? post.coverImage.url : null
  const coverImageUrl = getStrapiMediaUrl(rawCoverUrl)

  const coverImageAlt =
    typeof post.coverImage === 'object' && post.coverImage
      ? post.coverImage.alternativeText || post.title
      : post.title

  const authorName =
    typeof post.author === 'object' && post.author ? post.author.name : 'FiredUp Team'

  const categoryLabel = categoryLabels[post.category] || post.category

  return (
    <Link href={`/blog/${post.slug}`} className="group">
      <article className="bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl overflow-hidden hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/50 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
        {/* Cover Image */}
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={coverImageUrl}
            alt={coverImageAlt}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {/* Category Badge */}
          <div className="absolute top-4 left-4">
            <span className="inline-block px-3 py-1 bg-emerald-100/90 backdrop-blur-sm text-emerald-700 text-xs font-medium rounded-full">
              {categoryLabel}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 flex flex-col">
          {/* Title */}
          <h3 className="text-xl font-semibold text-emerald-900 mb-2 line-clamp-2 group-hover:text-emerald-700 transition-colors">
            {post.title}
          </h3>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-emerald-700/70 text-sm mb-4 line-clamp-3 flex-1">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 text-emerald-700/60 text-xs mt-auto pt-4 border-t border-emerald-50">
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
            <span>•</span>
            <span>{authorName}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
