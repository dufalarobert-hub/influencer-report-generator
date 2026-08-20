/**
 * Claude AI Service - Web Research & Analysis
 *
 * Používa Claude API na:
 * - Web research (kontroverzie, background, médiá)
 * - Brand safety assessment
 * - Generovanie odporúčaní
 *
 * v5.1:
 * - Model: claude-opus-4-8 (predtým rok starý claude-sonnet-4-20250514)
 * - Structured outputs namiesto regex parsovania JSON z textu:
 *   - research: forced tool "submit_research" (kompatibilné s web search citáciami)
 *   - text generation + discovery: output_config.format json_schema
 * - Zlyhaný research už nie je tichý — result nesie researchUnavailable: true
 * - Retry rieši SDK (maxRetries), manuálny retry loop odstránený
 */

import Anthropic from '@anthropic-ai/sdk'
import { DiscoveryParameters } from './types'

// Modely. Research je kvalitatívne kritický (brand safety due diligence).
// Pre úsporu je možné TEXT_MODEL / DISCOVERY_MODEL prepnúť na 'claude-haiku-4-5'.
const RESEARCH_MODEL = 'claude-opus-4-8'
const TEXT_MODEL = 'claude-opus-4-8'
const DISCOVERY_MODEL = 'claude-opus-4-8'

// Types
export interface BrandPartnership {
  brandName: string
  date?: string
  type: 'paid' | 'organic' | 'unknown'
  isCompetitor?: boolean
  category?: string

  // classification signals
  signals?: {
    hasHashtag: boolean       // #ad, #sponsored
    hasDiscountCode: boolean  // NATY20, -10%
    hasAffiliateLink: boolean // link v bio
    bioMention: boolean       // V bio = dlhodobé partnerstvo
  }
  frequency?: number          // Počet zmienok
  isLongTerm?: boolean        // >3 mesiace alebo v bio
}

// Overcommercialization detection
export interface CommercializationRisk {
  totalBrandMentions: number
  paidPartnerships: number
  organicMentions: number
  commercialRatio: number      // % postov s reklamou
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  warning?: string
}

// Source credibility
export interface SourceCredibility {
  source: string
  credibility: 'HIGH' | 'MEDIUM' | 'LOW'
  type: 'OFFICIAL_MEDIA' | 'TABLOID' | 'SOCIAL_MEDIA' | 'BLOG' | 'UNKNOWN'
}

export interface WebResearchResult {
  // Background info
  fullName: string
  nickname?: string
  occupation: string
  achievements: string[]
  partnerInfo?: string

  // Media & Public presence
  mediaAppearances: {
    tvShows: string[]      // Love Island, Survivor, atď.
    interviews: string[]   // Rozhovory v médiách
    articles: string[]     // Články o ňom/nej
  }

  // Upcoming events
  upcomingEvents: {
    hasEvents: boolean
    events: string[]       // Koncerty, akcie, eventy
  }

  // Recent news
  recentNews: {
    hasNews: boolean
    headlines: string[]    // Posledné správy/novinky
  }

  // Brand partnerships
  brandPartnerships: {
    found: boolean
    partnerships: BrandPartnership[]
    organicBrands: string[]  // Brands that appear organically (brand affinity)
  }

  // Brand safety
  controversies: {
    found: boolean
    items: Array<{
      description: string
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
      date?: string
      resolved?: boolean
      category?: 'LEGAL' | 'ETHICAL' | 'PR' | 'COMMERCIAL' | 'PERSONAL'
      source?: string
    }>
  }

  // Commercialization risk
  commercializationRisk?: CommercializationRisk
  currentBehavior: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  mediaPresentation: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  brandSafetyScore: number // 1-10

  // Brand matching
  suitableBrands: string[]
  unsuitableBrands: string[]

  // Sources
  sources: string[]

  // v5.1: true = web research ZLYHAL a toto sú default hodnoty.
  // Report MUSÍ zobraziť varovanie — brandSafetyScore nie je overený!
  researchUnavailable?: boolean
}

export interface ReportTextContent {
  heroSubtitle: string
  bioSummary: string
  mediaHighlights?: string
  controversyContext?: string
  upcomingEventsText?: string
  recommendationText: string
  verdictText: string
}

// Strop na jedno volanie API (ms). Bez neho SDK čaká defaultných 10 minút.
const REQUEST_TIMEOUT_MS = 90_000

// Celkový strop na web research vrátane pause_turn pokračovaní (ms).
// Nameraný research v plnej kvalite trvá ~90-190 s, ojedinele 300-500 s.
// Strop je poistka proti zamrznutiu, nie škrtenie kvality: po jeho prekročení
// sa research vzdá a report pokračuje s fallbackom (researchUnavailable: true
// → červené varovanie v PDF). Prepísateľné cez env RESEARCH_DEADLINE_MS.
// 240 s: Vercel funkcia ma strop 300 s. NAMERANE NA PRODUKCII: rezia okolo
// researchu (Step 1 profil fetch + generovanie textu) je len ~23 s, cize 240 s
// research → ~265 s celkovo, stale ~35 s rezerva. Research bezi PARALELNE s Apify
// reel/comment krokmi. Ked sa vetva zasekne aj za 240 s, strati sa len JEJ data
// (elegantna degradacia): safety vypadne → cerveny box, commercial → bez spoluprac.
// Prepisatelne cez RESEARCH_DEADLINE_MS.
const RESEARCH_DEADLINE_MS = Number(process.env.RESEARCH_DEADLINE_MS) || 260_000

/**
 * Initialize Anthropic client
 * SDK automaticky retryuje 429/5xx s exponential backoffom (maxRetries).
 * POZOR: timeouty sa tiež retryujú, takže wall-clock = timeout × (maxRetries + 1)
 * — preto nízke maxRetries a navyše deadline v performWebResearch().
 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  return new Anthropic({ apiKey, maxRetries: 2, timeout: REQUEST_TIMEOUT_MS })
}

/**
 * Sanitize text to remove problematic Unicode characters
 */
function sanitizeText(text: string): string {
  if (!text) return ''
  return text
    .replace(/[\uD800-\uDFFF]/g, '') // Remove surrogate pairs
    .replace(/[\u0000-\u001F]/g, ' ') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Remove Cyrillic and other non-Latin scripts from text
 * Keeps Czech/Slovak diacritics (áčďéěíňóřšťúůýž)
 */
function removeCyrillic(text: string): string {
  if (!text) return ''
  return text
    .replace(/[Ѐ-ӿ]/g, '') // Cyrillic
    .replace(/[؀-ۿ]/g, '') // Arabic
    .replace(/[֐-׿]/g, '') // Hebrew
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Clean citation tags from Claude web search results
 */
function cleanCitationTags(text: string): string {
  if (!text) return ''
  return text
    .replace(/<cite[^>]*>/g, '')  // Remove opening cite tags
    .replace(/<\/cite>/g, '')      // Remove closing cite tags
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim()
}

/**
 * Recursively clean all string values in an object from citation tags and Cyrillic
 */
function cleanObjectFromCitations(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return removeCyrillic(cleanCitationTags(obj))
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectFromCitations(item))
      .filter(item => {
        if (typeof item === 'string') return item.length > 0
        return true
      })
  }
  if (obj && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanObjectFromCitations(value)
    }
    return cleaned
  }
  return obj
}

