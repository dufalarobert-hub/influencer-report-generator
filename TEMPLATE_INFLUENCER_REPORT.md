# 📊 NiftyMinds - Influencer Report Template

**Verzia:** 2.0
**Dátum:** 12. marec 2026
**Vzorový report:** `Rousal_Influencer_Analysis.pdf`

---

## 🎯 ÚČEL TOHTO DOKUMENTU

Tento dokument slúži ako **kompletný návod** pre vytvorenie profesionálneho influencer marketing reportu v PDF formáte.

**Vzorový gold standard:** Radek "Ruchy" Roušal report v tejto zložke.

Každý nový report musí byť **1:1 rovnaký** ako vzorový - rovnaká štruktúra, farby, grafy, metriky.

---

## 📁 ŠTRUKTÚRA ZLOŽIEK

```
Influencer Report Generator/
├── README.md                              ← Quick start workflow
├── TEMPLATE_INFLUENCER_REPORT.md          ← Tento dokument (kompletný návod)
├── VZOROVY_REPORT_Rousal.pdf              ← VZOROVÝ PDF (gold standard)
├── TEMPLATE_report.html                   ← HTML šablóna
│
└── analyzy/                               ← Všetky influencer reporty
    ├── Roušal/                            ← Referenčný influencer
    │   ├── screenshots/
    │   │   ├── profile.png
    │   │   ├── grid.png
    │   │   ├── engagement_1.png
    │   │   └── engagement_2.png
    │   ├── Rousal_Influencer_Analysis.pdf
    │   └── rousal_final.html
    │
    ├── [Influencer 2]/                    ← Nová podzložka pre každého
    │   ├── screenshots/
    │   │   ├── profile.png
    │   │   ├── grid.png
    │   │   └── engagement_*.png
    │   └── [Meno]_Report.pdf
    │
    └── ...
```

---

## 🚀 WORKFLOW - Krok za krokom

### **PRÍPRAVA (User):**

1. **Vytvor podzložku** pre influencera:
   ```
   Analyza influencerov/[Meno Influencera]/
   ```

2. **Vytvor podsložku screenshots:**
   ```
   Analyza influencerov/[Meno]/screenshots/
   ```

3. **Pridaj screenshots:**
   - `profile.png` - Screenshot IG profilu (followers, posts, verified badge)
   - `grid.png` - Screenshot content gridu (9-12 príspevkov)
   - `engagement_1.png`, `engagement_2.png`, ... - Screenshots jednotlivých príspevkov s likes/comments

4. **Otvor nový Claude Code session** v zložke influencera

5. **Povieš Claudovi:**
   ```
   Prečítaj si /Users/robertdufala/Desktop/Analyza influencerov/TEMPLATE_INFLUENCER_REPORT.md
   a vygeneruj mi presne taký istý influencer report ako je vzorový
   Rousal_Influencer_Analysis.pdf, ale pre influencera [MENO].

   Screenshots sú v ./screenshots/

   Základné info:
   - Meno: [MENO]
   - Instagram: @[HANDLE]
   - Kategória: [KATEGORIA]
   - Ponúkaná cena: [CENA] CZK/mesiac
   - Followers: [POČET]
   - Top Reels views: [ČÍSLA]
   - Engagement (4 príspevky): [LIKES + COMMENTS]
   ```

### **GENEROVANIE (Claude):**

Claude automaticky:
1. Prečíta tento template
2. Pozrie vzorový Roušal PDF
3. Urobí web research (kontroverzie, background)
4. Vypočíta všetky metriky
5. Vygeneruje HTML
6. Vytvorí 3-stranové PDF
7. Uloží do zložky influencera

---

## 📋 VSTUPNÉ DÁTA (čo User poskytne)

### **1. ZÁKLADNÉ INFO**
- **Meno influencera:** (napr. "Jana Nováková")
- **Prezývka:** (optional, napr. "JayKay")
- **Instagram handle:** (napr. "@jana.fitness")
- **Kategória:** Sport / Lifestyle / Beauty / Tech / Food / Travel / Fitness / Entertainment / Business
- **Bio text:** (skopírovaný z IG profilu)

### **2. SCREENSHOTS** (v ./screenshots/)
- **profile.png** - profil s follower count, posts count, verified badge
- **grid.png** - grid 9-12 posledných príspevkov
- **engagement_1.png, engagement_2.png, ...** - jednotlivé príspevky s likes/comments

