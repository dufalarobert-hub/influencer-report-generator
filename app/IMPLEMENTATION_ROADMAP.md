# NiftyMinds Influencer Report Generator - Implementation Roadmap

## EXECUTIVE SUMMARY

**Aktuálny stav aplikácie: 7.5/10** 🟢

Vaša aplikácia je **produkčne ready** a obsahuje features na úrovni top influencer marketing agentúr. Identifikoval som však kritické oblasti pre zlepšenie, ktoré vás posunú na **9/10 - industry-leading** level.

---

## PRIORITY MATRICA (ROI × Effort)

### 🔴 QUICK WINS (High ROI × Low Effort)
1. **Brand partnership frequency analysis** - detekcia overcommercialization
2. **Source credibility system** - vyhne sa fake news v reportoch
3. **Controversy severity matrix** - presná klasifikácia rizík
4. **Category-specific ER adjustments** - presnejšie scoring

### 🟡 HIGH IMPACT (High ROI × Medium Effort)
5. **Viral potential scoring** - max views + consistency analysis
6. **Content value stack** - production + distribution + rights breakdown
7. **Media tier system** - kvalita press coverage
8. **Celebrity premium** - správne pricing pre 500K+ influencerov

### 🟢 LONG-TERM (Medium ROI × High Effort)
9. Competitor intelligence search
10. Time decay / trend analysis
11. Audience sentiment analysis
12. Platform-specific CPM/CPE

---

## PHASE 1: CRITICAL FIXES (Týždeň 1-2)

### Task 1.1: Brand Partnership Classification Logic
**File:** `/src/lib/claude.ts`
**Impact:** Rozlíšenie paid vs organic partnerships

```typescript
// PRIDAŤ do WebResearchResult interface
export interface BrandPartnership {
  brandName: string
  date?: string
  type: 'paid' | 'organic' | 'unknown'

  // NEW - frequency analysis
  frequency: number              // Počet zmienok
  firstSeen?: string
  lastSeen?: string
  isLongTerm: boolean           // >3 mesiace

  // NEW - classification signals
  signals: {
    hasHashtag: boolean         // #ad, #sponsored
    hasDiscountCode: boolean    // NATY20
    hasAffiliateLink: boolean   // link v bio
    bioMention: boolean         // V bio = silné partnerstvo
  }

  isCompetitor?: boolean
  category?: string
}

// NEW - overcommercialization detection
export interface CommercializationRisk {
  totalBrandPartnerships: number
  paidPartnerships: number
  organicPartnerships: number
  commercialRatio: number        // % postov s reklamou
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  warning?: string
}
```

**Implementation steps:**
1. V `performWebResearch()` funkci - analyzuj frekvenciu brand mentions
2. Počítaj kolikokrát sa brand objavil v captions (frequency)
3. Klasifikuj type based on signals:
   - `hasHashtag` OR `hasDiscountCode` + `frequency > 1` = `paid`
   - `frequency === 1` + no codes = `organic`
4. Vypočítaj `commercialRatio = paidPartnerships / totalPosts`
5. Ak `commercialRatio > 0.3` → warning: "High commercialization risk"

**Test case:**
- Influencer s 10 brand partnerships v 20 postoch
- Expected: `commercialRatio: 0.5`, `riskLevel: HIGH`
- Warning: "50% postov je reklama - riziko audience fatigue"

---

### Task 1.2: Source Credibility System
**File:** `/src/lib/claude.ts`
**Impact:** Vyhne sa fake news a nepresným informáciám

