# RC Copilot Web Dashboard — Spec

## Goal
Build a web dashboard that lets the RevenueCat evaluator open a URL and instantly see RC Copilot analyzing real Dark Noise subscription data. This is the "wow factor" — no install, no CLI, just click and see.

## Tech Stack
- **Next.js 15** (App Router)
- **Tailwind CSS** (utility-first, dark theme)
- **Recharts** (lightweight charts)
- **TypeScript** strict
- **Vercel** deploy

## Architecture

### API Key Security
- API key lives ONLY in server-side environment variable (`REVENUECAT_API_KEY`)
- All API calls happen in Next.js API routes / Server Components
- Client never sees the key
- Demo mode uses pre-set key via env var on Vercel

### Pages

#### 1. Landing Page (`/`)
- Hero: "RC Copilot — Your autonomous subscription analyst"
- 3 feature cards: Anomaly Detection, Trend Analysis, What-If Simulator
- "View Live Demo →" button → `/dashboard`
- Footer: "Built by Caio Vicentino for RevenueCat" + GitHub link

#### 2. Dashboard (`/dashboard`)
Main analytics view. Server-side data fetch on load.

**Layout:** Sidebar nav + main content area. Dark theme (slate-900 background).

**Sections:**

**a) Overview Strip (top)**
- 6 metric cards in a row: MRR, Revenue, Active Subs, Active Trials, New Customers, Active Users
- Each card: value, period, small trend indicator (↑↓→)
- Green/red accent based on direction

**b) Health Score**
- Circular gauge showing overall health (0-100)
- Based on: churn vs benchmark, trial conversion vs benchmark, revenue trend
- Color: green (80+), yellow (50-79), red (<50)

**c) Anomalies Section**
- Alert cards for each detected anomaly
- Red/amber based on severity (2σ vs 3σ)
- Each shows: metric name, date, actual vs expected, deviation
- Example: "⚠️ Revenue Feb 2026: $2,900 — 43% below average (2.1σ)"

**d) Trends Section**
- Line charts (Recharts) for key metrics over time:
  - Revenue (monthly, 15 months)
  - MRR (monthly)
  - Churn rate (monthly)
  - Trial conversion rate (monthly)
  - New customers (monthly)
- Each chart: trend line + direction label + % change

**e) What-If Simulator (INTERACTIVE)**
- 3 sliders:
  - "Reduce churn by X%" (0-5%, step 0.5)
  - "Improve trial conversion by X%" (0-20%, step 1)
  - "Grow new customers by X%" (0-50%, step 5)
- Real-time calculation showing:
  - Current MRR → Projected MRR (12 months)
  - Current Revenue → Projected Revenue
  - Additional subscribers gained
  - Dollar impact per year
- This is a CLIENT component (needs interactivity)
- Pre-load current values from server, calculations happen client-side

**f) Executive Summary**
- AI-generated text summary (rule-based, same as CLI)
- Key recommendations as bullet points
- "Download Full Report (Markdown)" button

**g) Insights Cards**
- 4-6 insight cards with icons
- Each: title, metric, recommendation, impact estimate
- Example: "Trial Conversion Excellence — 41% vs 25-30% industry avg. Your onboarding is working. Focus on maintaining this advantage."

### Design System
- **Background:** slate-900 (dark)
- **Cards:** slate-800 with slate-700 border, rounded-xl
- **Accent:** emerald-500 (positive), red-500 (negative), amber-500 (warning), blue-500 (info)
- **Text:** slate-100 (primary), slate-400 (secondary)
- **Charts:** emerald line on dark, grid lines slate-700
- **Font:** Inter (system fallback)
- **Responsive:** works on mobile but optimized for desktop

### API Routes

#### `GET /api/overview`
- Fetches from RC Charts API: overview endpoint
- Returns formatted metrics
- Caches for 5 minutes (revalidate)

