/**
 * Metrics Calculator v2.0
 *
 * Realistické finančné porovnanie:
 * - Čo dostanem za peniaze (reach, engagement, content)
 * - Porovnanie s alternatívami (Meta Ads, content production)
 * - Value-based scoring
 */

import { InstagramProfile } from './apify'

// Industry benchmarks (SK/CZ market) - BASE values
const BENCHMARKS = {
  // Meta Ads costs (BASE - will be adjusted dynamically)
  META_ADS_CPM_BASE: 35,      // CZK za 1000 impressions (base)
  META_ADS_CPE_BASE: 1.5,     // CZK za engagement (base)
  META_ADS_CPC: 5,            // CZK za click

  // Content production costs (BASE - will be adjusted by followers)
  VIDEO_PRODUCTION_BASE: 7500,   // CZK za 1 reels-style video (base)
  PHOTO_PRODUCTION_BASE: 4000,   // CZK za 1 kvalitné foto (base)
  STORY_PRODUCTION_BASE: 1500,   // CZK za story (base)

  // Influencer premiums
  TRUST_PREMIUM: 1.3,         // 30% premium za dôveru vs reklama
  WARM_AUDIENCE_PREMIUM: 1.5, // 50% premium za warm audience vs cold

  // Defaults
  DEFAULT_REELS_PER_MONTH: 2,
  DEFAULT_POSTS_PER_MONTH: 1,
  DEFAULT_STORIES_PER_MONTH: 4,
  DEFAULT_CONTRACT_MONTHS: 6,
}

/**
 * Get dynamic CPM based on ER rating and follower count
 * Higher ER = more valuable audience = higher CPM
 */
function getDynamicCPM(
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT',
  followers: number
): { cpm: number; multiplier: number; explanation: string } {
  // ER Quality multiplier
  const erMultipliers: Record<string, number> = {
    'EXCELLENT': 1.4,
    'GOOD': 1.2,
    'AVERAGE': 1.0,
    'BELOW_AVERAGE': 0.85,
    'POOR': 0.7,
  }

  // Size multiplier (bigger accounts = premium reach)
  let sizeMultiplier = 1.0
  if (followers >= 500000) sizeMultiplier = 1.2
  else if (followers >= 100000) sizeMultiplier = 1.1
  else if (followers >= 50000) sizeMultiplier = 1.0
  else sizeMultiplier = 0.9

  const erMult = erMultipliers[erRating] || 1.0
  const totalMultiplier = erMult * sizeMultiplier
  const cpm = Math.round(BENCHMARKS.META_ADS_CPM_BASE * totalMultiplier * 10) / 10

  return {
    cpm,
    multiplier: totalMultiplier,
    explanation: `Base ${BENCHMARKS.META_ADS_CPM_BASE} × ${erMult} (ER: ${erRating}) × ${sizeMultiplier} (size)`,
  }
}

/**
 * Get dynamic CPE based on ER rating
 * Higher ER = more engaged audience = more valuable engagement
 */
function getDynamicCPE(
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT'
): { cpe: number; explanation: string } {
  const cpeValues: Record<string, number> = {
    'EXCELLENT': 2.0,
    'GOOD': 1.7,
    'AVERAGE': 1.5,
    'BELOW_AVERAGE': 1.2,
    'POOR': 1.0,
  }

  const cpe = cpeValues[erRating] || 1.5

  return {
    cpe,
    explanation: `${cpe} CZK/engagement (ER: ${erRating})`,
  }
}

/**
 * Get dynamic content production values based on follower count
 * Bigger influencer = higher production value (quality, reach)
 */
function getDynamicContentValue(
  followers: number
): { reels: number; photo: number; story: number; multiplier: number; explanation: string } {
  let multiplier = 1.0
  let tier = ''

  if (followers >= 500000) {
    multiplier = 1.8
    tier = '500K+'
  } else if (followers >= 100000) {
    multiplier = 1.4
    tier = '100-500K'
  } else if (followers >= 50000) {
    multiplier = 1.1
    tier = '50-100K'
  } else {
    multiplier = 1.0
    tier = '<50K'
  }

  return {
    reels: Math.round(BENCHMARKS.VIDEO_PRODUCTION_BASE * multiplier),
    photo: Math.round(BENCHMARKS.PHOTO_PRODUCTION_BASE * multiplier),
    story: Math.round(BENCHMARKS.STORY_PRODUCTION_BASE * multiplier),
    multiplier,
    explanation: `${tier} tier → ${multiplier}× base value`,
  }
}

// Deliverables input type
export interface Deliverables {
  reelsPerMonth: number
  postsPerMonth: number
  storiesPerMonth: number
}

export interface MarketValue {
  conservativeLow: number
  conservativeHigh: number
  premiumLow: number
  premiumHigh: number

  // NEW: Dynamic multipliers explanation
  erMultiplier: number
  sizeMultiplier: number
  reachBonus: number
  verifiedBonus: number
  celebrityBonus: number         // NEW: Celebrity premium (500K+)
  celebrityTier?: string         // NEW: Celebrity tier description
  conservativeExplanation: string
  premiumExplanation: string
}

export interface DeliveryEstimate {
  // Per month
  reelsPerMonth: number
  postsPerMonth: number
  storiesPerMonth: number
  totalContentPerMonth: number
  monthlyReach: number
  monthlyReachMin: number      // NEW: Conservative estimate
  monthlyReachMax: number      // NEW: Optimistic/viral estimate
  monthlyEngagements: number
  monthlyLikes: number         // NEW: Expected likes
  monthlyComments: number      // NEW: Expected comments
  // Total (contract period)
  totalReels: number
  totalPosts: number
  totalStories: number
  totalContent: number
  totalReach: number
  totalReachMin: number        // NEW
  totalReachMax: number        // NEW
  totalEngagements: number
  totalLikes: number           // NEW
  totalComments: number        // NEW
}

