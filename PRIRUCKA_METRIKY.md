# 📊 Príručka k Influencer Reportu — čo ktorá metrika znamená

Krátky sprievodca pre tím. Report má 3 strany. Tu je, čo na nich nájdeš a **akú logiku má každé číslo.**

Zlaté pravidlo na koniec: **Final Score + Value Ratio** sú dve hlavné čísla, podľa ktorých sa rozhoduješ. Zvyšok je kontext, prečo to skóre vyšlo tak ako vyšlo.

---

## STRANA 1 — Profil & výkon

### Followers / Příspěvky / Verified
Základné údaje z Instagramu (cez Apify). Verified = modrá fajka.

### Performance Overview — tri čísla
| Číslo | Čo to je |
|-------|----------|
| **Reach (virální)** | Najlepší (najsledovanejší) Reel za posledných 6 mesiacov — strop, kam až vie dosiahnuť |
| **Reach (standard)** | Bežný dosah Reelu (medián) — čo realisticky čakať |
| **Engagement Rate (medián)** | Koľko % followerov priemerne reaguje (like + comment) na post |

> **Prečo medián a nie priemer?** Keď má niekto 1-2 virálne posty, priemer je nafúknutý a klame. Medián = „stredná hodnota", ukáže reálny bežný výkon. Preto sa pre všetky peňažné výpočty používa medián.

### Engagement Rate Benchmark (POOR → EXCELLENT)
ER sa **hodnotí podľa veľkosti účtu**, nie absolútne. Malé účty majú prirodzene vyšší ER než veľké.

- 2 % ER pri 5 000 followerov = slabé (POOR)
- 2 % ER pri 1 000 000 followerov = výborné (GOOD/EXCELLENT)

Farba a rating ti rovno povie, či je engagement na danú veľkosť dobrý.

### 🔍 Kvalita Publika (Detekcia Botov)
Odhad, koľko % followerov je reálnych (0–100 %). Logika: začína na 85 bodoch a pripočítava/odpočítava podľa signálov:
- **Červené vlajky** (ťahajú dole): viac sledujúcich než followerov, podozrivo nízky alebo naopak nereálne vysoký ER, takmer žiadne komentáre k lajkom.
- **Zelené vlajky** (ťahajú hore): zdravý pomer, kvalitné komentáre.

Risk: **LOW** (>75 %, OK) / **MEDIUM** (60–75 %, opatrnosť) / **HIGH** (<60 %, pozor na kúpených followerov).

### 💬 Kvalita Komentářů
Analýza vzorky komentárov — koľko je „generic" (emoji, „Nice!", boti/engagement pody) vs. „kvalitní" (otázky, názory, dlhšie vety). Vysoké % generic = umelo nafúknutý engagement.
*(Pozn.: vzorka je malá, ber to ako orientačný signál, nie presné číslo.)*

### 🚀 Virální Potenciál (0–10)
Schopnosť účtu „strieľať" virálne posty. Počíta sa z pomeru najlepšieho vs. priemerného Reelu + konzistencie. Ukazuje 3 odhady dosahu: pesimistický / priemer / virálny.

### ⭐ Celebrity Tier
Bonus pre veľké overené účty (500K+) — celebrity majú hodnotu samy o sebe, nielen cez čísla.

---

## STRANA 2 — Engagement & Hodnota

### Tabuľka Priemer / Trimmed Mean / Medián
Tri spôsoby výpočtu engagementu. **Medián** (zelený) je ten, ktorému ver — je odolný voči skresleniu virálnymi postami.

### Value Breakdown — „Čo dostanem za peniaze?"
Toto je jadro reportu. Porovnáva **hodnotu, ktorú influencer doručí**, s **cenou, ktorú zaňho platíš.**

| Položka | Čo to je |
|---------|----------|
| **Reach Value** | Koľko by stálo dosiahnuť rovnaký počet videní cez Meta Ads (platenú reklamu) |
| **Engagement Value** | Koľko by stál rovnaký engagement cez Meta Ads |
| **Content Value** | Koľko by stálo vyrobiť ten obsah externe (produkcia videí/fotiek) |
| **CELKOVÁ HODNOTA** | `max(Reach, Engagement) + Content` |

