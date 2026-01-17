import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    logger.debug('[middleware][debug] Processing request:', {
      url: req.url,
      token: token ? {
        id: token.id,
        name: token.name,
        email: token.email,
        sub: token.sub
      } : 'missing',
      path: req.nextUrl.pathname,
    });

    if (!token) {
      logger.debug('[middleware][debug] No token found, redirecting to landing page');
      return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        logger.debug('[middleware][debug] Authorization check:', {
          hasToken: !!token,
          tokenId: token?.sub
        });
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
     * 5. checkout page (/checkout) - handles its own auth redirect
     * 6. landing page (/) - handled separately with client-side auth check
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/.*|pricing|privacy|terms|checkout|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).+)',
  ],
};
