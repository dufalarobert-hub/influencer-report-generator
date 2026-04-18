# Claude API - Influencer Marketing Analýza a Odporúčania

## 1. WEB SEARCH STRATÉGIA

### Aktuálne problémy:
- **Príliš špecifické site: queries**: `site:idnes.cz OR site:blesk.cz` môžu vynechať dôležité zdroje
- **Chýbajúce sociálne médiá**: Instagram, TikTok, LinkedIn nie sú v search stratégii
- **Slabá detekcia brand partnerships**: Nedostatočná analýza organických vs. platených spolupráci

### Odporúčania:

#### A) Vylepšená search stratégia:
```javascript
// KROK 1 - Základné info (česko-slovenské médiá)
"${safeName}" (rozhovor OR interview OR profil) ${currentYear}

// KROK 2 - Brand safety (široké vyhľadávanie)
"${safeName}" (kontroverzia OR škandál OR kritika OR problém OR súd OR obvinenie)

// KROK 3 - Brand partnerships (kombinácia zdrojov)
"${safeName}" (spolupráca OR ambasádor OR partner OR kampaň OR reklama)
"${username}" brand deal partnership sponsored

// KROK 4 - Médiá podľa typu influencera
// Pre CZ/SK: Refresher, Forbes CZ/SK, Marketing Journal, HN
// Pre beauty: Czechcrunch, Elle, Marie Claire
// Pre tech: Lupa.cz, Živě.cz
```

#### B) Contextualizované vyhľadávanie podľa kategórie:
```javascript
const searchMediaByCategory = {
  'Beauty': ['elle.cz', 'marieclaire.cz', 'refresher.sk'],
  'Tech': ['lupa.cz', 'zive.cz', 'technet.cz'],
  'Lifestyle': ['forbes.cz', 'refinery29.cz', 'blesk.cz'],
  'Sport': ['isport.cz', 'sport.cz', 'sportnet.cz'],
  'Business': ['forbes.cz', 'hn.cz', 'e15.cz']
}
```

## 2. BRAND PARTNERSHIPS DETEKCIA

### Aktuálne problémy:
- Správne analyzujete bio a captions
- Ale: **Nedokážete rozlíšiť organický vs. platený mention**
- Chýba: **Analýza frekvencie spolupráce** (overcommercialization risk)
- Chýba: **Competitor brand detection**

### Kritické odporúčanie - Brand Analysis Framework:

```typescript
interface BrandPartnershipAnalysis {
  // Existujúce
  brandName: string
  type: 'paid' | 'organic' | 'unknown'

  // NOVÉ - kritické pre decision-making
  frequency: number               // Koľkokrát sa brand objavil
  firstSeen: string              // Dátum prvej zmienky
  lastSeen: string               // Dátum poslednej zmienky
  isLongTerm: boolean            // >3 mesiace = dlhodobé partnerstvo
  commercializationLevel: 'LOW' | 'MEDIUM' | 'HIGH'  // % platených postov

  // Signály pre klasifikáciu
  signals: {
    hasHashtag: boolean          // #ad, #sponsored
    hasDiscountCode: boolean     // -20%, KODNATY
    hasAffiliateLink: boolean    // link v bio
    bioMention: boolean          // V bio (= silnejšie partnerstvo)
    frequency: number            // Počet zmienok
  }
}
```

### Algoritmus pre type klasifikáciu:
```javascript
function classifyPartnership(signals) {
  // PAID - jasné signály
  if (signals.hasHashtag ||
      (signals.hasDiscountCode && signals.frequency > 1) ||
      signals.bioMention) {
    return 'paid'
  }

  // ORGANIC - občasné zmienky bez monetizácie
  if (signals.frequency === 1 &&
      !signals.hasDiscountCode &&
      !signals.hasHashtag) {
    return 'organic'
  }

  return 'unknown'
}
```

## 3. BRAND SAFETY - Severity Classification

### Aktuálny problém:
Máte severity levels (HIGH/MEDIUM/LOW) ale **chýba presná klasifikácia**

### Industry-standard severity framework:

```typescript
const BRAND_SAFETY_MATRIX = {
  // CRITICAL (1-2 score) - Deal breaker
  CRITICAL: [
    'Trestné obvinenie',
    'Sexuálne obvinenia',
    'Extrémizmus, rasizmus',
    'Podpora násilia',
    'Aktívny súdny spor'
  ],

  // HIGH (3-4 score) - High risk
  HIGH: [
    'Crypto scam',
    'Klamlivá reklama (dokázaná)',
    'Drogy (nie liečebné)',
    'OnlyFans/adult content',
    'Gambling propagácia',
    'Politická kontroverzia (extrém)'
  ],

  // MEDIUM (5-6 score) - Riešiteľné
  MEDIUM: [
    'Menší škandál (napr. hádka)',
    'Negativné PR (dočasné)',
    'Kritika od fanúšikov',
    'Staré kontroverzie (>3 roky, vyriešené)'
  ],

  // LOW (7-8 score) - Minor
  LOW: [
    'Drobné incidenty',
    'Neoverené fámy',
    'Subjektívna kritika'
  ],

  // SAFE (9-10 score)
  SAFE: [
    'Žiadne nálezy',
    'Pozitívne PR only',
    'Overená čistá história'
  ]
}
```

## 4. MEDIÁLNE ZMIENKY - Kvalita vs. Kvantita

### Aktuálny problém:
Prompt správne odporúča nezapisovať "odfotil sa s..." ale **chýba klasifikácia dôležitosti**

### Tier systém pre mediálne zmienky:

