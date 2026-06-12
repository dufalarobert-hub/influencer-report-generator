/**
 * Apify Service - Instagram Data Fetching
 *
 * Používa priame HTTP volanie na Apify API (bez SDK kvôli webpack issues)
 */

// Types
export interface InstagramPost {
  id: string
  type: 'Video' | 'Image' | 'Sidecar'
  shortCode: string
  caption: string
  url: string
  likesCount: number
  commentsCount: number
  videoViewCount?: number
  timestamp: string
  locationName?: string
}

export interface InstagramProfile {
  username: string
  fullName: string
  biography: string
  followersCount: number
  followsCount: number
  postsCount: number
  verified: boolean
  profilePicUrl: string
  profilePicUrlHD: string
  isBusinessAccount: boolean
  businessCategoryName?: string
  latestPosts: InstagramPost[]
  // Average (mean) values
  avgLikes?: number
  avgComments?: number
  avgVideoViews?: number
  engagementRate?: number
  reachMultiplier?: number
  // Median values (more robust against outliers)
  medianLikes?: number
  medianComments?: number
  medianVideoViews?: number
  medianEngagementRate?: number
  medianReachMultiplier?: number
  // Trimmed mean (10% cut from both ends - compromise between avg and median)
  trimmedMeanLikes?: number
  trimmedMeanComments?: number
  trimmedMeanVideoViews?: number
  trimmedMeanEngagementRate?: number
  // Outlier detection
  hasHighVariance?: boolean  // true if avg > 2x median (indicates viral outliers)
}

const APIFY_API_BASE = 'https://api.apify.com/v2'

// Maximum age of posts to include in metric calculations (in months)
const MAX_POST_AGE_MONTHS = 6

/**
 * Calculate median of an array of numbers
 * More robust against outliers than average
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }
  return sorted[mid]
}

/**
 * Calculate trimmed mean (removes top and bottom 10% of values)
 * Compromise between average and median - less affected by outliers
 */
function calculateTrimmedMean(values: number[], trimPercent: number = 0.1): number {
  if (values.length === 0) return 0
  if (values.length < 5) return calculateMedian(values) // Use median for small samples

  const sorted = [...values].sort((a, b) => a - b)
  const trimCount = Math.floor(sorted.length * trimPercent)
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount)

  if (trimmed.length === 0) return calculateMedian(values)

  return Math.round(trimmed.reduce((sum, val) => sum + val, 0) / trimmed.length)
}

/**
 * Check if a post is recent enough to include in calculations
 * Filters out old pinned posts that could skew metrics
 */
function isPostRecent(post: InstagramPost, maxAgeMonths: number = MAX_POST_AGE_MONTHS): boolean {
  if (!post.timestamp) return true // If no timestamp, include it

  const postDate = new Date(post.timestamp)
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - maxAgeMonths)

  return postDate >= cutoffDate
}

/**
 * Fetch Instagram profile data using Apify REST API
 */
