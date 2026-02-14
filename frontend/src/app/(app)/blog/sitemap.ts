import { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/strapi'

/**
 * Generate sitemap for blog posts
 * Automatically includes all published posts
 * Updates when new posts are published
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let posts: any[] = []

  try {
    posts = await getAllPosts()
  } catch (error) {
    console.error('Error fetching posts for sitemap:', error)
  }

  const blogPosts: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://firedup.app/blog/${post.slug}`,
    lastModified: post.updatedAt || post.publishedAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [
    {
      url: 'https://firedup.app/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...blogPosts,
  ]
}