```typescript
// PRIDAŤ credibility level ku všetkým informáciám
export interface VerifiedInformation<T> {
  value: T
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source?: string
  sourceType?: 'OFFICIAL_MEDIA' | 'SOCIAL_MEDIA' | 'BLOG' | 'FORUM'
}

// UPDATE WebResearchResult
export interface WebResearchResult {
  fullName: string
  nickname?: string
  occupation: string
  achievements: string[]

  // CHANGE from string to verified
  partnerInfo?: VerifiedInformation<string>

  // ADD credibility to media
  mediaAppearances: {
    tvShows: Array<VerifiedInformation<string>>
    interviews: Array<VerifiedInformation<string>>
    articles: Array<VerifiedInformation<string>>
  }

  // ... rest
}

// Helper function
function assessSourceCredibility(source: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const highCredibility = ['forbes', 'hn.cz', 'idnes', 'aktualne', 'ct24']
  const mediumCredibility = ['refresher', 'blesk', 'expres']

  const domain = new URL(source).hostname

  if (highCredibility.some(h => domain.includes(h))) return 'HIGH'
  if (mediumCredibility.some(m => domain.includes(m))) return 'MEDIUM'
  return 'LOW'
}
```

**Implementation:**
1. V Claude prompte - požaduj zdroj ku každej informácii
2. Parse zdroje z `sources[]` array
3. Assess credibility level
4. Ak `confidence === 'LOW'` → skip informáciu alebo flag
5. V PDF reporte - zobraz len `HIGH` a `MEDIUM` confidence info

---

### Task 1.3: Controversy Severity Matrix
**File:** `/src/lib/claude.ts`
**Impact:** Presná klasifikácia brand safety rizík

```typescript
// EXISTING ale UPGRADE
export interface Controversy {
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  date?: string
  resolved?: boolean

  // NEW - detailed context
  category: 'LEGAL' | 'ETHICAL' | 'PR' | 'COMMERCIAL' | 'PERSONAL'
  impact?: {
    followersLost?: number
    brandsLost?: string[]
    publicApology: boolean
  }
  resolution?: string
  source: string
  credibility: 'HIGH' | 'MEDIUM' | 'LOW'
}

// HELPER - automatic severity classification
const SEVERITY_KEYWORDS = {
  CRITICAL: ['trestné obvinenie', 'súd', 'obvinenie', 'kriminalita', 'extrémizmus', 'rasizmus'],
  HIGH: ['crypto scam', 'podvod', 'klamlivá reklama', 'drogy', 'gambling', 'onlyfans'],
  MEDIUM: ['škandál', 'hádka', 'kontroverzia', 'kritika', 'bojkot'],
  LOW: ['drobný incident', 'nedorozumenie', 'fáma']
}

function classifyControversySeverity(description: string): Controversy['severity'] {
  const lowerDesc = description.toLowerCase()

  for (const [severity, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return severity as Controversy['severity']
    }
  }

  return 'LOW'
}
```

**Implementation:**
1. V Claude prompte - pridaj kategorizáciu kontroverzií
2. Parse severity keywords z description
3. Auto-classify severity
4. Výpočet `brandSafetyScore` based on severity:
   - CRITICAL: score = 1-2 (immediate reject)
   - HIGH: score = 3-4 (risky, high-level approval needed)
   - MEDIUM: score = 5-6 (acceptable with conditions)
   - LOW: score = 7-8 (minor risk)
   - None: score = 9-10 (safe)

---

## PHASE 2: VALUE ENHANCEMENTS (Týždeň 3-4)

### Task 2.1: Viral Potential Scoring
**File:** `/src/lib/metrics.ts`
**Impact:** Lepšia predikcia reach performance

