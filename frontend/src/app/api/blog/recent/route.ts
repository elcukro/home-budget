import { NextRequest, NextResponse } from 'next/server'
import { getRecentPosts } from '@/lib/strapi'

/**
 * GET /api/blog/recent
 * Fetch recent blog posts
 * Query params: limit (default: 3)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '3', 10)

    const posts = await getRecentPosts(limit)

    return NextResponse.json({
      success: true,
      posts,
      count: posts.length,
    })
  } catch (error) {
    console.error('Error fetching recent posts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch blog posts',
        posts: [],
      },
      { status: 500 }
    )
  }
}
