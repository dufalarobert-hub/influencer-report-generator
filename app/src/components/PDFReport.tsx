'use client'

import { useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { ReportData } from '@/lib/types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface PDFReportProps {
  data: ReportData
}

export default function PDFReport({ data }: PDFReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return Math.round(num / 1000) + 'K'
    return num.toString()
  }

  const formatCZK = (num: number) => {
    return new Intl.NumberFormat('cs-CZ').format(Math.round(num / 1000)) + 'K'
  }

  const currentDate = new Date().toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  // Calculate max reel views
  const maxReelViews = data.topReels.length > 0
    ? Math.max(...data.topReels.map(r => r.videoViewCount || 0))
    : 0

  // Calculate average reel views
  const avgReelViews = data.topReels.length > 0
    ? Math.round(data.topReels.reduce((sum, r) => sum + (r.videoViewCount || 0), 0) / data.topReels.length)
    : 0

  // Reels chart data - use truncated captions as labels
  const getReelLabel = (reel: { caption?: string }, index: number): string => {
    if (!reel.caption) return `Reel ${index + 1}`
    // Get first 12 chars, remove hashtags for cleaner labels
    const clean = reel.caption
      .replace(/#\w+/g, '')  // Remove hashtags
      .replace(/[^\w\sáäčďéěíľĺňóôŕřšťúůýžÁÄČĎÉĚÍĽĹŇÓÔŔŘŠŤÚŮÝŽ]/gi, '') // Keep only letters
      .trim()
      .substring(0, 12)
    return clean || `Reel ${index + 1}`
  }

  const reelsChartData = {
    labels: data.topReels.slice(0, 8).map((r, i) => getReelLabel(r, i)),
    datasets: [{
      label: 'Videnia',
      data: data.topReels.slice(0, 8).map(r => r.videoViewCount || 0),
      backgroundColor: '#3333FF',
      borderRadius: 4,
    }]
  }

  const reelsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Top 8 Reels Performance (pocet videni)',
        color: '#000',
        font: { size: 11, weight: 700 as const },
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#666',
          font: { size: 8 },
          callback: (value: number | string) => {
            const num = typeof value === 'number' ? value : parseFloat(value)
            return num >= 1000000 ? (num/1000000) + 'M' : (num/1000) + 'K'
          }
        },
        grid: { color: '#E0E0E0' }
      },
      x: {
        ticks: { color: '#666', font: { size: 8 } },
        grid: { display: false }
      }
    }
  }

  // Cost comparison chart data (v5.1: dynamický CPM namiesto hardcoded 30K)
  const meta1M = Math.round((data.metrics.roi.metaAdsCPM || 35) * 1000)
  const influencer1M = Math.round(data.metrics.roi.influencerCPM * 1000)
  const metaTotal = data.metrics.roi.metaAdsEquivalent
  const influencerTotal = data.metrics.roi.totalContractValue

  const costChartData = {
    labels: ['Meta 1M', `${data.profile.username} 1M`, 'Meta 6M', `${data.profile.username} 6M`],
    datasets: [{
      label: 'Naklady (CZK)',
      data: [meta1M, influencer1M, metaTotal, influencerTotal],
      backgroundColor: ['#999', '#3333FF', '#999', '#3333FF'],
      borderRadius: 4,
    }]
  }

  const costChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Cost Comparison: Meta Ads vs. Influencer',
        color: '#000',
        font: { size: 11, weight: 700 as const },
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#666',
          font: { size: 8 },
          callback: (value: number | string) => {
            const num = typeof value === 'number' ? value : parseFloat(value)
            return num >= 1000 ? (num/1000) + 'K' : num
          }
        },
        grid: { color: '#E0E0E0' }
      },
      x: {
        ticks: { color: '#666', font: { size: 8 } },
        grid: { display: false }
      }
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const getRiskBadge = (level: string, text: string) => {
    const colors: Record<string, string> = {
      'HIGH': 'bg-red-500',
      'MEDIUM': 'bg-orange-500',
      'LOW': 'bg-green-500',
      'POSITIVE': 'bg-green-500',
      'NEUTRAL': 'bg-gray-500',
      'NEGATIVE': 'bg-red-500'
    }
    return (
      <span className={`${colors[level] || 'bg-gray-500'} text-white px-2 py-0.5 rounded text-xs font-semibold`}>
        {text}
      </span>
    )
  }

  return (
    <>
      {/* Print Button */}
      <div className="print:hidden mb-4 flex justify-end">
        <button
          onClick={handlePrint}
          className="px-6 py-3 text-white rounded-lg font-medium flex items-center gap-2"
          style={{ backgroundColor: '#3333FF' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
      </div>

      {/* PDF Report Container */}
      <div ref={reportRef} className="pdf-report">
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .pdf-report, .pdf-report * {
              visibility: visible;
            }
            .pdf-report {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .print\\:hidden {
              display: none !important;
            }
          }

          .pdf-report {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: #F5F5F5;
            color: #000;
            line-height: 1.5;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            background: #F5F5F5;
            padding: 13mm;
            page-break-after: always;
            position: relative;
            margin: 0 auto 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }

          @media print {
            .page {
              box-shadow: none;
              margin: 0;
            }
          }

          .page:last-child {
            page-break-after: avoid;
          }

          @page {
            size: A4;
            margin: 0;
          }
        `}</style>

        {/* PAGE 1: Profile & Overview */}
        <div className="page">
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div>
              <div className="text-lg font-bold">nifty — minds</div>
              <div className="text-gray-500 text-xs mt-1">Influencer Marketing Intelligence</div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div className="font-semibold">ANALYZA</div>
              <div>{currentDate}</div>
            </div>
          </div>

          {/* Hero Name */}
          <h1 className="text-4xl font-bold uppercase mb-2" style={{ color: '#3333FF', letterSpacing: '-0.5px' }}>
            {data.research.fullName || data.profile.fullName}
            {data.research.nickname && ` "${data.research.nickname}"`}
          </h1>
          <p className="text-gray-500 text-sm mb-4">
            @{data.profile.username} | {data.research.occupation || `${data.input.category} Influencer`}
          </p>

          {/* Profile Hero Box */}
          <div className="grid grid-cols-[250px_1fr] gap-5 bg-white p-5 rounded-lg border-[3px]" style={{ borderColor: '#3333FF' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(data.profile.profilePicUrl)}`}
              alt={data.profile.username}
              className="w-[250px] h-[250px] rounded-lg border-[3px] object-cover bg-gray-200"
              style={{ borderColor: '#3333FF' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.onerror = null
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.profile.fullName || data.profile.username)}&size=250&background=3333FF&color=fff&bold=true`
              }}
            />
            <div>
              {/* Stats Box */}
              <div className="grid grid-cols-3 gap-3 bg-white border-2 border-gray-200 rounded-md p-3 mb-3">
                <div className="text-center">
                  <span className="text-3xl font-bold block" style={{ color: '#3333FF' }}>
                    {formatNumber(data.profile.followersCount)}
                  </span>
                  <span className="text-xs text-gray-500 uppercase font-semibold mt-1 block">Followers</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold block" style={{ color: '#3333FF' }}>
                    {data.profile.postsCount}
                  </span>
                  <span className="text-xs text-gray-500 uppercase font-semibold mt-1 block">Příspěvky</span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold block" style={{ color: '#3333FF' }}>
                    {data.profile.verified ? '✓' : '—'}
                  </span>
                  <span className="text-xs text-gray-500 uppercase font-semibold mt-1 block">Verified</span>
                </div>
              </div>

              {/* Info Rows */}
              <div className="text-sm space-y-1">
                <div><span className="font-semibold">Bio:</span> {data.profile.biography?.substring(0, 100) || 'N/A'}</div>
                <div><span className="font-semibold">Kategorie:</span> {data.input.category}</div>
                {data.research.partnerInfo && (
                  <div><span className="font-semibold">Partner:</span> {data.research.partnerInfo}</div>
                )}
              </div>
            </div>
          </div>

          {/* Virality Callout */}
          {data.metrics.reachMultiplier > 1 && (
            <div className="text-white text-center py-3 px-4 rounded-md my-4 font-semibold" style={{ backgroundColor: '#3333FF' }}>
              🔥 {data.metrics.reachMultiplier >= 3 ? 'EXTREME VIRALITY' : 'GOOD REACH'}: {data.metrics.reachMultiplier.toFixed(0)}× vyšší reach než follower base
            </div>
          )}

          {/* Performance Overview */}
          <h2 className="text-base font-bold uppercase mt-4 mb-3" style={{ color: '#3333FF', letterSpacing: '0.5px' }}>
            Performance Overview
          </h2>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border-2 rounded-md p-3 text-center" style={{ borderColor: '#3333FF' }}>
              <span className="text-2xl font-bold block" style={{ color: '#3333FF' }}>
                {formatNumber(maxReelViews)}
              </span>
              <span className="text-xs text-gray-500 font-semibold mt-1 block">Reach<br/>(virální)</span>
            </div>
            <div className="bg-white border-2 rounded-md p-3 text-center" style={{ borderColor: '#3333FF' }}>
              <span className="text-2xl font-bold block" style={{ color: '#3333FF' }}>
                {formatNumber(avgReelViews)}
              </span>
              <span className="text-xs text-gray-500 font-semibold mt-1 block">Reach<br/>(standard)</span>
            </div>
            <div className="bg-white border-2 rounded-md p-3 text-center" style={{ borderColor: '#3333FF' }}>
              <span className="text-2xl font-bold block" style={{ color: '#3333FF' }}>
                {data.profile.medianEngagementRate?.toFixed(2) || data.metrics.engagementRate.toFixed(2)}%
              </span>
              <span className="text-xs text-gray-500 font-semibold mt-1 block">Engagement Rate<br/>(medián)</span>
            </div>
          </div>

          {/* HIGH VARIANCE WARNING */}
          {data.profile.hasHighVariance && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3 mt-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-lg">⚠️</span>
                <div>
                  <span className="text-xs font-bold text-amber-700 block">Vysoký rozptyl v engagement</span>
                  <span className="text-xs text-amber-600">
                    Priemer ({data.profile.engagementRate?.toFixed(2)}%) je výrazne vyšší ako medián ({data.profile.medianEngagementRate?.toFixed(2)}%).
                    Profil má pravdepodobne 1-2 virálne posty, ktoré skresľujú štatistiky.
                    <strong> Medián je presnejší ukazovateľ bežného výkonu.</strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* NEW: ER Benchmark Visual */}
          {data.metrics.erBenchmark && (
            <div className="bg-white border border-gray-200 rounded-md p-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">Engagement Rate Benchmark</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  data.metrics.erBenchmark.rating === 'EXCELLENT' ? 'bg-green-500 text-white' :
                  data.metrics.erBenchmark.rating === 'GOOD' ? 'bg-green-400 text-white' :
                  data.metrics.erBenchmark.rating === 'AVERAGE' ? 'bg-yellow-400 text-black' :
                  data.metrics.erBenchmark.rating === 'BELOW_AVERAGE' ? 'bg-orange-400 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  {data.metrics.erBenchmark.rating}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${data.metrics.erBenchmark.percentile}%`,
                    backgroundColor: '#3333FF'
                  }}
                />
              </div>
              <div className="text-xs text-gray-500">{data.metrics.erBenchmark.context}</div>
            </div>
          )}

          {/* NEW: Audience Quality Estimate */}
          {data.metrics.audienceQuality && (
            <div className="bg-white border border-gray-200 rounded-md p-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">🔍 Kvalita Publika (Detekce Botů)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  data.metrics.audienceQuality.riskLevel === 'LOW' ? 'bg-green-500 text-white' :
                  data.metrics.audienceQuality.riskLevel === 'MEDIUM' ? 'bg-yellow-400 text-black' :
                  'bg-red-500 text-white'
                }`}>
                  {data.metrics.audienceQuality.estimatedQuality}% | {data.metrics.audienceQuality.riskLevel} RISK
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {data.metrics.audienceQuality.greenFlags.length > 0 && (
                  <div>
                    {data.metrics.audienceQuality.greenFlags.slice(0, 2).map((flag, i) => (
                      <div key={i} className="text-green-600">✓ {flag}</div>
                    ))}
                  </div>
                )}
                {data.metrics.audienceQuality.redFlags.length > 0 && (
                  <div>
                    {data.metrics.audienceQuality.redFlags.slice(0, 2).map((flag, i) => (
                      <div key={i} className="text-red-600">⚠ {flag}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Confidence: {data.metrics.audienceQuality.confidence}
              </div>
            </div>
          )}

          {/* NEW: Comment Quality Analysis */}
          {data.commentAnalysis && (
            <div className="bg-white border border-gray-200 rounded-md p-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">💬 Kvalita Komentářů</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  data.commentAnalysis.qualityRating === 'HIGH' ? 'bg-green-500 text-white' :
                  data.commentAnalysis.qualityRating === 'MEDIUM' ? 'bg-yellow-400 text-black' :
                  'bg-red-500 text-white'
                }`}>
                  {data.commentAnalysis.commentQualityScore}/100 | {data.commentAnalysis.qualityRating}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center mb-2">
                <div>
                  <div className="font-semibold" style={{ color: '#3333FF' }}>{data.commentAnalysis.totalComments}</div>
                  <div className="text-gray-500">Celkem</div>
                </div>
                <div>
                  <div className="text-red-500 font-semibold">{data.commentAnalysis.genericRatio}%</div>
                  <div className="text-gray-500">Generic</div>
                </div>
                <div>
                  <div className="text-green-500 font-semibold">{data.commentAnalysis.meaningfulRatio}%</div>
                  <div className="text-gray-500">Kvalitní</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {data.commentAnalysis.greenFlags.length > 0 && (
                  <div>
                    {data.commentAnalysis.greenFlags.slice(0, 2).map((flag, i) => (
                      <div key={i} className="text-green-600">✓ {flag}</div>
                    ))}
                  </div>
                )}
                {data.commentAnalysis.redFlags.length > 0 && (
                  <div>
                    {data.commentAnalysis.redFlags.slice(0, 2).map((flag, i) => (
                      <div key={i} className="text-red-600">⚠ {flag}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NEW: Viral Potential Scoring */}
          {data.metrics.viralPotential && data.metrics.viralPotential.avgReelViews > 0 && (
            <div className="bg-white border border-gray-200 rounded-md p-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">🚀 Virální Potenciál</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  data.metrics.viralPotential.viralRating === 'VERY_HIGH' ? 'bg-purple-500 text-white' :
                  data.metrics.viralPotential.viralRating === 'HIGH' ? 'bg-green-500 text-white' :
                  data.metrics.viralPotential.viralRating === 'MEDIUM' ? 'bg-yellow-400 text-black' :
                  'bg-gray-400 text-white'
                }`}>
                  {data.metrics.viralPotential.viralRating} ({data.metrics.viralPotential.viralScore}/10)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div>
                  <div className="text-orange-600 font-semibold">{formatNumber(data.metrics.viralPotential.prediction.conservative)}</div>
                  <div className="text-gray-500">Pesimist.</div>
                </div>
                <div>
                  <div className="font-bold" style={{ color: '#3333FF' }}>{formatNumber(data.metrics.viralPotential.prediction.realistic)}</div>
                  <div className="text-gray-500">Průměr</div>
                </div>
                <div>
                  <div className="text-green-600 font-semibold">{formatNumber(data.metrics.viralPotential.prediction.optimistic)}</div>
                  <div className="text-gray-500">Virální</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-1 text-center">
                Konzistence: {Math.round(data.metrics.viralPotential.consistency * 100)}% | Max: {formatNumber(data.metrics.viralPotential.maxReelViews)} views
              </div>
            </div>
          )}

          {/* NEW: Celebrity Tier (if applicable) */}
          {data.metrics.marketValue.celebrityTier && (
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center py-2 px-4 rounded-md mt-3 font-semibold text-sm">
              ⭐ {data.metrics.marketValue.celebrityTier}
            </div>
          )}

          {/* Media & Events Info */}
          {(data.research.mediaAppearances?.tvShows?.length ||
            data.research.mediaAppearances?.articles?.length ||
            data.research.mediaAppearances?.interviews?.length ||
            data.research.recentNews?.hasNews ||
            data.research.upcomingEvents?.hasEvents) && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold mb-2" style={{ color: '#3333FF' }}>📰 MEDIÁLNÍ ZMÍNKY A AKTUALITY</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Recent News */}
                {data.research.recentNews?.hasNews && data.research.recentNews.headlines.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-3">
                    <h4 className="text-xs font-semibold mb-1">🔥 Aktuální zprávy</h4>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {data.research.recentNews.headlines.slice(0, 3).map((headline, i) => (
                        <li key={i}>• {headline}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Articles */}
                {data.research.mediaAppearances?.articles && data.research.mediaAppearances.articles.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-3">
                    <h4 className="text-xs font-semibold mb-1">📄 Články v médiích</h4>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {data.research.mediaAppearances.articles.slice(0, 3).map((article, i) => (
                        <li key={i}>• {article}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* TV Shows */}
                {data.research.mediaAppearances?.tvShows && data.research.mediaAppearances.tvShows.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-3">
                    <h4 className="text-xs font-semibold mb-1">📺 TV Shows</h4>
                    <p className="text-xs text-gray-600">{data.research.mediaAppearances.tvShows.slice(0, 3).join(', ')}</p>
                  </div>
                )}
                {/* Interviews */}
                {data.research.mediaAppearances?.interviews && data.research.mediaAppearances.interviews.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-3">
                    <h4 className="text-xs font-semibold mb-1">🎤 Rozhovory</h4>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {data.research.mediaAppearances.interviews.slice(0, 2).map((interview, i) => (
                        <li key={i}>• {interview}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Upcoming Events */}
                {data.research.upcomingEvents?.hasEvents && (
                  <div className="bg-white border border-gray-200 rounded-md p-3">
                    <h4 className="text-xs font-semibold mb-1">📅 Nadcházející eventy</h4>
                    <p className="text-xs text-gray-600">{data.research.upcomingEvents.events.slice(0, 2).join(', ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="absolute bottom-4 left-4 right-4 border-t border-gray-200 pt-3 flex justify-between text-xs text-gray-500">
            <span>nifty — minds</span>
            <span>Strana 1/3</span>
          </div>
        </div>

        {/* PAGE 2: Engagement & Financie */}
        <div className="page">
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div>
              <div className="text-lg font-bold">nifty — minds</div>
              <div className="text-gray-500 text-xs mt-1">Influencer Marketing Intelligence</div>
            </div>
          </div>

          <h2 className="text-base font-bold uppercase mb-3" style={{ color: '#3333FF', letterSpacing: '0.5px' }}>
            Engagement Analyza
          </h2>

          {/* Engagement Table */}
          <table className="w-full text-sm bg-white rounded-md overflow-hidden mb-4">
            <thead>
              <tr style={{ backgroundColor: '#3333FF' }} className="text-white">
                <th className="py-2 px-3 text-left text-xs uppercase font-semibold">Typ obsahu</th>
                <th className="py-2 px-3 text-right text-xs uppercase font-semibold">Likes</th>
                <th className="py-2 px-3 text-right text-xs uppercase font-semibold">Comments</th>
                <th className="py-2 px-3 text-right text-xs uppercase font-semibold">ER</th>
              </tr>
            </thead>
            <tbody>
              {data.topPosts.slice(0, 8).map((post, i) => {
                const er = ((post.likesCount + post.commentsCount) / data.profile.followersCount * 100).toFixed(2)
                return (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-2 px-3">{post.caption?.substring(0, 30) || post.type}</td>
                    <td className="py-2 px-3 text-right font-semibold" style={{ color: '#3333FF' }}>
                      {formatNumber(post.likesCount)}
                    </td>
                    <td className="py-2 px-3 text-right">{post.commentsCount}</td>
                    <td className="py-2 px-3 text-right font-semibold">{er}%</td>
                  </tr>
                )
              })}
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="py-2 px-3 font-semibold">Priemer</td>
                <td className="py-2 px-3 text-right font-bold">{formatNumber(data.profile.avgLikes || 0)}</td>
                <td className="py-2 px-3 text-right font-bold">{Math.round(data.profile.avgComments || 0)}</td>
                <td className="py-2 px-3 text-right font-bold">{data.profile.engagementRate?.toFixed(2)}%</td>
              </tr>
              {/* Trimmed Mean row */}
              {data.profile.trimmedMeanLikes !== undefined && (
                <tr className="bg-blue-50">
                  <td className="py-2 px-3 font-semibold text-blue-700">
                    Trimmed Mean <span className="text-xs font-normal">(10% orez)</span>
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-blue-700">{formatNumber(data.profile.trimmedMeanLikes)}</td>
                  <td className="py-2 px-3 text-right font-bold text-blue-700">{Math.round(data.profile.trimmedMeanComments || 0)}</td>
                  <td className="py-2 px-3 text-right font-bold text-blue-700">{data.profile.trimmedMeanEngagementRate?.toFixed(2)}%</td>
                </tr>
              )}
              {/* Median row */}
              {data.profile.medianLikes !== undefined && (
                <tr className={data.profile.hasHighVariance ? "bg-green-50" : "bg-gray-50"}>
                  <td className="py-2 px-3 font-semibold text-green-700">
                    Medián {data.profile.hasHighVariance && <span className="text-green-600">✓</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-green-700">{formatNumber(data.profile.medianLikes)}</td>
                  <td className="py-2 px-3 text-right font-bold text-green-700">{Math.round(data.profile.medianComments || 0)}</td>
                  <td className="py-2 px-3 text-right font-bold text-green-700">{data.profile.medianEngagementRate?.toFixed(2)}%</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Variance warning */}
          {data.profile.hasHighVariance && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2 mb-3 text-xs">
              <span className="text-amber-700">
                ⚠️ <strong>Vysoký rozptyl:</strong> Priemer ({data.profile.engagementRate?.toFixed(2)}%) je skreslený 1-2 virálnymi postami.
                Pre ROI kalkulácie sa používa <strong className="text-green-700">Medián ({data.profile.medianEngagementRate?.toFixed(2)}%)</strong>.
              </span>
            </div>
          )}

          {/* Reels Chart */}
          <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200" style={{ height: '140px' }}>
            <Bar data={reelsChartData} options={reelsChartOptions} />
          </div>

          <h2 className="text-base font-bold uppercase mb-3" style={{ color: '#3333FF', letterSpacing: '0.5px' }}>
            Value Breakdown - Co Dostanu Za Peníze?
          </h2>

          {/* Delivery Estimate */}
          {data.metrics.roi.delivery && (
            <div className="bg-white border-2 rounded-md p-3 mb-3" style={{ borderColor: '#3333FF' }}>
              <h3 className="text-xs font-semibold mb-2">📦 Slíbené Výstupy (6 měsíců)</h3>
              <div className="grid grid-cols-6 gap-2 text-center mb-2">
                <div>
                  <div className="text-lg font-bold" style={{ color: '#3333FF' }}>{data.metrics.roi.delivery.totalReels || 0}</div>
                  <div className="text-xs text-gray-500">Reels</div>
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: '#3333FF' }}>{data.metrics.roi.delivery.totalPosts || 0}</div>
                  <div className="text-xs text-gray-500">Foto</div>
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: '#3333FF' }}>{data.metrics.roi.delivery.totalStories || 0}</div>
                  <div className="text-xs text-gray-500">Stories</div>
                </div>
                <div className="border-l border-gray-200 pl-2">
                  <div className="text-lg font-bold" style={{ color: '#3333FF' }}>{data.metrics.roi.delivery.totalContent || 0}</div>
                  <div className="text-xs text-gray-500">Celkom</div>
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: '#3333FF' }}>{formatNumber(data.metrics.roi.delivery.totalReach)}</div>
                  <div className="text-xs text-gray-500">Reach</div>
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: '#3333FF' }}>{formatNumber(data.metrics.roi.delivery.totalEngagements)}</div>
                  <div className="text-xs text-gray-500">Engagem.</div>
                </div>
              </div>
              {/* MIN/MAX Reach Interval */}
              <div className="bg-gray-50 rounded p-2 mt-2">
                <div className="text-xs text-gray-500 mb-1 text-center">Předpokládaný Reach (6 měs.)</div>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="text-orange-600 font-semibold">MIN: {formatNumber(data.metrics.roi.delivery.totalReachMin || 0)}</span>
                  <span className="text-gray-400">—</span>
                  <span className="font-bold" style={{ color: '#3333FF' }}>PRŮMĚR: {formatNumber(data.metrics.roi.delivery.totalReach)}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-green-600 font-semibold">MAX: {formatNumber(data.metrics.roi.delivery.totalReachMax || 0)}</span>
                </div>
              </div>
              <div className="text-xs text-gray-400 text-center mt-2">
                Měsíčně: {data.metrics.roi.delivery.reelsPerMonth || 0} reels + {data.metrics.roi.delivery.postsPerMonth || 0} foto + {data.metrics.roi.delivery.storiesPerMonth || 0} stories
              </div>
            </div>
          )}

          {/* Value Breakdown Table */}
          {data.metrics.roi.valueBreakdown && (
            <table className="w-full text-xs bg-white rounded-md overflow-hidden mb-3">
              <thead>
                <tr style={{ backgroundColor: '#3333FF' }} className="text-white">
                  <th className="py-2 px-2 text-left uppercase font-semibold">Hodnota</th>
                  <th className="py-2 px-2 text-right uppercase font-semibold">Částka</th>
                  <th className="py-2 px-2 text-left uppercase font-semibold">Vysvětlení</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-2">📊 Reach Value</td>
                  <td className="py-2 px-2 text-right font-semibold" style={{ color: '#3333FF' }}>{formatNumber(data.metrics.roi.valueBreakdown.reachValue)} CZK</td>
                  <td className="py-2 px-2 text-gray-500 text-xs">Meta Ads CPM + warm audience premium</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-2">💬 Engagement Value</td>
                  <td className="py-2 px-2 text-right font-semibold" style={{ color: '#3333FF' }}>{formatNumber(data.metrics.roi.valueBreakdown.engagementValue)} CZK</td>
                  <td className="py-2 px-2 text-gray-500 text-xs">Meta Ads CPE + trust premium</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-2">🎬 Content Value</td>
                  <td className="py-2 px-2 text-right font-semibold" style={{ color: '#3333FF' }}>{formatNumber(data.metrics.roi.valueBreakdown.contentValue)} CZK</td>
                  <td className="py-2 px-2 text-gray-500 text-xs">Video/foto produkcia</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 px-2 font-bold">CELKOVÁ HODNOTA</td>
                  <td className="py-2 px-2 text-right font-bold text-lg" style={{ color: '#3333FF' }}>{formatNumber(data.metrics.roi.valueBreakdown.totalValue)} CZK</td>
                  <td className="py-2 px-2 text-gray-500 text-xs">max(Reach, Engagement) + Content</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* v5.1: methodology note — media value is NOT double-counted */}
          {data.metrics.roi.valueBreakdown && (
            <div className="text-xs text-gray-400 mb-3 -mt-2 px-1">
              Reach a Engagement value se překrývají (engagement je součástí nakoupených impresí),
              proto se do celkové hodnoty počítá vyšší z nich — ne součet.
            </div>
          )}

          {/* Value Ratio Callout */}
          {data.metrics.roi.valueBreakdown && (
            <div className="text-white text-center py-3 px-4 rounded-md mb-3" style={{ backgroundColor: '#3333FF' }}>
              <div className="text-sm mb-1">
                <strong>Cena:</strong> {formatNumber(data.metrics.roi.valueBreakdown.totalCost)} CZK |
                <strong> Hodnota:</strong> {formatNumber(data.metrics.roi.valueBreakdown.totalValue)} CZK
              </div>
              <div className="text-2xl font-bold">
                VALUE RATIO: {data.metrics.roi.valueBreakdown.valueRatio}x
              </div>
              <div className="text-xs mt-1 opacity-80">
                {data.metrics.roi.valueBreakdown.valueRatio >= 2 ? '✓ Vynikající deal' :
                 data.metrics.roi.valueBreakdown.valueRatio >= 1.5 ? '✓ Dobrý deal' :
                 data.metrics.roi.valueBreakdown.valueRatio >= 1 ? '~ OK deal' : '⚠ Předražené'}
              </div>
            </div>
          )}

          {/* Net Value */}
          {data.metrics.roi.valueBreakdown && data.metrics.roi.valueBreakdown.netValue > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md p-2 text-center mb-3">
              <span className="text-green-700 font-semibold text-sm">
                💰 Čistý zisk hodnoty: +{formatNumber(data.metrics.roi.valueBreakdown.netValue)} CZK
              </span>
            </div>
          )}

          {/* NEW: Conversion Predictions with Scenario Matrix (if AOV provided) */}
          {data.metrics.predictions && data.metrics.predictions.expectedConversions && (
            <>
              <h2 className="text-base font-bold uppercase mb-3" style={{ color: '#3333FF', letterSpacing: '0.5px' }}>
                Predikce Konverzí
              </h2>
              <div className="bg-white border-2 rounded-md p-3 mb-3" style={{ borderColor: '#3333FF' }}>
                <div className="text-xs text-gray-500 mb-2">Conversion Funnel (6 měsíců)</div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold" style={{ color: '#3333FF' }}>
                      {formatNumber(data.metrics.roi.delivery?.totalReach || 0)}
                    </div>
                    <div className="text-gray-500">👁️ Views</div>
                  </div>
                  <div className="text-gray-400">→</div>
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold" style={{ color: '#3333FF' }}>
                      {formatNumber(data.metrics.predictions.expectedClicks)}
                    </div>
                    <div className="text-gray-500">🖱️ Clicks ({data.metrics.predictions.ctrUsed}%)</div>
                  </div>
                  <div className="text-gray-400">→</div>
                  <div className="text-center flex-1">
                    <div className="text-lg font-bold" style={{ color: '#3333FF' }}>
                      {formatNumber(data.metrics.predictions.expectedConversions)}
                    </div>
                    <div className="text-gray-500">🛒 Sales ({data.metrics.predictions.conversionRateUsed}%)</div>
                  </div>
                </div>

                {/* Scenario Matrix (3x3) */}
                {data.metrics.predictions.scenarioMatrix && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs font-semibold mb-2 text-center">📊 Matice Scénářů (CTR × CR)</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="p-1 text-left text-gray-500"></th>
                          {data.metrics.predictions.crOptions?.map((cr) => (
                            <th key={cr} className="p-1 text-center text-gray-500">CR {cr}%</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.metrics.predictions.scenarioMatrix.map((row, ctrIdx) => {
                          const predictions = data.metrics.predictions!
                          return (
                          <tr key={ctrIdx}>
                            <td className="p-1 text-gray-500 font-semibold">CTR {predictions.ctrOptions?.[ctrIdx]}%</td>
                            {row.map((scenario, crIdx) => {
                              const isRecommended =
                                predictions.ctrOptions?.[ctrIdx] === predictions.recommendedCTR &&
                                predictions.crOptions?.[crIdx] === predictions.recommendedCR
                              return (
                                <td
                                  key={crIdx}
                                  className={`p-1 text-center rounded ${
                                    isRecommended ? 'bg-blue-100 ring-2 ring-blue-500' :
                                    scenario.isProfitable ? 'bg-green-50' : 'bg-red-50'
                                  }`}
                                >
                                  <div className="font-semibold">{scenario.conversions} ks</div>
                                  <div className={`text-xs ${scenario.isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                                    {scenario.roi > 0 ? '+' : ''}{scenario.roi}%
                                  </div>
                                  {isRecommended && <div className="text-xs text-blue-600">★ Doporučené</div>}
                                </td>
                              )
                            })}
                          </tr>
                        )})}
                      </tbody>
                    </table>
                    <div className="text-xs text-gray-400 text-center mt-2">
                      Doporučený scénář na základě ER ratingu • Zelené = ziskové, Červené = ztrátové
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-2 mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-gray-500">Break-even</div>
                    <div className="font-semibold">{data.metrics.predictions.breakEvenSales} prodejů</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Predikce</div>
                    <div className="font-semibold text-green-600">{data.metrics.predictions.expectedConversions} prodejů</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Expected Revenue</div>
                    <div className="font-semibold">{formatNumber(data.metrics.predictions.expectedRevenue || 0)} CZK</div>
                  </div>
                </div>
                {data.metrics.predictions.expectedROI !== undefined && (
                  <div className={`mt-2 text-center py-1 rounded text-sm font-bold ${
                    data.metrics.predictions.expectedROI > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    Expected ROI: {data.metrics.predictions.expectedROI > 0 ? '+' : ''}{data.metrics.predictions.expectedROI}%
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="absolute bottom-4 left-4 right-4 border-t border-gray-200 pt-3 flex justify-between text-xs text-gray-500">
            <span>nifty — minds</span>
            <span>Strana 2/3</span>
          </div>
        </div>

        {/* PAGE 3: Market Value & Verdict */}
        <div className="page">
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
            <div>
              <div className="text-lg font-bold">nifty — minds</div>
              <div className="text-gray-500 text-xs mt-1">Influencer Marketing Intelligence</div>
            </div>
          </div>

          <h2 className="text-base font-bold uppercase mb-3" style={{ color: '#3333FF', letterSpacing: '0.5px' }}>
            Market Value & Brand Safety
          </h2>

          {/* v5.1: Research failure warning — brand safety NOT verified */}
          {data.research.researchUnavailable && (
            <div className="bg-red-50 border-2 border-red-400 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-lg">⛔</span>
                <div>
                  <span className="text-sm font-bold text-red-700 block">Web research nedostupný — brand safety NEPROVĚŘENA</span>
                  <span className="text-xs text-red-600">
                    Automatický průzkum médií a kontroverzí selhal. Brand Safety Score ({data.research.brandSafetyScore}/10)
                    je neutrální výchozí hodnota, NE výsledek ověření. Před rozhodnutím doporučujeme
                    manuální kontrolu influencera, nebo report vygenerovat znovu.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Two Tables Side by Side */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Market Value Table */}
            <table className="w-full text-sm bg-white rounded-md overflow-hidden">
              <thead>
                <tr style={{ backgroundColor: '#3333FF' }} className="text-white">
                  <th className="py-2 px-3 text-left text-xs uppercase font-semibold">Model</th>
                  <th className="py-2 px-3 text-right text-xs uppercase font-semibold">Cena/měs.</th>
                  <th className="py-2 px-3 text-right text-xs uppercase font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Konzervativní</td>
                  <td className="py-2 px-3 text-right">{formatCZK(data.metrics.marketValue.conservativeLow)}-{formatCZK(data.metrics.marketValue.conservativeHigh)}</td>
                  <td className="py-2 px-3 text-right">{getRiskBadge('MEDIUM', 'Standard')}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Premium</td>
                  <td className="py-2 px-3 text-right">{formatCZK(data.metrics.marketValue.premiumLow)}-{formatCZK(data.metrics.marketValue.premiumHigh)}</td>
                  <td className="py-2 px-3 text-right">{getRiskBadge('HIGH', 'High')}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">Nabídka</td>
                  <td className="py-2 px-3 text-right font-bold">{formatCZK(data.input.offeredPrice)}</td>
                  <td className="py-2 px-3 text-right">
                    {getRiskBadge('LOW', `-${Math.round((1 - data.input.offeredPrice / data.metrics.marketValue.conservativeHigh) * 100)}%`)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Risk Table */}
            <table className="w-full text-sm bg-white rounded-md overflow-hidden">
              <thead>
                <tr style={{ backgroundColor: '#3333FF' }} className="text-white">
                  <th className="py-2 px-3 text-left text-xs uppercase font-semibold">Riziko</th>
                  <th className="py-2 px-3 text-right text-xs uppercase font-semibold">Level</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Historická kontroverze</td>
                  <td className="py-2 px-3 text-right">
                    {getRiskBadge(data.research.controversies?.found ? 'HIGH' : 'LOW',
                      data.research.controversies?.found ? 'VYSOKÉ' : 'NÍZKÉ')}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Aktuální chování</td>
                  <td className="py-2 px-3 text-right">
                    {getRiskBadge(data.research.currentBehavior || 'LOW',
                      data.research.currentBehavior === 'NEGATIVE' ? 'VYSOKÉ' : 'NÍZKÉ')}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3">Mediální prezentace</td>
                  <td className="py-2 px-3 text-right">
                    {getRiskBadge(data.research.mediaPresentation || 'POSITIVE',
                      data.research.mediaPresentation === 'POSITIVE' ? 'POZ.' :
                      data.research.mediaPresentation === 'NEGATIVE' ? 'NEG.' : 'NEUT.')}
                  </td>
                </tr>
                {/* NEW: Commercialization Risk */}
                <tr>
                  <td className="py-2 px-3">Komerční přesycení</td>
                  <td className="py-2 px-3 text-right">
                    {data.research.commercializationRisk ? (
                      getRiskBadge(
                        data.research.commercializationRisk.riskLevel,
                        `${Math.round(data.research.commercializationRisk.commercialRatio * 100)}% reklam`
                      )
                    ) : (
                      getRiskBadge('LOW', 'OK')
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Controversy Context */}
          {data.research.controversies?.found && data.research.controversies.items && (
            <div className="bg-yellow-50 border border-yellow-400 rounded-md p-3 mb-4">
              <h3 className="text-xs font-semibold text-yellow-700 mb-1">⚠️ Kontext: Historická kontroverze</h3>
              {data.research.controversies.items.map((item, i) => (
                <p key={i} className="text-xs text-yellow-800 leading-snug">
                  {item.date && `${item.date}: `}{item.description}
                  {item.resolved && ' (Resolved)'}
                </p>
              ))}
            </div>
          )}

          {/* NEW: Brand Partnerships */}
          {data.research.brandPartnerships?.found && (
            <div className="bg-white border border-gray-200 rounded-md p-3 mb-4">
              <h3 className="text-xs font-semibold mb-2">🤝 Předchozí Spolupráce</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Placené spolupráce:</div>
                  <div className="text-xs space-y-0.5">
                    {data.research.brandPartnerships.partnerships
                      .filter(p => p.type === 'paid')
                      .slice(0, 4)
                      .map((p, i) => (
                        <div key={i} className={p.isCompetitor ? 'text-red-600' : ''}>
                          {p.isCompetitor && '⚠️ '}{p.brandName}
                          {p.category && <span className="text-gray-400"> ({p.category})</span>}
                        </div>
                      ))}
                    {data.research.brandPartnerships.partnerships.filter(p => p.type === 'paid').length === 0 && (
                      <span className="text-gray-400">Žádné nalezené</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Brand Affinity (organicke):</div>
                  <div className="text-xs">
                    {data.research.brandPartnerships.organicBrands.length > 0
                      ? data.research.brandPartnerships.organicBrands.slice(0, 4).join(', ')
                      : <span className="text-gray-400">Žádné nalezené</span>
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Suitable/Unsuitable Brands */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <h3 className="text-xs font-semibold text-green-600 mb-2">✓ Vhodné pro:</h3>
              <ul className="text-xs text-gray-700 space-y-1">
                {data.research.suitableBrands?.slice(0, 4).map((brand, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="text-green-500 font-bold">✓</span> {brand}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-red-600 mb-2">✗ Nevhodné pro:</h3>
              <ul className="text-xs text-gray-700 space-y-1">
                {data.research.unsuitableBrands?.slice(0, 4).map((brand, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="text-red-500 font-bold">✗</span> {brand}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <h2 className="text-base font-bold uppercase mb-3" style={{ color: '#3333FF', letterSpacing: '0.5px' }}>
            Final Verdict
          </h2>

          {/* Verdict Box */}
          <div className="bg-white border-[3px] rounded-lg p-4 mb-4 text-center" style={{ borderColor: '#3333FF' }}>
            <div className="text-5xl font-bold mb-2" style={{ color: '#3333FF' }}>
              {data.metrics.score.finalScore.toFixed(2)}/10
            </div>
            <div className="text-sm font-semibold">
              {data.metrics.score.recommendation} – {data.text.verdictText}
            </div>
          </div>

          {/* Recommendation Callout */}
          <div className="text-white py-3 px-4 rounded-md text-sm text-left" style={{ backgroundColor: '#3333FF' }}>
            <strong>Doporučení:</strong> {data.text.recommendationText}
          </div>

          {/* Footer */}
          <div className="absolute bottom-4 left-4 right-4 border-t border-gray-200 pt-3 flex justify-between text-xs text-gray-500">
            <span>
              Sources: {data.research.sources?.slice(0, 2).join(', ') || 'Instagram API, Web Research'} |
              Prepared by: Influencer Marketing Manager
            </span>
            <span>Strana 3/3</span>
          </div>
        </div>
      </div>
    </>
  )
}