/**
 * Vynúti, že poľové vlastnosti researchu sú naozaj polia a vnorené objekty
 * existujú. Nástrojová schéma nie je `strict`, takže model (Opus 4.8) môže
 * vrátiť napr. `achievements` ako reťazec namiesto poľa — potom `.join()` /
 * `.map()` v generovaní textu aj v PDF spadne a CELÝ report vráti 500.
 * Táto normalizácia je jediné choke-point miesto, ktoré tomu zabráni.
 */
function normalizeResearchResult(r: WebResearchResult): WebResearchResult {
  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : [])
  const obj = (x: unknown): Record<string, unknown> =>
    x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {}

  const media = obj(r.mediaAppearances)
  const events = obj(r.upcomingEvents)
  const news = obj(r.recentNews)
  const partners = obj(r.brandPartnerships)
  const contro = obj(r.controversies)

  return {
    ...r,
    achievements: arr<string>(r.achievements),
    mediaAppearances: {
      tvShows: arr<string>(media.tvShows),
      interviews: arr<string>(media.interviews),
      articles: arr<string>(media.articles),
    },
    upcomingEvents: {
      hasEvents: Boolean(events.hasEvents),
      events: arr<string>(events.events),
    },
    recentNews: {
      hasNews: Boolean(news.hasNews),
      headlines: arr<string>(news.headlines),
    },
    brandPartnerships: {
      found: Boolean(partners.found),
      partnerships: arr<WebResearchResult['brandPartnerships']['partnerships'][number]>(partners.partnerships),
      organicBrands: arr<string>(partners.organicBrands),
    },
    controversies: {
      found: Boolean(contro.found),
      items: arr<WebResearchResult['controversies']['items'][number]>(contro.items),
    },
    suitableBrands: arr<string>(r.suitableBrands),
    unsuitableBrands: arr<string>(r.unsuitableBrands),
    sources: arr<string>(r.sources),
  }
}

/**
 * Assess source credibility based on domain
 */
function assessSourceCredibility(source: string): SourceCredibility {
  const highCredibility = ['forbes', 'hn.cz', 'hospodarske', 'ekonom', 'ct24', 'ceskatelevize']
  const mediumCredibility = ['idnes', 'aktualne', 'refresher', 'novinky']
  const tabloids = ['blesk', 'expres', 'aha', 'super']

  const lowerSource = source.toLowerCase()

  if (highCredibility.some(h => lowerSource.includes(h))) {
    return { source, credibility: 'HIGH', type: 'OFFICIAL_MEDIA' }
  }
  if (mediumCredibility.some(m => lowerSource.includes(m))) {
    return { source, credibility: 'MEDIUM', type: 'OFFICIAL_MEDIA' }
  }
  if (tabloids.some(t => lowerSource.includes(t))) {
    return { source, credibility: 'MEDIUM', type: 'TABLOID' }
  }
  if (lowerSource.includes('instagram') || lowerSource.includes('tiktok') || lowerSource.includes('facebook')) {
    return { source, credibility: 'LOW', type: 'SOCIAL_MEDIA' }
  }

  return { source, credibility: 'LOW', type: 'UNKNOWN' }
}

/**
 * Classify controversy severity based on keywords
 * Filters out relationship gossip which is not brand-damaging
 */
const SEVERITY_KEYWORDS = {
  CRITICAL: ['trestné', 'obvinenie', 'súd', 'väzenie', 'extrémizmus', 'rasizmus', 'násilie', 'pedofil', 'zneužívanie'],
  HIGH: ['crypto', 'scam', 'podvod', 'klamlivá reklama', 'drogy', 'gambling', 'onlyfans', 'adult', 'nft scam'],
  MEDIUM: ['škandál', 'bojkot', 'hate', 'agresívne', 'fyzický konflikt', 'vyhrážky'],
  LOW: ['kritika', 'hádka', 'incident', 'nedorozumenie']
}

// Keywords that indicate relationship gossip (NOT real controversies)
const GOSSIP_KEYWORDS = [
  'románik', 'randenie', 'vzťah', 'rozchod', 'rozvod', 'priateľka', 'priateľ',
  'pár', 'tvoria pár', 'láska', 'nevera', 'ruža pre nevestu', 'bachelor',
  'dating', 'relationship', 'couple', 'girlfriend', 'boyfriend', 'ex-'
]

function classifyControversySeverity(description: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const lowerDesc = description.toLowerCase()

  // First check if it's just relationship gossip - not a real controversy
  if (GOSSIP_KEYWORDS.some(keyword => lowerDesc.includes(keyword))) {
    const hasSerious = SEVERITY_KEYWORDS.CRITICAL.some(k => lowerDesc.includes(k)) ||
                       SEVERITY_KEYWORDS.HIGH.some(k => lowerDesc.includes(k))
    if (!hasSerious) {
      return 'LOW' // Relationship gossip = LOW, not brand-damaging
    }
  }

  for (const [severity, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    }
  }

  return 'LOW'
}

/**
 * Filter out old content - keep only last 3 months
 * v5.1 fix: predtým "year < currentYear → vyhodiť", čo v januári odfiltrovalo
 * aj december predošlého roka. Teraz počítame valídne roky z 3-mesačného okna.
 */
function filterOldContent(result: WebResearchResult): WebResearchResult {
  const now = new Date()
  const currentYear = now.getFullYear()

  // Years that fall inside the last-3-months window (handles year boundary)
  const validYears = new Set<number>()
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    validYears.add(d.getFullYear())
  }

  const isRecent = (text: string): boolean => {
    const yearMatch = text.match(/\b(20\d{2})\b/)
    if (yearMatch) {
      const year = parseInt(yearMatch[1])
      if (!validYears.has(year)) return false
    }
    return true
  }

  // Filter events - keep only future events
  if (result.upcomingEvents?.events) {
    result.upcomingEvents.events = result.upcomingEvents.events.filter(event => {
      const lowerEvent = event.toLowerCase()
      const yearMatch = event.match(/\b(20\d{2})\b/)
      if (yearMatch && parseInt(yearMatch[1]) < currentYear) {
        console.log(`[Claude] Filtering out past event: ${event}`)
        return false
      }
      // Filter out obvious past indicators
      if (lowerEvent.includes('proběhl') || lowerEvent.includes('konal se') ||
          lowerEvent.includes('byl') || lowerEvent.includes('byla')) {
        console.log(`[Claude] Filtering out past event: ${event}`)
        return false
      }
      return true
    })
    result.upcomingEvents.hasEvents = result.upcomingEvents.events.length > 0
  }

  // Filter news - keep only recent news (3 months)
  if (result.recentNews?.headlines) {
    result.recentNews.headlines = result.recentNews.headlines.filter(headline => {
      if (!isRecent(headline)) {
        console.log(`[Claude] Filtering out old news: ${headline}`)
        return false
      }
      return true
    })
    result.recentNews.hasNews = result.recentNews.headlines.length > 0
  }

  // Filter articles - keep only recent (3 months)
  if (result.mediaAppearances?.articles) {
    result.mediaAppearances.articles = result.mediaAppearances.articles.filter(article => {
      if (!isRecent(article)) {
        console.log(`[Claude] Filtering out old article: ${article}`)
        return false
      }
      return true
    })
  }

  // Filter interviews - keep only recent (3 months)
  if (result.mediaAppearances?.interviews) {
    result.mediaAppearances.interviews = result.mediaAppearances.interviews.filter(interview => {
      if (!isRecent(interview)) {
        console.log(`[Claude] Filtering out old interview: ${interview}`)
        return false
      }
      return true
    })
  }

  return result
}

