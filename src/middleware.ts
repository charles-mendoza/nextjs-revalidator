import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session-token';

/**
 * Gate all data + revalidation endpoints behind a valid session cookie.
 * Public endpoints (login/logout/session) are excluded via the matcher below.
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export const config = {
  matcher: ['/api/sites/:path*', '/api/revalidate'],
};
