import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin/dashboard routes
  if (pathname.startsWith('/admin/dashboard')) {
    const authCookie = request.cookies.get('sb-admin-auth');

    if (!authCookie || authCookie.value !== 'true') {
      // Redirect to login page
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Configure middleware matcher for dashboard routes only
export const config = {
  matcher: ['/admin/dashboard/:path*']
};