> **Prečo `max`, a nie súčet všetkých troch?** Keď kupuješ reklamu, engagement dostávaš v cene dosahu — sú to prekrývajúce sa veci. Sčítať ich by hodnotu umelo zdvojnásobilo. Preto berieme vyššiu z dvoch + cenu obsahu navrch. (Toto je zámerne konzervatívne, aby skóre neklamalo nahor.)

### ⭐ VALUE RATIO — najdôležitejšie číslo strany 2
**Hodnota ÷ Cena.** Koľkonásobok hodnoty dostávaš za svoje peniaze:

| Value Ratio | Význam |
|-------------|--------|
| **≥ 2.0×** | Vynikajúci deal |
| **1.5 – 2.0×** | Dobrý deal |
| **1.0 – 1.5×** | OK deal |
| **< 1.0×** | Predražené (platíš viac, než dostávaš) |

### Predikce Konverzí (len ak zadáš AOV — priemernú hodnotu objednávky)
Lievik: Videnia → Kliknutia → Predaje → tržby a ROI.

- **CTR** (% čo klikne): na Instagrame realisticky 0.5–2 % — Reels nemajú klikateľný link, klik ide cez stories/bio, preto nízke čísla.
- **CR** (% čo z kliknutí kúpi): 1–3 %.
- **Matica scenárov** ukazuje všetky kombinácie (zelené = ziskové, červené = stratové) a zvýrazní najrealistickejší podľa kvality účtu.

> Konverzie ber ako orientačný odhad, nie záruku — závisia od produktu, ceny aj kreatívy.

---

## STRANA 3 — Trhová hodnota & Brand Safety

### Market Value (Konzervatívny vs Premium)
Odhad férovej ceny spolupráce:
- **Konzervatívny** = 0,25–0,35 Kč/follower × kvalita publika × veľkosť
- **Premium** = 0,50–0,80 Kč/follower × bonusy (vysoký dosah, výborný ER, verified, celebrity)
- **Nabídka** = cena, ktorú reálne platíš + o koľko % je pod trhom

### Risk tabuľka (Brand Safety)
| Riadok | Čo sleduje |
|--------|------------|
| Historická kontroverze | Škandály z minulosti |
| Aktuální chování | Ako sa správa teraz |
| Mediální prezentace | Ako o ňom píšu médiá |
| Komerční přesycení | Či nie je „prereklamovaný" (veľa platených spoluprác = únava publika) |

> ⛔ **Červený box „Brand safety NEPROVĚŘENA"** = automatický web research zlyhal. Vtedy číslam o brand safety **never** a influencera si over manuálne (vygúgli meno), prípadne report spusti znova.

### Kontroverzie & Brand Partnerships
Nájdené škandály (s úrovňou závažnosti) a predošlé spolupráce (platené vs. organické). *Vzťahové drby sa zámerne ignorujú — nepoškodzujú značku.*

### Vhodné / Nevhodné pro
Typy značiek, ku ktorým sa influencer hodí a nehodí.

### 🏆 FINAL VERDICT — Final Score (0–10)
Hlavné rozhodovacie číslo. Vážený priemer štyroch zložiek:

| Zložka | Váha | Z čoho |
|--------|------|--------|
| Cena/Hodnota | 40 % | Value Ratio |
| Engagement | 25 % | ER rating podľa veľkosti |
| Dosah | 20 % | Reach multiplier |
| Brand Safety | 15 % | Web research |

| Final Score | Odporúčanie |
|-------------|-------------|
| **≥ 8.0** | 🟢 STRONG BUY — vezmi to |
| **6.5 – 8.0** | 🟢 BUY — dobrá voľba |
| **5.0 – 6.5** | 🟡 CONSIDER — zvážiť, vyjednať cenu |
| **< 5.0** | 🔴 PASS — radšej nie |

---

## TL;DR pre rýchle rozhodnutie
1. Pozri **Final Score** (vezmi/zváž/nechaj).
2. Pozri **Value Ratio** (či cena dáva zmysel).
3. Skontroluj **Brand Safety** (žiadny červený box, žiadne kontroverzie).
4. Pri pochybnostiach pozri **Kvalita Publika** (nie sú to kúpení followeri?).

Ak Final Score ≥ 6.5, Value Ratio ≥ 1.5 a brand safety je čistá → zelená. ✅

---
*NiftyMinds — Influencer Report Generator v5.1*
