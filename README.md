# NiftyMinds - Influencer Report Generator v5.1

**Automatizovaný systém pre generovanie profesionálnych influencer marketing reportov.**

---

## WEBOVA APLIKACIA

### Spustenie
```bash
cd "/Users/robertdufala/Desktop/Influencer Report Generator/app"
npm run dev
```

Otvor: **http://localhost:3001**

### Vstupne data

| Pole | Popis | Povinne |
|------|-------|---------|
| Instagram Username | bez @ | Ano |
| Kategoria | Sport, Lifestyle, Beauty, Tech... | Ano |
| Krajina influencera | CZ, SK, PL, RO, DE, IT, HU | Ano (default: CZ) |
| Offered Price | CZK/mesiac | Ano |
| Reels/mesiac | Pocet reels videi | Ano (default: 2) |
| Foto/mesiac | Pocet foto/carousel | Ano (default: 1) |
| Stories/mesiac | Pocet stories | Ano (default: 4) |
| Average Order Value | CZK - pre ROI predikcie | Nie |

---

## TECHNOLOGIE

| Sluzba | Ucel | Cena |
|--------|------|------|
| **Apify Profile Scraper** | Instagram profil + posty | ~$0.15/report |
| **Apify Reel Scraper** | Presné videoPlayCount (v4.8) | ~$0.05/report |
| **Apify Comments Scraper** | Analýza komentárov (v4.7) | ~$0.17/report |
| **Claude Opus 4.8** (v5.1) | Web research + text generation | ~$0.20-0.30/report |
| **Next.js 14** | Frontend & API | Free |

**Celkove naklady:** ~$0.55-0.65/report (opakovaný report do 7 dní: len Claude, Apify ide z cache)

> Pozn.: model sa dá prepnúť v `app/src/lib/claude.ts` (konštanty `RESEARCH_MODEL`,
> `TEXT_MODEL`, `DISCOVERY_MODEL`) — napr. `claude-haiku-4-5` zníži cenu na ~$0.02-0.05/report
> za cenu slabšieho researchu.

---

## ARCHITEKTURA

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (page.tsx)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Username   │ │  Category   │ │      Deliverables       ││
│  │  Price      │ │  AOV (opt)  │ │  Reels │ Foto │ Stories ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
└─────────────────────────┬───────────────────────────────────┘
                          │ POST /api/report/generate
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    API ROUTE (route.ts)                      │
│                                                              │
│  Step 1: fetchInstagramData() ──────► Apify Profile Scraper │
│          │                                                   │
│          ▼ profile, posts                                    │
│  Step 2: enrichProfileWithReelViews() ► Apify Reel Scraper  │
│          │                            (v4.8 - videoPlayCount)│
│          ▼ profile (accurate views)                          │
│  Step 3: fetchInstagramComments() ──► Apify Comments Scraper│
│          │                            (v4.7 - 75 comments)   │
│          ▼ commentAnalysis                                   │
│  Step 4: performWebResearch() ──────► Claude + Web Search   │
│          │                                                   │
│          ▼ research (controversies, partnerships, media)     │
│  Step 5: calculateAllMetrics() ─────► Local calculation     │
│          │                            (+ commentQuality)     │
│          ▼ metrics (value breakdown, scores, predictions)    │
│  Step 6: generateReportText() ──────► Claude                │
│          │                                                   │
│          ▼ text (hero, bio, recommendation)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ JSON Response
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  PDF REPORT (PDFReport.tsx)                  │
│                                                              │
│  Page 1: Profil & Overview + Comment Quality                 │
│  Page 2: Engagement & Value Breakdown                        │
│  Page 3: Brand Safety & Verdict                              │
└─────────────────────────────────────────────────────────────┘
```

---

## LOGIKA VYPOCTOV

### 1. ENGAGEMENT RATE - TRI METRIKY (v5.0)

Kvôli virálnym outlierom počítame ER tromi spôsobmi:

#### A) Výpočet per-post ER
```javascript
// Správny spôsob: ER pre každý post, potom agregácia
postERs = posts.map(post => (post.likes + post.comments) / followers * 100)
// Výsledok: [44.65%, 37.64%, 6.48%, 2.96%, 2.51%, 1.68%, 1.33%, 1.22%]
```

#### B) Tri agregačné metódy

| Metrika | Výpočet | Príklad | Použitie |
|---------|---------|---------|----------|
| **Priemer** | `sum(ERs) / count` | 12.31% | Celkový prehľad |
| **Trimmed Mean** | Priemer bez top/bottom 10% | 3.20% | Kompromis |
| **Medián** | Stredná hodnota | 2.74% | **ROI kalkulácie** |

#### C) Detekcia vysokého rozptylu
```javascript
hasHighVariance = (avgER / medianER) > 2
// Ak true → použije sa medián pre všetky výpočty
```

---

### 2. ENGAGEMENT RATE BENCHMARK

ER sa meni podla velkosti uctu - mensie ucty maju prirodzene vyssi ER.

```
Followers         | Poor  | Average | Good  | Excellent
------------------|-------|---------|-------|----------
< 10K (nano)      | <2%   | 4%      | 6%    | 10%+
10-50K (micro)    | <1.5% | 2.5%    | 4%    | 7%+
50-100K           | <1%   | 2%      | 3%    | 5%+
100-500K          | <0.8% | 1.5%    | 2.5%  | 4%+
500K+ (macro)     | <0.5% | 1%      | 2%    | 3%+
```

**Vystup:**
- `rating`: POOR / BELOW_AVERAGE / AVERAGE / GOOD / EXCELLENT
- `percentile`: 10% / 25% / 50% / 75% / 95%
- `context`: "Top 5% pre ucty s 125K followers"

---

### 3. BOT DETECTION (Audience Quality)

Kombinacia viacerych signalov na odhad % realnych followerov.

**Signaly:**

| Signal | Red Flag | Green Flag |
|--------|----------|------------|
| Follower/Following Ratio | < 1 (-15 bodov) | > 10 |
| ER vs Expected | < 30% ocakavaneho (-25) | >= ocakavany (+5) |
| Comments/Likes Ratio | < 1% (-10) | > 5% |
| Suspiciously High ER | 500K+ s ER > 10% (-20) | - |
| **Comment Quality (v4.7)** | genericRatio > 50% (-15) | meaningfulRatio > 35% (+10) |

**Comment Quality Analysis (v4.7):**
```
Apify Instagram Comments Scraper → 75 komentárov (5 postov × 15)