/**
 * Calculate commercialization risk from partnerships
 */
function calculateCommercializationRisk(
  partnerships: BrandPartnership[],
  totalPosts: number
): CommercializationRisk {
  const paidCount = partnerships.filter(p => p.type === 'paid').length
  const organicCount = partnerships.filter(p => p.type === 'organic').length
  const totalMentions = partnerships.length

  const commercialRatio = totalPosts > 0 ? paidCount / totalPosts : 0

  let riskLevel: CommercializationRisk['riskLevel'] = 'LOW'
  let warning: string | undefined

  if (commercialRatio > 0.4) {
    riskLevel = 'HIGH'
    warning = `${Math.round(commercialRatio * 100)}% postov je reklama - vysoké riziko audience fatigue`
  } else if (commercialRatio > 0.25) {
    riskLevel = 'MEDIUM'
    warning = `${Math.round(commercialRatio * 100)}% postov je reklama - stredné riziko`
  }

  return {
    totalBrandMentions: totalMentions,
    paidPartnerships: paidCount,
    organicMentions: organicCount,
    commercialRatio: Math.round(commercialRatio * 100) / 100,
    riskLevel,
    warning
  }
}

// Country configuration for web research
const COUNTRY_CONFIG: Record<string, {
  name: string
  searchLang: string
  controversyKeywords: string
  partnershipKeywords: string
}> = {
  CZ: {
    name: 'Česko',
    searchLang: 'čeština',
    controversyKeywords: 'kontroverzia OR škandál OR problém OR aféra',
    partnershipKeywords: 'spolupráca OR ambasádor OR reklama OR kampaň',
  },
  SK: {
    name: 'Slovensko',
    searchLang: 'slovenčina',
    controversyKeywords: 'kontroverzia OR škandál OR problém OR aféra',
    partnershipKeywords: 'spolupráca OR ambasádor OR reklama OR kampaň',
  },
  PL: {
    name: 'Poľsko',
    searchLang: 'poľština',
    controversyKeywords: 'kontrowersja OR skandal OR afera',
    partnershipKeywords: 'współpraca OR ambasador OR reklama OR kampania',
  },
  RO: {
    name: 'Rumunsko',
    searchLang: 'rumunčina',
    controversyKeywords: 'controversă OR scandal OR problemă',
    partnershipKeywords: 'colaborare OR ambasador OR reclamă OR campanie',
  },
  DE: {
    name: 'Nemecko',
    searchLang: 'nemčina',
    controversyKeywords: 'Kontroverse OR Skandal OR Problem',
    partnershipKeywords: 'Zusammenarbeit OR Botschafter OR Werbung OR Kampagne',
  },
  IT: {
    name: 'Taliansko',
    searchLang: 'taliančina',
    controversyKeywords: 'controversia OR scandalo OR problema',
    partnershipKeywords: 'collaborazione OR ambasciatore OR pubblicità OR campagna',
  },
  HU: {
    name: 'Maďarsko',
    searchLang: 'maďarčina',
    controversyKeywords: 'botrány OR probléma OR vita',
    partnershipKeywords: 'együttműködés OR nagykövet OR reklám OR kampány',
  },
}

/**
 * JSON Schema for the submit_research tool — guarantees parsed, validated input
 * instead of regex-matching JSON out of free text.
 */
const RESEARCH_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    fullName: { type: 'string' },
    nickname: { type: 'string', description: 'Prezývka ak existuje, inak prázdny string' },
    occupation: { type: 'string' },
    achievements: { type: 'array', items: { type: 'string' } },
    partnerInfo: { type: 'string', description: 'PRÁZDNY string ak nemáš 100% overený zdroj' },
    mediaAppearances: {
      type: 'object',
      properties: {
        tvShows: { type: 'array', items: { type: 'string' } },
        interviews: { type: 'array', items: { type: 'string' } },
        articles: { type: 'array', items: { type: 'string' } },
      },
      required: ['tvShows', 'interviews', 'articles'],
    },
    upcomingEvents: {
      type: 'object',
      properties: {
        hasEvents: { type: 'boolean' },
        events: { type: 'array', items: { type: 'string' } },
      },
      required: ['hasEvents', 'events'],
    },
    recentNews: {
      type: 'object',
      properties: {
        hasNews: { type: 'boolean' },
        headlines: { type: 'array', items: { type: 'string' } },
      },
      required: ['hasNews', 'headlines'],
    },
    brandPartnerships: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        partnerships: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              brandName: { type: 'string' },
              type: { type: 'string', enum: ['paid', 'organic', 'unknown'] },
              date: { type: 'string' },
              category: { type: 'string' },
              isCompetitor: { type: 'boolean', description: 'true ak značka konkuruje klientovej značke/odvetviu zo zadania' },
            },
            required: ['brandName', 'type'],
          },
        },
        organicBrands: { type: 'array', items: { type: 'string' } },
      },
      required: ['found', 'partnerships', 'organicBrands'],
    },
    controversies: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
              date: { type: 'string' },
              resolved: { type: 'boolean' },
            },
            required: ['description', 'severity'],
          },
        },
      },
      required: ['found', 'items'],
    },
    currentBehavior: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
    mediaPresentation: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
    brandSafetyScore: { type: 'number', description: '1-10, podľa škály v zadaní' },
    suitableBrands: { type: 'array', items: { type: 'string' } },
    unsuitableBrands: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'fullName', 'occupation', 'achievements', 'mediaAppearances', 'upcomingEvents',
    'recentNews', 'brandPartnerships', 'controversies', 'currentBehavior',
    'mediaPresentation', 'brandSafetyScore', 'suitableBrands', 'unsuitableBrands', 'sources',
  ],
}

// Research bežal ako jedno obrovské volanie (dlhý prompt + celá schéma + 5 searchov),
// čo trvalo 190-500 s a často nestihlo časový limit. Rozdelené na DVE nezávislé
// vetvy, ktoré bežia PARALELNE — rovnaký model, len každá s užším zadaním.
// (Skúšané aj 3 vetvy, ale pri veľkej latenčnej premenlivosti API to len zvýšilo
//  šancu, že jedna vetva bude tá pomalá a dotiahne celok — preto späť na 2.)
// Spoľahlivosť rieši RESEARCH_EFFORT (medium) — research vždy dobehne v limite.
const P = RESEARCH_TOOL_SCHEMA.properties

