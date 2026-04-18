/**
 * Shared Types for Influencer Report Generator
 */

import { InstagramProfile, InstagramPost, CommentAnalysis } from './apify'
import { WebResearchResult, ReportTextContent } from './claude'
import { InfluencerMetrics } from './metrics'

// Supported countries for influencer origin
export const COUNTRIES = {
  CZ: { code: 'CZ', name: 'Česko', flag: '🇨🇿', searchLang: 'čeština' },
  SK: { code: 'SK', name: 'Slovensko', flag: '🇸🇰', searchLang: 'slovenčina' },
  PL: { code: 'PL', name: 'Poľsko', flag: '🇵🇱', searchLang: 'poľština' },
  RO: { code: 'RO', name: 'Rumunsko', flag: '🇷🇴', searchLang: 'rumunčina' },
  DE: { code: 'DE', name: 'Nemecko', flag: '🇩🇪', searchLang: 'nemčina' },
  IT: { code: 'IT', name: 'Taliansko', flag: '🇮🇹', searchLang: 'taliančina' },
  HU: { code: 'HU', name: 'Maďarsko', flag: '🇭🇺', searchLang: 'maďarčina' },
} as const

export type CountryCode = keyof typeof COUNTRIES

// Input types
export interface ReportInput {
  username: string
  category: string
  offeredPrice: number
  country: CountryCode // NEW: Influencer's country
  contractMonths?: number
  averageOrderValue?: number // Optional AOV for conversion predictions

  // Deliverables per month
  deliverables?: {
    reelsPerMonth: number
    postsPerMonth: number      // foto/carousel
    storiesPerMonth: number
  }
}

// Category options
export const CATEGORIES = [
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
] as const

export type Category = typeof CATEGORIES[number]

// Full report data
export interface ReportData {
  // Input
  input: ReportInput

  // Instagram data
  profile: InstagramProfile
  topPosts: InstagramPost[]
  topReels: InstagramPost[]

  // Research
  research: WebResearchResult

  // Comment Analysis (optional - extra cost)
  commentAnalysis?: CommentAnalysis

  // Metrics
  metrics: InfluencerMetrics

  // Generated text
  text: ReportTextContent

  // Metadata
  generatedAt: string
  version: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface GenerateReportResponse {
  reportData: ReportData
  pdfUrl?: string
  htmlUrl?: string
}
