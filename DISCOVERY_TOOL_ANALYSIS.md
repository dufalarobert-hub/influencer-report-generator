# Influencer Discovery Tool - Analyza a Navrh

**Datum:** 21. april 2026
**Verzia:** 1.0
**Projekt:** NiftyMinds Influencer Discovery

---

## 1. CO ROBIA HYPEAUDITOR A PODOBNE NASTROJE?

### 1.1 HypeAuditor - Funkcie Discovery

HypeAuditor je lider v influencer discovery s databazou **224.5M+ profilov** napriec Instagram, YouTube, TikTok, Twitter a Twitch.

#### Hlavne Discovery Funkcie:

| Funkcia | Popis |
|---------|-------|
| **Vyhladavanie podla filtrov** | Audience location, vek, pohlavie, etnicita, zaujmy |
| **Fraud Detection** | AI detekcia 95% znamych podvodov (fake followers, engagement pods) |
| **Audience Quality Score** | Rychle ohodnotenie kvality audiencie |
| **Lookalikes** | Najdenie podobnych influencerov k existujucim uspesnym |
| **Niche Search** | Specialne vyhladavanie podla nichy/temy |
| **Keyword/Hashtag Search** | Vyhladavanie podla obsahu |

#### Ako Funguje Discovery:

1. **Zadanie kriterii** - krajina, kategoria, pocet followers, ER
2. **Filtrovanie** - demograficke filtre (audience age, location, gender)
3. **Scoring** - AI ohodnotenie kvality kazdeho profilu
4. **Lookalikes** - navrhy podobnych profileov
5. **Export** - zoznam s metrikami na outreach

### 1.2 Porovnanie Hlavnych Nastrojov

| Nastroj | Databaza | Cena (mesiac) | API | Silna stranka |
|---------|----------|---------------|-----|---------------|
| **HypeAuditor** | 219M+ | $399+ | Custom | Fraud detection, audit |
| **Modash** | 350M+ | $199-299 | $16K+/rok | Najvacsia databaza |
| **Upfluence** | 3M+ | $400+ | $478+ | E-commerce integracie |
| **Heepsy** | 11M+ | $49-199 | Limited | Budget-friendly |
| **Influencer Hero** | N/A | Custom | No | All-in-one workflow |

### 1.3 Typicke Filtre v Discovery Nastrojoch

```
INFLUENCER FILTRE:
- Platforma (Instagram, TikTok, YouTube)
- Followers range (1K-10K, 10K-100K, 100K-1M, 1M+)
- Engagement Rate minimum
- Kategoria/Nicha
- Verified status
- Business account type
- Posting frequency

AUDIENCE FILTRE:
- Krajina audiencie (top locations)
- Vek audiencie
- Pohlavie audiencie
- Jazyk
- Zaujmy/Interests

CONTENT FILTRE:
- Hashtagy ktore pouziva
- Keywords v bio/captions
- Typ obsahu (video, foto, carousel)
- Brand mentions
```

---

## 2. API/DATOVE ZDROJE - CO POTREBUJEME?

### 2.1 Apify Scrapery pre Discovery

Na Apify existuju specificke actors pre influencer discovery:

#### A) Instagram Hashtag Scraper (Apify Official)
- **URL:** https://apify.com/apify/instagram-hashtag-scraper
- **Co robi:** Scrapuje posts z hastagov, vratane autorov
- **Cena:** $2.60/1000 results (Free plan), $2.30/1000 (Starter)
- **Pouzitie:** Najdenie influencerov cez hashtagy

#### B) Instagram Hashtag Scraper s Engagement Rate
- **URL:** https://apify.com/khadinakbar/instagram-hashtag-scraper
- **Co robi:** Hashtag posts + pre-calculated ER
- **Cena:** Podobna ako official
- **Pouzitie:** Discovery s ER rankingom

#### C) Instagram Search Scraper
- **URL:** https://apify.com/apify/instagram-search-scraper
- **Co robi:** Vyhladava profiles/hashtagy/locations
- **Pouzitie:** Keyword-based discovery

