---
name: rc-copilot
description: Analyze RevenueCat subscription metrics for any app. Use when asked about subscription health, MRR, churn, trial conversion, revenue trends, anomaly detection, or What-If revenue scenarios. Requires a RevenueCat Charts API V2 key (read-only). Provides CLI commands for overview, full analysis, and scenario simulation. Trigger on "subscription metrics", "churn analysis", "MRR", "revenue health", "trial conversion", "RevenueCat", "subscription analytics", "what-if scenario", "anomaly detection", or any subscription app performance question.
---

# RC Copilot — RevenueCat Subscription Intelligence

Analyze any RevenueCat-connected app's subscription health with zero dependencies.

## Prerequisites

- **API Key**: RevenueCat Charts API V2 secret key (`sk_...`). Read-only is sufficient.
  - Get it from RevenueCat Dashboard → Project Settings → API Keys → Charts API V2
- **Node.js**: v18+ (uses native fetch)
- **Install**: `cd <skill-dir>/scripts && npm install` (first run only — installs TypeScript + vitest dev deps)

## Quick Start

```bash
# Set API key
export REVENUECAT_API_KEY="sk_your_key_here"

# Health overview (fastest — key metrics at a glance)
npx tsx <skill-dir>/scripts/rc-analyze.ts overview

# Full analysis with anomaly detection, trends, insights
npx tsx <skill-dir>/scripts/rc-analyze.ts analyze --period 90d

# What-If simulator (revenue impact scenarios)
npx tsx <skill-dir>/scripts/rc-analyze.ts what-if

# JSON output for programmatic use
npx tsx <skill-dir>/scripts/rc-analyze.ts analyze --format json --period 30d
```

## Commands

### `overview`
Quick health snapshot: MRR, ARR, active subs, churn rate, trial conversion, revenue — with trend arrows and change percentages. Takes ~5 seconds.

### `analyze [--period 30d|90d|180d|365d] [--format markdown|json]`
Full analysis across 10 chart types:
- **Metrics**: Current vs previous period with % change
- **Trends**: Linear regression detecting up/down/flat patterns
- **Anomalies**: Z-score detection (2σ threshold) flagging spikes and drops
- **Insights**: Rule-based recommendations (churn vs industry avg, trial conversion benchmarks, revenue seasonality, refund rate alerts)

Default period: 28d. Use 90d+ for trend accuracy.

### `what-if [--period 30d]`
Three scenario simulations using current data:
1. **Churn Reduction**: Impact of reducing churn by 2 percentage points
2. **Trial Conversion Improvement**: Impact of reaching 50% trial-to-paid
3. **Customer Growth**: Impact of 2x acquisition volume

Each scenario shows 12-month MRR and revenue projections.

## Available Metrics (10 Charts)

| Chart | What it measures | Unit |
|-------|-----------------|------|
| `revenue` | Total revenue | $ |
| `mrr` | Monthly Recurring Revenue | $ |
| `arr` | Annual Recurring Revenue | $ |
| `churn` | Monthly churn rate | % |
| `actives` | Active subscriptions | # |
| `trials` | Active trials | # |
| `trial_conversion_rate` | Trial → paid conversion | % |
| `conversion_to_paying` | Visitor → paying | % |
| `customers_new` | New customers per period | # |
| `refund_rate` | Refund rate | % |

## Industry Benchmarks (built-in)

- Churn: 5-7% monthly (healthy)
- Trial conversion: 25-30% (average), >35% (excellent)
- Conversion to paying: 2-5% (typical)
- Refund rate: 1-3% (normal), >5% (elevated)

## Output Formats

- **Markdown** (default): Human-readable report with emoji indicators
- **JSON**: Structured data with all metrics, anomalies, insights, and scenarios — ideal for piping into other tools or LLM context

## Architecture

```
RevenueCat Charts API V2
        │
   ┌────▼────┐
   │  API     │ Rate-limited client (120 req/min, auto-retry on 429)
   │  Client  │ Auto-discovers project from API key
   └────┬────┘
        │
   ┌────▼─────────┐
   │  Analyzer     │ Z-score anomalies, linear regression trends,
   │               │ rule-based insights with industry benchmarks
   └────┬─────────┘
        │
   ┌────▼──────────┐
   │  Simulator     │ What-If scenarios: churn, trials, growth
   │                │ 12-month compound projections
   └────┬──────────┘
        │
   ┌────▼────┐
   │  Report  │ Markdown or JSON output
   └─────────┘
```

## Advanced Usage

### Custom period analysis
```bash
npx tsx <skill-dir>/scripts/rc-analyze.ts analyze --period 365d --format json > annual-report.json
```

### Pipe JSON into LLM context
```bash
ANALYSIS=$(npx tsx <skill-dir>/scripts/rc-analyze.ts analyze --period 90d --format json)
echo "Based on this data, what should I prioritize? $ANALYSIS"
```

### Compare periods
Run two analyses with different periods and compare the JSON outputs for trend shifts.

## Error Handling

- **401**: Invalid API key or expired. Check RevenueCat dashboard.
- **429**: Rate limited. Script auto-retries with backoff.
- **No project found**: API key may not have Charts API V2 access. Verify in dashboard.

## Notes

- All data is read-only. The skill never modifies RevenueCat state.
- API key is never logged or exposed in output.
- Rate limiting is built-in (500ms between requests, auto-retry on 429).
- For web dashboard with AI chat, see the `web/` directory in the RC Copilot repo.
