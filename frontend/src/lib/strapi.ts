// Internal URL for server-side API calls (inside Docker: cms:1337)
const STRAPI_INTERNAL_URL = process.env.STRAPI_URL || 'http://localhost:1337'

// Public URL for browser-side access (exposed port on host)
const STRAPI_PUBLIC_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337'

/**
 * Build full URL for Strapi media files (server-side).
 * Uses the internal URL (STRAPI_URL) because Next.js Image component
 * fetches and optimizes images server-side via /_next/image.
 * The browser never accesses this URL directly.
 */
export function getStrapiMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  // Always strip hostname and return path-only (e.g. /uploads/foo.png).
  // Next.js rewrites in next.config.js proxy /uploads/* to Strapi internally,
  // so this works from both server (Image optimizer) and any client machine.
  if (url.startsWith('http')) {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  }
  return url
}

/**
 * Build full URL for Strapi media files (browser-side).
 * Uses NEXT_PUBLIC_STRAPI_URL which is accessible from the browser.
 * Use this for images rendered in client-side markdown or <img> tags.
 */
export function getStrapiPublicMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${STRAPI_PUBLIC_URL}${url}`
}

/**
 * Fetch helper for Strapi REST API.
 * Uses the internal Docker network URL for server-side calls.
 */
async function strapiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${STRAPI_INTERNAL_URL}/api${path}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) {
    throw new Error(`Strapi fetch failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

/**
 * Get all published blog posts
 * Sorted by publishedAt date (newest first)
 */
export async function getAllPosts() {
  const data = await strapiFetch<{ data: any[] }>(
    '/blog-posts?populate=*&sort=publishedAt:desc&pagination[limit]=100'
  )
  return data.data
}

/**
 * Get a single blog post by slug
 * Returns undefined if not found
 */
export async function getPost(slug: string) {
  const data = await strapiFetch<{ data: any[] }>(
    `/blog-posts?populate=*&filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[limit]=1`
  )
  return data.data[0]
}

/**
 * Get posts by category
 * Returns published posts in the specified category
 */
export async function getPostsByCategory(category: string) {
  const data = await strapiFetch<{ data: any[] }>(
    `/blog-posts?populate=*&filters[category][$eq]=${encodeURIComponent(category)}&sort=publishedAt:desc&pagination[limit]=50`
  )
  return data.data
}

/**
 * Get recent posts (limit to N most recent)
 * Useful for homepage preview sections
 */
export async function getRecentPosts(limit: number = 3) {
  const data = await strapiFetch<{ data: any[] }>(
    `/blog-posts?populate=*&sort=publishedAt:desc&pagination[limit]=${limit}`
  )
  return data.data
}

/**
 * Get all available categories with post counts
 * Returns array of {category, count} objects
 */
export async function getCategoriesWithCounts() {
  const categories = [
    'budgeting',
    'savings',
    'debt',
    'investing',
    'taxes',
    'tools',
  ]

  const categoriesWithCounts = await Promise.all(
    categories.map(async (category) => {
      const data = await strapiFetch<{ meta: { pagination: { total: number } } }>(
        `/blog-posts?filters[category][$eq]=${encodeURIComponent(category)}&pagination[limit]=0&pagination[withCount]=true`
      )
      return {
        category,
        count: data.meta.pagination.total,
      }
    })
  )

  return categoriesWithCounts.filter((c) => c.count > 0)
}

/**
 * Search posts by title or excerpt
 * Basic text search using Strapi's $containsi (case-insensitive contains)
 */
export async function searchPosts(query: string) {
  const q = encodeURIComponent(query)
  const data = await strapiFetch<{ data: any[] }>(
    `/blog-posts?populate=*&filters[$or][0][title][$containsi]=${q}&filters[$or][1][excerpt][$containsi]=${q}&sort=publishedAt:desc&pagination[limit]=50`
  )
  return data.data
}
