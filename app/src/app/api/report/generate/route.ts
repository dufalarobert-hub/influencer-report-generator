/**
 * API Endpoint: Generate Influencer Report
 *
 * POST /api/report/generate
 *
 * Workflow:
 * 1. Fetch Instagram data (Apify)
 * 2. Perform web research (Claude)
 * 3. Calculate metrics
 * 4. Generate report text (Claude)
 * 5. Return complete report data
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchInstagramData, getTopPosts, getTopReels, fetchInstagramComments, analyzeCommentQuality, CommentAnalysis, enrichProfileWithReelViews } from '@/lib/apify'
import { performWebResearch, generateReportText } from '@/lib/claude'
import { calculateAllMetrics } from '@/lib/metrics'
import { ReportInput, ReportData, ApiResponse, GenerateReportResponse } from '@/lib/types'

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
    console.log('[Step 1/6] Fetching Instagram data...')
    let profile = await fetchInstagramData(input.username)
    console.log(`[Step 1/6] ✓ Instagram data fetched (${profile.followersCount} followers)`)

    // Step 2: Enrich with accurate Reel views (videoPlayCount)
    console.log('[Step 2/6] Fetching accurate Reel views...')
    try {
      profile = await enrichProfileWithReelViews(profile)
      console.log(`[Step 2/6] ✓ Reel views enriched (avgViews: ${profile.avgVideoViews?.toLocaleString()})`)
    } catch (reelError) {
      console.log('[Step 2/6] ⚠ Reel enrichment skipped:', reelError instanceof Error ? reelError.message : 'Unknown error')
      // Continue with original videoViewCount values
    }

    // Step 3: Fetch and analyze comments (optional - for better bot detection)
    console.log('[Step 3/6] Fetching comments for quality analysis...')
    let commentAnalysis: CommentAnalysis | undefined
    try {
      // Get URLs of top 5 posts for comment analysis
      const topPostsForComments = getTopPosts(profile, 5)
      const postUrls = topPostsForComments
        .map(p => p.url)
        .filter(url => url && url.length > 0)

      if (postUrls.length > 0) {
        const comments = await fetchInstagramComments(postUrls, 15) // 15 comments per post (free tier)
        commentAnalysis = analyzeCommentQuality(comments)
        console.log(`[Step 3/6] ✓ Comment analysis complete (quality: ${commentAnalysis.qualityRating}, score: ${commentAnalysis.commentQualityScore}/100)`)
      } else {
        console.log('[Step 3/6] ⚠ No post URLs available for comment analysis')
      }
    } catch (commentError) {
      console.log('[Step 3/6] ⚠ Comment analysis skipped (optional):', commentError instanceof Error ? commentError.message : 'Unknown error')
      // Continue without comment analysis - it's optional
    }

    // Step 4: Perform web research (including brand partnerships from posts)
    console.log('[Step 4/6] Performing web research...')
    const postCaptions = profile.latestPosts.map(p => p.caption).filter(c => c)
    const research = await performWebResearch(
      profile.username,
      profile.fullName || profile.username,
      input.category,
      profile.biography,
      postCaptions,
      input.country || 'CZ' // Pass country for localized search
    )
    console.log(`[Step 4/6] ✓ Web research complete (brand safety: ${research.brandSafetyScore}/10)`)

    // Step 5: Calculate metrics (with optional comment quality for better bot detection)
    console.log('[Step 5/6] Calculating metrics...')
    const metrics = calculateAllMetrics(
      profile,
      input.offeredPrice,
      contractMonths,
      research.brandSafetyScore,
      input.deliverables, // Deliverables from input
      input.averageOrderValue,
      commentAnalysis // NEW: Pass comment quality for enhanced bot detection
    )
    console.log(`[Step 5/6] ✓ Metrics calculated (score: ${metrics.score.finalScore}/10)`)

    // Step 6: Generate report text
    console.log('[Step 6/6] Generating report text...')
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
    console.log('[Step 6/6] ✓ Report text generated')

    // Compile report data
    const reportData: ReportData = {
      input,
      profile,
      topPosts: getTopPosts(profile, 8),
      topReels: getTopReels(profile, 8),
      research,
      commentAnalysis, // NEW: Comment quality analysis
      metrics,
      text,
      generatedAt: new Date().toISOString(),
      version: '2.3',
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
