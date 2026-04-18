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
  avgLikes?: number
  avgComments?: number
  avgVideoViews?: number
  engagementRate?: number
  reachMultiplier?: number
}

const APIFY_API_BASE = 'https://api.apify.com/v2'

// Maximum age of posts to include in metric calculations (in months)
const MAX_POST_AGE_MONTHS = 6

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
    const maxAttempts = 60 // 2 minutes max

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

    // Calculate averages from RECENT posts only
    const postsWithEngagement = recentPosts.filter(p => p.likesCount > 0)
    // Fixed: Filter by videoViewCount only - Apify may return Reels as different types (Video, Reel, Clip, GraphVideo)
    const videoPosts = recentPosts.filter(p => p.videoViewCount && p.videoViewCount > 0)

    const avgLikes = postsWithEngagement.length > 0
      ? Math.round(postsWithEngagement.reduce((sum, p) => sum + p.likesCount, 0) / postsWithEngagement.length)
      : 0

    const avgComments = postsWithEngagement.length > 0
      ? Math.round(postsWithEngagement.reduce((sum, p) => sum + p.commentsCount, 0) / postsWithEngagement.length)
      : 0

    const avgVideoViews = videoPosts.length > 0
      ? Math.round(videoPosts.reduce((sum, p) => sum + (p.videoViewCount || 0), 0) / videoPosts.length)
      : 0

    const followersCount = raw.followersCount || 0

    const engagementRate = followersCount > 0
      ? ((avgLikes + avgComments) / followersCount) * 100
      : 0

    const reachMultiplier = followersCount > 0 && avgVideoViews > 0
      ? avgVideoViews / followersCount
      : 0

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
      avgLikes,
      avgComments,
      avgVideoViews,
      engagementRate: Math.round(engagementRate * 100) / 100,
      reachMultiplier: Math.round(reachMultiplier * 100) / 100,
    }

    console.log(`[Apify] Success! @${cleanUsername}: ${followersCount} followers, ${latestPosts.length} posts`)

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
    const maxAttempts = 60 // 2 minutes max

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

  // Recalculate averages with accurate data (only from recent posts!)
  const recentUpdatedPosts = updatedPosts.filter(p => isPostRecent(p))
  const updatedVideoPosts = recentUpdatedPosts.filter(p => p.videoViewCount && p.videoViewCount > 0)
  const avgVideoViews = updatedVideoPosts.length > 0
    ? Math.round(updatedVideoPosts.reduce((sum, p) => sum + (p.videoViewCount || 0), 0) / updatedVideoPosts.length)
    : 0

  const reachMultiplier = profile.followersCount > 0 && avgVideoViews > 0
    ? avgVideoViews / profile.followersCount
    : 0

  console.log(`[Apify Reels] Updated avgVideoViews: ${profile.avgVideoViews} -> ${avgVideoViews}`)
  console.log(`[Apify Reels] Updated reachMultiplier: ${profile.reachMultiplier} -> ${Math.round(reachMultiplier * 100) / 100}`)

  return {
    ...profile,
    latestPosts: updatedPosts,
    avgVideoViews,
    reachMultiplier: Math.round(reachMultiplier * 100) / 100,
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