/** Vetva A: identita, médiá, eventy, správy + brand safety (má kontext pre skóre). */
const SAFETY_SCHEMA = {
  type: 'object' as const,
  properties: {
    fullName: P.fullName,
    nickname: P.nickname,
    occupation: P.occupation,
    achievements: P.achievements,
    partnerInfo: P.partnerInfo,
    mediaAppearances: P.mediaAppearances,
    upcomingEvents: P.upcomingEvents,
    recentNews: P.recentNews,
    controversies: P.controversies,
    currentBehavior: P.currentBehavior,
    mediaPresentation: P.mediaPresentation,
    brandSafetyScore: P.brandSafetyScore,
    sources: P.sources,
  },
  required: [
    'fullName', 'occupation', 'achievements', 'mediaAppearances', 'upcomingEvents',
    'recentNews', 'controversies', 'currentBehavior', 'mediaPresentation',
    'brandSafetyScore', 'sources',
  ],
}

/** Vetva B: značkové spolupráce a vhodnosť pre značky. */
const COMMERCIAL_SCHEMA = {
  type: 'object' as const,
  properties: {
    brandPartnerships: P.brandPartnerships,
    suitableBrands: P.suitableBrands,
    unsuitableBrands: P.unsuitableBrands,
    sources: P.sources,
  },
  required: ['brandPartnerships', 'suitableBrands', 'unsuitableBrands', 'sources'],
}

/**
 * Perform web research on an influencer
 */
