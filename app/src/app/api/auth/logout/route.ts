import { NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth'

/**
 * POST /api/auth/logout — zmaže auth cookie.
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