export interface ValueBreakdown {
  // Reach value (vs Meta Ads)
  reachValue: number
  reachValueMin: number        // NEW: Conservative
  reachValueMax: number        // NEW: Optimistic
  reachExplanation: string
  dynamicCPM: number           // NEW: Actual CPM used
  cpmExplanation: string       // NEW

  // Engagement value (vs Meta Ads CPE)
  engagementValue: number
  engagementExplanation: string
  dynamicCPE: number           // NEW: Actual CPE used
  cpeExplanation: string       // NEW

  // Content creation value
  contentValue: number
  contentExplanation: string
  contentMultiplier: number    // NEW: Multiplier used
  contentTierExplanation: string // NEW

  // Total
  totalValue: number
  totalValueMin: number        // NEW
  totalValueMax: number        // NEW

  // Comparison
  totalCost: number
  valueRatio: number           // totalValue / totalCost
  valueRatioMin: number        // NEW
  valueRatioMax: number        // NEW
  netValue: number             // totalValue - totalCost
}

export interface ROIAnalysis {
  // Legacy fields for compatibility
  influencerCPM: number
  metaAdsCPM: number
  influencerCost1M: number
  metaAdsCost1M: number
  totalContractValue: number
  metaAdsEquivalent: number
  savingsPercent: number
  savingsAmount: number

  // New detailed breakdown
  delivery: DeliveryEstimate
  valueBreakdown: ValueBreakdown
}

export interface ScoreBreakdown {
  priceScore: number      // 40% - value ratio
  engagementScore: number // 25% - engagement rate quality
  reachScore: number      // 20% - reach multiplier
  brandSafetyScore: number // 15% - research based
  finalScore: number
  recommendation: 'STRONG BUY' | 'BUY' | 'CONSIDER' | 'PASS'
}