export async function performWebResearch(
  username: string,
  fullName: string,
  category: string,
  biography: string,
  postCaptions?: string[],
  country: string = 'CZ',
  clientBrand?: string
): Promise<WebResearchResult> {
  const client = getClient()

  console.log(`[Claude] Starting web research for ${fullName} (@${username}) [${country}]...`)

  const currentYear = new Date().getFullYear()
  const countryConfig = COUNTRY_CONFIG[country] || COUNTRY_CONFIG['CZ']

  // Prepare post captions for brand analysis (sanitized)
  const captionsForAnalysis = postCaptions
    ? postCaptions.slice(0, 20).map((c, i) => `${i + 1}. ${sanitizeText(c).substring(0, 350)}`).join('\n')
    : 'N/A'

  const safeName = sanitizeText(fullName)
  const safeBio = sanitizeText(biography).substring(0, 500)

  // Spoločná hlavička a pravidlá pre obe vetvy researchu
  const header = `OSOBA: ${safeName} (@${username})
KATEGÓRIA: ${category}
KRAJINA: ${countryConfig.name}
BIO: ${safeBio}

Influencer je z krajiny: ${countryConfig.name}
Hľadaj v jazyku: ${countryConfig.searchLang}`

  const commonRules = `⚠️ KRITICKÉ PRAVIDLÁ - DODRŽUJ:
1. NEPÍŠ informácie o vzťahoch/rozvodoch/deťoch ak to nie je 100% overené z dôveryhodného zdroja
2. NEHÁDAJ osobné informácie - ak nevieš, nechaj prázdne
3. partnerInfo: nechaj PRÁZDNE ak nemáš overený zdroj (radšej nič ako nepravda)
4. Ak nájdeš kontroverziu, uveď ROK a ZDROJ
5. recentNews: píš len SKUTOČNÉ články z médií (nie "odfotil sa s...", "bol na akcii...")

⏰ ČASOVÉ LIMITY - DŮLEŽITÉ!
Dnes je ${new Date().toLocaleDateString('cs-CZ')}.

RECENTNEWS: Uvádzaj LEN správy z POSLEDNÍCH 3 MĚSÍCŮ!
UPCOMINGEVENTS: Uvádzaj LEN BUDOUCÍ eventy (po dnešním datu)!
- NEZAHRŇUJ eventy, které už proběhly
- Pokud nemáš info o budoucích eventech, nech events: []

🌐 JAZYK VÝSTUPU: Piš POUZE v ČEŠTINĚ nebo SLOVENŠTINĚ!
- NEPOUŽÍVEJ azbuku ani jiné jazyky kromě názvů značek
- Pokud najdeš info v cizím jazyce, PŘELOŽ do češtiny

ČO PATRÍ DO recentNews.headlines:
✅ "Forbes leden ${currentYear}: Rozhovor o podnikaní"
✅ "iDnes ${currentYear}: Získal cenu Blogger roka"

ČO NEPATRÍ DO recentNews.headlines:
❌ Správy staršie ako 3 mesiace
❌ "Odfotil sa s fanúšikom", "Bol na párty", "Zverejnil nové foto"`

  // ── VETVA B: značkové spolupráce (beží paralelne s vetvou A) ──────────────
  const commercialPrompt = `DÔLEŽITÉ: Použi web_search a výsledok odovzdaj cez nástroj submit_research!
Tvojou úlohou sú VÝHRADNE značkové spolupráce a vhodnosť pre značky.

${header}

KROK 1 - POUŽI WEB SEARCH:
1. "${safeName}" ${countryConfig.partnershipKeywords} - brand partnerships

${commonRules}

KROK 2 - ANALYZUJ BIO NA SPOLUPRÁCE:
BIO: "${safeBio}"

V bio hľadaj: zmienky značiek (@ mentions), zľavové kódy ("kod: NATY20", "-10%"),
ambassador/partner zmienky, odkazy na spolupráce.
Ak nájdeš značky v bio, PRIDAJ ich do brandPartnerships!

KROK 3 - ANALYZUJ CAPTIONS PRE BRAND PARTNERSHIPS:
${captionsForAnalysis}

V captionoch hľadaj VŠETKY tieto signály:
A) HASHTAGS: #ad, #sponsored, #partner, #collab, #reklama, #spolupráca, #promo, #gifted, #darek
B) @MENTIONS značiek (nie osobné účty! napr. @nike, @notino_cz)
C) ZĽAVOVÉ KÓDY: "kod: XYZ", "-10%", "SLEVA", meno influencera ako kód (NATY20)
D) AFFILIATE LINKY: "link v bio", bit.ly, linktr.ee
E) FRÁZY: "v spolupráci s", "darček od", "ambasádor", "paid partnership"

Každú nájdenú značku PRIDAJ do brandPartnerships s typom:
- "paid" ak je tam #ad/#sponsored alebo "spolupráca"
- "unknown" ak je tam len @mention alebo zľavový kód

KROK 4 - BRAND PARTNERSHIPS Z WEBU:
Zaznamenaj všetky značky s ktorými influencer spolupracuje/spolupracoval
(ambasádorstvá, kampane, sponzorované príspevky, product placement).
${clientBrand ? `
🎯 KROK 4B - KONKURENČNÁ KONTROLA (KĽÚČOVÉ!):
Tento report sa robí pre klienta: "${sanitizeText(clientBrand)}".
Pri KAŽDOM nájdenom partnerstve (bio, captions aj web) vyhodnoť, či daná značka
pôsobí v rovnakom odvetví / predáva konkurenčný produkt ako klient.
- Ak áno → nastav isCompetitor: true pri danom partnerstve
- Konkurenčné spolupráce spomeň aj v recommendationText kontexte (sú kritické pre rozhodnutie)
- Ak si nie si istý odvetvím značky, vyhľadaj si ju cez web_search` : ''}

KROK 5 - suitableBrands / unsuitableBrands:
Na základe kategórie "${category}", obsahu profilu a nájdených spoluprác urč,
pre aké typy značiek je influencer vhodný a pre aké nie.

KROK 6 - Zavolaj nástroj submit_research so VŠETKÝMI nájdenými spoluprácami.
⚠️ Radšej nechaj pole PRÁZDNE ako písať neoverené informácie!`

  // ── VETVA A: identita, médiá + brand safety (má kontext pre presné skóre) ──
  const safetyPrompt = `DÔLEŽITÉ: Použi web_search tool na vyhľadanie OVERENÝCH informácií o tejto osobe a výsledok odovzdaj cez nástroj submit_research!
Tvojou úlohou je identita, mediálne výstupy a BRAND SAFETY. Značkové spolupráce NERIEŠ.

${header}

KROK 1 - POUŽI WEB SEARCH (vyhľadaj všetky):
1. "${safeName}" - základné info, médiá v krajine ${countryConfig.name}
2. "${safeName}" interview ${currentYear} - aktuálne rozhovory
3. "${safeName}" ${countryConfig.controversyKeywords} - brand safety

${commonRules}

KRITICKÉ PRE BRAND SAFETY - hľadaj TIETO typy kontroverzií:
- Politické vyjadrenia, extrémizmus, rasizmus, xenofóbia
- Drogy, alkohol, gambling propagácia, OnlyFans/adult content
- Podvody, súdne spory, trestné činy
- Agresívne správanie, klamlivá reklama, crypto/NFT scamy
- Bojkoty značiek kvôli jeho správaniu

⚠️ ČO NIE JE KONTROVERZIA (NEZAHRŇUJ):
❌ Vzťahové dramy, rozchody, romániky, špekulácie o randení
❌ Celebrity gossip bez reálneho dopadu, neoverené klebety z bulváru

brandSafetyScore škála:
- 1-2: KRITICKÉ (extrémizmus, trestné činy, aktuálne súdne spory)
- 3-4: VYSOKÉ RIZIKO (drogy, politické kontroverzie, crypto scamy)
- 5-6: STREDNÉ RIZIKO (menšie škandály, staré kontroverzie)
- 7-8: NÍZKE RIZIKO (drobné alebo neznámy, čistá história)
- 9-10: BEZPEČNÝ (overene čistý profil, žiadne nálezy)

KROK 2 - Po dokončení web searchov zavolaj nástroj submit_research so VŠETKÝMI nájdenými informáciami.
⚠️ ZAPAMÄTAJ SI: Radšej nechaj pole PRÁZDNE ako písať neoverené informácie!`

  const deadline = Date.now() + RESEARCH_DEADLINE_MS
  const remaining = () => deadline - Date.now()

  // DOČASNÉ MERANIE (odstrániť po zistení prod časov): koľko reálne beží každá
  // vetva na produkcii, aby sme vedeli navrhnúť async architektúru.
  const legTimings: Record<string, string> = {}

  /**
   * Odbehne jednu vetvu researchu. Vracia surový objekt zo submit_research,
   * alebo null ak vetva zlyhala (druhá vetva tým nie je dotknutá).
   */
  const runLeg = async (
    label: string,
    prompt: string,
    schema: object
  ): Promise<Record<string, unknown> | null> => {
    const legStart = Date.now()
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]

    const createParams = {
      model: RESEARCH_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' as const },
      // 'medium' effort: web searche prebehnú rovnako (identický research obsah),
      // model len menej „premýšľa" nad výsledkami → čas ~2× dole a hlavne bez
      // nepredvídateľných 250-500 s výkyvov, takže research VŽDY dobehne v limite.
      // Prepísateľné cez env RESEARCH_EFFORT (napr. 'high' pre max hĺbku).
      output_config: { effort: (process.env.RESEARCH_EFFORT || 'medium') as 'low' | 'medium' | 'high' },
      tools: [
        {
          type: 'web_search_20260209' as const,
          name: 'web_search' as const,
          max_uses: 4,
        },
        {
          name: 'submit_research',
          description: 'Odovzdaj finálne výsledky researchu o influencerovi. Zavolaj PRÁVE RAZ na konci, po dokončení všetkých web searchov.',
          input_schema: schema,
        },
      ],
    }

    // AbortSignal (na rozdiel od `timeout`) sa neretryuje — bez neho by SDK
    // po timeoute skúšalo znova a celkový čas by bol timeout × (maxRetries + 1).
    const call = () =>
      client.messages.create(
        { ...createParams, messages } as Anthropic.MessageCreateParamsNonStreaming,
        {
          signal: AbortSignal.timeout(Math.max(remaining(), 1_000)),
          timeout: Math.max(remaining(), 1_000),
          maxRetries: 1,
        }
      )

    try {
      const started = Date.now()
      let response = await call()

      // Server-side web search môže vrátiť pause_turn — pokračuj v ture,
      // ale nikdy nie za hranicu deadlinu (inak report zamrzne).
      let continuations = 0
      while (response.stop_reason === 'pause_turn' && continuations < 5) {
        if (remaining() <= 5_000) {
          console.warn(`[Claude:${label}] ⚠ Deadline vyčerpaný po ${continuations} pokračovaniach — končím`)
          break
        }
        messages.push({ role: 'assistant', content: response.content })
        response = await call()
        continuations++
      }

      const secs = ((Date.now() - started) / 1000).toFixed(0)
      legTimings[label] = `${secs}s OK`
      console.log(`[Claude:${label}] hotovo za ${secs}s (stop_reason: ${response.stop_reason})`)

      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'submit_research'
      )
      if (toolUse) return toolUse.input as Record<string, unknown>

      // Fallback: model skončil textom — skús nájsť JSON v texte
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error(`[Claude:${label}] Žiadny submit_research ani JSON v texte`)
        return null
      }
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>
    } catch (error) {
      const secs = ((Date.now() - legStart) / 1000).toFixed(0)
      legTimings[label] = `${secs}s ABORT`
      console.error(`[Claude:${label}] Zlyhalo po ${secs}s:`, error instanceof Error ? error.message : error)
      return null
    }
  }

  try {
    // Obe vetvy bežia súčasne → celkový čas = tá pomalšia, nie súčet
    const [safetyRaw, commercialRaw] = await Promise.all([
      runLeg('safety', safetyPrompt, SAFETY_SCHEMA),
      runLeg('commercial', commercialPrompt, COMMERCIAL_SCHEMA),
    ])

    // Brand safety (safety vetva) je pre report kritická — bez nej je research
    // nepreverený. Spolupráce (commercial) môžu chýbať, report to prežije
    // (doplnia sa defaulty). researchUnavailable riadi len zlyhanie safety vetvy.
    if (!safetyRaw) {
      console.error('[Claude] Safety vetva zlyhala → brand safety NEPREVERENÁ')
    }
    if (!commercialRaw) {
      console.warn('[Claude] ⚠ Commercial vetva zlyhala — report bez značkových spoluprác')
    }

    const safety = (safetyRaw ? cleanObjectFromCitations(safetyRaw) : {}) as Partial<WebResearchResult>
    const commercial = (commercialRaw ? cleanObjectFromCitations(commercialRaw) : {}) as Partial<WebResearchResult>

    // Zdroje sa zbierajú z oboch vetiev (bez duplikátov)
    const mergedSources = Array.from(new Set([
      ...(safety.sources || []), ...(commercial.sources || []),
    ]))

    // Merge with defaults so missing fields never break downstream code
    const defaults = getDefaultResearchResult(fullName, category)
    let result = {
      ...defaults,
      ...safety,
      ...commercial,
      sources: mergedSources,
      // Bez preverenej brand safety je report „nepreverený" (červený box v PDF)
      researchUnavailable: !safetyRaw,
    } as WebResearchResult

    // Model môže vrátiť polia v zlom tvare (reťazec namiesto poľa) → bez tejto
    // normalizácie by .join()/.map() nižšie zhodilo celý report na HTTP 500.
    result = normalizeResearchResult(result)

    // POST-PROCESSING: Enhance result with classification logic

    // 0. Filter out old events and news
    result = filterOldContent(result)
    console.log(`[Claude] After filtering: ${result.upcomingEvents?.events?.length || 0} events, ${result.recentNews?.headlines?.length || 0} news`)

    // 1. Re-classify controversy severities based on keywords
    if (result.controversies?.items) {
      result.controversies.items = result.controversies.items.map(item => ({
        ...item,
        severity: classifyControversySeverity(item.description)
      }))
    }

    // 2. Calculate commercialization risk
    if (result.brandPartnerships?.partnerships) {
      const totalPosts = postCaptions?.length || 12
      result.commercializationRisk = calculateCommercializationRisk(
        result.brandPartnerships.partnerships,
        totalPosts
      )
      console.log(`[Claude] Commercialization risk: ${result.commercializationRisk.riskLevel}`)
    }

    // 3. Assess source credibility (log for now)
    if (result.sources?.length > 0) {
      const credibilities = result.sources.map(assessSourceCredibility)
      const highCredCount = credibilities.filter(c => c.credibility === 'HIGH').length
      console.log(`[Claude] Sources: ${result.sources.length} total, ${highCredCount} high credibility`)
    }

    console.log(`[Claude] Research complete. Brand safety score: ${result.brandSafetyScore}`)
    // DOČASNÉ: časy vetiev do odpovede (odstrániť po zmeraní prod latencie)
    ;(result as WebResearchResult & { _debugLegTimings?: Record<string, string> })._debugLegTimings = legTimings
    return result

  } catch (error) {
    // SDK už retryol 429/5xx (maxRetries: 4) — ak sme tu, research reálne zlyhal.
    // Vraciame default s researchUnavailable: true, report zobrazí varovanie.
    console.error('[Claude] Web research failed, returning UNVERIFIED defaults:', error)
    return getDefaultResearchResult(fullName, category)
  }
}