export async function fetchInstagramData(username: string): Promise<InstagramProfile> {
  const apiToken = process.env.APIFY_API_TOKEN

  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  const cleanUsername = username.replace('@', '').trim()
  console.log(`[Apify] Fetching data for @${cleanUsername}...`)

  try {
    // Start the actor run
    const runResponse = await fetch(
      `${APIFY_API_BASE}/acts/apify~instagram-profile-scraper/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: [cleanUsername],
        }),
      }
    )

    if (!runResponse.ok) {
      const error = await runResponse.text()
      throw new Error(`Failed to start Apify actor: ${error}`)
    }

    const runData = await runResponse.json()
    const runId = runData.data.id

    console.log(`[Apify] Actor started, run ID: ${runId}`)

    // Poll for completion
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 90 // 3 minutes max

    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const statusResponse = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiToken}`
      )
      const statusData = await statusResponse.json()
      status = statusData.data.status

      attempts++
      if (attempts >= maxAttempts) {
        throw new Error('Timeout waiting for Apify actor to complete')
      }

      if (attempts % 5 === 0) {
        console.log(`[Apify] Still running... (${attempts * 2}s)`)
      }
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Apify actor failed with status: ${status}`)
    }

    // Get dataset ID from run
    const datasetId = runData.data.defaultDatasetId

    // Fetch results from dataset
    const datasetResponse = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiToken}`
    )

    if (!datasetResponse.ok) {
      throw new Error('Failed to fetch dataset')
    }

    const items = await datasetResponse.json()

    if (!items || items.length === 0) {
      throw new Error(`No data found for @${cleanUsername}`)
    }

    const raw = items[0]

    // Parse latest posts (increased to 20 for more reels data)
    const latestPosts: InstagramPost[] = (raw.latestPosts || [])
      .slice(0, 20)
      .map((p: Record<string, unknown>) => ({
        id: p.id as string,
        type: p.type as 'Video' | 'Image' | 'Sidecar',
        shortCode: p.shortCode as string,
        caption: (p.caption as string) || '',
        url: p.url as string,
        likesCount: (p.likesCount as number) || 0,
        commentsCount: (p.commentsCount as number) || 0,
        videoViewCount: p.videoViewCount as number | undefined,
        timestamp: p.timestamp as string,
        locationName: p.locationName as string | undefined,
      }))

    // Filter out old pinned posts (older than 6 months) for metric calculations
    const recentPosts = latestPosts.filter(p => isPostRecent(p))
    const filteredOutCount = latestPosts.length - recentPosts.length

    if (filteredOutCount > 0) {
      console.log(`[Apify] ⚠ Filtered out ${filteredOutCount} old posts (>6 months) from metric calculations`)
      // Log which posts were filtered
      const oldPosts = latestPosts.filter(p => !isPostRecent(p))
      oldPosts.forEach(p => {
        const postDate = new Date(p.timestamp).toLocaleDateString('cs-CZ')
        const engagement = p.videoViewCount
          ? `${(p.videoViewCount / 1000).toFixed(0)}K views`
          : `${p.likesCount} likes`
        console.log(`[Apify]   - Filtered: ${postDate} (${engagement})`)
      })
    }

    // Calculate averages AND medians from RECENT posts only
    const postsWithEngagement = recentPosts.filter(p => p.likesCount > 0)
    // Fixed: Filter by videoViewCount only - Apify may return Reels as different types (Video, Reel, Clip, GraphVideo)
    const videoPosts = recentPosts.filter(p => p.videoViewCount && p.videoViewCount > 0)

    // AVERAGE (mean) calculations
    const avgLikes = postsWithEngagement.length > 0
      ? Math.round(postsWithEngagement.reduce((sum, p) => sum + p.likesCount, 0) / postsWithEngagement.length)
      : 0

    const avgComments = postsWithEngagement.length > 0
      ? Math.round(postsWithEngagement.reduce((sum, p) => sum + p.commentsCount, 0) / postsWithEngagement.length)
      : 0

    const avgVideoViews = videoPosts.length > 0
      ? Math.round(videoPosts.reduce((sum, p) => sum + (p.videoViewCount || 0), 0) / videoPosts.length)
      : 0

    // MEDIAN calculations (more robust against outliers)
    const medianLikes = calculateMedian(postsWithEngagement.map(p => p.likesCount))
    const medianComments = calculateMedian(postsWithEngagement.map(p => p.commentsCount))
    const medianVideoViews = calculateMedian(videoPosts.map(p => p.videoViewCount || 0))

    // TRIMMED MEAN calculations (10% cut from both ends - compromise)
    const trimmedMeanLikes = calculateTrimmedMean(postsWithEngagement.map(p => p.likesCount))
    const trimmedMeanComments = calculateTrimmedMean(postsWithEngagement.map(p => p.commentsCount))
    const trimmedMeanVideoViews = calculateTrimmedMean(videoPosts.map(p => p.videoViewCount || 0))

    const followersCount = raw.followersCount || 0

    // Calculate ER for EACH POST first, then average/median/trimmed mean
    // This is the correct way - average the ERs, not average likes then calculate ER
    const postERs = followersCount > 0
      ? postsWithEngagement.map(p => ((p.likesCount + p.commentsCount) / followersCount) * 100)
      : []

    // Engagement rates (calculated correctly from per-post ERs)
    const engagementRate = postERs.length > 0
      ? postERs.reduce((sum, er) => sum + er, 0) / postERs.length
      : 0

    const medianEngagementRate = postERs.length > 0
      ? calculateMedian(postERs.map(er => Math.round(er * 100))) / 100  // Convert to preserve decimals
      : 0

    const trimmedMeanEngagementRate = postERs.length > 0
      ? calculateTrimmedMean(postERs.map(er => Math.round(er * 100))) / 100
      : 0

    // Reach multipliers
    const reachMultiplier = followersCount > 0 && avgVideoViews > 0
      ? avgVideoViews / followersCount
      : 0

    const medianReachMultiplier = followersCount > 0 && medianVideoViews > 0
      ? medianVideoViews / followersCount
      : 0

    // Detect high variance (outliers present)
    // If average ER is more than 2x the median ER, there are significant outliers
    const hasHighVariance = engagementRate > 0 && medianEngagementRate > 0 && (engagementRate / medianEngagementRate) > 2

    if (hasHighVariance) {
      console.log(`[Apify] ⚠ High variance detected! Avg ER: ${engagementRate.toFixed(2)}%, Median ER: ${medianEngagementRate.toFixed(2)}% (ratio: ${(engagementRate / medianEngagementRate).toFixed(1)}x)`)
      console.log(`[Apify]   → Using MEDIAN for more accurate ROI calculations`)
    }

    const profile: InstagramProfile = {
      username: raw.username,
      fullName: raw.fullName || '',
      biography: raw.biography || '',
      followersCount,
      followsCount: raw.followsCount || 0,
      postsCount: raw.postsCount || 0,
      verified: raw.verified || false,
      profilePicUrl: raw.profilePicUrl || '',
      profilePicUrlHD: raw.profilePicUrlHD || '',
      isBusinessAccount: raw.isBusinessAccount || false,
      businessCategoryName: raw.businessCategoryName,
      latestPosts,
      // Average values
      avgLikes,
      avgComments,
      avgVideoViews,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reachMultiplier: Math.round(reachMultiplier * 100) / 100,
      // Median values (more robust)
      medianLikes,
      medianComments,
      medianVideoViews,
      medianEngagementRate: Math.round(medianEngagementRate * 100) / 100,
      medianReachMultiplier: Math.round(medianReachMultiplier * 100) / 100,
      // Trimmed mean (10% orez - kompromis)
      trimmedMeanLikes,
      trimmedMeanComments,
      trimmedMeanVideoViews,
      trimmedMeanEngagementRate: Math.round(trimmedMeanEngagementRate * 100) / 100,
      // Outlier detection
      hasHighVariance,
    }

    console.log(`[Apify] Success! @${cleanUsername}: ${followersCount} followers, ${latestPosts.length} posts`)
    console.log(`[Apify] ER: ${profile.engagementRate}% (avg) / ${profile.trimmedMeanEngagementRate}% (trimmed) / ${profile.medianEngagementRate}% (median)${hasHighVariance ? ' ⚠️ HIGH VARIANCE' : ''}`)

    return profile

  } catch (error) {
    console.error('[Apify] Error:', error)
    throw error
  }
}

