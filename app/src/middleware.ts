import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, isValidToken } from '@/lib/auth'

/**
 * Password gate (v5.1)
 *
 * Chráni CELÚ aplikáciu vrátane /api/report/generate (kde sa míňa platené API).
 * Bez platnej auth cookie → redirect na /login (alebo 401 pre API).
 *
 * Verejné (bez hesla): /login, /api/auth/*, Next.js interné assety.
 */

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Verejné cesty pustíme ďalej
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value
  const authed = await isValidToken(token)

  if (authed) {
    return NextResponse.next()
  }

  // API → 401 JSON; stránky → redirect na login s návratovou adresou
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Neautorizováno — přihlaste se' },
      { status: 401 }
    )
  }

  const loginUrl = new URL('/login', request.url)
  if (pathname !== '/') {
    loginUrl.searchParams.set('from', pathname)
  }
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Všetko OKREM Next.js interných assetov a favicon-u
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
