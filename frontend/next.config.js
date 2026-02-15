/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    dangerouslyAllowLocalIP: true, // Required: CMS runs on Docker private network
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**',
        search: '',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1337',
        pathname: '/uploads/**',
        search: '',
      },
      {
        protocol: 'http',
        hostname: 'cms',
        port: '1337',
        pathname: '/uploads/**',
        search: '',
      },
      {
        protocol: 'https',
        hostname: 'firedup.app',
        port: '',
        pathname: '/uploads/**',
        search: '',
      },
      {
        protocol: 'https',
        hostname: 'assets.stickpng.com',
        port: '',
        pathname: '/images/**',
        search: '',
      },
      {
        protocol: 'https',
        hostname: 'cdn.brandfetch.io',
        port: '',
        pathname: '/**',
        search: '',
      },
    ],
  },
  // Generate unique build ID to help with cache invalidation
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  // Proxy /uploads/* to Strapi CMS so blog images resolve from any hostname
  async rewrites() {
    const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337'
    return [
      {
        source: '/uploads/:path*',
        destination: `${strapiUrl}/uploads/:path*`,
      },
    ]
  },
  // Headers for better cache control
  async headers() {
    return [
      {
        // For HTML pages - always revalidate
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // For static assets with hashed names - cache for 1 year
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