/**
 * Get top performing posts (only recent - last 6 months)
 */
export function getTopPosts(profile: InstagramProfile, count: number = 4): InstagramPost[] {
  return [...profile.latestPosts]
    .filter(p => isPostRecent(p))  // Exclude old pinned posts
    .sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount))
    .slice(0, count)
}

/**
 * Get top reels by views (only recent - last 6 months)
 */
export function getTopReels(profile: InstagramProfile, count: number = 8): InstagramPost[] {
  return profile.latestPosts
    .filter(p => isPostRecent(p))  // Exclude old pinned viral content
    // Fixed: Filter by videoViewCount only - Apify may return Reels as different types
    .filter(p => p.videoViewCount && p.videoViewCount > 0)
    .sort((a, b) => (b.videoViewCount || 0) - (a.videoViewCount || 0))
    .slice(0, count)
}

// ============================================
// INSTAGRAM REEL SCRAPER (for accurate videoPlayCount)
// ============================================

interface ReelData {
  shortCode: string
  videoPlayCount: number
  videoViewCount?: number
  likesCount: number
  commentsCount: number
}

/**
 * Fetch accurate video play counts using Instagram Reel Scraper
 * This returns videoPlayCount which is the actual view count shown on Instagram
 */
export async function fetchReelViews(reelUrls: string[]): Promise<Map<string, number>> {
  const apiToken = process.env.APIFY_API_TOKEN

  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  if (reelUrls.length === 0) {
    return new Map()
  }

  console.log(`[Apify Reels] Fetching accurate views for ${reelUrls.length} reels...`)

  try {
    // Start the Instagram Reel Scraper actor
    // Convert /p/ URLs to /reel/ format
    const formattedUrls = reelUrls.map(url => url.replace('/p/', '/reel/'))

    console.log(`[Apify Reels] URLs: ${formattedUrls.slice(0, 3).join(', ')}...`)

    const runResponse = await fetch(
      `${APIFY_API_BASE}/acts/apify~instagram-reel-scraper/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formattedUrls,  // Can accept usernames OR direct reel URLs
        }),
      }
    )

    if (!runResponse.ok) {
      const error = await runResponse.text()
      console.error('[Apify Reels] Failed to start:', error)
      return new Map()
    }

    const runData = await runResponse.json()
    const runId = runData.data.id

    console.log(`[Apify Reels] Actor started, run ID: ${runId}`)

    // Poll for completion
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 90 // 3 minutes max

    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const statusResponse = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiToken}`
      )
      const statusData = await statusResponse.json()
      status = statusData.data.status

      attempts++
      if (attempts >= maxAttempts) {
        console.error('[Apify Reels] Timeout')
        return new Map()
      }

      if (attempts % 5 === 0) {
        console.log(`[Apify Reels] Still running... (${attempts * 2}s)`)
      }
    }

    if (status !== 'SUCCEEDED') {
      console.error(`[Apify Reels] Failed with status: ${status}`)
      return new Map()
    }

    // Get dataset ID from run
    const datasetId = runData.data.defaultDatasetId

    // Fetch results from dataset
    const datasetResponse = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiToken}`
    )

    if (!datasetResponse.ok) {
      console.error('[Apify Reels] Failed to fetch dataset')
      return new Map()
    }

    const items: ReelData[] = await datasetResponse.json()

    // Build map of shortCode -> videoPlayCount
    const viewsMap = new Map<string, number>()
    for (const item of items) {
      if (item.shortCode && item.videoPlayCount) {
        viewsMap.set(item.shortCode, item.videoPlayCount)
        console.log(`[Apify Reels]   ${item.shortCode}: ${item.videoPlayCount.toLocaleString()} plays`)
      }
    }

    console.log(`[Apify Reels] Success! Got accurate views for ${viewsMap.size} reels`)

    return viewsMap

  } catch (error) {
    console.error('[Apify Reels] Error:', error)
    return new Map()
  }
}

/**
 * Fetch reels directly by username (gets accurate data from Reels tab)
 */
export async function fetchReelsByUsername(username: string, limit: number = 15): Promise<Map<string, number>> {
  const apiToken = process.env.APIFY_API_TOKEN

  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  console.log(`[Apify Reels] Fetching reels for @${username} (limit: ${limit})...`)

  try {
    const runResponse = await fetch(
      `${APIFY_API_BASE}/acts/apify~instagram-reel-scraper/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: [username],
          resultsLimit: limit,
        }),
      }
    )

    if (!runResponse.ok) {
      const error = await runResponse.text()
      console.error('[Apify Reels] Failed to start:', error)
      return new Map()
    }

    const runData = await runResponse.json()
    const runId = runData.data.id

    console.log(`[Apify Reels] Actor started, run ID: ${runId}`)

    // Poll for completion
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 90 // 3 minutes max

    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const statusResponse = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiToken}`
      )
      const statusData = await statusResponse.json()
      status = statusData.data.status

      attempts++
      if (attempts >= maxAttempts) {
        console.error('[Apify Reels] Timeout')
        return new Map()
      }

      if (attempts % 5 === 0) {
        console.log(`[Apify Reels] Still running... (${attempts * 2}s)`)
      }
    }

    if (status !== 'SUCCEEDED') {
      console.error(`[Apify Reels] Failed with status: ${status}`)
      return new Map()
    }

    const datasetId = runData.data.defaultDatasetId
    const datasetResponse = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiToken}`
    )

    if (!datasetResponse.ok) {
      console.error('[Apify Reels] Failed to fetch dataset')
      return new Map()
    }

    const items: ReelData[] = await datasetResponse.json()

    const viewsMap = new Map<string, number>()
    for (const item of items) {
      if (item.shortCode && item.videoPlayCount) {
        viewsMap.set(item.shortCode, item.videoPlayCount)
        console.log(`[Apify Reels]   ${item.shortCode}: ${item.videoPlayCount.toLocaleString()} plays`)
      }
    }

    console.log(`[Apify Reels] Success! Got ${viewsMap.size} reels from @${username}`)
    return viewsMap

  } catch (error) {
    console.error('[Apify Reels] Error:', error)
    return new Map()
  }
}