#### D) Instagram Profile Scraper (uz pouzivate)
- **URL:** https://apify.com/apify/instagram-profile-scraper
- **Pouzitie:** Detail profilu + metriky

### 2.2 Cenove Porovnanie

| Zdroj | Model | Cena | 100 influencerov |
|-------|-------|------|------------------|
| **Apify Hashtag** | Pay-per-result | $2.60/1K | ~$0.26-$2.60 |
| **Apify Profile** | Per-run | ~$0.10/profile | ~$10 |
| **HypeAuditor API** | Subscription | $399+/mo | N/A |
| **Modash API** | Annual | $16K/rok | ~$1,333/mo |
| **Manual Search** | Time | Free | 5-10h casu |

### 2.3 Realisticke Low-Cost Riesenie

**Kombinácia Apify actorov:**

```
KROK 1: Hashtag Discovery ($2.60/1000)
Instagram Hashtag Scraper -> zoznam userov co pouzivaju hashtag

KROK 2: Profile Enrichment ($0.10/profile)
Instagram Profile Scraper -> detail profilov (followers, ER, posts)

KROK 3: AI Scoring (Claude API)
Ohodnotenie relevantnosti, brand safety, odporucania

CELKOVE NAKLADY na 100 influencerov:
- Hashtag scrape: ~$0.50 (200 posts -> 100 unique users)
- Profile scrape: ~$10 (100 profiles)
- Claude API: ~$0.50 (text analysis)
= CELKOM: ~$11 za 100 influencerov
```

---

## 3. CO BY BOLO REALISTICKY IMPLEMENTOVATELNE?

### 3.1 MVP Funkcie (Low-Cost)

S Apify + Claude je mozne implementovat:

#### Tier 1 - Zakladne Discovery (MVP)

| Funkcia | Technologia | Naklad |
|---------|-------------|--------|
| **Hashtag Search** | Apify Hashtag Scraper | $2.60/1K |
| **Profile Data** | Apify Profile Scraper | ~$0.10/profil |
| **Basic Metrics** | Vas sucasny `metrics.ts` | Free |
| **Category Matching** | Claude API | ~$0.01/profil |
| **CSV Export** | JavaScript | Free |

#### Tier 2 - Rozsirene Discovery

| Funkcia | Technologia | Naklad |
|---------|-------------|--------|
| **Lookalike Search** | Apify + Claude | $0.20/query |
| **Keyword Search** | Apify Search Scraper | $3/1K |
| **Multi-hashtag** | Batch processing | Low |
| **Location Filter** | Post-processing | Free |

#### Tier 3 - Premium (buducnost)

| Funkcia | Technologia | Naklad |
|---------|-------------|--------|
| **Audience Demographics** | HypeAuditor/Modash API | $$$ |
| **Fraud Detection** | Custom ML model | Dev time |
| **Real-time Monitoring** | Webhooks + DB | Infra |

### 3.2 Co NIE JE Mozne bez Premium API

- **Audience Demographics** (vek, pohlavie, lokacia followers)
- **Audience Quality Score** (% fake followers)
- **Historical Growth Data** (follower trends)
- **Brand Affinity** (znacky ktore sleduju followers)
- **Competitor Audience Overlap**

Tieto funkcie vyzaduju pristup k internym datam IG, ktore Apify nema.

### 3.3 Navrh MVP Funkcii

```
VSTUP:
- Kategoria (Sport, Beauty, Tech...)
- Krajina (CZ, SK, PL...)
- Followers range (10K-50K, 50K-100K...)
- Minimum ER (napr. 2%)
- Pocet vysledkov (10, 25, 50, 100)

VYSTUP (pre kazdeho influencera):
- Username, Full Name, Bio
- Followers, Posts count
- Engagement Rate
- Avg Views (ak video)
- Profile link
- Discovery Score (1-10)
- Relevance note (preco bol najdeny)
```

---

## 4. NAVRH ARCHITEKTURY PRE "INFLUENCER DISCOVERY TOOL"

### 4.1 High-Level Architektura