Generic komentáre (boti/engagement pods):
- Len emoji: 🔥❤️💯
- Krátke frázy: "Nice!", "Amazing!", "Skvělé!"
- Spam: "Follow me", "Check my profile"

Meaningful komentáre (reálni užívatelia):
- 10+ slov
- Obsahuje otázky (?, jak, kde, proč)
- Obsahuje názory (myslím, souhlasím)

Scoring:
- genericRatio > 50%: -15 bodov
- genericRatio > 35%: -8 bodov
- meaningfulRatio > 35%: +10 bodov
- meaningfulRatio > 20%: +5 bodov
```

**Vypocet:**
```
Start: 85 bodov (optimisticky)
- Odpocitaj za red flags
+ Pripocitaj za green flags
= Finalne skore (min 20, max 100)

Risk Level:
< 60%  → HIGH risk
60-75% → MEDIUM risk
> 75%  → LOW risk
```

---

### 4. VALUE BREAKDOWN (DYNAMICKE HODNOTY)

Co kupujes ked platis influencerovi? Hodnoty sa DYNAMICKY menia podla kvality influencera.

#### A) REACH VALUE (Dynamicky CPM)
```
"Kolko by stal rovnaky reach cez Meta Ads?"

Total Reach × DYNAMICKY CPM × 1.5 (warm audience premium)

DYNAMICKY CPM = Base 35 CZK × ER Multiplier × Size Multiplier

ER Multiplier (kvalita publika):
- EXCELLENT: 1.4×
- GOOD: 1.2×
- AVERAGE: 1.0×
- POOR: 0.7×

Size Multiplier (premium reach):
- 500K+: 1.2×
- 100-500K: 1.1×
- 50-100K: 1.0×
- <50K: 0.9×
```

#### B) ENGAGEMENT VALUE (Dynamicky CPE)
```
"Kolko by stal rovnaky engagement cez Meta Ads?"

Total Engagements × DYNAMICKY CPE × 1.3 (trust premium)

DYNAMICKY CPE podla ER ratingu:
- EXCELLENT: 2.0 CZK
- GOOD: 1.7 CZK
- AVERAGE: 1.5 CZK
- POOR: 1.0 CZK
```

#### C) CONTENT VALUE (Dynamicky podla followers)
```
"Kolko by stalo vytvorit tento obsah externe?"

Followers     | Reels    | Foto     | Story
--------------|----------|----------|--------
500K+         | 13,500   | 7,000    | 2,500
100-500K      | 10,500   | 5,500    | 2,000
50-100K       | 8,250    | 4,500    | 1,750
<50K          | 7,500    | 4,000    | 1,500
```

#### D) REACH PREDIKCIA (MIN/AVG/MAX)
```
Na zaklade historickych dat pocitame:
- MIN Reach: avgViews × 0.6 (konzervativny odhad)
- AVG Reach: avgViews (ocakavany)
- MAX Reach: maxViews alebo avgViews × 1.5 (viralny potencial)

Vystup: Value Ratio MIN / AVG / MAX
```

#### TOTAL VALUE (v5.1 — bez dvojitého počítania)
```
TOTAL = max(Reach Value, Engagement Value) + Content Value