/**
 * Update profile posts with accurate video play counts from Reel Scraper
 */
export async function enrichProfileWithReelViews(profile: InstagramProfile): Promise<InstagramProfile> {
  // Fetch reels directly by username (more accurate than URL-based)
  const viewsMap = await fetchReelsByUsername(profile.username, 15)

  if (viewsMap.size === 0) {
    console.log('[Apify Reels] No views data returned, using original values')
    return profile
  }

  // Update posts with accurate views
  const updatedPosts = profile.latestPosts.map(post => {
    const accurateViews = viewsMap.get(post.shortCode)
    if (accurateViews) {
      console.log(`[Apify Reels] Updating ${post.shortCode}: ${post.videoViewCount} -> ${accurateViews}`)
      return { ...post, videoViewCount: accurateViews }
    }
    return post
  })

  // Recalculate averages AND medians with accurate data (only from recent posts!)
  const recentUpdatedPosts = updatedPosts.filter(p => isPostRecent(p))
  const updatedVideoPosts = recentUpdatedPosts.filter(p => p.videoViewCount && p.videoViewCount > 0)

  // Average
  const avgVideoViews = updatedVideoPosts.length > 0
    ? Math.round(updatedVideoPosts.reduce((sum, p) => sum + (p.videoViewCount || 0), 0) / updatedVideoPosts.length)
    : 0

  // Median
  const medianVideoViews = calculateMedian(updatedVideoPosts.map(p => p.videoViewCount || 0))

  // Reach multipliers
  const reachMultiplier = profile.followersCount > 0 && avgVideoViews > 0
    ? avgVideoViews / profile.followersCount
    : 0

  const medianReachMultiplier = profile.followersCount > 0 && medianVideoViews > 0
    ? medianVideoViews / profile.followersCount
    : 0

  console.log(`[Apify Reels] Updated avgVideoViews: ${profile.avgVideoViews} -> ${avgVideoViews}`)
  console.log(`[Apify Reels] Updated medianVideoViews: ${profile.medianVideoViews} -> ${medianVideoViews}`)
  console.log(`[Apify Reels] Updated reachMultiplier: ${profile.reachMultiplier} -> ${Math.round(reachMultiplier * 100) / 100}`)

  return {
    ...profile,
    latestPosts: updatedPosts,
    avgVideoViews,
    medianVideoViews,
    reachMultiplier: Math.round(reachMultiplier * 100) / 100,
    medianReachMultiplier: Math.round(medianReachMultiplier * 100) / 100,
  }
}

// ============================================
// INSTAGRAM COMMENTS SCRAPER
// ============================================

export interface InstagramComment {
  id: string
  text: string
  ownerUsername: string
  ownerProfilePicUrl?: string
  timestamp: string
  likesCount: number
  repliesCount?: number
  isVerified?: boolean
}