```
+------------------+
|   Frontend UI    |
|  (Next.js/React) |
+--------+---------+
         |
         v
+--------+---------+
|   API Routes     |
|  /api/discovery  |
+--------+---------+
         |
    +----+----+
    |         |
    v         v
+---+---+ +---+---+
| Apify | | Claude|
| APIs  | |  API  |
+---+---+ +---+---+
    |         |
    +----+----+
         |
         v
+--------+---------+
|  Discovery Logic |
|  - Filter        |
|  - Score         |
|  - Rank          |
+--------+---------+
         |
         v
+--------+---------+
|   Output         |
|  - JSON          |
|  - CSV Export    |
|  - Report link   |
+------------------+
```

### 4.2 Databazova Schema (optional pre caching)

```sql
-- Discovered influencers cache
CREATE TABLE discovered_influencers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE,
  full_name VARCHAR(255),
  followers_count INT,
  posts_count INT,
  engagement_rate DECIMAL(5,2),
  avg_views INT,
  bio TEXT,
  profile_pic_url TEXT,
  verified BOOLEAN,
  business_account BOOLEAN,
  category VARCHAR(100),
  country VARCHAR(10),
  discovery_score DECIMAL(3,1),
  discovered_via VARCHAR(100), -- hashtag, search, lookalike
  discovered_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Discovery searches log
CREATE TABLE discovery_searches (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  search_params JSONB,
  results_count INT,
  cost_estimate DECIMAL(10,4),
  created_at TIMESTAMP
);
```

### 4.3 API Endpoints

```typescript
// Discovery endpoints
POST /api/discovery/search
{
  hashtags: ["fitness", "workout"],
  category: "Fitness & Health",
  country: "CZ",
  followers: { min: 10000, max: 100000 },
  engagementRate: { min: 2.0 },
  limit: 50
}

// Response
{
  success: true,
  data: {
    influencers: [...],
    totalFound: 47,
    estimatedCost: "$5.20",
    searchId: "abc123"
  }
}

// Get influencer detail (enriched)
GET /api/discovery/profile/:username

// Export results
GET /api/discovery/export/:searchId?format=csv

// Lookalike search
POST /api/discovery/lookalike
{
  sourceUsername: "rousalruchy",
  limit: 20
}
```

### 4.4 Discovery Workflow

```
FAZA 1: HASHTAG COLLECTION
Input: hashtags[], country, category
|
v
Apify Hashtag Scraper
- Scrape 500-2000 posts per hashtag
- Extract unique usernames
- Filter by location (ak je v poste)
|
v
OUTPUT: Set<username> (100-500 unique)

FAZA 2: PROFILE ENRICHMENT
Input: usernames[]
|
v
Apify Profile Scraper (batch)
- Fetch profile data
- Calculate ER
- Get top posts
|
v
OUTPUT: InstagramProfile[] s metrikami

FAZA 3: FILTERING & SCORING
Input: profiles[], criteria
|
v
Filter Engine:
- followers in range?
- ER >= minimum?
- verified? business?
- posting frequency OK?
|
v
Scoring Engine (Claude):
- Category relevance (bio, content)
- Brand safety quick check
- Content quality assessment
|
v
OUTPUT: ScoredInfluencer[]

FAZA 4: RANKING & OUTPUT
Input: scored influencers
|
v
Sort by discovery_score DESC
|
v
OUTPUT:
- JSON response
- CSV export
- Link to generate full report (vas existujuci tool)
```

### 4.5 Implementacny Plan

#### Sprint 1: MVP Discovery (1-2 tyzdne)

```
[ ] Novy API route: /api/discovery/hashtag
[ ] Integrace Apify Hashtag Scraper
[ ] Basic filtering (followers, ER)
[ ] Simple UI form pre vstup
[ ] JSON output s vysledkami
```

#### Sprint 2: Profile Enrichment (1 tyzden)

```
[ ] Batch profile scraping
[ ] ER + Reach kalkulacia (z vasho metrics.ts)
[ ] Scoring algoritmus
[ ] CSV export
```

#### Sprint 3: UI + UX (1 tyzden)