/**
 * Generate report text content
 */
export async function generateReportText(
  profile: {
    fullName: string
    username: string
    category: string
    biography: string
  },
  research: WebResearchResult,
  metrics: {
    finalScore: number
    recommendation: string
    savingsPercent: number
    offeredPrice: number
    marketValueHigh: number
  }
): Promise<ReportTextContent> {
  const client = getClient()

  const mediaInfo = research.mediaAppearances
    ? `TV: ${research.mediaAppearances.tvShows?.join(', ') || 'N/A'}, Rozhovory: ${research.mediaAppearances.interviews?.join(', ') || 'N/A'}`
    : 'N/A'

  const eventsInfo = research.upcomingEvents?.hasEvents
    ? research.upcomingEvents.events.join(', ')
    : 'Žiadne známe'

  const newsInfo = research.recentNews?.hasNews
    ? research.recentNews.headlines.join(', ')
    : 'Žiadne aktuálne správy'

  const prompt = `Vygeneruj texty pre influencer marketing report:

**Influencer:** ${profile.fullName} (@${profile.username})
**Kategória:** ${profile.category}
**Bio:** ${profile.biography}

**Research výsledky:**
- Occupation: ${research.occupation}
- Achievements: ${research.achievements?.join(', ') || 'N/A'}
- Partner: ${research.partnerInfo || 'N/A'}
- Mediálne vystúpenia: ${mediaInfo}
- Nadchádzajúce eventy: ${eventsInfo}
- Aktuálne správy: ${newsInfo}
- Kontroverzie: ${research.controversies?.found ? research.controversies.items?.map(i => i.description).join(', ') : 'Žiadne'}
- Brand Safety Score: ${research.brandSafetyScore}/10${research.researchUnavailable ? ' (⚠ NEPREVERENÉ - research zlyhal, v textoch to spomeň!)' : ''}

**Metriky:**
- Final Score: ${metrics.finalScore}/10
- Recommendation: ${metrics.recommendation}
- Úspora vs Meta Ads: ${metrics.savingsPercent}%
- Ponúkaná cena: ${metrics.offeredPrice} CZK
- Market value: ${metrics.marketValueHigh} CZK

VYGENERUJ TIETO TEXTY:
- heroSubtitle: krátky popis pod menom (max 60 znakov, napr. '@handle | Víťaz Love Island 2024')
- bioSummary: 2-3 vety sumarizujúce kto je tento influencer, jeho achievements, TV show
- mediaHighlights: 1-2 vety o mediálnych vystúpeniach ak existujú, inak prázdny string
- controversyContext: ak existuje kontroverzia, krátky kontext pre warning box, inak prázdny string
- upcomingEventsText: ak má nadchádzajúce eventy, napíš o nich, inak prázdny string
- recommendationText: 2-3 vety s konkrétnym odporúčaním a podmienkami
- verdictText: krátky verdict text (napr. 'STRONG BUY – vynikajúca hodnota')

Píš profesionálně, stručně, v češtině. Pokud nemáš info, dej prázdný string.`

  try {
    const response = await client.messages.create({
      model: TEXT_MODEL,
      max_tokens: 2000,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              heroSubtitle: { type: 'string' },
              bioSummary: { type: 'string' },
              mediaHighlights: { type: 'string' },
              controversyContext: { type: 'string' },
              upcomingEventsText: { type: 'string' },
              recommendationText: { type: 'string' },
              verdictText: { type: 'string' },
            },
            required: [
              'heroSubtitle', 'bioSummary', 'mediaHighlights', 'controversyContext',
              'upcomingEventsText', 'recommendationText', 'verdictText',
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: 'user', content: prompt }],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const text = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )?.text
    if (!text) {
      return getDefaultReportText(profile, metrics)
    }

    const parsed = JSON.parse(text) as ReportTextContent
    // Empty strings → undefined (PDF renders sections conditionally)
    return {
      heroSubtitle: parsed.heroSubtitle,
      bioSummary: parsed.bioSummary,
      mediaHighlights: parsed.mediaHighlights || undefined,
      controversyContext: parsed.controversyContext || undefined,
      upcomingEventsText: parsed.upcomingEventsText || undefined,
      recommendationText: parsed.recommendationText,
      verdictText: parsed.verdictText,
    }

  } catch (error) {
    console.error('[Claude] Generate text error:', error)
    return getDefaultReportText(profile, metrics)
  }
}

