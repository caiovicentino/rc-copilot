# RevenueCat Take-Home Assignment — Caio Vicentino
## Agentic AI Developer & Growth Advocate

*Submitted: March 16, 2026*

---

## ⚡ TL;DR

I built **RC Copilot** — an autonomous AI agent that connects to RevenueCat's Charts API, analyzes subscription metrics, detects anomalies, and generates actionable reports. The tool, blog post, social media content, and growth campaign were all created autonomously by Major (my AI agent), demonstrating exactly what "Agentic AI Developer & Growth Advocate" means in practice.

**The deliverable is the demonstration.**

---

## 📦 Deliverables

### Task 1: Public-Facing Tool
**RC Copilot** — Open-source RevenueCat subscription analytics agent

🔗 **GitHub:** [github.com/caiovicentino/rc-copilot](https://github.com/caiovicentino/rc-copilot)

**What it does:**
- Connects to RevenueCat Charts API v2 (auto-discovers project from API key)
- Fetches 10 core chart types (revenue, MRR, ARR, churn, trials, conversion, refunds, actives, new customers)
- Detects anomalies using Z-score analysis (flags 2σ+ outliers)
- Classifies trends as growing, declining, or stable
- Generates What-If scenarios (churn reduction, trial improvement, customer growth)
- Outputs beautiful Markdown reports with executive summaries and recommendations
- Runs as CLI tool or GitHub Action — zero infrastructure required

**Tech highlights:**
- TypeScript with strict mode
- **Zero production dependencies** (native fetch + built-in Node.js APIs)
- Smart chartable measure discovery (automatically uses the correct metric index)
- Filters incomplete periods to avoid end-of-period distortion
- Industry benchmark comparisons (churn 5-7%, trial conversion 25-30%, etc.)

**Real insights discovered from Dark Noise:**
- ⚠️ February 2026 revenue dropped 43% ($2,900 vs $4,619) — 2.1σ anomaly
- ✅ Trial conversion at 41% — well above 25-30% industry average
- 📈 December spike ($7,243) — holiday/gifting pattern, 48% above average
- 💰 Each 1% churn reduction = ~$547/year in additional MRR
- 🚨 New customer spike on Dec 27 (994 vs 520 avg) — 3.0σ anomaly

→ **[Full Dark Noise Analysis Report](https://github.com/caiovicentino/rc-copilot/blob/main/examples/dark-noise-analysis.md)**

#### Live Web Dashboard + AI Copilot
🔗 **[web-five-lovat-52.vercel.app](https://web-five-lovat-52.vercel.app)**

A full web experience that lets you explore RC Copilot's analysis without installing anything:

**📊 Dashboard** ([/dashboard](https://web-five-lovat-52.vercel.app/dashboard))
- **Real-time metrics** from the RevenueCat Charts API (server-side — API key never touches the browser)
- **Interactive What-If Simulator** — drag sliders to model churn reduction, trial improvement, and growth scenarios
- **Anomaly alerts** with severity indicators and statistical context
- **Trend charts** (Recharts) for revenue, MRR, churn, trials, and conversion over time
- **Health Score** — composite gauge based on churn, conversion, and revenue trends vs industry benchmarks
- **Executive Summary** with actionable recommendations

**🧠 AI Copilot** ([/copilot](https://web-five-lovat-52.vercel.app/copilot))
- **Ask your data anything** — natural language chat powered by GPT-4o-mini
- All RevenueCat data (metrics, charts, anomalies, trends) injected as real-time context
- Streaming responses with Markdown rendering (tables, code blocks, lists)
- 5 suggested questions to get started ("Why did revenue drop in February?", "What should I focus on?")
- Full multi-turn conversation support

**Why AI Copilot matters:** Dashboards show data. Copilots explain it. Instead of reading charts, you ask *"What caused the December spike?"* and get a grounded, data-backed answer. This is where developer tools are heading — and Charts API makes it possible.

Built with Next.js 15, Tailwind CSS, Recharts, and OpenAI streaming. Dark theme. Responsive. Zero friction.

---

### Task 2: Content Package

#### Blog Post (2,400+ words)
**"I Built an Autonomous Revenue Analyst in 48 Hours — Here's How (and What It Found)"**

🔗 **[Read the full blog post](https://github.com/caiovicentino/rc-copilot/blob/main/content/blog-post.md)**

Covers: the problem with passive dashboards, RC Copilot's architecture, real insights from Dark Noise data, code deep-dives (anomaly detection, trend classification), setup instructions, and the vision for Charts API-powered tools.

Includes: code snippets, Mermaid architecture diagram, real data examples, CTA to Charts API docs.

#### Video Tutorial
**"RC Copilot: Autonomous Subscription Analytics in 2 Minutes"**

🔗 **[Watch the demo](https://github.com/caiovicentino/rc-copilot/releases/download/v1.0.0/demo.mp4)** *(narrated walkthrough of the tool running against real Dark Noise data)*

Shows: install → overview → What-If simulator → full analysis → GitHub Action — all in 1 minute 20 seconds.

#### 5 Social Media Posts (X/Twitter)

🔗 **[All 5 posts with media specs](https://github.com/caiovicentino/rc-copilot/blob/main/content/social-posts.md)**

| # | Angle | Target Audience |
|---|-------|----------------|
| 1 | The Problem (pain point) | Indie devs |
| 2 | Technical Feature (architecture) | Engineers |
| 3 | Surprising Insight (real data) | SaaS founders |
| 4 | Ease of Use (5-min setup) | Pragmatists |
| 5 | Meta/Transparency (AI disclosure) | Everyone |

---

### Task 3: Growth Campaign

🔗 **[Full Campaign Report](https://github.com/caiovicentino/rc-copilot/blob/main/content/growth-campaign.md)**

**Budget:** $100

| Channel | Budget | Strategy |
|---------|--------|----------|
| X/Twitter Promoted | $40 | Boost "surprising insight" post to dev audience |
| Newsletter Sponsorship | $20 | Sponsor 2 indie dev newsletters |
| Reddit Awards/Boost | $25 | r/SaaS + r/IndieHackers visibility |
| Product Hunt Assets | $15 | Professional launch materials |

**5 Target Communities:**
1. **r/SaaS** (85K members) — Direct target audience
2. **r/IndieHackers / IndieHackers.com** — RevenueCat's core users
3. **Hacker News** (Show HN) — Technical audience, open-source appreciation
4. **RevenueCat Community** — Existing users who benefit most
5. **Dev Twitter/X** — Viral potential, developer mindshare

**KPIs:** 50+ GitHub stars, 1K+ blog views, 500+ video views in first week.

**AI Disclosure:** All posts explicitly mention AI agent authorship. Full transparency.

---

## 📋 Process Log

🔗 **[Full Process Log](https://github.com/caiovicentino/rc-copilot/blob/main/PROCESS_LOG.md)**

Transparent documentation of every decision, tradeoff, and tool used during the assignment. Timestamps, rationale, and learnings included.

**Key decisions documented:**
- Why RC Copilot over a dashboard or API wrapper
- Why zero dependencies
- Why rule-based first, LLM optional
- Why GitHub Action as primary distribution
- Why Markdown over HTML/PDF

---

## 🤖 The Meta-Angle

This entire assignment was completed by **Major**, my AI agent built on OpenClaw. Major is a production AI assistant that runs 24/7 — managing social media (14K+ followers on X), processing 80+ mentions/day, creating content, monitoring markets, and now... applying for jobs.

**What this demonstrates:**
- The tool was **built by an AI agent** — proving it can handle autonomous development
- The content was **written by an AI agent** — proving it can handle developer advocacy
- The campaign was **designed by an AI agent** — proving it can handle growth strategy
- The process was **documented by an AI agent** — proving transparency and reliability

**The deliverable IS the demonstration.** You're not just evaluating code and content — you're seeing what "Agentic AI Developer & Growth Advocate" looks like in production.

---

## 📊 Technical Summary

| Metric | Value |
|--------|-------|
| Lines of Code | 1,500+ CLI + 2,800+ Web Dashboard + AI Copilot (TypeScript) |
| Production Dependencies | 0 (CLI), minimal (web: Next.js + Recharts) |
| Charts Analyzed | 10 types |
| API Endpoints Used | 3 (projects, overview, charts) |
| Anomalies Detected | 10+ in Dark Noise data |
| AI Copilot | Natural language chat with real-time data context |
| Report Sections | 5 (Summary, Metrics, Anomalies, Insights, What-If) |
| Blog Post Words | 2,400+ |
| Social Posts | 5 (different angles) |
| Communities Targeted | 5 |
| Tests | 57 passing (36 analyzer + 13 API routes + 8 copilot) |
| Time to Complete | ~6 hours of agent work |

---

*Built with autonomy, transparency, and genuine enthusiasm for what RevenueCat is building. The Charts API opens up a whole new category of developer tools — RC Copilot is just the beginning.*

**Caio Vicentino** — [caiovicentino.com.br](https://caiovicentino.com.br) | [@0xCVYH](https://x.com/0xCVYH) | [GitHub](https://github.com/caiovicentino)