```typescript
// NEW interface
export interface ViralPotential {
  avgReelViews: number
  maxReelViews: number
  topPercentile90Views: number    // Top 10% average
  consistency: number              // 0-1 score (std dev)

  viralScore: number               // 0-10
  viralRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

  prediction: {
    conservative: number           // 50th percentile
    realistic: number              // Avg
    optimistic: number             // 90th percentile (viral)
  }
}

// NEW function
export function calculateViralPotential(
  latestPosts: InstagramPost[]
): ViralPotential {
  const videoViews = latestPosts
    .filter(p => p.type === 'Video' && p.videoViewCount)
    .map(p => p.videoViewCount!)
    .sort((a, b) => b - a)

  if (videoViews.length === 0) {
    return getDefaultViralPotential()
  }

  const avg = mean(videoViews)
  const max = videoViews[0]
  const stdDev = standardDeviation(videoViews)

  // Top 10% posts
  const top10Count = Math.ceil(videoViews.length * 0.1)
  const top10Views = videoViews.slice(0, top10Count)
  const topPercentile90 = mean(top10Views)

  // Consistency score (lower std dev = more consistent)
  const consistency = Math.max(0, 1 - (stdDev / avg))

  // Viral score (based on peak performance)
  const peakToAvgRatio = max / avg
  let viralScore = 0

  if (peakToAvgRatio >= 5) viralScore = 10
  else if (peakToAvgRatio >= 3) viralScore = 8
  else if (peakToAvgRatio >= 2) viralScore = 6
  else if (peakToAvgRatio >= 1.5) viralScore = 5
  else viralScore = 3

  // Adjust by consistency (consistent = more reliable)
  viralScore = viralScore * (0.7 + 0.3 * consistency)

  // Viral rating
  let viralRating: ViralPotential['viralRating']
  if (viralScore >= 8) viralRating = 'VERY_HIGH'
  else if (viralScore >= 6) viralRating = 'HIGH'
  else if (viralScore >= 4) viralRating = 'MEDIUM'
  else viralRating = 'LOW'

  return {
    avgReelViews: Math.round(avg),
    maxReelViews: max,
    topPercentile90Views: Math.round(topPercentile90),
    consistency: Math.round(consistency * 100) / 100,
    viralScore: Math.round(viralScore * 10) / 10,
    viralRating,
    prediction: {
      conservative: Math.round(avg * 0.8),
      realistic: Math.round(avg),
      optimistic: Math.round(topPercentile90)
    }
  }
}

// Helper functions
function mean(arr: number[]): number {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length
}

function standardDeviation(arr: number[]): number {
  const avg = mean(arr)
  const squareDiffs = arr.map(val => Math.pow(val - avg, 2))
  const avgSquareDiff = mean(squareDiffs)
  return Math.sqrt(avgSquareDiff)
}
```

**Integration:**
1. V `calculateAllMetrics()` - call `calculateViralPotential()`
2. Použij `optimistic` prediction pre "Best case" scenár
3. Použij `conservative` pre "Worst case"
4. Zobraz v PDF reporte - "Viral potential: HIGH (8.5/10)"

---

### Task 2.2: Content Value Stack
**File:** `/src/lib/metrics.ts`
**Impact:** Presnejšia value calculation

```typescript
// NEW interface
export interface ContentValueStack {
  productionCost: number        // External agency cost
  distributionValue: number     // Reach × CPM
  usageRightsValue: number      // Rights to repost
  authenticityPremium: number   // Influencer > generic ad
  totalValue: number
}

// UPDATE ValueBreakdown
export interface ValueBreakdown {
  // ... existing fields

  // NEW - detailed content breakdown
  contentValueStack: {
    reels: ContentValueStack[]
    posts: ContentValueStack[]
    stories: ContentValueStack[]
  }
}

// NEW function
export function calculateContentValueStack(
  contentType: 'reels' | 'posts' | 'stories',
  avgReach: number,
  usageRights: boolean = false
): ContentValueStack {
  // Production costs (what agency would charge)
  const productionCosts = {
    reels: 7500,
    posts: 4000,
    stories: 1500
  }

  const productionCost = productionCosts[contentType]

  // Distribution value (reach × CPM × warm audience bonus)
  const cpm = 35
  const distributionValue = (avgReach / 1000) * cpm * 1.5

  // Usage rights (can brand repost = extra value)
  const usageRightsValue = usageRights
    ? productionCost * 0.5  // +50% for rights
    : 0

  // Authenticity premium
  // Influencer content performs 2-3× better than brand content
  const authenticityPremium = distributionValue * 0.5

  const totalValue = productionCost +
                     distributionValue +
                     usageRightsValue +
                     authenticityPremium

  return {
    productionCost: Math.round(productionCost),
    distributionValue: Math.round(distributionValue),
    usageRightsValue: Math.round(usageRightsValue),
    authenticityPremium: Math.round(authenticityPremium),
    totalValue: Math.round(totalValue)
  }
}
```

