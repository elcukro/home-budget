import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    console.log('[middleware][debug] Processing request:', {
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
      console.log('[middleware][debug] No token found, redirecting to sign-in');
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        console.log('[middleware][debug] Authorization check:', {
          hasToken: !!token,
          tokenId: token?.sub
        });
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/signin',
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)',
  ],
};