export interface CommentAnalysis {
  totalComments: number
  genericComments: number      // Emoji only, "Nice!", "🔥", etc.
  meaningfulComments: number   // 10+ words, questions, opinions
  genericRatio: number         // % of generic comments
  meaningfulRatio: number      // % of meaningful comments
  avgCommentLength: number
  commentQualityScore: number  // 0-100
  qualityRating: 'LOW' | 'MEDIUM' | 'HIGH'
  redFlags: string[]
  greenFlags: string[]
}

/**
 * Fetch comments from Instagram posts using Apify Comments Scraper
 * @param postUrls - Array of Instagram post/reel URLs
 * @param commentsPerPost - Number of comments to fetch per post (default 15, free plan limit)
 */
export async function fetchInstagramComments(
  postUrls: string[],
  commentsPerPost: number = 15
): Promise<InstagramComment[]> {
  const apiToken = process.env.APIFY_API_TOKEN

  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  console.log(`[Apify Comments] Fetching comments for ${postUrls.length} posts...`)

  try {
    // Start the Instagram Comments Scraper actor
    const runResponse = await fetch(
      `${APIFY_API_BASE}/acts/apify~instagram-comment-scraper/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: postUrls,
          resultsLimit: commentsPerPost,
          includeReplies: false,  // Keep costs down
        }),
      }
    )

    if (!runResponse.ok) {
      const error = await runResponse.text()
      throw new Error(`Failed to start Comments Scraper: ${error}`)
    }

    const runData = await runResponse.json()
    const runId = runData.data.id

    console.log(`[Apify Comments] Actor started, run ID: ${runId}`)

    // Poll for completion
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 30 // 1 minute max

    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const statusResponse = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiToken}`
      )
      const statusData = await statusResponse.json()
      status = statusData.data.status

      attempts++
      if (attempts >= maxAttempts) {
        throw new Error('Timeout waiting for Comments Scraper')
      }
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Comments Scraper failed with status: ${status}`)
    }

    // Get dataset ID from run
    const datasetId = runData.data.defaultDatasetId

    // Fetch results from dataset
    const datasetResponse = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiToken}`
    )

    if (!datasetResponse.ok) {
      throw new Error('Failed to fetch comments dataset')
    }

    const items = await datasetResponse.json()

    // Parse comments
    const comments: InstagramComment[] = items.map((item: Record<string, unknown>) => ({
      id: item.id as string || '',
      text: item.text as string || '',
      ownerUsername: item.ownerUsername as string || '',
      ownerProfilePicUrl: item.ownerProfilePicUrl as string || '',
      timestamp: item.timestamp as string || '',
      likesCount: (item.likesCount as number) || 0,
      repliesCount: item.repliesCount as number || 0,
      isVerified: item.isVerified as boolean || false,
    }))

    console.log(`[Apify Comments] Success! Fetched ${comments.length} comments`)

    return comments

  } catch (error) {
    console.error('[Apify Comments] Error:', error)
    throw error
  }
}

/**
 * Analyze comment quality to detect bots/engagement pods
 */
