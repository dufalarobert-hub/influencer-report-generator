/**
 * Claude AI Service - Web Research & Analysis
 *
 * Používa Claude API na:
 * - Web research (kontroverzie, background, médiá)
 * - Brand safety assessment
 * - Generovanie odporúčaní
 */

import Anthropic from '@anthropic-ai/sdk'

// Types
export interface BrandPartnership {
  brandName: string
  date?: string
  type: 'paid' | 'organic' | 'unknown'
  isCompetitor?: boolean
  category?: string

  // NEW - classification signals
  signals?: {
    hasHashtag: boolean       // #ad, #sponsored
    hasDiscountCode: boolean  // NATY20, -10%
    hasAffiliateLink: boolean // link v bio
    bioMention: boolean       // V bio = dlhodobé partnerstvo
  }
  frequency?: number          // Počet zmienok
  isLongTerm?: boolean        // >3 mesiace alebo v bio
}

// NEW - Overcommercialization detection
export interface CommercializationRisk {
  totalBrandMentions: number
  paidPartnerships: number
  organicMentions: number
  commercialRatio: number      // % postov s reklamou
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  warning?: string
}

// NEW - Source credibility
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

  // Brand partnerships (NEW)
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

  // NEW - Commercialization risk
  commercializationRisk?: CommercializationRisk
  currentBehavior: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  mediaPresentation: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  brandSafetyScore: number // 1-10

  // Brand matching
  suitableBrands: string[]
  unsuitableBrands: string[]

  // Sources
  sources: string[]
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

/**
 * Initialize Anthropic client
 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  return new Anthropic({ apiKey })
}

/**
 * Sanitize text to remove problematic Unicode characters
 */
