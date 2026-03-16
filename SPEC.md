# RC Copilot — RevenueCat AI Analyst

## Overview
An autonomous AI agent that connects to RevenueCat's Charts API, analyzes subscription metrics, detects anomalies, and generates actionable insights as natural-language reports. Runs as a GitHub Action, CLI tool, or one-shot script.

## Architecture
```
RevenueCat Charts API v2
        ↓
  RC Copilot Core (TypeScript)
  ├── API Client (fetches all 21 chart types)
  ├── Data Analyzer (trend detection, anomaly flagging, comparisons)
  ├── Insight Generator (rule-based + optional LLM)
  └── Report Builder (Markdown + JSON + optional Slack/email)
        ↓
  Output: Weekly/daily report with actionable insights
```

## RevenueCat Charts API Details
- **Base URL:** `https://api.revenuecat.com/v2`
- **Auth:** `Authorization: Bearer <API_KEY>`
- **Project ID:** Discovered via `GET /v2/projects`
- **Chart endpoint:** `GET /v2/projects/{project_id}/charts/{chart_name}?resolution={day|week|month}&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Overview:** `GET /v2/projects/{project_id}/metrics/overview`

### Available Charts (21 total):
actives, actives_movement, actives_new, arr, churn, cohort_explorer, conversion_to_paying, customers_new, ltv_per_customer, ltv_per_paying_customer, mrr, mrr_movement, refund_rate, revenue, subscription_retention, subscription_status, trials, trials_movement, trials_new, customers_active, trial_conversion_rate

### Data Format:
```json
{
  "category": "revenue",
  "display_name": "Revenue",
  "measures": [{ "display_name": "Revenue", "unit": "$" }, { "display_name": "Transactions", "unit": "#" }],
  "summary": { "average": { "Revenue": 4889.49 }, "total": { "Revenue": 73342.28 } },
  "values": [{ "cohort": 1735689600, "measure": 0, "value": 4944.16 }]
}
```

### Real Data from Dark Noise (test app):
- MRR: ~$4,500/month
- Revenue: ~$5K/month (peaked $7.2K in Dec 2025)
- Active Subscriptions: ~2,529
- Active Trials: ~65
- Churn Rate: ~7% monthly average
- Trial Conversion Rate: ~41%
- New Customers (28d): 1,572
- Conversion to Paying (7d): ~4.45%

## Features to Build

### 1. Core: API Client (`src/api.ts`)
- Auto-discover project ID from API key
- Fetch any chart with configurable date range and resolution
- Fetch overview metrics
- Rate limiting and error handling
- TypeScript types for all responses

### 2. Analyzer (`src/analyzer.ts`)
Analyze data and detect:
- **Trend Detection:** MRR going up/down/flat over last N periods
- **Anomaly Detection:** Values > 2 standard deviations from mean
- **Churn Alerts:** Churn rate increasing vs previous period
- **Trial Performance:** Conversion rate changes
- **Revenue Anomalies:** Unexpected drops or spikes
- **Seasonality:** Month-over-month patterns (e.g., December spike)
- **What-If Simulator:** "If churn drops by X%, MRR impact over 12 months"

### 3. Report Generator (`src/report.ts`)
- **Markdown report:** Beautiful, readable, with sections and metrics
- **JSON structured output:** For programmatic consumption
- **Executive Summary:** 3-5 bullet points of most important findings
- **Actionable Recommendations:** Based on data patterns
- **Optional LLM mode:** If OPENAI_API_KEY is set, use AI for richer analysis
- **Optional Slack webhook:** Post report to Slack channel

### 4. CLI (`src/cli.ts`)
```bash
npx rc-copilot analyze --api-key sk_xxx --period 90d --format markdown
npx rc-copilot overview --api-key sk_xxx
npx rc-copilot what-if --api-key sk_xxx --reduce-churn 2%
```

### 5. GitHub Action (`action.yml`)
```yaml
- uses: major-rc/rc-copilot@v1
  with:
    api-key: ${{ secrets.REVENUECAT_API_KEY }}
    period: 90d
    slack-webhook: ${{ secrets.SLACK_WEBHOOK }}
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9am
```

## File Structure
```
rc-copilot/
├── src/
│   ├── index.ts          # Main entry point
│   ├── api.ts            # RevenueCat API client
│   ├── analyzer.ts       # Data analysis & anomaly detection
│   ├── report.ts         # Report generation (MD + JSON)
│   ├── simulator.ts      # What-If scenario simulator
│   ├── cli.ts            # CLI interface
│   └── types.ts          # TypeScript types
├── action.yml            # GitHub Action definition
├── package.json
├── tsconfig.json
├── README.md             # Comprehensive documentation
├── LICENSE               # MIT
├── .github/
│   └── workflows/
│       └── example.yml   # Example workflow
└── examples/
    ├── report-sample.md  # Example generated report
    └── dark-noise-analysis.md  # Real analysis from assignment data
