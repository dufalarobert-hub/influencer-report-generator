# Nasadenie na Vercel (interná aplikácia)

Aplikácia je chránená **jedným univerzálnym heslom** — kolega zadá heslo na
`/login` a dostane sa do generátora. Žiadne emaily, žiadna databáza.

---

## 1. Push na GitHub

Repo je prepojené s `github.com/dufalarobert-hub/influencer-report-generator.git`.
Aktuálna verzia (v5.1) je už zmergovaná na `main` a pushnutá. Pre budúce zmeny
ich dostaň na hlavnú vetvu:

```bash
cd "/Users/robertdufala/Desktop/Influencer Report Generator"
git checkout main
git push origin main
```

> `.env.local` (API kľúče + heslo) je v `.gitignore` — na GitHub sa NEDOSTANE.
> Kľúče sa nastavujú zvlášť vo Vercel (krok 3).

---

## 2. Vytvor projekt na Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → importuj `influencer-report-generator`.
2. ⚠️ **Root Directory: `app`** — Next.js appka je v podpriečinku `app/`,
   nie v koreni repa. Toto MUSÍŠ nastaviť (Edit pri "Root Directory").
3. Framework Preset: **Next.js** (detekuje sa automaticky).

---

## 3. Environment Variables (Vercel → Settings → Environment Variables)

Pridaj tieto 4 premenné (Production + Preview):

| Názov | Hodnota | Popis |
|-------|---------|-------|
| `APP_PASSWORD` | *zvolené heslo* | Jediné heslo, ktoré zadávajú kolegovia |
| `AUTH_SECRET` | `openssl rand -hex 32` | Náhodný secret na podpis cookie |
| `APIFY_API_TOKEN` | `apify_api_...` | Apify token |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API kľúč |

`AUTH_SECRET` vygeneruj v termináli:
```bash
openssl rand -hex 32
```

> Keď zmeníš `APP_PASSWORD` alebo `AUTH_SECRET` neskôr, všetci prihlásení sa
> odhlásia (staré cookies prestanú platiť) — to je v poriadku.

---

## 4. Vercel plán — POZOR na timeout

Generovanie reportu trvá **1–3 minúty** (Apify scraping + Claude research).

- **Hobby (free):** limit funkcie je 60 s → **report spadne na timeout.** Nestačí.
- **Pro ($20/mes):** limit 300 s — appka má nastavené `maxDuration = 300`. **Toto potrebuješ.**

Ak ste na Hobby pláne, treba upgrade na Pro, inak reporty nedobehnú.

---

## 5. Deploy

Klikni **Deploy**. Po ~2 min dostaneš URL (napr. `influ-report.vercel.app`).

Otestuj:
1. Otvor URL → presmeruje ťa na `/login`.
2. Zadaj `APP_PASSWORD` → pustí ťa do generátora.
3. Vygeneruj testovací report.

Kolegom pošli URL + heslo. Hotovo.

---

## Ako to funguje (pre istotu)

- `src/middleware.ts` — chráni **celú** appku vrátane `/api/report/generate`
  (platený endpoint). Bez cookie → redirect na `/login`, API → 401.
- `src/app/login` — formulár s jedným poľom (heslo).
- `src/app/api/auth/login` — overí heslo proti `APP_PASSWORD`, nastaví
  HttpOnly + Secure cookie podpísanú HMAC-om (`AUTH_SECRET`).
- Cookie platí **7 dní**, potom sa kolega prihlási znova.
- Tlačidlo **Odhlásit** je vpravo hore v hlavičke.

## Zmena hesla

Vercel → Settings → Environment Variables → uprav `APP_PASSWORD` → **Redeploy**.
