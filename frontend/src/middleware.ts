import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Security headers to add to all responses
const securityHeaders = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Enable XSS filter in older browsers
  'X-XSS-Protection': '1; mode=block',
  // Referrer policy - don't leak full URL to external sites
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permissions policy - restrict features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Content Security Policy - adjust as needed for your app
  // Note: This is a basic policy - you may need to adjust based on your specific needs
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://*.posthog.com https://eu-assets.i.posthog.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://accounts.google.com https://firedup.app https://api.stripe.com https://*.sentry.io https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.posthog.com",
    "frame-src 'self' https://accounts.google.com https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
};

function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    // SECURITY: Don't log sensitive token data in production
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('[middleware][debug] Processing request:', {
        url: req.url,
        hasToken: !!token,
        path: req.nextUrl.pathname,
      });
    }

    if (!token) {
      const response = NextResponse.redirect(new URL('/', req.url));
      return addSecurityHeaders(response);
    }

    const response = NextResponse.next();
    return addSecurityHeaders(response);
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // SECURITY: Only log in development, and don't log sensitive data
        if (process.env.NODE_ENV !== 'production') {
          logger.debug('[middleware][debug] Authorization check:', {
            hasToken: !!token,
          });
        }
        return !!token;
      },
    },
    pages: {
      signIn: '/',
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * 1. api routes (/api/*)
     * 2. static assets (_next/static/*, _next/image/*, favicon.ico, public files with extensions)
     * 3. auth pages (/auth/*)
     * 4. public pages (/pricing, /privacy, /terms)
     * 5. partner accept page (/partner/accept) - handles auth internally
     * 6. checkout page (/checkout) - handles its own auth redirect
     * 7. landing page (/) - handled separately with client-side auth check
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/.*|partner/accept|pricing|privacy|terms|manual|blog|checkout|ynab-alternatywa|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).+)',
  ],
};