Prečo max a nie súčet: keď kupuješ impressions cez Meta Ads, engagement
dostávaš v cene — Reach a Engagement value sa prekrývajú. Súčet by tú istú
mediálnu hodnotu počítal dvakrát a tlačil score k BUY.
(Warm audience premium tiež znížená 1.5 → 1.25, kvalita publika je už
zohľadnená v dynamickom CPM.)

VALUE RATIO = Total Value / Total Cost

Interpretacia:
≥3.0x → STRONG BUY (dostavas 3x hodnotu)
2.0-3.0x → BUY
1.0-2.0x → CONSIDER
<1.0x → PASS (replatis)
```

---

### 5. CONVERSION PREDICTIONS (ak je AOV zadane)

#### A) SCENARIOVA MATICA (9 kombinacii)

Zobrazuje vsetky mozne vysledky pre rozne CTR a Conversion Rate:

```
              │ CR 1%      │ CR 2%      │ CR 3%
──────────────┼────────────┼────────────┼────────────
CTR 1%        │ 110 sales  │ 220 sales  │ 330 sales
              │ ROI: -45%  │ ROI: +10%  │ ROI: +65%
──────────────┼────────────┼────────────┼────────────
CTR 2%        │ 220 sales  │ 440 sales  │ 660 sales
              │ ROI: +10%  │ ROI: +120% │ ROI: +230%
──────────────┼────────────┼────────────┼────────────
CTR 3%        │ 330 sales  │ 660 sales  │ 990 sales
              │ ROI: +65%  │ ROI: +230% │ ROI: +395%

Break-even: 200 predajov (zelene = profitabilne)
```

#### B) DYNAMICKY CTR PODLA ER RATINGU

Vyssi engagement = viac angazovane publikum = vyssi CTR:

v5.1: CTR znížené na realistické IG hodnoty — Reels nemajú klikateľný link,
klik ide cez stories sticker / bio. Matica scenárov: CTR 0.5/1/2 % × CR 1/2/3 %.

| ER Rating | Ocakavany CTR | Odporucany scenar |
|-----------|---------------|-------------------|
| EXCELLENT | 1.0-2.0% | CTR 2% |
| GOOD | 0.8-1.5% | CTR 1% |
| AVERAGE | 0.5-1.0% | CTR 1% |
| BELOW_AVERAGE | 0.3-0.8% | CTR 0.5% |
| POOR | 0.2-0.5% | CTR 0.5% |

#### C) ODPORUCANY SCENAR

Na zaklade ER ratingu influencera zvyraznime najrealistickejsi scenar:

```
ER Rating: GOOD → Odporucany CTR: 2%, CR: 2%

CONVERSION FUNNEL:
Views:        1,100,000
      ↓ CTR 2%
Clicks:       22,000
      ↓ Conv 2%
Conversions:  440 predajov

Expected Revenue: 880,000 CZK
Expected ROI:     +120%
```

---

### 6. MARKET VALUE (DYNAMICKE MULTIPLIKATORY)

Odhad trhovej hodnoty spoluprace - kolko by ste normalne zaplatili.

#### A) KONZERVATIVNY MODEL
```
Base: 0.25-0.35 CZK/follower
× ER Multiplier (EXCELLENT 1.4×, GOOD 1.2×, AVERAGE 1.0×, POOR 0.7×)
× Size Multiplier (500K+ 0.8×, 100-500K 0.9×, <50K 1.1×)
```

| ER Rating | Size | Priklad (100K followers) |
|-----------|------|--------------------------|
| EXCELLENT | 100K | 100K × 0.30 × 1.4 × 0.9 = 37,800 CZK |
| AVERAGE | 100K | 100K × 0.30 × 1.0 × 0.9 = 27,000 CZK |
| POOR | 50K | 50K × 0.30 × 0.7 × 1.0 = 10,500 CZK |

#### B) PREMIUM MODEL
```
Base: 0.50-0.80 CZK/follower
× Reach Bonus (3×+ reach = 1.4×, 2×+ = 1.2×, <1× = 0.8×)
× ER Bonus (EXCELLENT 1.3×, GOOD 1.15×)
× Verified Bonus (+10%)
```

| Faktor | Bonus | Vysvetlenie |
|--------|-------|-------------|
| Reach 3×+ | +40% | Viralny obsah, siaha daleko za followers |
| ER EXCELLENT | +30% | Vysoko angazovane publikum |
| Verified | +10% | Overeny ucet, vyssia doveryhodnost |

---

### 7. VIRAL POTENTIAL SCORING (v4.6)

Meri schopnost influencera vytvorit viralny obsah.

```
viralScore = (maxViews / avgViews - 1) × 2.5 + (consistency × 3)

consistency = 1 - (stdDev / avgViews)  // 0-1, vyssi = stabilnejsi