function sanitizeText(text: string): string {
  if (!text) return ''
  // Remove surrogate pairs and other problematic characters
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
  // Remove Cyrillic characters (U+0400-U+04FF)
  // Remove Arabic, Hebrew, and other non-Latin scripts
  return text
    .replace(/[\u0400-\u04FF]/g, '') // Cyrillic
    .replace(/[\u0600-\u06FF]/g, '') // Arabic
    .replace(/[\u0590-\u05FF]/g, '') // Hebrew
    .replace(/[\u4E00-\u9FFF]/g, '') // Chinese
    .replace(/[\u3040-\u309F]/g, '') // Japanese Hiragana
    .replace(/[\u30A0-\u30FF]/g, '') // Japanese Katakana
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
        // Remove empty strings after cleaning
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
    // Check if there's something more serious combined with it
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
 * Filters: events, news, articles, interviews
 */
function filterOldContent(result: WebResearchResult): WebResearchResult {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  // Calculate which months are valid (last 3 months)
  // For March 2026: valid = Jan 2026, Feb 2026, Mar 2026
  const validMonths: string[] = []
  const czechMonths = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen',
                       'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
  const shortMonths = ['led', 'úno', 'bře', 'dub', 'kvě', 'čer', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro']

  for (let i = 0; i < 3; i++) {
    let month = currentMonth - i
    let year = currentYear
    if (month <= 0) {
      month += 12
      year -= 1
    }
    validMonths.push(`${year}`)
    validMonths.push(czechMonths[month - 1])
    validMonths.push(shortMonths[month - 1])
  }

  // Helper function to check if content is recent (last 3 months)
  const isRecent = (text: string): boolean => {
    const lowerText = text.toLowerCase()

    // Check for year - if old year, filter out
    const yearMatch = text.match(/\b(20\d{2})\b/)
    if (yearMatch) {
      const year = parseInt(yearMatch[1])
      // Only allow current year (for recent months) or explicit recent months
      if (year < currentYear) {
        return false
      }
    }

    // Check for old month patterns like "2024", "2023", etc.
    if (/\b(201\d|202[0-4])\b/.test(text)) {
      return false
    }

    return true
  }

  // Filter events - keep only future events
  if (result.upcomingEvents?.events) {
    result.upcomingEvents.events = result.upcomingEvents.events.filter(event => {
      const lowerEvent = event.toLowerCase()
      // Check if event contains a past year
      if (/\b(201\d|202[0-5])\b/.test(event) && !event.includes(String(currentYear))) {
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
 * Perform web research on an influencer
 */
export async function performWebResearch(
  username: string,
  fullName: string,
  category: string,
  biography: string,
  postCaptions?: string[],
  country: string = 'CZ' // NEW: influencer's country
): Promise<WebResearchResult> {
  const client = getClient()

  console.log(`[Claude] Starting web research for ${fullName} (@${username}) [${country}]...`)

  const currentYear = new Date().getFullYear()
  const countryConfig = COUNTRY_CONFIG[country] || COUNTRY_CONFIG['CZ']

  // Prepare post captions for brand analysis (sanitized)
  // Zvýšené na 20 captionov a 350 znakov pre lepšiu detekciu partnerstiev
  const captionsForAnalysis = postCaptions
    ? postCaptions.slice(0, 20).map((c, i) => `${i+1}. ${sanitizeText(c).substring(0, 350)}`).join('\n')
    : 'N/A'

  // Sanitize all text inputs
  const safeName = sanitizeText(fullName)
  const safeBio = sanitizeText(biography).substring(0, 500)

  const prompt = `DÔLEŽITÉ: Použi web_search tool na vyhľadanie OVERENÝCH informácií o tejto osobe!

OSOBA: ${safeName} (@${username})
KATEGÓRIA: ${category}
KRAJINA: ${countryConfig.name}
BIO: ${safeBio}

KROK 1 - POUŽI WEB SEARCH (vyhľadaj všetky):
Influencer je z krajiny: ${countryConfig.name}
Hľadaj v jazyku: ${countryConfig.searchLang}

1. "${safeName}" - základné info, médiá v krajine ${countryConfig.name}
2. "${safeName}" interview ${currentYear} - aktuálne rozhovory
3. "${safeName}" ${countryConfig.controversyKeywords} - brand safety
4. "${safeName}" ${countryConfig.partnershipKeywords} - brand partnerships

DÔLEŽITÉ PRE VYHĽADÁVANIE:
- Influencer je z krajiny ${countryConfig.name} → hľadaj v lokálnych médiách tejto krajiny
- Použij kľúčové slová v jazyku: ${countryConfig.searchLang}
- Hľadaj aj v medzinárodných médiách ak je influencer známy globálne

⚠️ KRITICKÉ PRAVIDLÁ - DODRŽUJ:
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
- NEPOUŽÍVEJ azbyku (ruštinu, bulharštinu, ukrajinštinu)
- NEPOUŽÍVEJ jiné jazyky (němčina, angličtina) kromě názvů značek
- Pokud najdeš info v cizím jazyce, PŘELOŽ do češtiny

ČO PATRÍ DO recentNews.headlines:
✅ "Forbes január 2025: Rozhovor o podnikaní"
✅ "Refresher február 2025: Nový podcast"
✅ "iDnes 2025: Získal cenu Blogger roka"

ČO NEPATRÍ DO recentNews.headlines:
❌ Správy staršie ako 3 mesiace
❌ "Odfotil sa s fanúšikom"
❌ "Bol na párty"
❌ "Zverejnil nové foto"

DÔLEŽITÉ PRE VÝSTUP:
- fullName: použi len meno a priezvisko, NIE prezývky
- nickname: prezývka ak existuje
- partnerInfo: NECHAJ PRÁZDNE ak nemáš 100% overený zdroj!
- recentNews.headlines: len SKUTOČNÉ mediálne články z POSLEDNÍCH 3 MĚSÍCŮ
- mediaAppearances.articles: POUZE články z POSLEDNÍCH 3 MĚSÍCŮ! (s datem 2026)
- mediaAppearances.interviews: POUZE rozhovory z POSLEDNÍCH 3 MĚSÍCŮ! (s datem 2026)
- NEPOUŽÍVAJ cite tagy, len čistý text

KROK 2 - ANALYZUJ BIO NA SPOLUPRÁCE:
BIO: "${safeBio}"

DÔLEŽITÉ! V bio hľadaj:
- Zmienky značiek (@ mentions)
- Zľavové kódy (napr. "kod: NATY20", "code:", "-10%")
- Ambassador/partner zmienky
- Odkazy na spolupráce
Ak nájdeš značky v bio, PRIDAJ ich do brandPartnerships!

KROK 3 - ANALYZUJ CAPTIONS PRE BRAND PARTNERSHIPS:
${captionsForAnalysis}

DÔLEŽITÉ! V captionoch hľadaj VŠETKY tieto signály:

A) HASHTAGS pre platenú spoluprácu:
   #ad, #sponsored, #partner, #collab, #reklama, #spolupráca, #advertisement, #promo, #gifted, #darek

B) @MENTIONS značiek (nie osobné účty!):
   Hľadaj @názov kde názov je firma/brand (napr. @nike, @notino_cz, @dm_cesko)
   IGNORUJ osobné účty priateľov

C) ZĽAVOVÉ KÓDY v texte:
   - "kod: XYZ", "code: XYZ", "kód: XYZ"
   - "-10%", "-15%", "-20%" + názov značky
   - "ZĽAVA", "SLEVA", "DISCOUNT"
   - Meno influencera ako kód (napr. "NATY20", "EVA15")

D) AFFILIATE/PRODUCT LINKY:
   - "link v bio", "odkaz v bio", "link in bio"
   - bit.ly, linktr.ee, amzn.to, shopify odkazy
   - "kúpiš tu:", "objednaj na:", "nájdeš na:"

E) FRÁZY O SPOLUPRÁCI:
   - "v spolupráci s", "spolupracujem s", "partner"
   - "darček od", "gift from", "dostala som od"
   - "ambasádor", "ambassador", "tvár značky"
   - "reklamná spolupráca", "paid partnership"

Každú nájdenú značku PRIDAJ do brandPartnerships s typom:
- "paid" ak je tam #ad/#sponsored alebo "spolupráca"
- "unknown" ak je tam len @mention alebo zľavový kód

KROK 4 - BRAND PARTNERSHIPS Z WEBU:
Zaznamenaj všetky značky s ktorými influencer spolupracuje/spolupracoval:
- Ambasádorstvá (dlhodobé partnerstvá)
- Reklamné kampane
- Sponzorované príspevky
- Product placement

KROK 5 - PO VYHĽADANÍ vráť JSON s nájdenými informáciami:

KRITICKÉ PRE BRAND SAFETY - hľadaj TIETO typy kontroverzií:
- Politické vyjadrenia, extrémizmus
- Rasizmus, xenofóbia, homofóbia
- Drogy, alkohol, gambling propagácia
- OnlyFans, adult content
- Podvody, súdne spory, trestné činy
- Agresívne správanie, fyzické konflikty
- Klamlivá reklama, crypto/NFT scamy
- Bojkoty značiek kvôli jeho správaniu

⚠️ ČO NIE JE KONTROVERZIA (NEZAHRŇUJ):
❌ Vzťahové dramy, rozchody, romániky
❌ Špekulácie o randení ("tvoria pár?")
❌ Celebrity gossip bez reálneho dopadu
❌ Bežné hádky na sociálnych sieťach
❌ Neoverené klebety z bulváru

⚠️ PRE SKUTOČNÉ KONTROVERZIE:
- Uveď ROK kedy sa to stalo
- Uveď či je to VYRIEŠENÉ alebo stále aktuálne
- NEZAHRŇUJ vzťahové dramy - tie nepoškodzujú značky!

brandSafetyScore škála:
- 1-2: KRITICKÉ (extrémizmus, trestné činy, aktuálne súdne spory)
- 3-4: VYSOKÉ RIZIKO (drogy, politické kontroverzie, crypto scamy)
- 5-6: STREDNÉ RIZIKO (menšie škandály, staré kontroverzie)
- 7-8: NÍZKE RIZIKO (drobné alebo neznámy, čistá história)
- 9-10: BEZPEČNÝ (overene čistý profil, žiadne nálezy)

ODPOVEĎ - po web search vráť IBA ČISTÝ JSON (bez cite tagov!):
{"fullName":"${safeName}","nickname":"","occupation":"","achievements":[],"partnerInfo":"","mediaAppearances":{"tvShows":[],"interviews":[],"articles":[]},"upcomingEvents":{"hasEvents":false,"events":[]},"recentNews":{"hasNews":false,"headlines":[]},"brandPartnerships":{"found":false,"partnerships":[],"organicBrands":[]},"controversies":{"found":false,"items":[]},"currentBehavior":"NEUTRAL","mediaPresentation":"NEUTRAL","brandSafetyScore":7,"suitableBrands":[],"unsuitableBrands":[],"sources":[]}

PRÍKLADY SPRÁVNEHO FORMÁTU:
- fullName: "Eva Adamczyková" (len meno, nie prezývky)
- nickname: "Krůta" (prezývka samostatne)
- partnerInfo: "" (NECHAJ PRÁZDNE ak nemáš 100% overený zdroj!)
- mediaAppearances.tvShows: ["StarDance 2025", "Survivor"] (TV show můžou být i starší)
- mediaAppearances.articles: ["Forbes únor 2026: Rozhovor o kariéře", "Refresher březen 2026: Jak buduje značku"] ← MAX 3 MĚSÍCE!
- mediaAppearances.interviews: ["Podcast XY leden 2026", "TV Prima únor 2026"] ← MAX 3 MĚSÍCE!
- recentNews.headlines: ["Forbes březen 2026: Top 30 pod 30", "iDnes únor 2026: Získal ocenění"] ← MAX 3 MĚSÍCE!
- upcomingEvents.events: ["Koncert Praha duben 2026", "Festival léto 2026"] ← LEN BUDOUCÍ!

❌ ŠPATNĚ (staré eventy - NEZAHRŇUJ):
- upcomingEvents.events: ["Koncert 2024", "Festival léto 2025"]

PRÍKLADY KONTROVERZIE (ak nájdeš):
"controversies":{"found":true,"items":[
  {"description":"2019: Kritika za klamlivú reklamu na detox čaj","severity":"MEDIUM","date":"2019","resolved":true},
  {"description":"2022: Kontroverzia okolo crypto projektu","severity":"HIGH","date":"2022","resolved":false}
]}

Príklad brandPartnerships:
"brandPartnerships":{"found":true,"partnerships":[
  {"brandName":"Nike","type":"paid","category":"Sport","date":"2024"}
],"organicBrands":["Apple","Mercedes"]}

⚠️ ZAPAMÄTAJ SI: Radšej nechaj pole PRÁZDNE ako písať neoverené informácie!`

  // Retry logic for rate limits
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Claude] Web research attempt ${attempt}/${maxRetries}...`)

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5,
          } as unknown as Anthropic.Tool,
        ],
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      // Log what we got back
      console.log('[Claude] Response stop_reason:', response.stop_reason)
      console.log('[Claude] Content blocks:', response.content.length)

      // Extract text response and log block types
      let textContent = ''
      for (const block of response.content) {
        console.log('[Claude] Block type:', block.type)
        if (block.type === 'text') {
          textContent += block.text
        }
      }

      console.log('[Claude] Raw response:', textContent.substring(0, 500))

      // Parse JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[Claude] Could not find JSON in response')
        return getDefaultResearchResult(fullName, category)
      }

      try {
        const rawResult = JSON.parse(jsonMatch[0])
        // Clean all citation tags and Cyrillic from the result
        let result = cleanObjectFromCitations(rawResult) as WebResearchResult

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
        return result
      } catch (parseError) {
        console.error('[Claude] JSON parse error:', parseError)
        return getDefaultResearchResult(fullName, category)
      }

    } catch (error: unknown) {
      lastError = error as Error
      const errorMessage = lastError?.message || ''

      // Check if rate limit error (429)
      if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
        const waitTime = attempt * 30 // 30s, 60s, 90s
        console.log(`[Claude] Rate limit hit. Waiting ${waitTime}s before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
        continue
      }

      // For other errors, don't retry
      console.error('[Claude] API error:', error)
      throw error
    }
  }

  // All retries failed, return default
  console.error('[Claude] All retries failed, using default research result')
  return getDefaultResearchResult(fullName, category)
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
- Brand Safety Score: ${research.brandSafetyScore}/10

**Metriky:**
- Final Score: ${metrics.finalScore}/10
- Recommendation: ${metrics.recommendation}
- Úspora vs Meta Ads: ${metrics.savingsPercent}%
- Ponúkaná cena: ${metrics.offeredPrice} CZK
- Market value: ${metrics.marketValueHigh} CZK

VYGENERUJ TIETO TEXTY (JSON formát):
{
  "heroSubtitle": "krátky popis pod menom (max 60 znakov, napr. '@handle | Víťaz Love Island 2024')",
  "bioSummary": "2-3 vety sumarizujúce kto je tento influencer, jeho achievements, TV show",
  "mediaHighlights": "1-2 vety o mediálnych vystúpeniach ak existujú, inak null",
  "controversyContext": "ak existuje kontroverzia, napíš krátky kontext pre warning box, inak null",
  "upcomingEventsText": "ak má nadchádzajúce eventy, napíš o nich, inak null",
  "recommendationText": "2-3 vety s konkrétnym odporúčaním a podmienkami",
  "verdictText": "krátky verdict text (napr. 'STRONG BUY – vynikajúca hodnota')"
}

Píš profesionálně, stručně, v češtině. Pokud nemáš info, dej null.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    let textContent = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text
      }
    }

    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return getDefaultReportText(profile, metrics)
    }

    return JSON.parse(jsonMatch[0]) as ReportTextContent

  } catch (error) {
    console.error('[Claude] Generate text error:', error)
    return getDefaultReportText(profile, metrics)
  }
}

/**
 * Default research result if API fails
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
    brandSafetyScore: 7.5,
    suitableBrands: brands.suitable,
    unsuitableBrands: brands.unsuitable,
    sources: [],
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