export function analyzeCommentQuality(comments: InstagramComment[]): CommentAnalysis {
  if (comments.length === 0) {
    return {
      totalComments: 0,
      genericComments: 0,
      meaningfulComments: 0,
      genericRatio: 0,
      meaningfulRatio: 0,
      avgCommentLength: 0,
      commentQualityScore: 50,
      qualityRating: 'MEDIUM',
      redFlags: ['No comments to analyze'],
      greenFlags: [],
    }
  }

  // Generic comment patterns (bots, engagement pods)
  const genericPatterns = [
    /^[🔥❤️💯👏👍😍🙌💪✨🎉💕😊🤩😻💗💖]+$/,  // Emoji only
    /^(nice|great|amazing|beautiful|awesome|love it|wow|cool|perfect|stunning|gorgeous)[\s!.]*$/i,
    /^(super|skvělé|krásné|pecka|bomba|paráda|hustý)[\s!.]*$/i,  // Czech generic
    /^(follow me|check my|link in bio|dm for).*$/i,  // Spam
    /^@\w+\s*$/,  // Just tagging someone
    /^.{1,5}$/,  // Very short (1-5 chars)
  ]

  // Meaningful comment indicators
  const meaningfulIndicators = [
    /\?/,  // Contains question
    /\b(how|what|where|why|when|which|jak|kde|proč|co)\b/i,  // Question words
    /\b(think|believe|feel|opinion|agree|disagree|myslím|souhlasím)\b/i,  // Opinions
  ]

  let genericCount = 0
  let meaningfulCount = 0
  let totalLength = 0

  for (const comment of comments) {
    const text = comment.text.trim()
    totalLength += text.length

    // Check if generic
    const isGeneric = genericPatterns.some(pattern => pattern.test(text))
    if (isGeneric) {
      genericCount++
      continue
    }

    // Check if meaningful (10+ words OR contains indicators)
    const wordCount = text.split(/\s+/).length
    const hasMeaningfulIndicator = meaningfulIndicators.some(pattern => pattern.test(text))

    if (wordCount >= 10 || hasMeaningfulIndicator) {
      meaningfulCount++
    }
  }

  const genericRatio = Math.round((genericCount / comments.length) * 100)
  const meaningfulRatio = Math.round((meaningfulCount / comments.length) * 100)
  const avgCommentLength = Math.round(totalLength / comments.length)

  // Calculate quality score (0-100)
  let qualityScore = 50  // Start at neutral

  // Penalize high generic ratio
  if (genericRatio > 60) qualityScore -= 30
  else if (genericRatio > 40) qualityScore -= 15
  else if (genericRatio < 20) qualityScore += 10

  // Reward meaningful comments
  if (meaningfulRatio > 40) qualityScore += 25
  else if (meaningfulRatio > 25) qualityScore += 15
  else if (meaningfulRatio < 10) qualityScore -= 10

  // Reward longer average comments
  if (avgCommentLength > 50) qualityScore += 10
  else if (avgCommentLength < 15) qualityScore -= 10

  // Clamp score
  qualityScore = Math.max(0, Math.min(100, qualityScore))

  // Determine rating
  let qualityRating: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  if (qualityScore >= 65) qualityRating = 'HIGH'
  else if (qualityScore < 40) qualityRating = 'LOW'

  // Build flags
  const redFlags: string[] = []
  const greenFlags: string[] = []

  if (genericRatio > 50) redFlags.push(`${genericRatio}% generic komentářů (emoji, "Nice!")`)
  if (meaningfulRatio < 15) redFlags.push('Málo smysluplných komentářů')
  if (avgCommentLength < 15) redFlags.push('Velmi krátké komentáře v průměru')

  if (meaningfulRatio > 30) greenFlags.push(`${meaningfulRatio}% obsahuje otázky/názory`)
  if (avgCommentLength > 40) greenFlags.push('Dlouhé, angažované komentáře')
  if (genericRatio < 25) greenFlags.push('Nízký podíl generických komentářů')

  return {
    totalComments: comments.length,
    genericComments: genericCount,
    meaningfulComments: meaningfulCount,
    genericRatio,
    meaningfulRatio,
    avgCommentLength,
    commentQualityScore: qualityScore,
    qualityRating,
    redFlags,
    greenFlags,
  }
}

// ============================================
// LOOKALIKE DISCOVERY - Related Profiles
// ============================================

import { LOOKALIKE_CONFIG } from './types'

/**
 * Related profile data from Instagram Related Person Scraper
 */
export interface RelatedProfileData {
  username: string
  fullName?: string
  profilePicUrl?: string
  isVerified?: boolean
  isPrivate?: boolean
  id?: string
  followersCount?: number
  biography?: string
}

/**
 * Get lookalike config based on environment
 */
function getLookalikeConfig() {
  const mode = process.env.DISCOVERY_MODE || process.env.NODE_ENV || 'development'
  return mode === 'production' ? LOOKALIKE_CONFIG.production : LOOKALIKE_CONFIG.development
}

/**
 * Fetch related/suggested profiles using Instagram Related Person Scraper
 * This uses Instagram's actual "Suggested Accounts" feature
 *
 * Actor: api-empire/instagram-related-person-scraper
 */
export async function fetchRelatedProfiles(
  username: string,
  limit: number = 20
): Promise<RelatedProfileData[]> {
  const apiToken = process.env.APIFY_API_TOKEN

  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  const cleanUsername = username.replace('@', '').trim()
  console.log(`[Apify Related] Fetching suggested profiles for @${cleanUsername} (limit: ${limit})...`)

  try {
    // Use Instagram Related Person Scraper - specifically for suggested accounts
    const runResponse = await fetch(
      `${APIFY_API_BASE}/acts/api-empire~instagram-related-person-scraper/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernames: [cleanUsername],
          resultsLimit: limit,
        }),
      }
    )

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      throw new Error(`Apify Related Person API error: ${runResponse.status} - ${errorText}`)
    }

    const runData = await runResponse.json()
    const runId = runData.data.id

    console.log(`[Apify Related] Run started: ${runId}`)

    // Poll for completion
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 90 // 3 minutes max

    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++

      if (attempts >= maxAttempts) {
        throw new Error('Apify Related Person scraper timeout (3 minutes)')
      }

      const statusResponse = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiToken}`
      )
      const statusData = await statusResponse.json()
      status = statusData.data.status

      if (attempts % 10 === 0) {
        console.log(`[Apify Related] Status: ${status} (${attempts * 2}s elapsed)`)
      }
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Apify Related Person scraper failed with status: ${status}`)
    }

    // Fetch results from dataset
    const datasetId = runData.data.defaultDatasetId
    const resultsResponse = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiToken}`
    )

    if (!resultsResponse.ok) {
      throw new Error(`Failed to fetch related profiles: ${resultsResponse.status}`)
    }

    const rawResults = await resultsResponse.json()

    // Transform results - this scraper returns profiles directly
    const relatedProfiles: RelatedProfileData[] = rawResults
      .filter((item: Record<string, unknown>) => item.username)
      .map((item: Record<string, unknown>) => ({
        username: item.username as string,
        fullName: item.full_name as string || item.fullName as string || undefined,
        profilePicUrl: item.profile_pic_url as string || item.profilePicUrl as string || undefined,
        isVerified: item.is_verified as boolean || item.isVerified as boolean || false,
        isPrivate: item.is_private as boolean || item.isPrivate as boolean || false,
        id: item.id as string || item.pk as string || undefined,
        followersCount: item.followers_count as number || item.followersCount as number || undefined,
        biography: item.biography as string || item.bio as string || undefined,
      }))

    console.log(`[Apify Related] Found ${relatedProfiles.length} suggested profiles`)

    return relatedProfiles

  } catch (error) {
    console.error('[Apify Related] Error:', error)
    throw error
  }
}