### **3. PERFORMANCE ČÍSLA**
- **Followers:** (napr. 125000)
- **Posts count:** (napr. 599)
- **Verified:** Áno/Nie
- **Top 4-8 Reels views:** (napr. 2000000, 1500000, 1200000, 1000000)
- **4 príspevky engagement:**
  - Post 1: [typ obsahu], [likes], [comments]
  - Post 2: [typ obsahu], [likes], [comments]
  - Post 3: [typ obsahu], [likes], [comments]
  - Post 4: [typ obsahu], [likes], [comments]

### **4. BUSINESS ÚDAJE**
- **Ponúkaná cena:** (CZK/mesiac)
- **Dĺžka kontraktu:** (mesiace, default: 6)
- **Client/značka:** (optional)

---

## 🤖 AUTOMATICKÉ VÝPOČTY (Claude)

Claude musí vypočítať:

### **Engagement Metrics:**
```
Avg Likes = sum(post_likes) / count(posts)
Avg Comments = sum(post_comments) / count(posts)
Engagement Rate (ER) = ((avg_likes + avg_comments) / followers) × 100
```

### **Reach Metrics:**
```
Avg Reel Views = sum(reel_views) / count(reels)
Max Reel Views = max(reel_views)
Reach Multiplier = avg_reel_views / followers
```

### **Market Value:**

**Konzervatívny model:**
```
Low = followers × 0.28 CZK
High = followers × 0.40 CZK
```

**Premium model** (ak reach multiplier > 3):
```
Low = followers × 0.80 CZK
High = followers × 1.20 CZK
```

### **CPM & ROI:**
```
Meta Ads CPM = 30 CZK (fix)
Influencer CPM = (offered_price / avg_reel_views) × 1000
Total Contract Value = offered_price × contract_months
Meta Ads Cost = (avg_reel_views × contract_months / 1000) × 30
Savings % = ((meta_cost - total_contract) / meta_cost) × 100
```

### **Final Score (1-10):**
```
Price Score = min(10, (market_value_high / offered_price) × 3)
Engagement Score = min(10, engagement_rate × 2)
Reach Score = min(10, reach_multiplier × 2)
Brand Safety Score = 8.0 (default, upraviť podľa research)

Final Score = (Price × 40%) + (Engagement × 30%) + (Reach × 20%) + (Brand Safety × 10%)
```

### **Odporúčanie:**
```
≥ 8.0  → STRONG BUY 🟢
≥ 6.5  → BUY 🟡
≥ 5.0  → CONSIDER 🟠
< 5.0  → PASS 🔴
```

---

## 📄 ŠTRUKTÚRA PDF REPORTU (3 strany)

### **STRANA 1: Profil & Overview**

**Header:**
- Logo: "nifty — minds"
- Subtitle: "Influencer Marketing Intelligence"
- Dátum

**Hero sekcia:**
- H1: Meno influencera (+ prezývka ak má)
- Subtitle: @handle | Kategória Influencer
- Veľká profilová fotka (250px)
- Stats box: Followers / Posts / Verified

**Performance Overview:**
- 3 metric boxy:
  - Max Reach (virálne)
  - Avg Reach (štandard)
  - Engagement Rate (%)
- Callout: "🔥 EXTREME VIRALITY: [X]× vyšší reach než follower base"
- Content grid screenshot

**Footer:** "nifty — minds | Strana 1/3"

---

### **STRANA 2: Engagement & Financie**

**Engagement Analýza:**
- Tabuľka 4 príspevkov:
  | Typ obsahu | Likes | Comments | ER |
- Priemer row (zvýraznený)

**Top Reels Performance:**
- Bar chart (Chart.js)
- X-axis: #1, #2, #3, ...
- Y-axis: Počet videní

**Finančné Porovnanie:**
- Bar chart (Chart.js)
- Porovnanie: Meta 1M, Influencer 1M, Meta Total, Influencer Total

**ROI Callout:**
- "90 000 CZK vs. Meta Ads (450 000 CZK) = 80% ÚSPORA"

**Cost boxes:**
- Grid 2 stĺpce:
  - Meta Ads: CPM, 1M cost, Engagement
  - Influencer: CPM, 1M cost, Engagement

**Footer:** "nifty — minds | Strana 2/3"

---

### **STRANA 3: Market Value & Verdikt**

