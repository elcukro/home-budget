'use client'

import { useEffect, useState } from 'react'
import BlogCard from './BlogCard'
import Link from 'next/link'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string
  coverImage: {
    url: string
    alt: string
  } | string
  category: string
  publishedAt: string
  author: {
    name: string
  } | string
}

/**
 * Client-side blog preview section for landing page
 * Fetches 3 most recent blog posts via API
 */
export default function BlogPreviewSectionClient() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch('/api/blog/recent?limit=3')
        if (!response.ok) {
          throw new Error('Failed to fetch posts')
        }
        const data = await response.json()
        setPosts(data.posts || [])
      } catch (err) {
        console.error('Error fetching blog posts:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  // Don't show section if no posts or error
  if (!loading && (posts.length === 0 || error)) {
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

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white/80 border border-emerald-100 rounded-2xl overflow-hidden h-96 animate-pulse"
              >
                <div className="h-48 bg-emerald-100" />
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-emerald-100 rounded w-20" />
                  <div className="h-6 bg-emerald-100 rounded w-3/4" />
                  <div className="h-4 bg-emerald-100 rounded w-full" />
                  <div className="h-4 bg-emerald-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Blog Cards Grid */}
        {!loading && posts.length > 0 && (
          <>
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
          </>
        )}
      </div>
    </section>
  )
}