Predikce dosahu:
- Konzervativni: avgViews × 0.8
- Realisticka: avgViews
- Optimisticka: (avgViews + maxViews) / 2
```

| viralScore | Rating | Vyznam |
|------------|--------|--------|
| 0-3 | LOW | Stabilni, ale bez viral potencialu |
| 3-5 | MEDIUM | Obcasne vyssi dosah |
| 5-7 | HIGH | Caste viralni prispevky |
| 7-10 | VERY_HIGH | Viral machine, vysoka variabilita |

---

### 8. CELEBRITY PREMIUM (v4.6)

Velke ucty maji premium hodnotu - jsou brand samy o sobe.

```
Celebrity Tier      | Followers    | Multiplikator
--------------------|--------------|---------------
MEGA CELEBRITY      | 2M+          | 2.0×
TOP CELEBRITY       | 1M-2M        | 1.6×
CELEBRITY           | 500K-1M      | 1.3×
INFLUENCER          | <500K        | 1.0×
```

Premium se aplikuje na Market Value:
```
Final Market Value = Base Market Value × Celebrity Multiplier
```

---

### 9. BRAND PARTNERSHIP CLASSIFICATION (v4.6)

Rozliseni mezi placenou a organickou zmienkou.

#### Signaly placeneho partnerství:
| Signal | Typ | Priklad |
|--------|-----|---------|
| Hashtag | PAID | #ad, #sponsored, #partner, #reklama |
| Discount kod | PAID | NATY20, -10%, kod: XYZ |
| Affiliate link | PAID | link v bio, bit.ly, linktr.ee |
| BIO zmienka | LONG-TERM | ambasador, partner brand |
| Frekvence 2+ | PAID | Vice zminek stejne znacky |
| Bez signalu | ORGANIC | Zmienka bez komercnich indikátoru |

#### Commercialization Risk:
```
commercialRatio = paidPartnerships / totalBrandMentions

Risk Level:
< 30% → LOW (zdravy mix)
30-50% → MEDIUM (casto propaguje)
> 50% → HIGH (prekomercializovany)
```

---

### 10. SOURCE CREDIBILITY (v4.6)

Dulezitost zdroje informaci pro Brand Safety.

| Kredibilita | Zdroje | Vaha |
|-------------|--------|------|
| HIGH | Forbes, HN, iDnes, Aktualne, Denik N, CT24 | Plna duvera |
| MEDIUM | Refresher, Blesk, Expres, Prima | S rezervou |
| LOW | Blogy, fora, socialni site | Overit z vice zdroju |

Pravidla:
- HIGH zdroj + kontroverze = okamzita penalizace
- LOW zdroj + kontroverze = potreba overeni
- Taploidy (Blesk, Aha) = snizena vaha pro brand safety

---

### 11. CONTROVERSY SEVERITY (v4.6)

Presna klasifikace kontroverzii s casovou degradaci.

| Severity | Score | Priklady |
|----------|-------|----------|
| CRITICAL | 1-2 | Trestni stihani, extremismus, nasili |
| HIGH | 3-4 | Crypto scam, drogy, podvody, sexualni skandaly |
| MEDIUM | 5-6 | Plagiatorstvi, male podvody, stare pripady |
| LOW | 7-8 | Drobne incidenty, verejne hadky |

#### Casova degradace:
```
< 6 mesicu: plny dopad
6-12 mesicu: -1 severity level
1-3 roky: -2 severity levels
3+ roky: maximalne MEDIUM
```

#### Gossip Filter:
Vztahove drby NEJSOU kontroverze pro brand safety:
- Romaniky, randeni, rozchody
- Ruze pro nevestu, Bachelor
- "Tvori par s...", "Randí s..."

Tyto se PRESKAKUJI a neovlivnuji brand safety score.

---

### 12. FINAL SCORE

Vazeny priemer styroch komponentov:

| Komponenta | Vaha | Zdroj |
|------------|------|-------|
| Price Score | 40% | Value Ratio |
| Engagement Score | 25% | ER benchmark RATING (v5.1 — size-adjusted, nie absolútne ER) |
| Reach Score | 20% | Reach multiplier |
| Brand Safety | 15% | Web research (pri zlyhaní researchu = 5/10 + varovanie v reporte) |

Engagement Score (v5.1): EXCELLENT=10, GOOD=8, AVERAGE=6, BELOW_AVERAGE=4, POOR=2

**Recommendation:**
- ≥8.0 → STRONG BUY
- 6.5-8.0 → BUY
- 5.0-6.5 → CONSIDER
- <5.0 → PASS

---

## WEB RESEARCH (Claude)

### Co Claude vyhlada:

1. **Zakladne info** - kto to je, occupation, achievements
2. **BIO analyza** - znacky, zlavove kody, @ mentions, ambassador zmienky
3. **Captions analyza** - #ad, #sponsored, #partner v prispevkoch
4. **Aktualne spravy** - clanky z aktualneho roku
5. **Kontroverzie** - skandaly, problemy
6. **Brand partnerships z webu** - s kym spolupracuje/spolupracoval

### Kroky analyzy:
```
KROK 1: Web Search (4 queries)
  - "{meno}" - zakladne info
  - "{meno}" 2026 clanky novinky - aktualne spravy
  - "{meno}" kontroverzia OR skandal - brand safety
  - "{meno}" spolupraca OR ambassador OR reklama - partnerships