**Market Value:**
- Tabuľka 2 stĺpce:
  1. Model | Cena/mes. | Status
     - Konzervatívny: 35-50K
     - Premium: 100-150K
     - **Ponuka: 15K** (-70%)

  2. Riziko | Level
     - Historická kontroverzia: VYSOKÉ/NÍZKE
     - Aktuálne správanie: NÍZKE
     - Mediálna prezentácia: POZ.

**Kontext kontroverzie** (ak existuje):
- Žltý warning box s popisom

**Vhodné/Nevhodné brandy:**
- Grid 2 stĺpce:
  - ✓ Vhodné pre: [zoznam]
  - ✗ Nevhodné pre: [zoznam]

**Final Verdict:**
- Veľký box:
  - Score: "8.65/10"
  - Text: "STRONG BUY – s brand safety mitigation"

**Odporúčanie callout:**
- Blue box s konkrétnym odporúčaním + podmienkami

**Footer:** "Sources: [zdroje] | Prepared by: Senior Influencer Marketing Manager | Strana 3/3"

---

## 🎨 DESIGN SPECS

### **Farby (NiftyMinds branding):**
```css
Primary: #3333FF (electric blue)
Background: #F5F5F5 (light grey)
Text: #000000 (black)
Secondary text: #666666
Borders: #E0E0E0

Risk colors:
- HIGH: #ef4444 (red)
- MEDIUM: #f59e0b (orange)
- LOW: #10b981 (green)
```

### **Typografia:**
```css
Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif

H1: 34px, bold, uppercase, #3333FF
H2: 15px, bold, uppercase, #3333FF, letter-spacing: 0.5px
H3: 11px, semi-bold, #000
Body: 9.5px, #333

Logo: 18px, bold, "nifty — minds"
```

### **Spacing:**
```css
Page padding: 13mm
Margins between sections: 2-3mm
Box padding: 3-4mm
```

### **Components:**
- **Metric box:** White bg, 2px #3333FF border, rounded 6px
- **Callout:** #3333FF bg, white text, rounded 6px
- **Table:** White bg, #3333FF headers, hover effect
- **Chart:** Chart.js, 50mm height, #3333FF bars
- **Verdict box:** White bg, 3px #3333FF border, centered

---

## 🔍 WEB RESEARCH (Claude automaticky)

Claude musí vyhľadať:

### **1. Background Info:**
- Wikipedia (SK/EN)
- Google News
- Články o influencerovi

### **2. Brand Safety Check:**
Vyhľadaj kontroverzie:
- "[meno] kontroverzia"
- "[meno] škandál"
- "[meno] problém"
- "[meno] ban"
- "[meno] suspended"

Ak nájdeš:
- Zapíš do yellow warning boxu na strane 3
- Uprav Brand Safety Score (napr. z 8.0 na 6.0)
- Uprav Final Score

### **3. Partner/Relationship Info:**
Ak má partnera/partnerku (v bio alebo z research):
- Zapíš do profilu
- Poznač ak partner má veľký reach (collaboration potential)

### **4. Achievements:**
Zisti:
- Tituly (šampión, víťaz...)
- Spolupráce (značky)
- Media appearances

---

## 📊 VHODNÉ/NEVHODNÉ BRANDY (podľa kategórie)

### **Sport:**
✓ Vhodné: Športové značky, Energy drinks, Fitness zariadenia, Športová výživa
✗ Nevhodné: Beauty produkty, Baby produkty, Luxusné móda, Fine dining

### **Lifestyle:**
✓ Vhodné: Fashion brands, Automotive, Travel, Lifestyle produkty
✗ Nevhodné: B2B software, Industrial, Farmaceutiká, Finance (conservative)

### **Beauty:**
✓ Vhodné: Kozmetika, Fashion, Wellness, Luxury retail
✗ Nevhodné: Heavy machinery, Gaming, Automotive, Sports equipment

### **Tech:**
✓ Vhodné: Tech brands, Gaming, Software, Elektronika
✗ Nevhodné: Tradičné retail, Food & beverage, Fashion, Beauty

### **Fitness:**
✓ Vhodné: Fitness zariadenia, Športová výživa, Wellness, Healthy food
✗ Nevhodné: Fast food, Alkohol, Tabak, Nezdravé produkty

### **Food:**
✓ Vhodné: Reštaurácie, Food brands, Kitchen equipment, Gastro
✗ Nevhodné: Diet pills, Fitness equipment, Sports gear, Tech

### **Travel:**
✓ Vhodné: Airlines, Hotels, Tourism, Luggage, Travel apps
✗ Nevhodné: Heavy industry, B2B services, Local services