```typescript
const MEDIA_TIER_SYSTEM = {
  // TIER 1 - Premium (najvyššia hodnota pre brand)
  tier1: {
    outlets: ['Forbes', 'HN', 'Ekonom', 'Wall Street Journal'],
    types: ['Cover story', 'Feature interview', 'Expert quote'],
    value: 'HIGH'
  },

  // TIER 2 - Mainstream
  tier2: {
    outlets: ['Refresher', 'iDnes', 'Blesk', 'Aktuálně'],
    types: ['Rozhovor', 'Profil', 'Top 30 pod 30'],
    value: 'MEDIUM'
  },

  // TIER 3 - Niche/Blogs
  tier3: {
    outlets: ['Personal blogs', 'Small podcasts'],
    types: ['Guest appearance', 'Mention'],
    value: 'LOW'
  }
}
```

**Odporúčanie**: Ukladajte tier level k mediálnym zmienky:
```typescript
mediaAppearances: {
  tier1Articles: string[]  // Forbes rozhovor
  tier2Articles: string[]  // Refresher profil
  tier3Articles: string[]  // Blog mention
}
```

## 5. PROMPT OPTIMALIZÁCIA PRE CZ/SK INFLUENCEROV

### Aktuálne dobre:
- Jazyk vyhľadávania (CZ/SK)
- Lokálne médiá

### Chýba:

#### A) Platform-specific search:
```javascript
// Instagram pre vizuály
"${username}" Instagram collaboration brand

// TikTok pre younger demographics
"${username}" TikTok sponsored viral

// YouTube pre long-form
"${username}" YouTube partnership deal
```

#### B) Competitor intelligence:
```javascript
// Kto ešte robí s týmito značkami?
"ambasádor" "${competitorBrand}" instagram cesko

// Industry benchmarking
"${category}" influencer marketing "cz" OR "sk" case study
```

#### C) Audience sentiment:
```javascript
// Co hovoria fanúšikovia?
"${username}" "fake" OR "bot" OR "kúpené likes"  // Red flags
"${username}" "authentic" OR "genuine" OR "love"  // Green flags
```

## 6. OVEROVANIE INFORMÁCIÍ - Source Credibility

### Aktuálny problém:
Prompt hovorí "100% overené" ale **nedefinuje čo je dôveryhodný zdroj**

### Source credibility framework:

```typescript
const SOURCE_CREDIBILITY = {
  // HIGH credibility (1.0)
  high: [
    'Overené oficiálne médiá (Forbes, HN, iDnes)',
    'Súdne dokumenty',
    'Oficiálne vyhlásenia značiek',
    'Instagram verifikované účty (blue check)'
  ],

  // MEDIUM credibility (0.7)
  medium: [
    'Blog články s citáciami',
    'Industry reports',
    'Neoverené sociálne médiá (ale s dôkazmi)'
  ],

  // LOW credibility (0.3)
  low: [
    'Fóra, komentáre',
    'Anonymné zdroje',
    'Tabloid špekulácie'
  ]
}
```

**Odporúčanie**: Pridajte `confidence` level ku každej informácii:
```typescript
partnerInfo?: {
  value: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source: string
}
```

## 7. KONTROVERZIE - Temporal Context

### Chýba:
- **Časová línia kontroverzií** (je to aktuálne alebo staré?)
- **Resolved status** (implementované ale nevyužíva sa správne)
- **Impact assessment** (ako to ovplyvnilo influencera?)

### Odporúčaný formát:
```typescript
controversies: {
  found: boolean
  items: Array<{
    description: string
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    date: string  // YYYY-MM
    resolved: boolean
    resolution?: string  // Ako to bolo vyriešené?
    impact: {
      followersLost?: number
      brandsLost: string[]
      publicApology: boolean
    }
    source: string
    credibility: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE'
}
```

## 8. ROI PREDICTIONS - Missing Piece

### Čo v research chýba:
- **Past campaign performance** (ak sú verejné)
- **Industry benchmarks** pre podobných influencerov
- **Audience demographics** (vek, pohlavie, lokácia)

### Odporúčanie - web search pre:
```javascript
// Case studies
"${safeName}" kampan vysledky metrics ROI results

// Competitor benchmarks
"${category}" influencer "engagement rate" "conversion rate" benchmark

// Audience insights (ak sú verejné)
"${username}" audience demographics analytics
```

---

## PRIORITY AKCIE (Sorted by Impact)

### 🔴 CRITICAL (Implementujte ASAP):
1. **Brand partnership classification logic** - rozlíšenie paid vs organic
2. **Source credibility system** - vyhne sa fake news
3. **Controversy severity matrix** - presná klasifikácia rizík

### 🟡 HIGH PRIORITY:
4. **Media tier system** - kvalitatívne hodnotenie press coverage
5. **Temporal context** pre kontroverzie - kedy to bolo?
6. **Frequency analysis** pre brand mentions - overcommercialization detection

### 🟢 MEDIUM PRIORITY:
7. Competitor intelligence search
8. Platform-specific search (Instagram, TikTok)
9. Audience sentiment analysis

---

## TESTOVANIE

### Testovacie prípady pre validáciu:
1. **Influencer s kontroverziou** (napr. Eva Burešová - Love Island)
2. **Overcommercialized influencer** (10+ brand partnerships)
3. **Micro influencer** (10-50K) so silným engagement
4. **Celebrity** (500K+) s nízkou autenticitou

### Metriky úspešnosti:
- Brand partnerships: >90% accuracy na klasifikáciu paid vs organic
- Controversies: 100% detection rate na HIGH severity
- Media mentions: Tier classification presnosť >85%
- Source credibility: 0% false positives na critical info
