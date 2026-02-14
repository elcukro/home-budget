import { getRecentPosts } from '@/lib/strapi'
import BlogCard from './BlogCard'
import Link from 'next/link'

/**
 * Blog preview section for landing page
 * Shows 3 most recent blog posts
 * Server component - fetches data at build time
 */
export default async function BlogPreviewSection() {
  let posts: any[] = []

  try {
    posts = await getRecentPosts(3)
  } catch (error) {
    console.error('Error fetching blog posts:', error)
    // If blog is not set up yet, don't show the section
    return null
  }

  // Don't show section if no posts
  if (posts.length === 0) {
    return null
  }

  return (
    <section className="py-20 bg-gradient-to-b from-white to-emerald-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
            Najnowsze artykuły
          </h2>
          <p className="text-emerald-700/70 max-w-2xl mx-auto">
            Praktyczne porady o zarządzaniu budżetem, oszczędzaniu i budowaniu
            wolności finansowej
          </p>
        </div>

        {/* Blog Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium rounded-full transition-all shadow-sm hover:shadow-md"
          >
            Zobacz wszystkie artykuły
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
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