### **Entertainment:**
✓ Vhodné: Media brands, Streaming, Events, Lifestyle
✗ Nevhodné: Corporate B2B, Industrial, Conservative brands

### **Business:**
✓ Vhodné: B2B software, Finance, Consulting, Education
✗ Nevhodné: Entertainment, Gaming, Fast fashion, Food

---

## 🛠️ TECHNICKÁ IMPLEMENTÁCIA

### **1. HTML Generovanie:**
- Skopíruj `rousal_final.html` ako šablónu
- Replace všetky hodnoty s novými dátami
- Update Chart.js data arrays
- Update engagement tabuľku
- Update market value čísla

### **2. PDF Generovanie:**
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f'file://{html_path}')
    page.wait_for_timeout(2500)  # Wait for Chart.js
    page.pdf(
        path=pdf_path,
        format='A4',
        print_background=True,
        margin={'top': '0mm', 'right': '0mm', 'bottom': '0mm', 'left': '0mm'}
    )
    browser.close()
```

### **3. Verifikácia:**
```bash
mdls -name kMDItemNumberOfPages [pdf_path]
```
Musí byť: `kMDItemNumberOfPages = 3`

Ak nie je 3:
- Ak < 3: Pridaj spacing, zväčši elementy
- Ak > 3: Zmenši spacing, zmenši elementy, skráť text

---

## ✅ CHECKLIST PRED FINALIZÁCIOU

Pred uložením PDF skontroluj:

- [ ] PDF má **presne 3 strany**
- [ ] Všetky screenshoty sú viditeľné (nekropia sa)
- [ ] Grafy sú vyrenderované (nie prázdne)
- [ ] Všetky čísla sú správne vypočítané
- [ ] Engagement Rate je realistický (1-20%)
- [ ] Market value dáva zmysel
- [ ] Final Score je 1-10
- [ ] Brand safety kontext je uvedený (ak relevantné)
- [ ] Farby sú NiftyMinds (#3333FF, nie magenta!)
- [ ] Žiadne Lorem Ipsum / placeholder texty
- [ ] Footer má správne číslo strany (1/3, 2/3, 3/3)
- [ ] PDF je uložený v zložke influencera
- [ ] HTML je tiež uložený (pre budúce úpravy)

---

## 📚 PRÍKLAD POUŽITIA

**User povie:**

```
Vygeneruj mi influencer report pre Janu Novákovú.

Základné info:
- Meno: Jana Nováková
- Instagram: @jana.fitness
- Kategória: Fitness & Health
- Ponúkaná cena: 18 000 CZK/mesiac
- Followers: 85 000
- Posts: 342
- Verified: Áno
- Bio: "💪 Personal Trainer | 🏆 Fitness Coach | 📍 Praha"

Top Reels views:
- 650 000
- 480 000
- 320 000
- 280 000

Engagement (4 príspevky):
1. Tréning video: 5200 likes, 23 comments
2. Motivačný quote: 8900 likes, 54 comments
3. Supplement review: 3400 likes, 12 comments
4. Before/After transformation: 12000 likes, 89 comments

Screenshots sú v ./screenshots/
```

**Claude:**
1. Prečíta tento template
2. Pozrie Roušal PDF
3. Urobí web research na Janu
4. Vypočíta:
   - ER: 7.2%
   - Reach: 5.4x
   - Market value: 24-34K
   - Score: 7.8/10 → BUY
5. Vygeneruje 3-stranové PDF
6. Uloží `Jana_Novakova_Report.pdf`

---

## 🎯 CIEĽ

**Každý report musí byť:**
- ✅ Profesionálny
- ✅ Konzistentný (1:1 ako Roušal)
- ✅ Presný (správne výpočty)
- ✅ Kompletný (všetky sekcie)
- ✅ Client-ready (pripravený na prezentáciu)
- ✅ 3 strany A4 (ani menej, ani viac)

---

## 📞 SUPPORT

Ak Claude nevie vygenerovať report alebo má problémy:
1. Skontroluj či sú screenshots v správnej zložke
2. Skontroluj či sú všetky čísla zadané
3. Skontroluj či HTML šablóna `rousal_final.html` existuje
4. Restart Claude session

---

**Verzia:** 2.0
**Last Updated:** 12. marec 2026
**Maintained by:** NiftyMinds.cz
**Gold Standard:** Rousal_Influencer_Analysis.pdf
