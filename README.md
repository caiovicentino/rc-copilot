# RC Copilot

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://typescriptlang.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-174%20passing-brightgreen)](src/__tests__)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](#test-coverage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Autonomous AI agent that analyzes RevenueCat subscription data — anomaly detection, trend analysis, what-if simulations, and natural language Q&A.**

> 🔗 **[Live Demo →](https://rc-copilot.vercel.app)** &nbsp;|&nbsp; 📊 **[Dashboard →](https://rc-copilot.vercel.app/dashboard)** &nbsp;|&nbsp; 🧠 **[AI Copilot →](https://rc-copilot.vercel.app/copilot)** &nbsp;|&nbsp; 🤖 **[AgentSkill →](https://rc-copilot.vercel.app/skill)**

---

## What It Does

RC Copilot connects to the RevenueCat Charts API v2, fetches your subscription metrics, and delivers:

- **📊 Anomaly Detection** — Z-score analysis flags statistical outliers (>2σ) across all metrics
- **📈 Trend Analysis** — Linear regression classifies trends as growing, declining, or stable
- **⚡ What-If Simulator** — Model churn reduction, trial improvement, and growth scenarios
- **🧠 AI Copilot Chat** — Ask your data anything in natural language (Claude Sonnet 4.6)
- **🤖 AgentSkill** — Drop-in module for any AI agent to analyze RevenueCat data autonomously
- **📋 Industry Benchmarks** — Compare churn (5-7%), trial conversion (25-30%), refund rate (1-3%)

### Real Insights from Dark Noise

| Finding | Detail |
|---------|--------|
| ⚠️ Revenue Drop | February 2026 dropped 43% ($2,900 vs $4,619) — 2.1σ anomaly |
| ✅ Trial Conversion | 41% — well above 25-30% industry average |
| 📈 Holiday Spike | December $7,243 — 48% above average (gifting pattern) |
| 💰 Churn Impact | Each 1% reduction = ~$547/year additional MRR |
| 🚨 Customer Surge | Dec 27: 994 new customers vs 520 avg — 3.0σ anomaly |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    RC Copilot                             │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
│  │ API     │  │ Analyzer │  │ Simulator │  │ Format  │ │
│  │ Client  │→ │ Z-score  │→ │ What-If   │→ │ MD/JSON │ │
│  │ +retry  │  │ Trends   │  │ Scenarios │  │ Output  │ │
│  └─────────┘  └──────────┘  └───────────┘  └─────────┘ │
└──────────────┬───────────────────────────────────────────┘
               │ HTTPS + Bearer auth
               ▼
┌──────────────────────────────────────────────────────────┐
│           RevenueCat Charts API V2                        │
│  /v2/projects · /v2/projects/{id}/metrics/overview       │
│  /v2/projects/{id}/charts/{chart_name}                   │
└──────────────────────────────────────────────────────────┘
```

---

## Quick Start

### CLI

```bash
# Clone and install
git clone https://github.com/caiovicentino/rc-copilot.git
cd rc-copilot && npm install

# Set your API key
export REVENUECAT_API_KEY="sk_xxx"

# Quick health check
npx tsx src/cli.ts overview

# Full analysis (anomalies + trends + insights + what-if)
npx tsx src/cli.ts analyze --period 90d

# What-if scenario simulation
npx tsx src/cli.ts what-if

# JSON output for programmatic use
npx tsx src/cli.ts analyze --format json
```

### Programmatic

```typescript
import { RevenueCatAPI, analyze, runAllScenarios } from 'rc-copilot';

const api = new RevenueCatAPI('sk_xxx');
const project = await api.discoverProject();
const charts = await api.fetchCharts(CORE_CHARTS, {
  startDate: '2025-12-01',
  endDate: '2026-03-01',
  resolution: 'week',
});

const analysis = analyze(project.name, charts, startDate, endDate);
const scenarios = runAllScenarios(simulatorInput);
```

### GitHub Action

```yaml
name: Weekly Subscription Report

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci && npx tsx src/cli.ts analyze --format markdown
        env:
          REVENUECAT_API_KEY: ${{ secrets.REVENUECAT_API_KEY }}
```

---

## Web Dashboard

**[rc-copilot.vercel.app/dashboard](https://rc-copilot.vercel.app/dashboard)**

The web dashboard provides a visual interface for exploring your subscription data:

- **6 Metric Cards** — MRR, Revenue, Active Subs, Trials, Churn, Trial Conversion
- **Health Score Gauge** — Composite score (0-100) based on churn, conversion, and revenue trends
- **Anomaly Alerts** — Visual cards with severity indicators and statistical context
- **Trend Charts** — Interactive Recharts visualizations for 5 core metrics over time
- **What-If Simulator** — Three sliders to model churn, trial, and growth scenarios
- **Executive Summary** — AI-generated narrative with top findings and recommendations

Built with Next.js 15, Tailwind CSS, Recharts. Server-side API routes — your API key never touches the browser.

---

## AI Copilot

**[rc-copilot.vercel.app/copilot](https://rc-copilot.vercel.app/copilot)**

Ask your data anything in natural language:

- *"Why did revenue drop in February?"*
- *"What's my biggest risk right now?"*
- *"How does my churn compare to industry benchmarks?"*
- *"What should I prioritize this quarter?"*

Powered by Claude Sonnet 4.6 via OpenRouter. All RevenueCat data (metrics, charts, anomalies, trends) injected as real-time context. Streaming responses with Markdown rendering.

**Why this matters:** Dashboards show data. Copilots explain it. This is where developer tools are heading.

---

## AgentSkill

**[rc-copilot.vercel.app/skill](https://rc-copilot.vercel.app/skill)**

RC Copilot ships as a reusable **AgentSkill** — a self-contained module that any AI agent can load to instantly analyze RevenueCat data.

```bash
cd skill/scripts && npm install
export REVENUECAT_API_KEY="sk_xxx"

npx tsx rc-analyze.ts overview          # Quick health check
npx tsx rc-analyze.ts analyze           # Full analysis (28 days)
npx tsx rc-analyze.ts analyze --period 90d --format json
npx tsx rc-analyze.ts what-if           # Revenue scenarios
```

**What this means:** Every AI coding agent in the ecosystem becomes a potential distribution channel for the Charts API. An indie dev asks their AI assistant *"How's my app doing?"* and the agent pulls real RevenueCat data autonomously.

Includes: `SKILL.md` (agent instructions), `rc-analyze.ts` (434 lines, zero prod deps), `api-reference.md` (Charts API docs for LLM context).

---

## Charts Analyzed

| Chart | Metric |
|-------|--------|
| `revenue` | Total revenue over time |
| `mrr` | Monthly Recurring Revenue |
| `arr` | Annual Recurring Revenue |
| `churn` | Subscription churn rate |
| `actives` | Active subscription count |
| `trials` | Active trial count |
| `trial_conversion_rate` | Trial-to-paid conversion |
| `conversion_to_paying` | Visitor-to-paying conversion |
| `customers_new` | New customer acquisitions |
| `refund_rate` | Refund rate percentage |

---

## CLI Reference

```
USAGE:
  rc-copilot <command> [options]

COMMANDS:
  analyze     Full subscription analysis with insights and recommendations
  overview    Quick metrics overview (key numbers at a glance)
  what-if     Run what-if scenario simulations

OPTIONS:
  --api-key <key>          RevenueCat API key (or REVENUECAT_API_KEY env var)
  --period <period>        Analysis period: 7d, 14d, 28d, 30d, 60d, 90d, 180d, 365d
  --format <format>        Output format: markdown, json
  --verbose                Show debug output
```

---

## Test Coverage

**174 tests passing — 100% coverage across all packages.**

| Package | Tests | Statements | Branches | Functions | Lines |
|---------|-------|-----------|----------|-----------|-------|
| CLI (core) | 57 | 100% | 100% | 100% | 100% |
| Web (dashboard + copilot) | 57 | 100% | 100% | 100% | 100% |
| AgentSkill | 117 | 100% | 100% | 100% | 100% |

```bash
# Run all tests
npm test

# With coverage
npm run test:coverage

# AgentSkill tests
cd skill/scripts && npm test
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CLI | TypeScript strict, zero production dependencies |
| Web | Next.js 15, Tailwind CSS, Recharts |
| AI Copilot | Claude Sonnet 4.6 via OpenRouter (streaming) |
| AgentSkill | Standalone TypeScript, zero prod deps |
| Testing | Vitest, v8 coverage |
| Deploy | Vercel |

---

## Content

| Deliverable | Link |
|-------------|------|
| 📝 Blog Post (2,400+ words) | [content/blog-post.md](content/blog-post.md) |
| 🐦 Social Posts (6 posts) | [content/social-posts.md](content/social-posts.md) |
| 📈 Growth Campaign ($100) | [content/growth-campaign.md](content/growth-campaign.md) |
| 🎬 Video Demo | [Download (GitHub Release)](https://github.com/caiovicentino/rc-copilot/releases/download/v1.0.0/demo.mp4) |
| 📋 Process Log | [PROCESS_LOG.md](PROCESS_LOG.md) |
| 📄 Full Submission | [SUBMISSION.md](SUBMISSION.md) |

---

## License

[MIT](LICENSE)

---

Built by [Major 🎖️](https://github.com/caiovicentino) for RevenueCat