KROK 2: Analyza BIO
  - Zmienky znaciek (@ mentions)
  - Zlavove kody (kod: XYZ, code:, -10%)
  - Ambassador/partner zmienky

KROK 3: Analyza Captions
  - #ad, #sponsored, #partner, #collab, #reklama

KROK 4: Brand Partnerships z webu
  - Ambasadorstva, kampane, sponzorovane prispevky

KROK 5: Generovanie JSON vystupu
```

### Brand Safety Score:
| Score | Riziko | Priklady |
|-------|--------|----------|
| 1-2 | KRITICKE | Trestne stihani, extremismus |
| 3-4 | VYSOKE | Crypto scam, drogy, podvody |
| 5-6 | STREDNE | Mensie skandaly, stare pripady |
| 7-8 | NIZKE | Drobne incidenty |
| 9-10 | BEZPECNY | Cisty profil, zadne kontroverze |

### Gossip Filter (v4.6):
Vztahove drby se IGNORUJI - neovlivnuji brand safety:
- ❌ "Randi s ucastnici Ruze pro nevestu"
- ❌ "Rozchod s partnerem"
- ✅ "Obvineni z podvodu" (toto SE pocita)

### Source Credibility (v4.6):
Zdroje se vazi podle dulezitosti:
- **HIGH:** Forbes, HN, iDnes → plna duvera
- **MEDIUM:** Refresher, Blesk → s rezervou
- **LOW:** Blogy, fora → potreba overeni

---

## STRUKTURA PROJEKTU

```
app/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Frontend formular
│   │   └── api/
│   │       ├── report/generate/  ← Hlavny API endpoint
│   │       └── proxy-image/      ← Image proxy (CORS)
│   ├── components/
│   │   └── PDFReport.tsx         ← 3-strankovy PDF report
│   └── lib/
│       ├── apify.ts              ← Instagram scraping
│       ├── claude.ts             ← Web research + text gen
│       ├── metrics.ts            ← Vsetky vypocty
│       └── types.ts              ← TypeScript interfaces
├── .env.local                    ← API keys
└── package.json
```

---

## KONFIGURACIA

### API Keys (.env.local)
```env
APIFY_API_TOKEN=apify_api_xxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### Ziskanie API keys
1. **Apify:** https://console.apify.com → Settings → Integrations
2. **Claude:** https://console.anthropic.com → API Keys

---

## PDF REPORT OBSAH

### Strana 1: Profil & Overview
- Profilova fotka (cez proxy)
- Followers, Posts, Verified + Celebrity Tier badge (v4.6)
- Performance metriky (Max Reach, Avg Reach, ER)
- ER Benchmark (progress bar + rating)
- Audience Quality (bot detection)
- **Comment Quality (v4.7)** - generic vs meaningful ratio
- Viral Potential (viralScore, consistency) (v4.6)
- TV Shows & Eventy

### Strana 2: Engagement & Value
- TOP 8 prispevkov (engagement tabulka)
- TOP 8 Reels (graf s nazvami z captions)
- Slubene vystupy (Reels/Foto/Stories breakdown)
- Value Breakdown tabulka + Celebrity Bonus (v4.6)
- VALUE RATIO callout (MIN / AVG / MAX)
- Conversion Predictions (ak AOV zadane)
- Scenariova matica 3×3 s doporucenim

### Strana 3: Brand Safety & Verdict
- Market Value (konzervativny vs premium + celebrity bonus)
- Medialni zminky a aktuality (max 3 mesice) (v4.6)
- Risk Assessment tabulka + Commercialization Risk (v4.6)
- Kontroverzie s Severity levelem (v4.6)
- Brand Partnerships (PAID vs ORGANIC) (v4.6)
- Vhodne/Nevhodne brandy
- Final Score + Recommendation

### Jazyk reportu (v4.6)
Vsechny texty jsou v **ceskem jazyce**.

---

## TROUBLESHOOTING

| Problem | Riesenie |
|---------|----------|
| Rate limit (429) | Cakaj 1 min, auto-retry funguje |
| Profilova fotka chyba | Proxy endpoint, fallback na avatar |
| JSON parse error | App pouzije default hodnoty |
| Apify timeout | Account moze byt privatny |
| Citation tagy v texte | Automaticky sa cistia |
| Views nesedia s Instagramom | Normalne - verejne views su nižšie ako prihlásené (IG+FB kombinácia) |
| 0 deliverables nefunguje | Opravené vo v4.8 |