```

## Tech Stack
- TypeScript / Node.js 20+
- Zero production dependencies (just fetch API + built-in Node)
- Dev deps: tsx for running, vitest for testing (optional)
- No external AI dependency required (rule-based analysis by default)
- Optional: OpenAI/Anthropic for enhanced analysis

## Key Design Decisions
1. **Zero deps for core** — makes it lightweight and easy to audit
2. **Rule-based first, LLM optional** — works without API keys, but enhanced with them
3. **GitHub Action native** — primary distribution channel for developers
4. **Real insights from real data** — use Dark Noise data to show genuine value
5. **Beautiful Markdown reports** — developers live in GitHub, make reports feel native

## API Key for Testing
- Key: sk_qdnvkjsVGhoVVNGiajqNHYIypcjgs
- App: Dark Noise
- Project ID: proj058a6330
- Access: Read-only, Charts metrics permissions
- NOTE: This key is provided by RevenueCat for the assignment. In production code, use environment variables.

## Sample Output (Target)
```markdown
# 📊 RC Copilot Report — Dark Noise
*Generated: March 16, 2026 | Period: Last 90 days*

## Executive Summary
- ⚠️ **Revenue dropped 43% in February** ($2,900 vs $4,619 in January) — investigate pricing changes or seasonal effect
- ✅ **Trial conversion rate is strong at 41%** — well above industry average (~25-30%)
- 📈 **December spike ($7,243)** suggests holiday/gifting opportunity — plan for Q4 2026
- ⚠️ **Churn averaging 7%/month** — each 1% reduction = ~$540 additional annual MRR
- 🎯 **4.45% visitor-to-paying conversion** — room for paywall optimization

## Key Metrics
| Metric | Current | Trend | Industry Avg |
|--------|---------|-------|--------------|
| MRR | $4,557 | → Flat | - |
| Monthly Revenue | $5,105 | ↓ Declining | - |
| Active Subs | 2,529 | → Stable | - |
| Churn Rate | 7.0% | → Stable | 5-7% |
| Trial Conv. | 41% | ✅ Strong | 25-30% |

## 🔍 Anomalies Detected
1. **Feb 2026 Revenue Dip:** $2,900 is 2.1σ below 12-month average ($4,889)
2. **Dec 2025 Revenue Spike:** $7,243 is 2.4σ above average — seasonal pattern

## 💡 Recommendations
1. Investigate February revenue drop — was there a pricing change, app issue, or seasonal effect?
2. Plan a Q4 campaign — December consistently outperforms, suggesting gifting/holiday potential
3. Consider reducing trial friction — 41% conversion is great, but 59% still churn from trial
4. Target churn reduction — a 1% improvement adds ~$540/year to MRR

## 🔮 What-If Scenarios
- Reduce churn from 7% to 5%: **+$1,080 MRR in 12 months**
- Increase trial conversion from 41% to 50%: **+$XX additional paying users/month**
- Double new customer acquisition: **+$XX projected MRR growth**
```
