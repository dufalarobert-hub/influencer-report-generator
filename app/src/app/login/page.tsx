'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        const from = searchParams.get('from') || '/'
        // full reload, aby middleware videl novú cookie
        window.location.href = from
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Nesprávné heslo')
        setPassword('')
      }
    } catch {
      setError('Něco se pokazilo, zkuste to znovu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#3333FF' }}>
            nifty — minds
          </h1>
          <p className="text-gray-500 text-sm mt-1">Influencer Report Generator</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Přístupové heslo
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="••••••••"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: '#3333FF' }}
          >
            {loading ? 'Ověřuji…' : 'Vstoupit'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
              {error}
            </div>
          )}
        </form>

        <p className="text-center text-gray-400 text-xs mt-4">
          Interní nástroj. Heslo získáš od správce.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
