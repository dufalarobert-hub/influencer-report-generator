import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, AUTH_MAX_AGE, computeToken, isCorrectPassword } from '@/lib/auth'

/**
 * POST /api/auth/login
 * Body: { password: string }
 * Pri správnom hesle nastaví podpísanú HttpOnly cookie.
 */
export async function POST(request: NextRequest) {
  let password = ''
  try {
    const body = await request.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek' }, { status: 400 })
  }

  if (!isCorrectPassword(password)) {
    // Malé oneskorenie sťažuje brute-force
    await new Promise(r => setTimeout(r, 600))
    return NextResponse.json({ success: false, error: 'Nesprávné heslo' }, { status: 401 })
  }

  const token = await computeToken()
  const response = NextResponse.json({ success: true })
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_MAX_AGE,
  })
  return response
}
