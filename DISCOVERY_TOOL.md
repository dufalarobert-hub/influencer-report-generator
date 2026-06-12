# Influencer Discovery Tool

## Prehľad

Druhá záložka v Influencer Report Generator aplikácii. Umožňuje vyhľadávať influencerov pomocou natural language popisu.

**Verzia:** 1.0 (plánovaná)
**Stav:** V príprave
**Posledná aktualizácia:** 2025-01-XX

---

## Dva nezávislé nástroje

| Tab | Názov | Účel |
|-----|-------|------|
| 1 | Analýza Influencera | Detailný report konkrétneho influencera |
| 2 | Hľadanie Influencerov | Nájsť influencerov podľa kritérií |

Záložky sú **úplne oddelené** - žiadne automatické prepojenie. Ak chce užívateľ report pre nájdeného influencera, manuálne skopíruje username do Tab 1.

---

## Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│  UŽÍVATEĽ                                                   │
│  "Hľadám fitness influencerku v ČR, 50-150k followers"     │
│  Krajina: [CZ]                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE API (Haiku 4.5)                                     │
│  Extrakcia parametrov z natural language                    │
│                                                             │
│  Output:                                                    │
│  {                                                          │
│    "hashtags": ["fitnesscz", "zdravestravovani"],          │
│    "category": "Fitness & Health",                          │
│    "followersMin": 50000,                                   │
│    "followersMax": 150000,                                  │
│    "keywords": ["žena", "fitness"]                          │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  APIFY HASHTAG SCRAPER                                      │
│  Actor: apify/instagram-hashtag-scraper                     │
│                                                             │
│  Input: hashtags[], resultsLimit                            │
│  Output: posts[] s username, likes, comments                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  DEDUPLIKÁCIA                                               │
│  Extrahovať unikátne usernames z postov                     │
│  Filtrovať podľa followersRange (ak dostupné)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  APIFY PROFILE SCRAPER                                      │
│  Actor: apify/instagram-profile-scraper                     │
│                                                             │
│  Input: usernames[]                                         │
│  Output: profiles[] s followers, ER, posts                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  VÝPOČET METRÍK                                             │
│  - Engagement Rate (median)                                 │
│  - Audience Quality Score                                   │
│  - Relevance Score                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  VÝSLEDKY                                                   │
│  Grid 20 influencerov s metrikami                          │
│  Zoradené podľa Relevance Score                            │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Design

### Vstupný formulár

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 HĽADANIE INFLUENCEROV                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Popíšte koho hľadáte:                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Fitness influencerka v Česku, 50-150k followers,          │ │
│  │ zdravé stravovanie, cvičenie doma. Pre klienta čo         │ │
│  │ predáva proteínové tyčinky.                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│  287/500 znakov                                                │
│                                                                 │
│  Krajina:  [🇨🇿 Česko ▼]                                        │
│                                                                 │
│  [🔍 Hľadať]                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Výsledky

```
┌─────────────────────────────────────────────────────────────────┐
│  Nájdených: 20 influencerov                    [Nové hľadanie]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   [foto]     │ │   [foto]     │ │   [foto]     │            │
│  │  @user1      │ │  @user2      │ │  @user3      │            │
│  │  Fitness     │ │  Fitness     │ │  Lifestyle   │            │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤            │
│  │ 125K follow. │ │ 89K follow.  │ │ 156K follow. │            │
│  │ ER: 4.2%     │ │ ER: 5.1%     │ │ ER: 3.2%     │            │
│  │ Views: 45K   │ │ Views: 32K   │ │ Views: 58K   │            │
│  │ Quality: 85% │ │ Quality: 91% │ │ Quality: 78% │            │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤            │
│  │ ⭐ 8.5/10    │ │ ⭐ 9.2/10    │ │ ⭐ 7.8/10    │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
│  (Kliknutím na kartu sa otvorí Instagram profil)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Metriky zobrazené vo výsledkoch

| Metrika | Popis | Zdroj |
|---------|-------|-------|
| **Followers** | Počet sledovateľov | Apify Profile |
| **ER (Median)** | Engagement Rate | Vlastný výpočet |
| **Avg Views** | Priemerné views na Reels | Apify Profile |
| **Quality** | Audience Quality Score (% reálnych followerov) | Vlastný výpočet |
| **Score** | Celkové hodnotenie (Relevance Score) | Vlastný výpočet |

### Relevance Score výpočet

```typescript
relevanceScore =
  (erScore × 0.35) +           // ER benchmark (POOR/AVG/GOOD/EXCELLENT)
  (audienceQuality × 0.25) +   // % reálnych followerov
  (brandSafety × 0.20) +       // Brand safety score /10
  (hashtagMatch × 0.10) +      // Koľko hashtagov matchlo
  (recentActivity × 0.10)      // Posledný post < 14 dní = 1.0
```

---

## Konfigurácia - Dev vs Production

```typescript
const DISCOVERY_CONFIG = {
  development: {
    hashtagPostsLimit: 50,      // Počet postov z hashtagov
    profilesToAnalyze: 2,       // Počet profilov na analýzu
    resultsToShow: 2,           // Počet zobrazených výsledkov
    hashtagsToUse: 2,           // Počet hashtagov na search
  },
  production: {
    hashtagPostsLimit: 500,
    profilesToAnalyze: 30,
    resultsToShow: 20,
    hashtagsToUse: 5,
  }
}
```

### Environment variable

```env
# .env.local
DISCOVERY_MODE=development  # alebo "production"
```

---

## Náklady

### Development mode (~$0.45 za search)

| Služba | Počet | Cena |
|--------|-------|------|
| Claude Haiku (extrakcia) | 1 call | $0.002 |
| Hashtag Scraper | 50 postov | $0.13 |
| Profile Scraper | 2 profily | $0.30 |
| **CELKOM** | | **~$0.45** |

### Production mode (~$5.80 za search)

| Služba | Počet | Cena |
|--------|-------|------|
| Claude Haiku (extrakcia) | 1 call | $0.002 |
| Hashtag Scraper | 500 postov | $1.30 |
| Profile Scraper | 30 profilov | $4.50 |
| **CELKOM** | | **~$5.80** |

### Apify cenník

| Plán | Hashtag Scraper | Profile Scraper |
|------|-----------------|-----------------|
| Free | $2.60/1000 postov | ~$0.15/profil |
| Starter | $2.30/1000 postov | ~$0.13/profil |

---

## Podporované krajiny

Rovnaké ako v existujúcom Report Generator:

| Kód | Krajina | Jazyk hashtagov |
|-----|---------|-----------------|
| CZ | Česko | čeština |
| SK | Slovensko | slovenčina |
| PL | Poľsko | poľština |
| DE | Nemecko | nemčina |
| IT | Taliansko | taliančina |
| RO | Rumunsko | rumunčina |
| HU | Maďarsko | maďarčina |

Claude generuje hashtags v správnom jazyku podľa vybranej krajiny.

---

## Claude Parameter Extraction

### Prompt štruktúra

```
Analyzuj nasledujúci popis a extrahuj parametre pre vyhľadávanie influencerov.

POPIS: "{userQuery}"
KRAJINA: {country}

Vráť JSON s týmito poľami:
- hashtags: 3-5 relevantných hashtagov v jazyku krajiny (bez #)
- category: kategória z [Sport, Lifestyle, Beauty & Fashion, ...]
- followersMin: minimálny počet followerov (number)
- followersMax: maximálny počet followerov (number)
- keywords: kľúčové slová z popisu
- contentType: typ obsahu (lifestyle/educational/entertainment)
- targetGender: pohlavie influencera ak špecifikované (male/female/any)
```

### Príklad extrakcie

**Input:**
```
"Hľadám fitness influencerku v Česku, 50-150k followers, zdravé stravovanie"
Krajina: CZ
```

**Output:**
```json
{
  "hashtags": ["fitnesscz", "zdravestravovani", "cviceni", "fitnessmotivation", "zdravyzivotnistyl"],
  "category": "Sport",
  "followersMin": 50000,
  "followersMax": 150000,
  "keywords": ["fitness", "zdravé stravovanie"],
  "contentType": "lifestyle",
  "targetGender": "female"
}
```

---

## Súbory na vytvorenie/upravenie

### Nové súbory

| Súbor | Účel |
|-------|------|
| `app/src/app/api/discovery/route.ts` | API endpoint pre discovery |
| `app/src/components/DiscoveryForm.tsx` | Formulár pre vyhľadávanie |
| `app/src/components/DiscoveryResults.tsx` | Grid s výsledkami |
| `app/src/components/DiscoveryCard.tsx` | Karta jedného influencera |

### Upravené súbory

| Súbor | Zmeny |
|-------|-------|
| `app/src/app/page.tsx` | Pridať tab navigáciu |
| `app/src/lib/apify.ts` | Pridať `fetchHashtagPosts()` |
| `app/src/lib/claude.ts` | Pridať `extractDiscoveryParameters()` |
| `app/src/lib/types.ts` | Pridať Discovery typy |

---

## Roadmap

### v1.0 (MVP)

- [x] Natural language input (500 znakov)
- [x] Výber krajiny
- [x] Claude extrakcia parametrov
- [x] Hashtag scraping
- [x] Profile scraping
- [x] Výpočet základných metrík
- [x] Grid zobrazenie výsledkov
- [x] Dev/Production konfigurácia

### v1.1 (Vylepšenia)

- [ ] **Hybrid input** - po extrakcii ukázať parametre, user môže upraviť
- [ ] **Sort výsledkov** - podľa followers, ER, score
- [ ] **Filter výsledkov** - dodatočné filtrovanie po načítaní
- [ ] **Preview posledného postu** - thumbnail v karte
- [ ] **Export CSV** - export výsledkov pre agentúry

### v1.2 (Pokročilé)

- [ ] **"Similar to @username"** - nájdi podobných influencerov
- [ ] **Compare mode** - porovnanie 2-3 influencerov side-by-side
- [ ] **Save search** - uložiť vyhľadávanie na neskôr
- [ ] **Hashtag suggestions** - Claude navrhne ďalšie hashtags

### v2.0 (Budúcnosť)

- [ ] **Cache profilov** - 7-dňová cache na zníženie nákladov
- [ ] **Zvýšenie limitov** - 50+ profilov, 1000+ postov
- [ ] **Brand affinity detection** - s akými značkami spolupracujú
- [ ] **Lookalike audiences** - nájdi influencerov s podobným publikom
- [ ] **Prepojenie s Tab 1** - tlačidlo "Generovať Report" priamo v karte

---

## Porovnanie s konkurenciou

| Funkcia | Náš nástroj | HypeAuditor | Modash |
|---------|-------------|-------------|--------|
| Cena | ~$6/search | $299/mesiac | $299/mesiac |
| Natural language | ✅ | ❌ | ✅ (AI) |
| Audience demographics | ❌ | ✅ | ✅ |
| Fake followers detection | ✅ | ✅ | ✅ |
| Brand safety | ✅ | ✅ | ❌ |
| Lokálne hashtags (CZ/SK) | ✅ | ⚠️ | ⚠️ |
| Report generation | ✅ (Tab 1) | ✅ | ✅ |

### Naša konkurenčná výhoda

1. **10x lacnejšie** pri nízkom objeme (<50 searches/mesiac)
2. **Lokálna expertíza** - hashtags v CZ/SK jazykoch
3. **Brand safety + controversy detection** - máme v reporte
4. **Kombinácia Discovery + Deep Report** - dva nástroje v jednom

### Naša slabina

1. **Žiadne audience demographics** - nevieme vek/pohlavie publika
2. **Pomalšie** - scraping trvá dlhšie ako indexed databáza
3. **Limitovaný scale** - pri vysokom objeme drahšie ako subscription

---

## Technické poznámky

### Rate limiting

- Apify: Bez explicitného limitu, ale dlhšie čakanie pri vysokej záťaži
- Claude: 1000 requests/minútu (Haiku)

### Error handling

```typescript
// Ak hashtag scraper nájde 0 postov
if (posts.length === 0) {
  return { error: "Nenašli sa žiadne posty. Skúste iné kľúčové slová." }
}

// Ak profile scraper zlyhá
if (profiles.length < minRequired) {
  return {
    partial: true,
    profiles: profiles,
    message: "Našli sme menej profilov ako očakávané."
  }
}
```

### Timeout handling

| Operácia | Timeout |
|----------|---------|
| Claude extraction | 30s |
| Hashtag scraping | 3 min |
| Profile scraping (per batch) | 2 min |
| Celkový request | 10 min |

---

## Changelog

### 2025-01-XX - Initial design
- Definícia architektúry
- UI mockupy
- Cenová kalkulácia
- Roadmap v1.0 - v2.0