---

## NAKLADY

### Per Report
| Sluzba | Cena |
|--------|------|
| Apify Instagram Profile Scraper | ~$0.15 |
| Apify Instagram Reel Scraper (v4.8) | ~$0.05 |
| Apify Instagram Comments Scraper (v4.7) | ~$0.17 |
| Claude Haiku (web research) | ~$0.02-0.05 |
| **SPOLU** | **~$0.40-0.45** |

### Mesacne (100 reportov)
~$40-45/mesiac

---

## CHANGELOG

### v5.1 (Jún 2026) - AKTUÁLNA VERZIA

#### METODIKA (kalibrácia — menej optimistické skóre)
- **Total Value = max(Reach, Engagement) + Content** — odstránené dvojité počítanie
  mediálnej hodnoty (engagement je súčasťou nakúpených impressions)
- **Warm audience premium 1.5 → 1.25** (kvalita publika je už v dynamickom CPM)
- **Engagement Score z ER benchmark RATINGU** (size-adjusted) — veľké účty už nie sú
  penalizované za prirodzene nižší absolútny ER
- **Medián sa používa pre ROI VŽDY** (nie len pri high variance) — odstránený cliff
  effect na hranici avg/median = 2
- **Realistické CTR scenáre** — matica 0.5/1/2 % (Reels nemajú klikateľný link)
- **Zlyhaný web research už nie je tichý** — default brandSafetyScore je 5 (nie 7.5)
  a report zobrazí výrazné varovanie "brand safety NEPROVĚŘENA"

#### AI (Claude)
- **Model: claude-opus-4-8** (predtým rok starý claude-sonnet-4-20250514)
- **Structured outputs** namiesto regex parsovania JSON z textu:
  - research: forced tool `submit_research` (kompatibilné s web search)
  - text generation + discovery: `output_config.format` (json_schema)
- Web search tool aktualizovaný na `web_search_20260209`, adaptive thinking
- Retry rieši SDK (`maxRetries: 4`), manuálny retry loop odstránený
- SDK upgrade 0.30 → 0.104

#### INFRAŠTRUKTÚRA
- **Apify refaktor**: jeden `runApifyActor()` helper namiesto 6× kopírovaného
  polling kódu (apify.ts: 1334 → ~950 riadkov); mŕtvy kód `fetchReelViews` odstránený
- **Disková cache pre Apify** (`.cache/apify/`, TTL 7 dní) — opakovaný report toho
  istého influencera nestojí nič a je okamžitý (vypnutie: `APIFY_CACHE=off`)
- **Paralelný pipeline**: Reel views + komentáre + web research bežia naraz
  (~30-60 s úspora na report)
- **Jeden zdroj typov**: `ReportData` sa importuje z `lib/types.ts`
  (predtým 3 nezávislé, rozchádzajúce sa kópie v page.tsx a PDFReport.tsx)
- **Unit testy** výpočtového jadra (`npm test`, vitest, 19 testov)
- Opravený broken import `DiscoveryParameters` (typ doplnený do types.ts)
- Opravený 3-mesačný filter správ (v januári odfiltroval aj december)
- PDF: hardcoded Meta CPM 30K v grafe nahradený dynamickým CPM

---

### v5.0 (Apríl 2026)

#### ENGAGEMENT RATE: PRIEMER vs MEDIÁN vs TRIMMED MEAN

**Problém:** Influenceri s 1-2 virálnymi postami majú skreslený priemer ER.

**Riešenie:** Teraz počítame 3 metriky:

| Metrika | Výpočet | Použitie |
|---------|---------|----------|
| **Priemer** | Priemer ER všetkých postov | Celkový prehľad |
| **Trimmed Mean** | Priemer bez top/bottom 10% | Kompromis |
| **Medián** | Stredná hodnota ER | **ROI kalkulácie** |

**Príklad:**
```
Post ERs: 44.65%, 37.64%, 6.48%, 2.96%, 2.51%, 1.68%, 1.33%, 1.22%

Priemer:       12.31%  ← skreslený virálnymi postami
Trimmed Mean:   3.20%  ← bez extrémov (10% orez)
Medián:         2.74%  ← stredná hodnota
```

#### DETEKCIA VYSOKÉHO ROZPTYLU (High Variance)

```javascript
// Ak priemer > 2× medián → hasHighVariance = true
if (avgER / medianER > 2) {
  // Použije sa MEDIÁN pre ROI kalkulácie
  // Zobrazí sa warning v reporte
}
```

**Warning v reporte:**
```
⚠️ Vysoký rozptyl: Priemer (12.31%) je skreslený virálnymi postami.
   Pre ROI kalkulácie sa používa Medián (2.74%).
```

#### FILTER STARÝCH POSTOV (6 mesiacov)