```
[ ] Discovery dashboard
[ ] Filter panel
[ ] Results grid/table
[ ] "Generate Report" button (link na existujuci tool)
[ ] Search history
```

#### Sprint 4: Optimalizacia (ongoing)

```
[ ] Caching discovered profiles
[ ] Rate limiting
[ ] Cost tracking
[ ] Lookalike search
```

---

## 5. CENOVA KALKULACIA

### 5.1 Predpokladane Mesacne Naklady

| Scenar | Searches/mes | Profiles/search | Apify | Claude | Celkom |
|--------|--------------|-----------------|-------|--------|--------|
| **Light** | 10 | 50 | $15 | $2 | ~$17/mes |
| **Medium** | 30 | 100 | $50 | $10 | ~$60/mes |
| **Heavy** | 100 | 100 | $150 | $30 | ~$180/mes |

### 5.2 Porovnanie s Konkurenciou

| Riesenie | Mesacna Cena | Discovery Limit |
|----------|--------------|-----------------|
| **Vas MVP** | $17-180 | Unlimited searches |
| **HypeAuditor** | $399+ | Limited by plan |
| **Modash** | $199+ | Limited by plan |
| **Heepsy** | $49-199 | Limited by plan |

**Vysledok:** Vas MVP moze byt 2-20x lacnejsi ako komercne riesenia, s obmedzeniami v audience demographics.

---

## 6. ODPORUCANIA

### 6.1 Immediate Actions

1. **Implementovat Hashtag Discovery MVP**
   - Najrychlejsia pridana hodnota
   - Nízke náklady (~$0.003/influencer)
   - Pouzit existujucu infrastrukturu

2. **Integrovat s existujucim Report Generatorom**
   - Discovery -> klik -> Full Report
   - Seamless user experience

3. **Pridat CSV Export**
   - Uzivatel si exportne zoznam
   - Moze pouzit externe pre outreach

### 6.2 Nice-to-Have (buducnost)

1. **Database Caching**
   - Ukladat discovered profiles
   - Rychlejsie opakovane vyhladavania
   - Historical data

2. **Lookalike Search**
   - "Najdi podobnych k @rousalruchy"
   - Bio similarity (Claude embeddings)
   - Hashtag overlap

3. **Bulk Actions**
   - Generovat reporty pre viacerych naraz
   - Batch outreach templates

### 6.3 Co NEODPORUCAM

1. **Kupovat HypeAuditor/Modash API**
   - Prilis drahe pre vas use case
   - $399+/mesiac je overkill

2. **Budovat vlastny fraud detection**
   - Vyzaduje ML expertise
   - HypeAuditor ma roky nasko

3. **Real-time monitoring**
   - Vysokie infra naklady
   - Nie je potrebne pre discovery

---

## 7. ZAVER

### Realisticky MVP:

**INPUT:**
- Hashtagy (#fitness, #czechfitness)
- Kategoria, Krajina
- Followers range, min ER

**PROCESS:**
- Apify Hashtag Scraper -> usernames
- Apify Profile Scraper -> profile data
- Vas metrics.ts -> ER, reach
- Claude -> relevance scoring

**OUTPUT:**
- Ranked list influencerov
- CSV export
- "Generate Full Report" button

**NAKLADY:** ~$10-20 za 100 influencerov

**TIMELINE:** 2-4 tyzdne na MVP

---

## Zdroje

- [HypeAuditor Discovery](https://hypeauditor.com/discovery/)
- [Apify Instagram Hashtag Scraper](https://apify.com/apify/instagram-hashtag-scraper)
- [Apify Instagram Search Scraper](https://apify.com/apify/instagram-search-scraper)
- [Modash vs HypeAuditor](https://www.modash.io/modash-vs-hypeauditor)
- [HypeAuditor Alternatives 2026](https://sproutsocial.com/insights/hypeauditor-alternatives/)
- [Influencer Marketing APIs Comparison](https://influencers.club/blog/influencer-marketing-apis/)

---

**Dokument pripravil:** Claude Code (Influencer Marketing Strategist)
**Verzia:** 1.0
**Posledna aktualizacia:** 21. april 2026