**Integration:**
1. V `calculateValueBreakdown()` - nahraď simple content value calculation
2. Zobraz breakdown v PDF:
   - "Content production: 7,500 CZK"
   - "Distribution value: 5,250 CZK (100K reach)"
   - "Usage rights: 3,750 CZK"
   - "Authenticity bonus: 2,625 CZK"
   - "**Total: 19,125 CZK**"

---

### Task 2.3: Category-Specific ER Adjustments
**File:** `/src/lib/metrics.ts`
**Impact:** Presnejšie scoring pre rôzne niche

```typescript
// NEW - category multipliers
const ER_CATEGORY_MULTIPLIER = {
  'Beauty': 1.2,        // Highly engaged community
  'Fashion': 1.15,      // High engagement
  'Lifestyle': 1.1,     // Above average
  'Sport': 1.0,         // Baseline
  'Food': 1.05,         // Slightly above
  'Tech': 0.9,          // Lower engagement
  'Gaming': 0.85,       // Passive audience
  'Finance': 0.8,       // Niche, lower ER
  'Business': 0.8,      // Professional, less emotional
  'Travel': 1.1,        // Aspirational, high engagement
}

// UPDATE calculateERBenchmark()
export function calculateERBenchmark(
  engagementRate: number,
  followers: number,
  category?: string  // NEW parameter
): ERBenchmark {
  // Existing follower-based benchmarks
  let benchmarks = getBenchmarksByFollowerCount(followers)

  // NEW - adjust by category
  if (category && ER_CATEGORY_MULTIPLIER[category]) {
    const multiplier = ER_CATEGORY_MULTIPLIER[category]
    benchmarks = {
      poor: benchmarks.poor * multiplier,
      average: benchmarks.average * multiplier,
      good: benchmarks.good * multiplier,
      excellent: benchmarks.excellent * multiplier
    }
  }

  // ... rest of logic
}
```

---

### Task 2.4: Celebrity Premium for 500K+
**File:** `/src/lib/metrics.ts`
**Impact:** Správne pricing pre top-tier influencerov

```typescript
// UPDATE calculateMarketValue()
export function calculateMarketValue(
  followers: number,
  reachMultiplier: number,
  erRating: 'POOR' | 'BELOW_AVERAGE' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' = 'AVERAGE',
  verified: boolean = false
): MarketValue {
  // ... existing logic

  // NEW - Celebrity premium
  let celebrityBonus = 1.0
  let celebrityTier = ''

  if (verified && followers >= 500000) {
    if (followers >= 2000000) {
      celebrityBonus = 2.0
      celebrityTier = 'Major celebrity (2M+)'
    } else if (followers >= 1000000) {
      celebrityBonus = 1.6
      celebrityTier = 'Celebrity (1M+)'
    } else if (followers >= 500000) {
      celebrityBonus = 1.3
      celebrityTier = 'Micro-celebrity (500K+)'
    }
  }

  // Apply celebrity bonus to premium pricing
  const premiumLow = Math.round(
    followers * premiumBaseLow * reachBonus * erBonus * verifiedBonus * celebrityBonus
  )
  const premiumHigh = Math.round(
    followers * premiumBaseHigh * reachBonus * erBonus * verifiedBonus * celebrityBonus
  )

  // ... return with celebrityBonus in explanation
}
```

---

## PHASE 3: POLISH & OPTIMIZATION (Týždeň 5-6)

### Task 3.1: Media Tier System
**File:** `/src/lib/claude.ts`

```typescript
export interface MediaMention {
  title: string
  outlet: string
  date?: string
  tier: 'TIER1' | 'TIER2' | 'TIER3'
  value: 'HIGH' | 'MEDIUM' | 'LOW'
}

const MEDIA_TIERS = {
  tier1: {
    outlets: ['forbes', 'hn.cz', 'ekonom', 'wall street journal'],
    value: 'HIGH'
  },
  tier2: {
    outlets: ['refresher', 'idnes', 'blesk', 'aktualne'],
    value: 'MEDIUM'
  },
  tier3: {
    outlets: ['blog', 'podcast'],
    value: 'LOW'
  }
}
```

