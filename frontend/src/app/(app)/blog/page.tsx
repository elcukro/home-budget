import { getAllPosts } from '@/lib/strapi'
import BlogCard from '@/components/blog/BlogCard'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog FiredUp - Zarządzanie budżetem domowym',
  description:
    'Praktyczne porady o zarządzaniu budżetem, oszczędzaniu i budowaniu wolności finansowej',
  openGraph: {
    title: 'Blog FiredUp - Zarządzanie budżetem domowym',
    description:
      'Praktyczne porady o zarządzaniu budżetem, oszczędzaniu i budowaniu wolności finansowej',
    type: 'website',
  },
}

const categories = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'budgeting', label: 'Budżetowanie' },
  { value: 'savings', label: 'Oszczędzanie' },
  { value: 'debt', label: 'Kredyty i długi' },
  { value: 'investing', label: 'Inwestowanie' },
  { value: 'taxes', label: 'Podatki' },
  { value: 'tools', label: 'Narzędzia' },
]

interface BlogPageProps {
  searchParams: Promise<{
    category?: string
  }>
}

const blogBreadcrumbJsonLd = {
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
  ],
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  let posts: any[] = []

  try {
    posts = await getAllPosts()
  } catch (error) {
    console.error('Error fetching blog posts:', error)
  }

  // Filter by category if provided (Next.js 15: searchParams is a Promise)
  const { category: selectedCategory } = await searchParams
  const filteredPosts = selectedCategory && selectedCategory !== 'all'
    ? posts.filter((post) => post.category === selectedCategory)
    : posts

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogBreadcrumbJsonLd) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-emerald-900 mb-4">
            Blog FiredUp
          </h1>
          <p className="text-emerald-700/70 max-w-2xl mx-auto">
            Praktyczne porady o zarządzaniu budżetem domowym, oszczędzaniu i
            budowaniu wolności finansowej
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => {
            const isActive =
              (cat.value === 'all' && !selectedCategory) ||
              selectedCategory === cat.value

            return (
              <Link
                key={cat.value}
                href={cat.value === 'all' ? '/blog' : `/blog?category=${cat.value}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-white/80 border border-emerald-100 text-emerald-700 hover:border-emerald-200'
                }`}
              >
                {cat.label}
              </Link>
            )
          })}
        </div>

        {/* Posts Grid */}
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-emerald-900 mb-2">
              Brak artykułów
            </h3>
            <p className="text-emerald-700/70">
              {selectedCategory && selectedCategory !== 'all'
                ? 'Nie znaleziono artykułów w tej kategorii.'
                : 'Wkrótce pojawią się tu pierwsze artykuły!'}
            </p>
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-16 p-8 bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl text-center">
          <h2 className="text-2xl font-bold text-emerald-900 mb-3">
            Zacznij zarządzać swoim budżetem
          </h2>
          <p className="text-emerald-700/70 mb-6 max-w-2xl mx-auto">
            Zastosuj te porady w praktyce z FiredUp - darmową aplikacją do
            zarządzania budżetem domowym
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-full shadow-lg shadow-emerald-200 transition-all"
          >
            Rozpocznij za darmo
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
    </div>
  )
}
