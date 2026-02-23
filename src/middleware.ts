import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !(await verifySessionCookie(token))) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