- Posty staršie ako 6 mesiacov sú vyfiltrované z výpočtov
- Eliminuje pinnuté virálne posty ktoré skresľujú štatistiky
- V konzole sa loguje ktoré posty boli vyfiltrované

#### OPRAVA VÝPOČTU ER

**Predtým (NESPRÁVNE):**
```javascript
avgLikes = 8000
engagementRate = (avgLikes + avgComments) / followers = 2.13%
```

**Teraz (SPRÁVNE):**
```javascript
// 1. Vypočítaj ER pre KAŽDÝ post
postERs = posts.map(p => (p.likes + p.comments) / followers * 100)

// 2. Potom priemer/medián/trimmed mean z tých ERs
avgER = average(postERs)        // 12.31%
medianER = median(postERs)      // 2.74%
trimmedMeanER = trimmedMean(postERs)  // 3.20%
```

---

### v4.9 (Apríl 2026)

#### MULTI-COUNTRY SUPPORT
- **Nový dropdown: Krajina influencera** - výber z 7 krajín
  - 🇨🇿 Česko, 🇸🇰 Slovensko, 🇵🇱 Poľsko, 🇷🇴 Rumunsko
  - 🇩🇪 Nemecko, 🇮🇹 Taliansko, 🇭🇺 Maďarsko

- **Dynamický Claude prompt podľa krajiny:**
  - Vyhľadávanie v lokálnych médiách danej krajiny
  - Kľúčové slová pre kontroverzie v lokálnom jazyku
  - Kľúčové slová pre partnerstvá v lokálnom jazyku

- **Výstup zostáva v češtine** - report je vždy v CZ jazyku

---

### v4.8 (Apríl 2026)

#### PRESNÉ VIDEO VIEWS (Reel Scraper)
- **Nový Step 2/6: enrichProfileWithReelViews()** - integrácia Apify Reel Scraper
  - Profile Scraper vracia `videoViewCount` (interná metrika, nepresná)
  - Reel Scraper vracia `videoPlayCount` (skutočné views zobrazené na Instagrame)
  - Automatické zlúčenie presných views do profilu
  - ~2× presnejšie dáta o dosahu Reels

- **Prepočet všetkých závislých metrík:**
  - Total Reach (monthly, contract)
  - CPM (cost per 1000 views)
  - Conversion Predictions (clicks, sales)
  - Market Value (reach multiplier)
  - Final Score (reach component)

#### ZNÁMA LIMITÁCIA
- **Instagram zobrazuje rozdielne views podľa stavu prihlásenia:**
  - Prihlásený: kombinované Instagram + Facebook views (vyššie čísla)
  - Neprihlásený/Scraper: len Instagram views (nižšie čísla)
  - Ak influencer cross-postuje na Facebook, verejné views sú ~30-50% z prihlásených
  - Toto je zámerné správanie Instagramu, nie bug

#### OPRAVY
- **0 deliverables bug fix** - zadanie 0 stories/reels/foto teraz funguje správne
  - Predtým: `parseInt('0') || 4` → 4 (falsy value fallback)
  - Teraz: `storiesPerMonth !== '' ? parseInt(storiesPerMonth) : 4`

#### NÁKLADY
- Apify Reel Scraper: ~$0.05/report
- Celkové náklady: ~$0.40-0.45/report

---

### v4.7 (Apríl 2026)

#### COMMENT QUALITY ANALYSIS
- **Instagram Comments Scraper** - nové Apify API pre analýzu komentárov
  - Sťahuje 75 komentárov (5 top postov × 15 komentárov)
  - Detekcia generic komentárov (emoji, "Nice!", spam)
  - Detekcia meaningful komentárov (otázky, názory, 10+ slov)
  - Comment Quality Score 0-100

- **Vylepšený Bot Detection** - integrácia Comment Quality do Audience Quality
  - genericRatio > 50%: -15 bodov (boti/engagement pods)
  - meaningfulRatio > 35%: +10 bodov (reálni užívatelia)
  - Presnejšia detekcia fake engagement

#### NÁKLADY
- Apify Comments Scraper: ~$0.17/report (75 komentárov)
- Celkové náklady: ~$0.35-0.40/report

---

### v4.6 (Marec 2026)

#### PHASE 1: KRITICKE OPRAVY
- **BRAND PARTNERSHIP CLASSIFICATION** - rozlisenie PAID vs ORGANIC partnerships
  - Signaly: #ad, #sponsored, discount kody, affiliate linky, frekvencia zmienok
  - Commercialization Risk: % postov ktore su reklama (LOW/MEDIUM/HIGH)
  - Varovanie pri vysokem pomere sponzorovaneho obsahu (>40%)

- **SOURCE CREDIBILITY SYSTEM** - kredibilita medialnych zdrojov
  - HIGH: Forbes, Hospodarske noviny, iDnes, Aktualne.cz, Denik N
  - MEDIUM: Refresher, Blesk, Expres, Aha, Extra
  - LOW: Blogy, fora, nezname zdroje