// NEW: Audience Quality / Bot Detection
export interface AudienceQualityEstimate {
  estimatedQuality: number  // 0-100%
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  redFlags: string[]
  greenFlags: string[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

// NEW: ER Benchmark context
export interface ERBenchmark {
  value: number
  rating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT'
  percentile: number  // Where they stand (0-100)
  context: string
}

// NEW: Viral Potential Scoring
export interface ViralPotential {
  avgReelViews: number
  maxReelViews: number
  topPercentile90Views: number    // Top 10% average
  consistency: number              // 0-1 score (lower std dev = more consistent)

  viralScore: number               // 0-10
  viralRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

  prediction: {
    conservative: number           // 50th percentile (worst case)
    realistic: number              // Avg (expected)
    optimistic: number             // 90th percentile (viral potential)
  }
}

// NEW: Single scenario in the matrix
export interface ConversionScenario {
  ctr: number              // CTR percentage (e.g., 1, 2, 3)
  conversionRate: number   // CR percentage (e.g., 1, 2, 3)
  clicks: number
  conversions: number
  revenue: number
  roi: number              // ROI percentage
  isBreakEven: boolean     // true if this scenario hits break-even
  isProfitable: boolean    // true if ROI > 0
}

// NEW: Conversion Predictions with scenario matrix
export interface ConversionPrediction {
  // Legacy fields (for backwards compatibility)
  expectedClicks: number
  expectedClicksLow: number
  expectedClicksHigh: number
  expectedConversions?: number
  expectedConversionsLow?: number
  expectedConversionsHigh?: number
  expectedRevenue?: number
  breakEvenSales?: number
  expectedROI?: number
  ctrUsed: number
  conversionRateUsed?: number

  // NEW: Scenario matrix (3×3 = 9 scenarios)
  scenarioMatrix?: ConversionScenario[][]  // [ctrIndex][crIndex]
  ctrOptions: number[]      // e.g., [1, 2, 3]
  crOptions: number[]       // e.g., [1, 2, 3]

  // NEW: Recommended scenario based on ER rating
  recommendedScenario?: ConversionScenario
  recommendedCTR: number
  recommendedCR: number
  erBasedCTRRange: { min: number; max: number }
}

export interface InfluencerMetrics {
  // Basic
  followers: number
  following: number
  posts: number
  verified: boolean

  // Engagement
  avgLikes: number
  avgComments: number
  engagementRate: number
  erBenchmark: ERBenchmark  // NEW

  // Audience Quality (NEW)
  audienceQuality: AudienceQualityEstimate

  // Reach
  avgReelViews: number
  maxReelViews: number
  reachMultiplier: number

  // Viral Potential (NEW)
  viralPotential: ViralPotential

  // Financial
  offeredPrice: number
  contractMonths: number
  marketValue: MarketValue
  roi: ROIAnalysis

  // Predictions (NEW)
  predictions: ConversionPrediction

  // Score
  score: ScoreBreakdown
}

/**
 * Calculate market value with dynamic multipliers
 * Based on ER rating, follower count, reach, and verified status
 */
export function calculateMarketValue(
  followers: number,
  reachMultiplier: number,
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' = 'AVERAGE',
  verified: boolean = false
): MarketValue {
  // === ER MULTIPLIER ===
  // Higher ER = more valuable audience
  const erMultipliers: Record<string, number> = {
    'EXCELLENT': 1.4,
    'GOOD': 1.2,
    'AVERAGE': 1.0,
    'BELOW_AVERAGE': 0.85,
    'POOR': 0.7,
  }
  const erMultiplier = erMultipliers[erRating] || 1.0

  // === SIZE MULTIPLIER ===
  // Smaller accounts = higher per-follower rate (more engaged)
  // Larger accounts = volume discount
  let sizeMultiplier = 1.0
  let sizeTier = ''
  if (followers >= 500000) {
    sizeMultiplier = 0.8
    sizeTier = '500K+ (volume)'
  } else if (followers >= 100000) {
    sizeMultiplier = 0.9
    sizeTier = '100-500K'
  } else if (followers >= 50000) {
    sizeMultiplier = 1.0
    sizeTier = '50-100K'
  } else {
    sizeMultiplier = 1.1
    sizeTier = '<50K (micro)'
  }

  // === CONSERVATIVE MODEL ===
  // Base: 0.25-0.35 CZK/follower × ER × Size
  const conservativeBaseLow = 0.25
  const conservativeBaseHigh = 0.35
  const conservativeLow = Math.round(followers * conservativeBaseLow * erMultiplier * sizeMultiplier)
  const conservativeHigh = Math.round(followers * conservativeBaseHigh * erMultiplier * sizeMultiplier)

  // === REACH BONUS (for Premium) ===
  // Higher reach = more value
  let reachBonus = 1.0
  let reachTier = ''
  if (reachMultiplier >= 3) {
    reachBonus = 1.4
    reachTier = '3×+ reach (+40%)'
  } else if (reachMultiplier >= 2) {
    reachBonus = 1.2
    reachTier = '2×+ reach (+20%)'
  } else if (reachMultiplier >= 1) {
    reachBonus = 1.0
    reachTier = '1×+ reach'
  } else {
    reachBonus = 0.8
    reachTier = '<1× reach (-20%)'
  }

  // === ER BONUS (for Premium) ===
  // Additional bonus for high engagement
  let erBonus = 1.0
  if (erRating === 'EXCELLENT') erBonus = 1.3
  else if (erRating === 'GOOD') erBonus = 1.15

  // === VERIFIED BONUS ===
  const verifiedBonus = verified ? 1.1 : 1.0

  // === CELEBRITY PREMIUM (500K+) ===
  // Celebrities command premium beyond pure reach metrics
  let celebrityBonus = 1.0
  let celebrityTier: string | undefined

  if (verified && followers >= 500000) {
    if (followers >= 2000000) {
      celebrityBonus = 2.0
      celebrityTier = 'Major celebrity (2M+) - 2× premium'
    } else if (followers >= 1000000) {
      celebrityBonus = 1.6
      celebrityTier = 'Celebrity (1M+) - 1.6× premium'
    } else if (followers >= 500000) {
      celebrityBonus = 1.3
      celebrityTier = 'Micro-celebrity (500K+) - 1.3× premium'
    }
  }

  // === PREMIUM MODEL ===
  // Base: 0.50-0.80 CZK/follower × Reach × ER × Verified × Celebrity
  const premiumBaseLow = 0.50
  const premiumBaseHigh = 0.80
  const premiumLow = Math.round(followers * premiumBaseLow * reachBonus * erBonus * verifiedBonus * celebrityBonus)
  const premiumHigh = Math.round(followers * premiumBaseHigh * reachBonus * erBonus * verifiedBonus * celebrityBonus)

  // Build explanations
  const conservativeExplanation = `Base ${conservativeBaseLow}-${conservativeBaseHigh} × ER ${erMultiplier} (${erRating}) × Size ${sizeMultiplier} (${sizeTier})`
  const premiumExplanation = `Base ${premiumBaseLow}-${premiumBaseHigh} × Reach ${reachBonus} (${reachTier}) × ER ${erBonus} × Verified ${verifiedBonus}${celebrityBonus > 1 ? ` × Celebrity ${celebrityBonus}` : ''}`

  return {
    conservativeLow,
    conservativeHigh,
    premiumLow,
    premiumHigh,
    erMultiplier,
    sizeMultiplier,
    reachBonus,
    verifiedBonus,
    celebrityBonus,
    celebrityTier,
    conservativeExplanation,
    premiumExplanation,
  }
}

/**
 * Estimate what you'll get for your money
 * Now includes MIN/MAX reach and detailed engagement breakdown
 */
export function estimateDelivery(
  avgReelViews: number,
  maxReelViews: number,
  avgLikes: number,
  avgComments: number,
  deliverables: Deliverables = {
    reelsPerMonth: BENCHMARKS.DEFAULT_REELS_PER_MONTH,
    postsPerMonth: BENCHMARKS.DEFAULT_POSTS_PER_MONTH,
    storiesPerMonth: BENCHMARKS.DEFAULT_STORIES_PER_MONTH,
  },
  contractMonths: number = BENCHMARKS.DEFAULT_CONTRACT_MONTHS
): DeliveryEstimate {
  // Stories have ~10% of reels reach, ~5% engagement
  const storyReachMultiplier = 0.1
  const storyEngagementMultiplier = 0.05

  // MIN/MAX reach multipliers
  const MIN_REACH_FACTOR = 0.6   // Conservative: 60% of average
  const MAX_REACH_FACTOR = 1.5   // Optimistic: 150% of average or use maxReelViews

  // Calculate MIN reach (conservative estimate)
  const minReelViews = avgReelViews * MIN_REACH_FACTOR

  // Calculate MAX reach (use actual max if available, otherwise 1.5× average)
  const effectiveMaxReelViews = maxReelViews > avgReelViews
    ? maxReelViews
    : avgReelViews * MAX_REACH_FACTOR

  // Monthly calculations - AVERAGE
  const reelsReach = avgReelViews * deliverables.reelsPerMonth
  const postsReach = avgReelViews * 0.3 * deliverables.postsPerMonth
  const storiesReach = avgReelViews * storyReachMultiplier * deliverables.storiesPerMonth
  const monthlyReach = reelsReach + postsReach + storiesReach

  // Monthly calculations - MIN
  const reelsReachMin = minReelViews * deliverables.reelsPerMonth
  const postsReachMin = minReelViews * 0.3 * deliverables.postsPerMonth
  const storiesReachMin = minReelViews * storyReachMultiplier * deliverables.storiesPerMonth
  const monthlyReachMin = reelsReachMin + postsReachMin + storiesReachMin

  // Monthly calculations - MAX
  const reelsReachMax = effectiveMaxReelViews * deliverables.reelsPerMonth
  const postsReachMax = effectiveMaxReelViews * 0.3 * deliverables.postsPerMonth
  const storiesReachMax = effectiveMaxReelViews * storyReachMultiplier * deliverables.storiesPerMonth
  const monthlyReachMax = reelsReachMax + postsReachMax + storiesReachMax

  // Engagement calculations - detailed
  const reelsLikes = avgLikes * deliverables.reelsPerMonth
  const postsLikes = avgLikes * deliverables.postsPerMonth
  const storiesLikes = avgLikes * storyEngagementMultiplier * deliverables.storiesPerMonth
  const monthlyLikes = reelsLikes + postsLikes + storiesLikes

  const reelsComments = avgComments * deliverables.reelsPerMonth
  const postsComments = avgComments * deliverables.postsPerMonth
  const storiesComments = avgComments * storyEngagementMultiplier * deliverables.storiesPerMonth
  const monthlyComments = reelsComments + postsComments + storiesComments

  const monthlyEngagements = monthlyLikes + monthlyComments
  const totalContentPerMonth = deliverables.reelsPerMonth + deliverables.postsPerMonth + deliverables.storiesPerMonth

  return {
    reelsPerMonth: deliverables.reelsPerMonth,
    postsPerMonth: deliverables.postsPerMonth,
    storiesPerMonth: deliverables.storiesPerMonth,
    totalContentPerMonth,
    monthlyReach: Math.round(monthlyReach),
    monthlyReachMin: Math.round(monthlyReachMin),
    monthlyReachMax: Math.round(monthlyReachMax),
    monthlyEngagements: Math.round(monthlyEngagements),
    monthlyLikes: Math.round(monthlyLikes),
    monthlyComments: Math.round(monthlyComments),
    totalReels: deliverables.reelsPerMonth * contractMonths,
    totalPosts: deliverables.postsPerMonth * contractMonths,
    totalStories: deliverables.storiesPerMonth * contractMonths,
    totalContent: totalContentPerMonth * contractMonths,
    totalReach: Math.round(monthlyReach * contractMonths),
    totalReachMin: Math.round(monthlyReachMin * contractMonths),
    totalReachMax: Math.round(monthlyReachMax * contractMonths),
    totalEngagements: Math.round(monthlyEngagements * contractMonths),
    totalLikes: Math.round(monthlyLikes * contractMonths),
    totalComments: Math.round(monthlyComments * contractMonths),
  }
}

/**
 * Calculate value breakdown - what is this worth?
 * Now uses DYNAMIC CPM, CPE, and Content values based on influencer metrics
 */
export function calculateValueBreakdown(
  delivery: DeliveryEstimate,
  offeredPrice: number,
  contractMonths: number,
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' = 'AVERAGE',
  followers: number = 50000
): ValueBreakdown {
  const totalCost = offeredPrice * contractMonths

  // Get dynamic values based on influencer quality
  const cpmData = getDynamicCPM(erRating, followers)
  const cpeData = getDynamicCPE(erRating)
  const contentData = getDynamicContentValue(followers)

  // 1. REACH VALUE (with dynamic CPM)
  // "Ak by som chcel rovnaký reach cez Meta Ads, koľko by to stálo?"
  const rawReachValue = (delivery.totalReach / 1000) * cpmData.cpm
  const reachValue = Math.round(rawReachValue * BENCHMARKS.WARM_AUDIENCE_PREMIUM)
  const reachExplanation = `${formatNumber(delivery.totalReach)} views × ${cpmData.cpm} CZK CPM × 1.5 (warm audience)`

  // MIN/MAX reach values
  const rawReachValueMin = (delivery.totalReachMin / 1000) * cpmData.cpm
  const reachValueMin = Math.round(rawReachValueMin * BENCHMARKS.WARM_AUDIENCE_PREMIUM)
  const rawReachValueMax = (delivery.totalReachMax / 1000) * cpmData.cpm
  const reachValueMax = Math.round(rawReachValueMax * BENCHMARKS.WARM_AUDIENCE_PREMIUM)

  // 2. ENGAGEMENT VALUE (with dynamic CPE)
  // "Ak by som chcel rovnaký engagement cez Meta Ads, koľko by to stálo?"
  const rawEngagementValue = delivery.totalEngagements * cpeData.cpe
  const engagementValue = Math.round(rawEngagementValue * BENCHMARKS.TRUST_PREMIUM)
  const engagementExplanation = `${formatNumber(delivery.totalEngagements)} engagements × ${cpeData.cpe} CZK × 1.3 (trust premium)`

  // 3. CONTENT VALUE (with dynamic production costs)
  // "Koľko by stálo vytvoriť tento obsah externe?"
  const reelsValue = delivery.totalReels * contentData.reels
  const postsValue = delivery.totalPosts * contentData.photo
  const storiesValue = delivery.totalStories * contentData.story
  const contentValue = reelsValue + postsValue + storiesValue

  const contentParts = []
  if (delivery.totalReels > 0) contentParts.push(`${delivery.totalReels} reels × ${formatNumber(contentData.reels)}`)
  if (delivery.totalPosts > 0) contentParts.push(`${delivery.totalPosts} posts × ${formatNumber(contentData.photo)}`)
  if (delivery.totalStories > 0) contentParts.push(`${delivery.totalStories} stories × ${formatNumber(contentData.story)}`)
  const contentExplanation = contentParts.join(' + ')

  // TOTAL VALUES (avg, min, max)
  const totalValue = reachValue + engagementValue + contentValue
  const totalValueMin = reachValueMin + engagementValue + contentValue
  const totalValueMax = reachValueMax + engagementValue + contentValue

  return {
    reachValue,
    reachValueMin,
    reachValueMax,
    reachExplanation,
    dynamicCPM: cpmData.cpm,
    cpmExplanation: cpmData.explanation,
    engagementValue,
    engagementExplanation,
    dynamicCPE: cpeData.cpe,
    cpeExplanation: cpeData.explanation,
    contentValue,
    contentExplanation,
    contentMultiplier: contentData.multiplier,
    contentTierExplanation: contentData.explanation,
    totalValue,
    totalValueMin,
    totalValueMax,
    totalCost,
    valueRatio: Math.round((totalValue / totalCost) * 100) / 100,
    valueRatioMin: Math.round((totalValueMin / totalCost) * 100) / 100,
    valueRatioMax: Math.round((totalValueMax / totalCost) * 100) / 100,
    netValue: totalValue - totalCost,
  }
}

/**
 * Calculate ROI with detailed breakdown
 * Now uses dynamic values based on ER rating and follower count
 */
export function calculateROI(
  avgReelViews: number,
  maxReelViews: number,
  avgLikes: number,
  avgComments: number,
  offeredPrice: number,
  contractMonths: number = BENCHMARKS.DEFAULT_CONTRACT_MONTHS,
  deliverables?: Deliverables,
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' = 'AVERAGE',
  followers: number = 50000
): ROIAnalysis {
  // Delivery estimate (now with MIN/MAX reach)
  const delivery = estimateDelivery(
    avgReelViews,
    maxReelViews,
    avgLikes,
    avgComments,
    deliverables,
    contractMonths
  )

  // Value breakdown (now with dynamic CPM/CPE/Content values)
  const valueBreakdown = calculateValueBreakdown(
    delivery,
    offeredPrice,
    contractMonths,
    erRating,
    followers
  )

  // Legacy calculations for backwards compatibility
  const influencerCPM = avgReelViews > 0
    ? Math.round((offeredPrice / avgReelViews) * 1000)
    : 0

  const influencerCost1M = avgReelViews > 0
    ? Math.round((offeredPrice / avgReelViews) * 1000000)
    : 0

  const metaAdsCost1M = BENCHMARKS.META_ADS_CPM_BASE * 1000
  const totalContractValue = offeredPrice * contractMonths

  // Savings based on value comparison
  const savingsAmount = valueBreakdown.netValue
  const savingsPercent = valueBreakdown.totalCost > 0
    ? Math.round((savingsAmount / valueBreakdown.totalValue) * 100)
    : 0

  return {
    influencerCPM,
    metaAdsCPM: valueBreakdown.dynamicCPM, // Use dynamic CPM
    influencerCost1M,
    metaAdsCost1M,
    totalContractValue,
    metaAdsEquivalent: valueBreakdown.reachValue,
    savingsPercent: Math.max(0, savingsPercent),
    savingsAmount: Math.max(0, savingsAmount),
    delivery,
    valueBreakdown,
  }
}

/**
 * Calculate final score (1-10)
 */
export function calculateScore(
  valueRatio: number,
  engagementRate: number,
  reachMultiplier: number,
  brandSafetyScore: number = 7.0
): ScoreBreakdown {
  // Price/Value Score (40%) - based on value ratio
  // valueRatio 1.0 = break even, 2.0 = 2x value, etc.
  let priceScore: number
  if (valueRatio >= 3.0) priceScore = 10
  else if (valueRatio >= 2.5) priceScore = 9
  else if (valueRatio >= 2.0) priceScore = 8
  else if (valueRatio >= 1.5) priceScore = 7
  else if (valueRatio >= 1.2) priceScore = 6
  else if (valueRatio >= 1.0) priceScore = 5
  else if (valueRatio >= 0.8) priceScore = 4
  else priceScore = 3

  // Engagement Score (25%) - engagement rate quality
  // ER benchmarks: <1% poor, 1-3% average, 3-6% good, >6% excellent
  let engagementScore: number
  if (engagementRate >= 8) engagementScore = 10
  else if (engagementRate >= 6) engagementScore = 9
  else if (engagementRate >= 4) engagementScore = 8
  else if (engagementRate >= 3) engagementScore = 7
  else if (engagementRate >= 2) engagementScore = 6
  else if (engagementRate >= 1) engagementScore = 5
  else engagementScore = 3

  // Reach Score (20%) - viral potential
  let reachScore: number
  if (reachMultiplier >= 5) reachScore = 10
  else if (reachMultiplier >= 3) reachScore = 8
  else if (reachMultiplier >= 2) reachScore = 7
  else if (reachMultiplier >= 1) reachScore = 6
  else if (reachMultiplier >= 0.5) reachScore = 5
  else reachScore = 4

  // Brand Safety Score (15%) - from research
  const safetyScore = Math.min(10, Math.max(0, brandSafetyScore))

  // Final Score (weighted average)
  const finalScore = (
    (priceScore * 0.40) +
    (engagementScore * 0.25) +
    (reachScore * 0.20) +
    (safetyScore * 0.15)
  )

  // Recommendation
  let recommendation: 'STRONG BUY' | 'BUY' | 'CONSIDER' | 'PASS'
  if (finalScore >= 8.0) {
    recommendation = 'STRONG BUY'
  } else if (finalScore >= 6.5) {
    recommendation = 'BUY'
  } else if (finalScore >= 5.0) {
    recommendation = 'CONSIDER'
  } else {
    recommendation = 'PASS'
  }

  return {
    priceScore: Math.round(priceScore * 100) / 100,
    engagementScore: Math.round(engagementScore * 100) / 100,
    reachScore: Math.round(reachScore * 100) / 100,
    brandSafetyScore: safetyScore,
    finalScore: Math.round(finalScore * 100) / 100,
    recommendation,
  }
}

/**
 * Calculate all metrics for an influencer
 */
export function calculateAllMetrics(
  profile: InstagramProfile,
  offeredPrice: number,
  contractMonths: number = BENCHMARKS.DEFAULT_CONTRACT_MONTHS,
  brandSafetyScore: number = 7.0,
  deliverables?: Deliverables,
  averageOrderValue?: number,
  commentQuality?: { genericRatio: number; meaningfulRatio: number; commentQualityScore: number }
): InfluencerMetrics {
  // Get max reel views
  // Fixed: Filter by videoViewCount only - Apify may return Reels as different types
  const videoPosts = profile.latestPosts.filter(p => p.videoViewCount && p.videoViewCount > 0)
  const maxReelViews = videoPosts.length > 0
    ? Math.max(...videoPosts.map(p => p.videoViewCount || 0))
    : 0

  // Use MEDIAN values when high variance is detected (more accurate for outlier profiles)
  const useMedian = profile.hasHighVariance === true
  const avgReelViews = useMedian && profile.medianVideoViews
    ? profile.medianVideoViews
    : (profile.avgVideoViews || 0)
  const avgLikes = useMedian && profile.medianLikes
    ? profile.medianLikes
    : (profile.avgLikes || 0)
  const avgComments = useMedian && profile.medianComments
    ? profile.medianComments
    : (profile.avgComments || 0)
  const reachMultiplier = useMedian && profile.medianReachMultiplier
    ? profile.medianReachMultiplier
    : (profile.reachMultiplier || 0)
  const engagementRate = useMedian && profile.medianEngagementRate
    ? profile.medianEngagementRate
    : (profile.engagementRate || 0)

  if (useMedian) {
    console.log(`[Metrics] ⚠ High variance detected - using MEDIAN values for calculations`)
    console.log(`[Metrics]   ER: ${profile.engagementRate}% (avg) → ${engagementRate}% (median)`)
  }

  // Calculate ER benchmark first (needed for dynamic values)
  const erBenchmark = calculateERBenchmark(engagementRate, profile.followersCount)

  // Market value (now with dynamic multipliers)
  const marketValue = calculateMarketValue(
    profile.followersCount,
    reachMultiplier,
    erBenchmark.rating,
    profile.verified
  )

  // ROI with detailed breakdown (now with dynamic values)
  const roi = calculateROI(
    avgReelViews,
    maxReelViews,
    avgLikes,
    avgComments,
    offeredPrice,
    contractMonths,
    deliverables,
    erBenchmark.rating,
    profile.followersCount
  )

  // NEW: Audience quality estimate (with optional comment quality)
  const audienceQuality = calculateAudienceQuality(
    profile.followersCount,
    profile.followsCount,
    engagementRate,
    avgLikes,
    avgComments,
    commentQuality
  )

  // erBenchmark already calculated above for ROI

  // NEW: Conversion predictions with scenario matrix
  const predictions = calculateConversionPrediction(
    roi.delivery.totalReach,
    averageOrderValue,
    roi.valueBreakdown.totalCost,
    erBenchmark.rating
  )

  // NEW: Viral potential scoring
  const viralPotential = calculateViralPotential(profile.latestPosts)

  // Score based on value ratio
  const score = calculateScore(
    roi.valueBreakdown.valueRatio,
    engagementRate,
    reachMultiplier,
    brandSafetyScore
  )

  return {
    followers: profile.followersCount,
    following: profile.followsCount,
    posts: profile.postsCount,
    verified: profile.verified,
    avgLikes,
    avgComments,
    engagementRate,
    erBenchmark,
    audienceQuality,
    avgReelViews,
    maxReelViews,
    reachMultiplier,
    viralPotential,
    offeredPrice,
    contractMonths,
    marketValue,
    roi,
    predictions,
    score,
  }
}

/**
 * Calculate audience quality estimate (bot detection)
 * @param commentQuality - Optional comment quality analysis for enhanced bot detection
 */
export function calculateAudienceQuality(
  followers: number,
  following: number,
  engagementRate: number,
  avgLikes: number,
  avgComments: number,
  commentQuality?: { genericRatio: number; meaningfulRatio: number; commentQualityScore: number }
): AudienceQualityEstimate {
  const redFlags: string[] = []
  const greenFlags: string[] = []
  let qualityScore = 85 // Start optimistic

  // 1. Follower/Following ratio analysis
  const ratio = following > 0 ? followers / following : followers
  if (ratio < 1) {
    redFlags.push('Follower/following ratio < 1 (follows viac ako followers)')
    qualityScore -= 15
  } else if (ratio > 100) {
    greenFlags.push(`Výborný ratio ${Math.round(ratio)}:1`)
  } else if (ratio > 10) {
    greenFlags.push(`Zdravý ratio ${Math.round(ratio)}:1`)
  }

  // 2. Engagement rate vs follower count
  // Expected ER decreases with follower count
  let expectedER: number
  if (followers < 10000) expectedER = 5.0
  else if (followers < 50000) expectedER = 3.5
  else if (followers < 100000) expectedER = 2.5
  else if (followers < 500000) expectedER = 2.0
  else expectedER = 1.5

  if (engagementRate < expectedER * 0.3) {
    redFlags.push(`Veľmi nízky ER (${engagementRate.toFixed(1)}%) pre ${formatNumber(followers)} followers`)
    qualityScore -= 25
  } else if (engagementRate < expectedER * 0.6) {
    redFlags.push(`Podpriemerný ER (${engagementRate.toFixed(1)}%) pre túto veľkosť`)
    qualityScore -= 10
  } else if (engagementRate >= expectedER) {
    greenFlags.push(`Nadpriemerný ER (${engagementRate.toFixed(1)}%)`)
    qualityScore += 5
  }

  // 3. Comments to Likes ratio (bots usually don't comment)
  const commentLikeRatio = avgLikes > 0 ? avgComments / avgLikes : 0
  if (commentLikeRatio < 0.01) {
    redFlags.push('Veľmi málo komentárov vs likes (možné boty)')
    qualityScore -= 10
  } else if (commentLikeRatio > 0.05) {
    greenFlags.push('Zdravý pomer komentárov k likes')
  }

  // 4. Suspiciously high engagement for big accounts
  if (followers > 500000 && engagementRate > 10) {
    redFlags.push('Podozrivo vysoký ER pre veľký účet')
    qualityScore -= 20
  }

  // 5. NEW: Comment Quality Analysis (if available)
  if (commentQuality) {
    // High generic ratio = bots/engagement pods
    if (commentQuality.genericRatio > 50) {
      redFlags.push(`${commentQuality.genericRatio}% komentářů jsou generic (emoji, "Nice!")`)
      qualityScore -= 15
    } else if (commentQuality.genericRatio > 35) {
      redFlags.push(`${commentQuality.genericRatio}% generic komentářů`)
      qualityScore -= 8
    }

    // High meaningful ratio = real engaged users
    if (commentQuality.meaningfulRatio > 35) {
      greenFlags.push(`${commentQuality.meaningfulRatio}% komentářů obsahuje otázky/názory`)
      qualityScore += 10
    } else if (commentQuality.meaningfulRatio > 20) {
      greenFlags.push(`${commentQuality.meaningfulRatio}% kvalitních komentářů`)
      qualityScore += 5
    }
  }

  // Normalize score
  qualityScore = Math.max(20, Math.min(100, qualityScore))

  // Determine confidence
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  if (redFlags.length === 0 && greenFlags.length >= 2) confidence = 'HIGH'
  if (redFlags.length >= 2) confidence = 'LOW'

  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW'
  if (qualityScore < 60) riskLevel = 'HIGH'
  else if (qualityScore < 75) riskLevel = 'MEDIUM'

  return {
    estimatedQuality: qualityScore,
    confidence,
    redFlags,
    greenFlags,
    riskLevel,
  }
}

/**
 * Calculate ER benchmark context
 */
export function calculateERBenchmark(
  engagementRate: number,
  followers: number
): ERBenchmark {
  // Adjusted benchmarks based on follower count
  let benchmarks: { poor: number; average: number; good: number; excellent: number }

  if (followers < 10000) {
    benchmarks = { poor: 2, average: 4, good: 6, excellent: 10 }
  } else if (followers < 50000) {
    benchmarks = { poor: 1.5, average: 2.5, good: 4, excellent: 7 }
  } else if (followers < 100000) {
    benchmarks = { poor: 1, average: 2, good: 3, excellent: 5 }
  } else if (followers < 500000) {
    benchmarks = { poor: 0.8, average: 1.5, good: 2.5, excellent: 4 }
  } else {
    benchmarks = { poor: 0.5, average: 1, good: 2, excellent: 3 }
  }

  let rating: ERBenchmark['rating']
  let percentile: number
  let context: string

  if (engagementRate >= benchmarks.excellent) {
    rating = 'EXCELLENT'
    percentile = 95
    context = `Top 5% pre účty s ${formatNumber(followers)} followers`
  } else if (engagementRate >= benchmarks.good) {
    rating = 'GOOD'
    percentile = 75
    context = `Nad priemerom pre účty s ${formatNumber(followers)} followers`
  } else if (engagementRate >= benchmarks.average) {
    rating = 'AVERAGE'
    percentile = 50
    context = `Priemer pre účty s ${formatNumber(followers)} followers`
  } else if (engagementRate >= benchmarks.poor) {
    rating = 'BELOW_AVERAGE'
    percentile = 25
    context = `Pod priemerom - zvážiť kvalitu publika`
  } else {
    rating = 'POOR'
    percentile = 10
    context = `Výrazne pod priemerom - vysoké riziko botov`
  }

  return {
    value: engagementRate,
    rating,
    percentile,
    context,
  }
}

/**
 * Calculate viral potential based on video performance
 * Analyzes consistency vs. peak performance potential
 */
export function calculateViralPotential(
  latestPosts: Array<{ type: string; videoViewCount?: number }>
): ViralPotential {
  const videoViews = latestPosts
    // Fixed: Filter by videoViewCount only - Apify may return Reels as different types
    .filter(p => p.videoViewCount && p.videoViewCount > 0)
    .map(p => p.videoViewCount!)
    .sort((a, b) => b - a)

  // Default for accounts with no video data
  if (videoViews.length === 0) {
    return {
      avgReelViews: 0,
      maxReelViews: 0,
      topPercentile90Views: 0,
      consistency: 0,
      viralScore: 0,
      viralRating: 'LOW',
      prediction: { conservative: 0, realistic: 0, optimistic: 0 }
    }
  }

  // Calculate statistics
  const avg = videoViews.reduce((sum, val) => sum + val, 0) / videoViews.length
  const max = videoViews[0]

  // Standard deviation
  const squareDiffs = videoViews.map(val => Math.pow(val - avg, 2))
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length
  const stdDev = Math.sqrt(avgSquareDiff)

  // Top 10% posts
  const top10Count = Math.max(1, Math.ceil(videoViews.length * 0.1))
  const top10Views = videoViews.slice(0, top10Count)
  const topPercentile90 = top10Views.reduce((sum, val) => sum + val, 0) / top10Views.length

  // Consistency score (lower std dev = more consistent)
  // Normalized: 1 = very consistent, 0 = very inconsistent
  const consistency = avg > 0 ? Math.max(0, Math.min(1, 1 - (stdDev / avg))) : 0

  // Viral score based on peak performance ratio
  const peakToAvgRatio = avg > 0 ? max / avg : 1
  let viralScore = 0

  if (peakToAvgRatio >= 5) viralScore = 10      // 5× average = extreme viral potential
  else if (peakToAvgRatio >= 3) viralScore = 8  // 3× average = high viral
  else if (peakToAvgRatio >= 2) viralScore = 6  // 2× average = medium viral
  else if (peakToAvgRatio >= 1.5) viralScore = 5
  else viralScore = 3                            // Consistent performer

  // Boost score slightly for consistent performers (reliable)
  viralScore = viralScore * (0.8 + 0.2 * consistency)

  // Determine rating
  let viralRating: ViralPotential['viralRating']
  if (viralScore >= 8) viralRating = 'VERY_HIGH'
  else if (viralScore >= 6) viralRating = 'HIGH'
  else if (viralScore >= 4) viralRating = 'MEDIUM'
  else viralRating = 'LOW'

  return {
    avgReelViews: Math.round(avg),
    maxReelViews: Math.round(max),
    topPercentile90Views: Math.round(topPercentile90),
    consistency: Math.round(consistency * 100) / 100,
    viralScore: Math.round(viralScore * 10) / 10,
    viralRating,
    prediction: {
      conservative: Math.round(avg * 0.6),      // Worst case: 60% of average
      realistic: Math.round(avg),                // Expected: average
      optimistic: Math.round(topPercentile90)    // Best case: top 10% average
    }
  }
}

/**
 * Get recommended CTR range based on ER rating
 * Higher ER = more engaged audience = higher expected CTR
 */
function getRecommendedCTRByER(
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT'
): { min: number; max: number; recommended: number } {
  const ctrRanges: Record<string, { min: number; max: number; recommended: number }> = {
    'EXCELLENT': { min: 2.5, max: 3.5, recommended: 3 },
    'GOOD': { min: 1.5, max: 2.5, recommended: 2 },
    'AVERAGE': { min: 1.0, max: 2.0, recommended: 1.5 },
    'BELOW_AVERAGE': { min: 0.5, max: 1.5, recommended: 1 },
    'POOR': { min: 0.5, max: 1.0, recommended: 0.5 },
  }
  return ctrRanges[erRating] || ctrRanges['AVERAGE']
}

/**
 * Calculate conversion predictions with scenario matrix
 * Now includes 9 scenarios (3 CTR × 3 CR) and recommended scenario based on ER
 */
export function calculateConversionPrediction(
  totalReach: number,
  averageOrderValue?: number,
  totalCost?: number,
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' = 'AVERAGE'
): ConversionPrediction {
  // CTR options for matrix (1%, 2%, 3%)
  const ctrOptions = [1, 2, 3]
  // CR options for matrix (1%, 2%, 3%)
  const crOptions = [1, 2, 3]

  // Get recommended CTR based on ER rating
  const erBasedCTR = getRecommendedCTRByER(erRating)

  // Find closest CTR option to recommended
  const recommendedCTR = ctrOptions.reduce((prev, curr) =>
    Math.abs(curr - erBasedCTR.recommended) < Math.abs(prev - erBasedCTR.recommended) ? curr : prev
  )
  // Default recommended CR is 2% (middle ground)
  const recommendedCR = 2

  // Legacy calculations (using recommended values)
  const expectedClicksLow = Math.round(totalReach * (ctrOptions[0] / 100))
  const expectedClicks = Math.round(totalReach * (recommendedCTR / 100))
  const expectedClicksHigh = Math.round(totalReach * (ctrOptions[2] / 100))

  const result: ConversionPrediction = {
    expectedClicks,
    expectedClicksLow,
    expectedClicksHigh,
    ctrUsed: recommendedCTR,
    ctrOptions,
    crOptions,
    recommendedCTR,
    recommendedCR,
    erBasedCTRRange: { min: erBasedCTR.min, max: erBasedCTR.max },
  }

  // If AOV provided, calculate full matrix and conversions
  if (averageOrderValue && averageOrderValue > 0) {
    const cost = totalCost || 0

    // Build scenario matrix (3×3)
    const scenarioMatrix: ConversionScenario[][] = []

    for (let ctrIdx = 0; ctrIdx < ctrOptions.length; ctrIdx++) {
      const ctrRow: ConversionScenario[] = []
      const ctr = ctrOptions[ctrIdx]

      for (let crIdx = 0; crIdx < crOptions.length; crIdx++) {
        const cr = crOptions[crIdx]

        const clicks = Math.round(totalReach * (ctr / 100))
        const conversions = Math.round(clicks * (cr / 100))
        const revenue = conversions * averageOrderValue
        const roi = cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : 0
        const breakEvenSales = cost > 0 ? Math.ceil(cost / averageOrderValue) : 0

        ctrRow.push({
          ctr,
          conversionRate: cr,
          clicks,
          conversions,
          revenue,
          roi,
          isBreakEven: conversions >= breakEvenSales,
          isProfitable: roi > 0,
        })
      }
      scenarioMatrix.push(ctrRow)
    }

    result.scenarioMatrix = scenarioMatrix

    // Set recommended scenario
    const recCtrIdx = ctrOptions.indexOf(recommendedCTR)
    const recCrIdx = crOptions.indexOf(recommendedCR)
    if (recCtrIdx >= 0 && recCrIdx >= 0) {
      result.recommendedScenario = scenarioMatrix[recCtrIdx][recCrIdx]
    }

    // Legacy fields
    result.expectedConversionsLow = scenarioMatrix[0][0].conversions
    result.expectedConversions = result.recommendedScenario?.conversions
    result.expectedConversionsHigh = scenarioMatrix[2][2].conversions
    result.conversionRateUsed = recommendedCR
    result.expectedRevenue = result.recommendedScenario?.revenue
    result.breakEvenSales = cost > 0 ? Math.ceil(cost / averageOrderValue) : undefined
    result.expectedROI = result.recommendedScenario?.roi
  }

  return result
}

/**
 * Format number for display (e.g., 125000 -> "125K")
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return num.toString()
}

/**
 * Format currency (CZK)
 */
export function formatCZK(amount: number): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + ' CZK'
}