---

### Task 3.2: Competitor Intelligence
**File:** `/src/lib/claude.ts`

```typescript
// V prompte pridaj:
// "Nájdi ktorí konkurenti (influenceri v rovnakej kategórii) spolupracujú s rovnakými značkami"

export interface CompetitorIntelligence {
  competitorInfluencers: Array<{
    username: string
    followers: number
    sharedBrands: string[]
  }>
  marketPosition: 'LEADER' | 'CHALLENGER' | 'FOLLOWER'
}
```

---

## TESTING STRATEGY

### Test Profiles (CZ/SK influenceri):

1. **Micro (10-50K)**: @nataliasimkova_
   - Expected: HIGH ER, LOW reach, GOOD value ratio

2. **Mid-tier (50-100K)**: @kruta_eva
   - Expected: MEDIUM ER, MEDIUM reach, multiple brand partnerships

3. **Macro (100-500K)**: @matusfiker
   - Expected: GOOD ER for size, HIGH reach, some controversies?

4. **Mega (500K+)**: @jancina
   - Expected: LOW ER (normal for size), VERY HIGH reach, celebrity premium

### Automated tests:

```javascript
// test/metrics.test.ts
describe('Brand Partnership Classification', () => {
  it('should detect paid partnership from hashtags', () => {
    const caption = "Miluju @brand! #ad #sponsored"
    const result = classifyPartnership(caption)
    expect(result.type).toBe('paid')
  })

  it('should detect overcommercialization', () => {
    const partnerships = 15
    const totalPosts = 20
    const risk = calculateCommercializationRisk(partnerships, totalPosts)
    expect(risk.riskLevel).toBe('HIGH')
    expect(risk.commercialRatio).toBe(0.75)
  })
})
```

---

## MONITORING & METRICS

### KPIs to track:

1. **Accuracy metrics:**
   - Brand partnership classification accuracy: Target >90%
   - Controversy detection rate: Target 100% for HIGH severity
   - Source credibility false positive rate: Target <5%

2. **Performance metrics:**
   - Report generation time: Target <60s
   - Claude API success rate: Target >95%
   - Apify scraping success rate: Target >90%

3. **Business metrics:**
   - Reports generated per day
   - Average report score (should stabilize around 6-7)
   - Client satisfaction (manual feedback)

---

## DEPLOYMENT CHECKLIST

### Before launch:
- [ ] Test all 4 influencer size categories
- [ ] Test overcommercialized influencer (10+ partnerships)
- [ ] Test influencer with controversy
- [ ] Test international vs. CZ/SK influencer
- [ ] Verify PDF report formatting
- [ ] Check all calculations manually for 1 profile
- [ ] Load test with 10 concurrent requests
- [ ] Set up error monitoring (Sentry?)
- [ ] Document API rate limits

---

## ESTIMATED TIMELINE

**Phase 1 (Critical):** 10-15 days
- Task 1.1: 3 days
- Task 1.2: 2 days
- Task 1.3: 2 days
- Testing: 3 days

**Phase 2 (Enhancements):** 10-12 days
- Task 2.1: 3 days
- Task 2.2: 2 days
- Task 2.3: 1 day
- Task 2.4: 1 day
- Testing: 3 days

**Phase 3 (Polish):** 5-7 days
- Task 3.1: 2 days
- Task 3.2: 2 days
- Final testing: 2 days

**Total: 25-34 days (5-7 weeks)**

---

## FINAL NOTES

Vaša aplikácia je **solid foundation**. S implementáciou Phase 1 budete **produkčne excelentní**. Phase 2 a 3 vás posunie na **industry-leading** level.

**Prioritizujte:**
1. Phase 1 - Critical (immediate business value)
2. Task 2.1 - Viral potential (high impact)
3. Task 2.2 - Content value stack (better pricing justification)

Ostatné features sú "nice to have" ale nie blocking.

**Otázky?** Môžem poskytnúť:
- Code snippets pre akúkoľvek task
- Unit tests
- API documentation
- More test cases