/**
 * Filter related profiles - remove private, filter by followers
 * Returns usernames for detailed analysis
 */
export function filterRelatedProfiles(
  profiles: RelatedProfileData[],
  limit?: number
): string[] {
  const config = getLookalikeConfig()
  const maxProfiles = limit || config.profilesToAnalyze
  const minFollowers = config.minFollowersForInfluencer

  console.log(`[Lookalike] Filtering ${profiles.length} related profiles...`)
  console.log(`[Lookalike] Criteria: public, ${minFollowers.toLocaleString()}+ followers`)

  // Filter out private accounts and small accounts
  const validProfiles = profiles.filter(p => {
    if (p.isPrivate) {
      console.log(`[Lookalike]   Skipping @${p.username}: private account`)
      return false
    }
    // If we have followers count, check minimum
    if (p.followersCount !== undefined && p.followersCount < minFollowers) {
      console.log(`[Lookalike]   Skipping @${p.username}: only ${p.followersCount} followers`)
      return false
    }
    return true
  })

  console.log(`[Lookalike] Found ${validProfiles.length} valid profiles`)

  // Sort by followers count if available (higher = more established)
  const sorted = validProfiles.sort((a, b) =>
    (b.followersCount || 0) - (a.followersCount || 0)
  )

  // Return up to limit usernames
  const result = sorted.slice(0, maxProfiles).map(p => p.username)

  console.log(`[Lookalike] Returning ${result.length} for detailed analysis`)

  return result
}

/**
 * Fetch multiple Instagram profiles sequentially
 * Uses the existing fetchInstagramData function
 */