/**
 * Default research result if API fails.
 * researchUnavailable: true → report zobrazí výrazné varovanie, že brand safety
 * NIE JE preverená (predtým sa tichý default tváril ako čistý profil).
 */
function getDefaultResearchResult(fullName: string, category: string): WebResearchResult {
  const brandMapping: Record<string, { suitable: string[], unsuitable: string[] }> = {
    'Sport': {
      suitable: ['Športové značky', 'Energy drinks', 'Fitness zariadenia', 'Športová výživa'],
      unsuitable: ['Beauty produkty', 'Baby produkty', 'Luxusná móda', 'Fine dining'],
    },
    'Lifestyle': {
      suitable: ['Fashion brands', 'Automotive', 'Travel', 'Lifestyle produkty'],
      unsuitable: ['B2B software', 'Industrial', 'Farmaceutiká', 'Finance'],
    },
    'Beauty': {
      suitable: ['Kozmetika', 'Fashion', 'Wellness', 'Luxury retail'],
      unsuitable: ['Heavy machinery', 'Gaming', 'Automotive', 'Sports equipment'],
    },
    'Fitness': {
      suitable: ['Fitness zariadenia', 'Športová výživa', 'Wellness', 'Healthy food'],
      unsuitable: ['Fast food', 'Alkohol', 'Tabak', 'Nezdravé produkty'],
    },
    'default': {
      suitable: ['Lifestyle brands', 'FMCG', 'E-commerce', 'Tech'],
      unsuitable: ['Kontroverzné produkty', 'Politické', 'Náboženské', 'Adult'],
    },
  }

  const brands = brandMapping[category] || brandMapping['default']

  return {
    fullName,
    occupation: category + ' Influencer',
    achievements: [],
    mediaAppearances: {
      tvShows: [],
      interviews: [],
      articles: [],
    },
    upcomingEvents: {
      hasEvents: false,
      events: [],
    },
    recentNews: {
      hasNews: false,
      headlines: [],
    },
    brandPartnerships: {
      found: false,
      partnerships: [],
      organicBrands: [],
    },
    controversies: {
      found: false,
      items: [],
    },
    currentBehavior: 'NEUTRAL',
    mediaPresentation: 'NEUTRAL',
    brandSafetyScore: 5, // neutrálne, NIE optimistických 7.5 — nič nebolo overené
    suitableBrands: brands.suitable,
    unsuitableBrands: brands.unsuitable,
    sources: [],
    researchUnavailable: true,
  }
}

/**
 * Default report text if generation fails
 */
function getDefaultReportText(
  profile: { fullName: string; username: string; category: string },
  metrics: { finalScore: number; recommendation: string; savingsPercent: number; offeredPrice: number }
): ReportTextContent {
  return {
    heroSubtitle: `@${profile.username} | ${profile.category} Influencer`,
    bioSummary: `${profile.fullName} je ${profile.category.toLowerCase()} influencer na Instagrame.`,
    recommendationText: `Odporúčame ${metrics.recommendation === 'STRONG BUY' || metrics.recommendation === 'BUY' ? 'akceptovať' : 'zvážiť'} spoluprácu za ${metrics.offeredPrice} CZK/mesiac. Úspora oproti Meta Ads: ${metrics.savingsPercent}%.`,
    verdictText: `${metrics.recommendation} – Score ${metrics.finalScore}/10`,
  }
}

// ============================================
// DISCOVERY TOOL - Parameter Extraction
// ============================================

// Hashtag suggestions by category and country
const HASHTAG_CONFIG: Record<string, Record<string, string[]>> = {
  CZ: {
    'Sport': ['fitnesscz', 'sportcz', 'cviceni', 'treninkcz', 'fitnessmotivation', 'sportovkyne'],
    'Lifestyle': ['lifestylecz', 'zivotnisstyl', 'inspiration', 'czechblogger', 'lifestyleblogger'],
    'Beauty & Fashion': ['beautycz', 'kosmetika', 'modacz', 'fashion', 'czechbeauty', 'beautyblogger'],
    'Fitness & Health': ['fitnesscz', 'zdravyzivotnistyl', 'cviceni', 'zdravestravovani', 'workout', 'fitnessgirl'],
    'Food & Gastro': ['foodcz', 'jidlo', 'varenicz', 'foodblogger', 'recepty', 'foodie'],
    'Travel': ['cestovani', 'travelbloggercz', 'cestovatelka', 'cestujem', 'dovolena', 'travelczech', 'cestujemeczech', 'travelblogger', 'wanderlust'],
    'Tech & Gaming': ['techcz', 'gaming', 'hrycz', 'technologie', 'gamercz'],
    'Entertainment': ['zabava', 'humor', 'komediacz', 'cesko', 'funny'],
    'Family & Parenting': ['maminka', 'rodicovstvi', 'deti', 'momblogger', 'rodina', 'mamablogger'],
    'Business & Finance': ['byznyscz', 'podnikani', 'finance', 'investice', 'motivace'],
  },
  SK: {
    'Sport': ['fitnesssk', 'sportsk', 'cvicenie', 'treningsk', 'fitnessmotivation'],
    'Lifestyle': ['lifestylesk', 'cestovanie', 'zivotnysstyl', 'inspiration', 'slovakblogger'],
    'Beauty & Fashion': ['beautysk', 'kozmetika', 'modask', 'fashion', 'slovakbeauty'],
    'Fitness & Health': ['fitnesssk', 'zdravyzivotnystyl', 'cvicenie', 'zdravestravovanie', 'workout'],
    'Food & Gastro': ['foodsk', 'jedlo', 'varenie', 'foodblogger', 'recepty'],
    'Travel': ['cestovaniesk', 'travel', 'vylet', 'dovolenka', 'slovaktravel'],
    'Tech & Gaming': ['techsk', 'gaming', 'hry', 'technologie', 'gamersk'],
    'Entertainment': ['zabava', 'humor', 'komediesk', 'slovensko', 'funny'],
    'Family & Parenting': ['mamicka', 'rodicovstvo', 'deti', 'momblogger', 'rodina'],
    'Business & Finance': ['byznyssk', 'podnikanie', 'financie', 'investicie', 'motivacia'],
  },
  DE: {
    'Sport': ['fitnessdeutschland', 'sportdeutschland', 'training', 'fitness', 'workout'],
    'Lifestyle': ['lifestylegermany', 'lebenstil', 'inspiration', 'germanblogger', 'lifestyle'],
    'Beauty & Fashion': ['beautygermany', 'kosmetik', 'mode', 'fashion', 'germanbeauty'],
    'Fitness & Health': ['fitnessdeutschland', 'gesundheit', 'training', 'ernahrung', 'workout'],
    'default': ['deutschland', 'german', 'lifestyle', 'blogger', 'influencer'],
  },
  IT: {
    'Sport': ['fitnessitalia', 'sportitalia', 'allenamento', 'fitness', 'workout'],
    'Lifestyle': ['lifestyleitalia', 'stiledivita', 'ispirazione', 'italianblogger', 'lifestyle'],
    'Beauty & Fashion': ['beautyitalia', 'cosmetici', 'moda', 'fashion', 'italianbeauty'],
    'Fitness & Health': ['fitnessitalia', 'salute', 'allenamento', 'alimentazione', 'workout'],
    'default': ['italia', 'italian', 'lifestyle', 'blogger', 'influencer'],
  },
  PL: {
    'Sport': ['fitnesspolska', 'sportpolska', 'trening', 'fitness', 'cwiczenia'],
    'Lifestyle': ['lifestylepolska', 'styl', 'inspiracja', 'polishblogger', 'lifestyle'],
    'Beauty & Fashion': ['beautypolska', 'kosmetyki', 'moda', 'fashion', 'polishbeauty'],
    'Fitness & Health': ['fitnesspolska', 'zdrowie', 'trening', 'zdrowezywienie', 'workout'],
    'default': ['polska', 'polish', 'lifestyle', 'blogger', 'influencer'],
  },
  RO: {
    'default': ['romania', 'romanian', 'lifestyle', 'blogger', 'influencer', 'fitness'],
  },
  HU: {
    'default': ['magyarorszag', 'hungarian', 'lifestyle', 'blogger', 'influencer', 'fitness'],
  },
}

