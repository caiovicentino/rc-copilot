# 📋 RC Copilot — Process Log

*This log documents every step, decision, and tradeoff made during the 48-hour assignment window. All work was performed autonomously by Major, an AI agent built on OpenClaw.*

## Timeline

### Hour 0 (March 16, 2026 — 11:38 BRT)
**Assignment received.** Email from Angela Buccitti (RevenueCat) with take-home assignment PDF.

**First actions (11:38-11:45):**
1. Extracted and analyzed the full PDF — identified all 3 tasks, deliverables, evaluation criteria
2. Created project directory and initialized git repo
3. Explored RevenueCat API v2 documentation

### Hour 0.5 (11:45-12:00)
**API Exploration & Data Discovery:**
1. Tested authentication with provided API key → confirmed read-only access
2. Discovered project: Dark Noise (proj058a6330) — an ambient noise/sound app
3. Mapped all 21 available chart endpoints:
   - actives, actives_movement, actives_new, arr, churn, cohort_explorer
   - conversion_to_paying, customers_new, ltv_per_customer, ltv_per_paying_customer
   - mrr, mrr_movement, refund_rate, revenue, subscription_retention
   - subscription_status, trials, trials_movement, trials_new, customers_active, trial_conversion_rate
4. Pulled real data from key charts (revenue, mrr, churn, trials, conversion)
5. **Key insight:** Dark Noise has $4.5K MRR, 2,529 active subs, 41% trial conversion, ~7% monthly churn

**Decision: Tool concept**
- Rejected: Simple dashboard (every candidate will build this)
- Rejected: API wrapper library (too thin, not impressive enough)
- **Chosen: RC Copilot** — autonomous AI analyst that generates actionable reports
- **Reasoning:** This directly demonstrates the role (agentic AI + developer advocacy). The tool IS what the job is about.

**Decision: Architecture**
- Zero production dependencies → lightweight, auditable, trustworthy
- Rule-based analysis first → works without any AI API key
- Optional LLM enhancement → shows sophistication without requiring it
- GitHub Action native → developers' natural habitat
- **Tradeoff:** No fancy UI. Reports are Markdown. This is intentional — devs live in terminals and GitHub, not dashboards.

### Hour 1-3 (12:00-14:00)
**Development Phase:**
- Created comprehensive SPEC.md with architecture, API details, data format
- Spawned Claude Code (coding agent) to build the full TypeScript project
- Parallel work: began drafting blog post structure and growth campaign

### Tools Used
- **OpenClaw**: Orchestration, sub-agent management, file operations
- **Claude Code**: Coding agent for TypeScript development
- **RevenueCat Charts API v2**: Data source
- **curl**: API exploration and testing
- **edge-tts**: Video voiceover generation
- **Remotion** (planned): Video tutorial production
- **Git/GitHub**: Version control and hosting

### Key Tradeoffs

| Decision | Alternative | Why This |
|----------|------------|----------|
| TypeScript | Python | RC's ecosystem is JS/TS. Speaks their language. |
| Zero deps | axios, lodash, etc. | Shows confidence, keeps it auditable, no supply chain risk |
| Rule-based first | LLM-only | Works offline, predictable, fast. LLM is enhancement, not crutch. |
| GitHub Action | Hosted SaaS | Meets devs where they are. Zero signup friction. |
| Markdown reports | HTML/PDF | Native to dev workflows (GitHub, Slack, email) |
| CLI tool | Web app | Composable. Can pipe output anywhere. |

---

*This log will be updated as the assignment progresses.*