- **CONTROVERSY SEVERITY MATRIX** - presna klasifikace kontroverzii
  - CRITICAL (1-2): Trestne obvineni, extremismus, nasilí
  - HIGH (3-4): Crypto scam, drogy, podvody
  - MEDIUM (5-6): Mensí skandaly, stare kontroverze
  - LOW (7-8): Drobne incidenty
  - GOSSIP FILTER: Vztahove drby (romantiky, rozchody) = NENI kontroverze

#### PHASE 2: VYLEPSENI
- **VIRAL POTENTIAL SCORING** - mereni viralniho potencialu
  - viralScore 0-10 (na zaklade max vs avg views, konzistence)
  - Predikce: konzervativni / realisticka / optimisticka
  - Rating: LOW / MEDIUM / HIGH / VERY_HIGH

- **CELEBRITY PREMIUM** - premium pro velke ucty
  - 500K-1M followers: 1.3× multiplikator
  - 1M-2M followers: 1.6× multiplikator
  - 2M+ followers: 2.0× multiplikator
  - Celebrity Tier badge v reportu

#### OSTATNI ZMENY
- **3-mesicni limit** pro medialni zminky (recentNews)
- **Cesky jazyk** v celem PDF reportu
- **20 prispevku** z Apify (misto 12) pro presnejsi data
- **5 web searches** z Claude API (misto 3) pro vice info

---

### v4.5 (Marec 2026)
- **DYNAMICKY MARKET VALUE** - konzervativny aj premium model s multiplikatormi
- Konzervativny: Base × ER Multiplier × Size Multiplier
- Premium: Base × Reach Bonus × ER Bonus × Verified Bonus
- Vysvetlenia pre kazdy multiplikator

### v4.4 (Marec 2026)
- **SCENARIOVA MATICA KONVERZII** - 9 kombinacii (3 CTR × 3 CR)
- **DYNAMICKY CTR** podla ER ratingu influencera
- Odporucany scenar zvyrazneny na zaklade engagementu
- Break-even a ROI pre kazdy scenar

### v4.3 (Marec 2026)
- **DYNAMICKE VALUE VYPOCTY** - CPM, CPE, Content Value sa menia podla kvality influencera
- Dynamicky CPM: Base 35 × ER Multiplier × Size Multiplier
- Dynamicky CPE: 1.0-2.0 CZK podla ER ratingu
- Dynamicky Content Value: podla poctu followers (7,500-13,500 CZK za Reels)
- **MIN/MAX REACH PREDIKCIA** - konzervativny vs optimisticky odhad
- **ENGAGEMENT BREAKDOWN** - ocakavane likes a comments zvlast
- Value Ratio teraz zobrazuje MIN/AVG/MAX

### v4.2 (Marec 2026)
- Rozsirena captions analyza (20 postov, 350 znakov)
- Detekcia @mentions znaciek v captionoch
- Detekcia zlavovych kodov v texte (kod: XYZ, -10%, NATY20)
- Detekcia affiliate linkov (link v bio, bit.ly, linktr.ee)
- Detekcia fraz o spolupraci (v spolupraci s, darcek od, ambasador)
- Automaticke rozlisenie paid vs unknown partnerstiev

### v4.1 (Marec 2026)
- BIO analyza na znacky a zlavove kody (@ mentions, kod: XYZ)
- Rozsireny bio limit z 300 na 500 znakov
- 5-krokova analyza (web search, bio, captions, partnerships, output)

### v4.0 (Marec 2026)
- Deliverables input (Reels/Foto/Stories per month)
- Value Breakdown pocita s realnymi vystupmi
- Realisticka cena Reels produkcie (7,500 CZK vs 12K) pre kritickejsie hodnotenie
- ER Benchmark s vizualnym progress barom
- Bot Detection / Audience Quality estimate
- Brand Partnerships z webu (ambassador, kampane)
- Conversion Predictions (ak AOV zadane)
- Citation tags auto-cleaning
- Vylepseny Claude prompt pre lepsie vysledky

### v3.0 (Marec 2026)
- Webova aplikacia (Next.js)
- Automaticky Instagram scraping (Apify)
- AI web research (Claude Haiku)
- Value Breakdown model
- Image proxy pre CORS

### v2.0
- Manualny workflow s Claude Code

### v1.0
- Manualne reporty v Google Docs

---

## QUICK START

```bash
# 1. Instalacia
cd "/Users/robertdufala/Desktop/Influencer Report Generator/app"
npm install

# 2. Konfiguracia
# Vytvor .env.local s API keys

# 3. Spustenie
PORT=3001 npm run dev

# 4. Otvor prehliadac
open http://localhost:3001
```

---

*NiftyMinds.cz | Influencer Marketing Intelligence*
*Verzia: 5.1 | Last Updated: 12. jún 2026*