export async function fetchMultipleProfiles(
  usernames: string[]
): Promise<InstagramProfile[]> {
  console.log(`[Lookalike] Fetching ${usernames.length} profiles...`)

  const profiles: InstagramProfile[] = []
  const errors: string[] = []

  // Fetch profiles sequentially to avoid rate limits
  for (const username of usernames) {
    try {
      console.log(`[Lookalike] Fetching profile: @${username}`)
      const profile = await fetchInstagramData(username)
      profiles.push(profile)
    } catch (error) {
      console.error(`[Lookalike] Failed to fetch @${username}:`, error)
      errors.push(username)
    }

    // Small delay between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`[Lookalike] Fetched ${profiles.length}/${usernames.length} profiles (${errors.length} failed)`)

  return profiles
}

/**
 * Calculate similarity score for a lookalike influencer
 * Based on engagement quality and profile characteristics
 */
export function calculateSimilarityScore(
  profile: InstagramProfile,
  sourceFollowers: number
): number {
  let score = 0

  // 1. Engagement Rate (40%) - most important for quality
  const er = profile.medianEngagementRate || profile.engagementRate || 0
  if (er >= 5) score += 40
  else if (er >= 3.5) score += 35
  else if (er >= 2.5) score += 28
  else if (er >= 1.5) score += 20
  else if (er >= 1) score += 12
  else score += 0

  // 2. Similar size to source (25%)
  const sizeRatio = profile.followersCount / sourceFollowers
  if (sizeRatio >= 0.5 && sizeRatio <= 2.0) {
    score += 25  // Within 2x range
  } else if (sizeRatio >= 0.2 && sizeRatio <= 5.0) {
    score += 15  // Within 5x range
  } else {
    score += 5   // Very different size
  }

  // 3. Recent activity (15%)
  const recentPosts = profile.latestPosts?.filter(p => isPostRecent(p, 1)) || []
  if (recentPosts.length >= 4) score += 15
  else if (recentPosts.length >= 2) score += 10
  else if (recentPosts.length >= 1) score += 5

  // 4. Profile quality (10%)
  if (profile.biography && profile.biography.length > 50) score += 5
  if (profile.isBusinessAccount) score += 5

  // 5. Consistency bonus (10%)
  if (!profile.hasHighVariance) score += 10

  // Penalty for very low engagement
  if (er < 0.5) {
    score = Math.max(0, score - 15)
  }

  return Math.round(Math.min(100, score))
}

// ============================================
// HASHTAG FALLBACK SCRAPING
// ============================================

/**
 * Post from hashtag scraper
 */
export interface HashtagPost {
  username: string
  shortCode: string
  likesCount: number
  commentsCount: number
  ownerFollowers?: number
}

/**
 * Extract hashtags from bio and category
 */
export function extractHashtagsFromProfile(
  bio: string,
  category?: string,
  username?: string
): string[] {
  const hashtags: string[] = []

  // Extract hashtags from bio
  const bioHashtags = bio.match(/#(\w+)/g) || []
  hashtags.push(...bioHashtags.map(h => h.replace('#', '').toLowerCase()))

  // Add category-based hashtags
  if (category) {
    const categoryLower = category.toLowerCase()
    if (categoryLower.includes('fitness') || categoryLower.includes('sport')) {
      hashtags.push('fitness', 'fitnessmotivation', 'workout', 'gym')
    }
    if (categoryLower.includes('beauty') || categoryLower.includes('fashion')) {
      hashtags.push('beauty', 'fashion', 'style', 'makeup')
    }
    if (categoryLower.includes('travel')) {
      hashtags.push('travel', 'wanderlust', 'travelgram', 'explore')
    }
    if (categoryLower.includes('food')) {
      hashtags.push('food', 'foodie', 'foodporn', 'instafood')
    }
    if (categoryLower.includes('lifestyle')) {
      hashtags.push('lifestyle', 'life', 'daily', 'instagood')
    }
    if (categoryLower.includes('art') || categoryLower.includes('creator')) {
      hashtags.push('art', 'creative', 'artist', 'content')
    }
    if (categoryLower.includes('video') || categoryLower.includes('film')) {
      hashtags.push('video', 'filmmaker', 'cinematography', 'reels')
    }
  }

  // Add generic influencer hashtags as fallback
  if (hashtags.length < 3) {
    hashtags.push('influencer', 'contentcreator', 'instagram')
  }

  // Remove duplicates and return max 6
  return [...new Set(hashtags)].slice(0, 6)
}

/**
 * Fetch posts from hashtags (fallback when no related profiles)
 */
export async function fetchHashtagPosts(
  hashtags: string[],
  limit: number = 100
): Promise<HashtagPost[]> {
  const apiToken = process.env.APIFY_API_TOKEN

  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN is not configured')
  }

  console.log(`[Apify Hashtag] Fetching posts from hashtags: ${hashtags.join(', ')}`)

  try {
    const runResponse = await fetch(
      `${APIFY_API_BASE}/acts/apify~instagram-hashtag-scraper/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hashtags: hashtags,
          resultsLimit: Math.ceil(limit / hashtags.length),
          resultsType: 'posts',
        }),
      }
    )

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      throw new Error(`Apify Hashtag API error: ${runResponse.status} - ${errorText}`)
    }

    const runData = await runResponse.json()
    const runId = runData.data.id

    console.log(`[Apify Hashtag] Run started: ${runId}`)

    // Poll for completion
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 90

    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++

      if (attempts >= maxAttempts) {
        throw new Error('Apify Hashtag scraper timeout')
      }

      const statusResponse = await fetch(
        `${APIFY_API_BASE}/actor-runs/${runId}?token=${apiToken}`
      )
      const statusData = await statusResponse.json()
      status = statusData.data.status

      if (attempts % 15 === 0) {
        console.log(`[Apify Hashtag] Status: ${status} (${attempts * 2}s)`)
      }
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Apify Hashtag scraper failed: ${status}`)
    }

    const datasetId = runData.data.defaultDatasetId
    const resultsResponse = await fetch(
      `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${apiToken}`
    )

    const rawResults = await resultsResponse.json()

    const posts: HashtagPost[] = rawResults
      .filter((item: Record<string, unknown>) => item.ownerUsername)
      .map((item: Record<string, unknown>) => ({
        username: item.ownerUsername as string,
        shortCode: item.shortCode as string || '',
        likesCount: item.likesCount as number || 0,
        commentsCount: item.commentsCount as number || 0,
        ownerFollowers: item.ownerFollowersCount as number || undefined,
      }))

    console.log(`[Apify Hashtag] Found ${posts.length} posts`)

    return posts

  } catch (error) {
    console.error('[Apify Hashtag] Error:', error)
    throw error
  }
}

/**
 * Get unique influencer usernames from hashtag posts
 */
export function getInfluencersFromHashtags(
  posts: HashtagPost[],
  minFollowers: number = 5000,
  limit: number = 10
): string[] {
  // Group by username and calculate engagement
  const userMap = new Map<string, { engagement: number; followers?: number }>()

  for (const post of posts) {
    if (!post.username) continue

    const existing = userMap.get(post.username)
    const engagement = post.likesCount + post.commentsCount

    if (existing) {
      existing.engagement += engagement
      if (post.ownerFollowers) existing.followers = post.ownerFollowers
    } else {
      userMap.set(post.username, {
        engagement,
        followers: post.ownerFollowers
      })
    }
  }

  // Filter and sort
  const sorted = Array.from(userMap.entries())
    .filter(([_, data]) => !data.followers || data.followers >= minFollowers)
    .sort((a, b) => b[1].engagement - a[1].engagement)
    .slice(0, limit)
    .map(([username]) => username)

  console.log(`[Hashtag] Found ${sorted.length} potential influencers`)

  return sorted
}
