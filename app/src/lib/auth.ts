/**
 * Jednoduchá password-gate autentifikácia (v5.1)
 *
 * Jedno univerzálne heslo (APP_PASSWORD) pre celý interný tím — žiadne emaily,
 * žiadna DB. Po prihlásení sa nastaví HttpOnly cookie podpísaná HMAC-om
 * (AUTH_SECRET), takže ju nejde sfalšovať bez znalosti secretu.
 *
 * Web Crypto (crypto.subtle) funguje v edge middleware aj v node API routách.
 */

export const AUTH_COOKIE = 'irg_auth'
// 7 dní — kolega sa neprihlasuje pri každom reporte
export const AUTH_MAX_AGE = 60 * 60 * 24 * 7

function getSecret(): string {
  // Fallback na APP_PASSWORD, aby appka fungovala aj keď zabudneš nastaviť
  // AUTH_SECRET — ale do produkcie nastav vlastný náhodný AUTH_SECRET.
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD
  if (!secret) {
    throw new Error('AUTH_SECRET (alebo APP_PASSWORD) nie je nastavený')
  }
  return secret
}

/**
 * Vypočíta podpis (hex HMAC-SHA256) konštantného tokenu pomocou secretu.
 * Toto je hodnota, ktorá sa uloží do cookie.
 */
export async function computeToken(): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('authenticated'))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Constant-time porovnanie reťazcov rovnakej dĺžky */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Overí, či hodnota cookie zodpovedá platnému podpisu.
 */
export async function isValidToken(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false
  try {
    const expected = await computeToken()
    return safeEqual(cookieValue, expected)
  } catch {
    return false
  }
}

/**
 * Overí zadané heslo proti APP_PASSWORD (constant-time).
 */
export function isCorrectPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) {
    throw new Error('APP_PASSWORD nie je nastavený')
  }
  return safeEqual(password, expected)
}
