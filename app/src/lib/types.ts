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

// ============================================
// LOOKALIKE DISCOVERY TOOL TYPES
// ============================================

/**
 * Lookalike Discovery Configuration
 * Scrapes followers of a known influencer to find similar ones
 */
export const LOOKALIKE_CONFIG = {
  development: {
    followersToScrape: 200,       // Followers to fetch from source account
    minFollowersForInfluencer: 5000,  // Min followers to be considered influencer
    maxFollowersForInfluencer: 1000000, // Max followers
    profilesToAnalyze: 5,         // How many potential influencers to analyze
    resultsToShow: 5,             // Final results to display
    minEngagementRate: 1.0,       // Filter out low ER
  },
  production: {
    followersToScrape: 1000,
    minFollowersForInfluencer: 10000,
    maxFollowersForInfluencer: 2000000,
    profilesToAnalyze: 30,
    resultsToShow: 20,
    minEngagementRate: 1.0,
  },
} as const

/**
 * Source influencer info (the one we're finding lookalikes for)
 */
export interface LookalikeSource {
  username: string
  fullName: string
  followersCount: number
  category?: string
  profilePicUrl?: string
}

/**
 * Input for lookalike search
 */
export interface DiscoveryInput {
  username: string  // @username of source influencer
  country: CountryCode
}

/**
 * Single influencer result from lookalike discovery
 */
export interface DiscoveryInfluencer {
  username: string
  fullName: string
  profilePicUrl: string
  followersCount: number
  postsCount: number
  engagementRate: number
  medianEngagementRate?: number
  avgLikes: number
  avgVideoViews?: number
  similarityScore: number  // How similar to source influencer
  category?: string
  isVerified?: boolean
  lastPostDate?: string
  biography?: string
}

/**
 * Full lookalike search result
 */
export interface DiscoveryResult {
  source: LookalikeSource       // The influencer we searched from
  influencers: DiscoveryInfluencer[]
  totalFollowersScraped: number
  potentialInfluencersFound: number
  timestamp: string
}

/**
 * API response for discovery endpoint
 */
export interface DiscoveryResponse {
  result: DiscoveryResult
}
