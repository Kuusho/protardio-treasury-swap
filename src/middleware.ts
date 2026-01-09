import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();
  
  // Check if this is the whitelist subdomain
  const isWhitelistSubdomain = 
    hostname.startsWith('whitelist.') || 
    hostname === 'whitelist.localhost:3000' ||
    hostname.includes('whitelist');

  if (isWhitelistSubdomain) {
    // Rewrite to /whitelist routes
    // If accessing root of subdomain, go to /whitelist
    if (url.pathname === '/') {
      url.pathname = '/whitelist';
      return NextResponse.rewrite(url);
    }
    
    // If not already a /whitelist path, prefix it
    if (!url.pathname.startsWith('/whitelist') && !url.pathname.startsWith('/_next') && !url.pathname.startsWith('/api')) {
      url.pathname = `/whitelist${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