/**
 * Extract discovery parameters from natural language query using Claude
 */
export async function extractDiscoveryParameters(
  query: string,
  country: string = 'CZ'
): Promise<DiscoveryParameters> {
  const client = getClient()

  console.log(`[Claude Discovery] Extracting parameters from: "${query.substring(0, 100)}..."`)

  const countryConfig = COUNTRY_CONFIG[country] || COUNTRY_CONFIG['CZ']

  const prompt = `Si expert na Instagram influencer marketing. Analyzuj popis od klienta a vygeneruj NAJLEPŠIE možné parametre pre vyhľadávanie influencerov.

POPIS OD KLIENTA:
"${query}"

KRAJINA: ${countryConfig.name} (${country})
JAZYK: ${countryConfig.searchLang}

TVOJA ÚLOHA:
1. Pochop ČO PRESNE klient hľadá (typ influencera, niche, štýl obsahu)
2. Vygeneruj 8-10 NAJRELEVANTNEJŠÍCH hashtagov ktoré by takýto influencer REÁLNE používal
3. Extrahuj všetky parametre

KRITICKÉ PRAVIDLÁ PRE HASHTAGS:
- Generuj 8-10 hashtagov (nie menej!)
- Hashtagy musia byť REÁLNE POUŽÍVANÉ na Instagrame v danej krajine
- Mix: 50% lokálne (v jazyku krajiny), 50% medzinárodné (anglicky)
- Bez # znaku
- Premýšľaj: "Aké hashtagy by TENTO TYP influencera používal vo svojich postoch?"

PRÍKLADY HASHTAGOV PODĽA NICHE:
- Travel žena CZ: cestovatelka, travelgirl, cestujemeczech, wanderlust, travelbloggercz, cestovani, dovolena, exploremore
- Fitness žena CZ: fitgirl, fitnesscz, cvicenidoma, healthylifestyle, workoutmotivation, fitnessmotivace, treninky
- Beauty CZ: czechbeauty, makeuplover, skincareroutine, beautybloggercz, kosmetika, krasa

PRAVIDLÁ PRE FOLLOWERS:
- Ak je uvedené presné číslo (napr. "30-50k"), použi ho presne
- "mikro" = 5000-50000, "malý" = 10000-50000, "stredný" = 50000-200000, "veľký" = 200000+

PRAVIDLÁ PRE POHLAVIE:
- "influencerka/blogerka" = female, "influencer/bloger" = male, neuvedené = any

KATEGÓRIE: Sport, Lifestyle, Beauty & Fashion, Tech & Gaming, Food & Gastro, Travel, Fitness & Health, Entertainment, Business & Finance, Family & Parenting`

  try {
    const response = await client.messages.create({
      model: DISCOVERY_MODEL,
      max_tokens: 1500,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              hashtags: { type: 'array', items: { type: 'string' } },
              category: { type: 'string' },
              followersMin: { type: 'integer' },
              followersMax: { type: 'integer' },
              keywords: { type: 'array', items: { type: 'string' } },
              contentType: { type: 'string' },
              targetGender: { type: 'string', enum: ['male', 'female', 'any'] },
            },
            required: ['hashtags', 'category', 'followersMin', 'followersMax', 'keywords', 'contentType', 'targetGender'],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: 'user', content: prompt }],
    } as Anthropic.MessageCreateParamsNonStreaming)

    const text = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )?.text
    if (!text) {
      console.error('[Claude Discovery] Empty response')
      return getDefaultDiscoveryParameters(query, country)
    }

    const result = JSON.parse(text) as DiscoveryParameters

    // Validate and fix hashtags if needed
    if (!result.hashtags || result.hashtags.length === 0) {
      result.hashtags = getDefaultHashtags(result.category, country)
    }
    result.hashtags = result.hashtags.map(h => h.replace(/^#/, ''))

    console.log(`[Claude Discovery] Extracted: ${result.hashtags.length} hashtags, category: ${result.category}, followers: ${result.followersMin}-${result.followersMax}`)

    return result

  } catch (error) {
    console.error('[Claude Discovery] Error:', error)
    return getDefaultDiscoveryParameters(query, country)
  }
}

/**
 * Get default hashtags for a category and country
 */
function getDefaultHashtags(category: string, country: string): string[] {
  const countryHashtags = HASHTAG_CONFIG[country] || HASHTAG_CONFIG['CZ']
  return countryHashtags[category] || countryHashtags['default'] || ['influencer', 'lifestyle', 'blogger']
}

/**
 * Default discovery parameters if extraction fails
 */
function getDefaultDiscoveryParameters(query: string, country: string): DiscoveryParameters {
  // Try to detect category from query
  const queryLower = query.toLowerCase()
  let category = 'Lifestyle'

  if (queryLower.includes('fitness') || queryLower.includes('sport') || queryLower.includes('cvič')) {
    category = 'Fitness & Health'
  } else if (queryLower.includes('beauty') || queryLower.includes('móda') || queryLower.includes('fashion') || queryLower.includes('kozmetik')) {
    category = 'Beauty & Fashion'
  } else if (queryLower.includes('food') || queryLower.includes('jedl') || queryLower.includes('varen')) {
    category = 'Food & Gastro'
  } else if (queryLower.includes('tech') || queryLower.includes('gaming') || queryLower.includes('hr')) {
    category = 'Tech & Gaming'
  } else if (queryLower.includes('travel') || queryLower.includes('cestov')) {
    category = 'Travel'
  }

  return {
    hashtags: getDefaultHashtags(category, country),
    category,
    followersMin: 10000,
    followersMax: 500000,
    keywords: query.split(' ').filter(w => w.length > 3).slice(0, 5),
    contentType: 'lifestyle',
    targetGender: 'any',
  }
}