#### `GET /api/charts?type=revenue&period=P15M&interval=month`
- Fetches specific chart data
- Supported types: revenue, mrr, churn, trials, trial_conversion_rate, customers_new, actives, refund_rate
- Returns time series data

#### `GET /api/analysis`
- Runs full analysis (same logic as CLI analyzer)
- Returns: anomalies, trends, insights, health score
- Heavy endpoint, cache 10 minutes

### Files Structure
```
web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (landing)
│   ├── dashboard/
│   │   └── page.tsx (main dashboard — server component)
│   ├── api/
│   │   ├── overview/route.ts
│   │   ├── charts/route.ts
│   │   └── analysis/route.ts
│   └── globals.css
├── components/
│   ├── MetricCard.tsx
│   ├── HealthGauge.tsx
│   ├── AnomalyCard.tsx
│   ├── TrendChart.tsx (client — uses Recharts)
│   ├── WhatIfSimulator.tsx (client — interactive sliders)
│   ├── InsightCard.tsx
│   ├── ExecutiveSummary.tsx
│   └── Navbar.tsx
├── lib/
│   ├── revenuecat.ts (API client — reuse logic from src/api.ts)
│   ├── analyzer.ts (analysis logic — reuse from src/analyzer.ts)
│   └── types.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── .env.local (REVENUECAT_API_KEY=sk_qdnvkjsVGhoVVNGiajqNHYIypcjgs)
```

### Key Implementation Notes

1. **Reuse core logic** from `src/analyzer.ts`, `src/api.ts`, `src/simulator.ts` — copy and adapt for web context (no CLI deps)

2. **RevenueCat Charts API v2:**
   - Base: `https://api.revenuecat.com/v2`
   - Auth: `Authorization: Bearer sk_qdnvkjsVGhoVVNGiajqNHYIypcjgs`
   - Project discovery: `GET /projects` → use first project
   - Overview: `GET /projects/{id}/metrics/overview`
   - Charts: `GET /projects/{id}/charts/{chart_type}?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&interval=month&currency=USD`
   - Available charts: revenue, mrr, churn, trials, trial_conversion_rate, customers_new, actives, refund_rate, arr, conversion_to_paying, subscription_retention

3. **Chart data format:** Each chart returns `data` array with `date` and `values` (array of numbers, first index = the metric). Use `chartable_measures` to find the right index.

4. **What-If calculations (client-side):**
   - Churn reduction: savedMRR = currentMRR * (churnReduction/100) * 12
   - Trial improvement: newSubs = trialStarts * (conversionImprovement/100), newMRR = newSubs * avgRevenuePerSub
   - Customer growth: additionalCustomers = currentNewCustomers * (growthRate/100), newMRR = additionalCustomers * conversionRate * avgRevenuePerSub

5. **Health Score formula:**
   - Start at 50
   - Churn < 5%: +20, < 7%: +10, > 10%: -20
   - Trial conv > 35%: +15, > 25%: +5, < 15%: -15
   - Revenue trend up: +15, stable: +5, down: -15
   - Clamp 0-100

6. **Error handling:** If API fails, show graceful error state with "Unable to fetch data" message. Never crash.

7. **DO NOT expose API key to client.** All fetches happen server-side.

## Vercel Deploy
- Project name: `rc-copilot`
- Framework: Next.js
- Environment variable: `REVENUECAT_API_KEY=sk_qdnvkjsVGhoVVNGiajqNHYIypcjgs`
- Build command: `next build`
- Output: `.next`

After build, deploy with: `cd web && npx vercel --prod --yes`
If vercel not found: `npx vercel@latest --prod --yes`

## Quality Bar
- Must look professional — this is being evaluated by a hiring team
- No placeholder text, no "Lorem ipsum", no broken layouts
- Every number must be REAL (from the API)
- Charts must render correctly
- What-If must calculate correctly
- Mobile responsive (but desktop-first)
- Fast load time (<3s)
