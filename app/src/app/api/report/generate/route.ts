/**
 * API Endpoint: Generate Influencer Report
 *
 * POST /api/report/generate
 *
 * Workflow:
 * 1. Fetch Instagram data (Apify)
 * 2-4. PARALELNE (v5.1): presné Reel views + analýza komentárov + web research
 * 5. Calculate metrics
 * 6. Generate report text (Claude)
 * 7. Return complete report data
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchInstagramData, getTopPosts, getTopReels, fetchInstagramComments, analyzeCommentQuality, CommentAnalysis, enrichProfileWithReelViews, InstagramProfile } from '@/lib/apify'
import { performWebResearch, generateReportText } from '@/lib/claude'
import { calculateAllMetrics } from '@/lib/metrics'
import { ReportInput, ReportData, ApiResponse, GenerateReportResponse } from '@/lib/types'

// Apify scraping + Claude research trvá 1-3 min → potrebujeme dlhý limit.
// Vercel: 300 s je strop na Pro pláne (Hobby má len 60 s a report by spadol).
export const maxDuration = 300
export const dynamic = 'force-dynamic'

async function fetchCommentAnalysis(profile: InstagramProfile): Promise<CommentAnalysis | undefined> {
  try {
    const topPostsForComments = getTopPosts(profile, 5)
    const postUrls = topPostsForComments
      .map(p => p.url)
      .filter(url => url && url.length > 0)

    if (postUrls.length === 0) {
      console.log('[Comments] ⚠ No post URLs available for comment analysis')
      return undefined
    }

    const comments = await fetchInstagramComments(postUrls, 15) // 15 comments per post (free tier)
    const analysis = analyzeCommentQuality(comments)
    console.log(`[Comments] ✓ Quality: ${analysis.qualityRating}, score: ${analysis.commentQualityScore}/100`)
    return analysis
  } catch (error) {
    console.log('[Comments] ⚠ Comment analysis skipped (optional):', error instanceof Error ? error.message : 'Unknown error')
    return undefined
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse input
    const input: ReportInput = await request.json()

    // Validate input
    if (!input.username) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Username is required' },
        { status: 400 }
      )
    }

    if (!input.category) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Category is required' },
        { status: 400 }
      )
    }

    if (!input.offeredPrice || input.offeredPrice <= 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Offered price must be greater than 0' },
        { status: 400 }
      )
    }

    const contractMonths = input.contractMonths || 6

    console.log(`\n${'='.repeat(60)}`)
    console.log(`[Report] Starting report generation for @${input.username}`)
    console.log(`[Report] Category: ${input.category}, Country: ${input.country || 'CZ'}, Price: ${input.offeredPrice} CZK`)
    console.log(`${'='.repeat(60)}\n`)

    // Step 1: Fetch Instagram data
    console.log('[Step 1/4] Fetching Instagram data...')
    const baseProfile = await fetchInstagramData(input.username)
    console.log(`[Step 1/4] ✓ Instagram data fetched (${baseProfile.followersCount} followers)`)

    // Steps 2-4 in PARALLEL — all depend only on the base profile:
    //   a) accurate Reel views (Apify Reel Scraper)
    //   b) comment quality analysis (Apify Comments Scraper)
    //   c) web research (Claude + web search)
    console.log('[Step 2/4] Running Reel views + comments + web research in parallel...')
    const postCaptions = baseProfile.latestPosts.map(p => p.caption).filter(c => c)

    const [profile, commentAnalysis, research] = await Promise.all([
      enrichProfileWithReelViews(baseProfile).catch((e) => {
        console.log('[Step 2/4] ⚠ Reel enrichment skipped:', e instanceof Error ? e.message : 'Unknown error')
        return baseProfile
      }),
      fetchCommentAnalysis(baseProfile),
      performWebResearch(
        baseProfile.username,
        baseProfile.fullName || baseProfile.username,
        input.category,
        baseProfile.biography,
        postCaptions,
        input.country || 'CZ'
      ),
    ])

    console.log(`[Step 2/4] ✓ Parallel fetch done (avgViews: ${profile.avgVideoViews?.toLocaleString()}, brand safety: ${research.brandSafetyScore}/10${research.researchUnavailable ? ' ⚠ NEPREVERENÉ' : ''})`)

    // Step 3: Calculate metrics
    console.log('[Step 3/4] Calculating metrics...')
    const metrics = calculateAllMetrics(
      profile,
      input.offeredPrice,
      contractMonths,
      research.brandSafetyScore,
      input.deliverables,
      input.averageOrderValue,
      commentAnalysis
    )
    console.log(`[Step 3/4] ✓ Metrics calculated (score: ${metrics.score.finalScore}/10)`)

    // Step 4: Generate report text
    console.log('[Step 4/4] Generating report text...')
    const text = await generateReportText(
      {
        fullName: profile.fullName || profile.username,
        username: profile.username,
        category: input.category,
        biography: profile.biography,
      },
      research,
      {
        finalScore: metrics.score.finalScore,
        recommendation: metrics.score.recommendation,
        savingsPercent: metrics.roi.savingsPercent,
        offeredPrice: input.offeredPrice,
        marketValueHigh: metrics.marketValue.premiumHigh || metrics.marketValue.conservativeHigh,
      }
    )
    console.log('[Step 4/4] ✓ Report text generated')

    // Compile report data
    const reportData: ReportData = {
      input,
      profile,
      topPosts: getTopPosts(profile, 8),
      topReels: getTopReels(profile, 8),
      research,
      commentAnalysis,
      metrics,
      text,
      generatedAt: new Date().toISOString(),
      version: '5.1',
    }

    const duration = Date.now() - startTime
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[Report] ✓ Report generated successfully in ${duration}ms`)
    console.log(`[Report] Recommendation: ${metrics.score.recommendation}`)
    console.log(`${'='.repeat(60)}\n`)

    return NextResponse.json<ApiResponse<GenerateReportResponse>>({
      success: true,
      data: {
        reportData,
      },
    })

  } catch (error) {
    console.error('[Report] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
