'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ReportData } from '@/lib/types'

// Dynamicky importujeme PDFReport bez SSR (kvoli Chart.js)
const PDFReport = dynamic(() => import('@/components/PDFReport'), { ssr: false })


const CATEGORIES = [
  'Sport',
  'Lifestyle',
  'Beauty & Fashion',
  'Tech & Gaming',
  'Food & Gastro',
  'Travel',
  'Fitness & Health',
  'Entertainment',
  'Business & Finance',
  'Family & Parenting',
]

const COUNTRIES = [
  { code: 'CZ', name: 'Česko', flag: '🇨🇿' },
  { code: 'SK', name: 'Slovensko', flag: '🇸🇰' },
  { code: 'PL', name: 'Poľsko', flag: '🇵🇱' },
  { code: 'RO', name: 'Rumunsko', flag: '🇷🇴' },
  { code: 'DE', name: 'Nemecko', flag: '🇩🇪' },
  { code: 'IT', name: 'Taliansko', flag: '🇮🇹' },
  { code: 'HU', name: 'Maďarsko', flag: '🇭🇺' },
]

export default function Home() {
  // Report Generator state
  const [username, setUsername] = useState('')
  const [category, setCategory] = useState('Sport')
  const [country, setCountry] = useState('CZ')
  const [offeredPrice, setOfferedPrice] = useState('')
  const [averageOrderValue, setAverageOrderValue] = useState('')
  const [clientBrand, setClientBrand] = useState('')
  // Deliverables
  const [reelsPerMonth, setReelsPerMonth] = useState('2')
  const [postsPerMonth, setPostsPerMonth] = useState('1')
  const [storiesPerMonth, setStoriesPerMonth] = useState('4')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  // Počítadlo behu — bez neho user nevie, či to ide alebo zamrzlo
  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [loading])

  const generateReport = async () => {
    if (!username.trim() || !offeredPrice) return

    setLoading(true)
    setError('')
    setReportData(null)
    setProgress('Connecting to APIs...')

    try {
      setProgress('Fetching Instagram data via Apify...')

      const response = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.replace('@', ''),
          category,
          country,
          offeredPrice: parseInt(offeredPrice),
          averageOrderValue: averageOrderValue ? parseInt(averageOrderValue) : undefined,
          clientBrand: clientBrand.trim() || undefined,
          deliverables: {
            reelsPerMonth: reelsPerMonth !== '' ? parseInt(reelsPerMonth) : 2,
            postsPerMonth: postsPerMonth !== '' ? parseInt(postsPerMonth) : 1,
            storiesPerMonth: storiesPerMonth !== '' ? parseInt(storiesPerMonth) : 4,
          },
        }),
        // Vercel funkcia má strop 300 s — nikdy nečakaj dlhšie ako ona
        signal: AbortSignal.timeout(300_000),
      })

      // Pri timeoute/chybe infraštruktúry vráti Vercel HTML, nie JSON —
      // holé response.json() by spadlo na nezrozumiteľnej syntax chybe.
      const raw = await response.text()
      let result: { success?: boolean; error?: string; data?: { reportData: ReportData } }
      try {
        result = JSON.parse(raw)
      } catch {
        throw new Error(
          response.status === 504
            ? 'Server nestihl report dokončit v časovém limitu (300 s). Zkuste to prosím znovu — podruhé jsou data z cache a je to rychlejší.'
            : `Server vrátil neočekávanou odpověď (HTTP ${response.status}).`
        )
      }

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate report')
      }

      setReportData(result.data.reportData)
      setProgress('')
      setShowForm(false)

    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'TimeoutError'
          ? 'Generování trvalo déle než 5 minut a bylo přerušeno. Zkuste to prosím znovu.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong'
      setError(message)
      setProgress('')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setReportData(null)
    setShowForm(true)
    setUsername('')
    setCountry('CZ')
    setOfferedPrice('')
    setAverageOrderValue('')
    setReelsPerMonth('2')
    setPostsPerMonth('1')
    setStoriesPerMonth('4')
    setError('')
  }

  return (
    <main className="max-w-[210mm] mx-auto p-4 print:p-0 print:max-w-none">
      {/* Header - Hidden when printing */}
      {showForm && (
        <div className="print:hidden mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#3333FF' }}>
              nifty — minds
            </h1>
            <p className="text-gray-500 text-sm">Influencer Report Generator v5.1</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              window.location.href = '/login'
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Odhlásit
          </button>
        </div>
      )}

      {/* Input Form - Hidden when printing */}
      {showForm && !loading && (
        <div className="print:hidden bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Generate Influencer Report</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instagram Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="rousalruchy"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Krajina influencera
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Offered Price (CZK/month)
              </label>
              <input
                type="number"
                value={offeredPrice}
                onChange={(e) => setOfferedPrice(e.target.value)}
                placeholder="15000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Deliverables - what influencer promises */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Sľúbené výstupy (za mesiac)
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reels videá</label>
                <input
                  type="number"
                  value={reelsPerMonth}
                  onChange={(e) => setReelsPerMonth(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Foto/Carousel</label>
                <input
                  type="number"
                  value={postsPerMonth}
                  onChange={(e) => setPostsPerMonth(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stories</label>
                <input
                  type="number"
                  value={storiesPerMonth}
                  onChange={(e) => setStoriesPerMonth(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                />
              </div>
            </div>
          </div>

          {/* Optional: AOV for conversion predictions */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Average Order Value (CZK) <span className="text-gray-400 font-normal">— optional, for ROI predictions</span>
            </label>
            <input
              type="number"
              value={averageOrderValue}
              onChange={(e) => setAverageOrderValue(e.target.value)}
              placeholder="500"
              className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ak zadáš priemernú hodnotu objednávky, vypočítame predikciu konverzií a ROI
            </p>
          </div>

          {/* Optional: client brand for competitor check */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Klientova značka / odvetvie <span className="text-gray-400 font-normal">— optional, zapne konkurenčnú kontrolu</span>
            </label>
            <input
              type="text"
              value={clientBrand}
              onChange={(e) => setClientBrand(e.target.value)}
              placeholder="napr. Notino (kozmetika e-shop)"
              className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Research označí spolupráce influencera s konkurenciou tejto značky (⚠️ v reporte)
            </p>
          </div>

          <button
            onClick={generateReport}
            disabled={loading || !username.trim() || !offeredPrice}
            className="w-full py-3 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: '#3333FF' }}
          >
            {loading ? progress || 'Generating...' : 'Generate Report'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="print:hidden bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">{progress}</p>
          <p className="text-gray-400 text-sm mt-2">
            Obvykle 2–3 minuty · běží {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </p>
          <div className="mt-4 text-left max-w-md mx-auto">
            <div className="text-xs text-gray-500 space-y-1">
              <p>1. Fetching Instagram profile data...</p>
              <p>2. Analyzing engagement metrics...</p>
              <p>3. Running web research (media, controversies)...</p>
              <p>4. Calculating market value & ROI...</p>
              <p>5. Generating report...</p>
            </div>
          </div>
        </div>
      )}

      {/* Report Results */}
      {reportData && !loading && (
        <>
          {/* Back Button - Hidden when printing */}
          <div className="print:hidden mb-4 flex justify-between items-center">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              New Report
            </button>
          </div>

          {/* PDF Report Component */}
          <PDFReport data={reportData} />

          {/* Debug Data - Hidden when printing */}
          <details className="print:hidden mt-6 bg-white rounded-lg shadow-md p-6">
            <summary className="cursor-pointer font-medium">Show Raw Data (Debug)</summary>
            <pre className="mt-4 p-4 bg-gray-100 rounded-lg text-xs overflow-auto max-h-96">
              {JSON.stringify(reportData, null, 2)}
            </pre>
          </details>
        </>
      )}
    </main>
  )
}
