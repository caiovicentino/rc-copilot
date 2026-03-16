import Navbar from "@/components/Navbar";
import Link from "next/link";

const commands = [
  {
    name: "overview",
    description: "Quick health snapshot — key metrics at a glance in seconds",
    usage: "npx tsx rc-analyze.ts overview",
    output: "MRR, Active Subscriptions, Trials, Churn, Revenue — with trend arrows",
    icon: "📊",
  },
  {
    name: "analyze",
    description: "Full statistical analysis with anomaly detection, trends, and insights",
    usage: "npx tsx rc-analyze.ts analyze --period 90d",
    output: "Z-score anomalies, linear regression trends, industry benchmarks, What-If scenarios",
    icon: "🔬",
  },
  {
    name: "what-if",
    description: "Revenue impact simulator — model churn reduction, trial improvement, growth",
    usage: "npx tsx rc-analyze.ts what-if",
    output: "3 scenarios with projected 12-month MRR and revenue impact",
    icon: "⚡",
  },
];

const metrics = [
  "MRR", "Revenue", "Active Subscriptions", "New Customers", "Churn",
  "Trial Conversion", "Conversion to Paying", "ARPU", "Refund Rate", "Active Trials",
];

const capabilities = [
  { title: "Zero Dependencies", desc: "Pure TypeScript — no runtime deps. Just Node.js 18+ native fetch.", icon: "📦" },
  { title: "Z-Score Anomaly Detection", desc: "Statistical outlier detection with configurable threshold (default: 2σ).", icon: "🎯" },
  { title: "Linear Regression Trends", desc: "Least-squares trend analysis with direction classification and R² confidence.", icon: "📈" },
  { title: "What-If Simulator", desc: "Model churn reduction, trial conversion, and customer growth scenarios.", icon: "🧪" },
  { title: "Industry Benchmarks", desc: "Compare churn (5-7%), trial conversion (25-30%), refund rate (1-3%) against industry.", icon: "🏆" },
  { title: "Dual Output", desc: "Human-readable Markdown or structured JSON for programmatic pipelines.", icon: "🔄" },
];

export default function SkillPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm px-4 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              AgentSkill
            </div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-3 py-1.5 rounded-full">
              117 tests · 100% coverage
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 tracking-tight mb-4">
            RC Copilot AgentSkill
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mb-8">
            Give any AI agent the power to analyze RevenueCat subscription data autonomously.
            Drop-in skill with zero dependencies — just set an API key and go.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com/caiovicentino/rc-copilot/tree/main/skill"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold rounded-xl transition-colors"
            >
              View on GitHub &rarr;
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
            >
              See Live Dashboard &rarr;
            </Link>
          </div>
        </section>

        {/* What It Does */}
        <section className="border-t border-slate-800 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">What is an AgentSkill?</h2>
            <p className="text-slate-400 max-w-3xl mb-12">
              An AgentSkill is a reusable module that gives AI agents specialized capabilities.
              Instead of writing custom integrations, any agent (Claude, GPT, Codex, etc.) can
              load this skill and instantly analyze RevenueCat data — anomaly detection, trends,
              forecasting — all from a single TypeScript file with zero dependencies.
            </p>

            <h3 className="text-xl font-semibold text-slate-100 mb-6">Capabilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((cap) => (
                <div key={cap.title} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="text-2xl mb-3">{cap.icon}</div>
                  <h4 className="font-semibold text-slate-100 mb-1">{cap.title}</h4>
                  <p className="text-sm text-slate-400">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Commands */}
        <section className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-bold text-slate-100 mb-8">Commands</h2>
            <div className="space-y-6">
              {commands.map((cmd) => (
                <div key={cmd.name} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{cmd.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-100 mb-1">{cmd.name}</h3>
                      <p className="text-slate-400 mb-3">{cmd.description}</p>
                      <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-emerald-400 mb-2">
                        $ {cmd.usage}
                      </div>
                      <p className="text-xs text-slate-500">→ {cmd.output}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Metrics Tracked */}
        <section className="border-t border-slate-800 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-bold text-slate-100 mb-8">10 Core Metrics Tracked</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {metrics.map((m) => (
                <div key={m} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-center">
                  <span className="text-sm font-medium text-slate-200">{m}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Start */}
        <section className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-bold text-slate-100 mb-8">Quick Start</h2>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <pre className="text-sm text-slate-300 overflow-x-auto leading-relaxed">
{`# 1. Clone the repo
git clone https://github.com/caiovicentino/rc-copilot.git
cd rc-copilot/skill/scripts

# 2. Install dev deps (tsx + vitest only)
npm install

# 3. Set your API key
export REVENUECAT_API_KEY="sk_your_key_here"

# 4. Run analysis
npx tsx rc-analyze.ts overview          # Quick health check
npx tsx rc-analyze.ts analyze           # Full analysis (28 days)
npx tsx rc-analyze.ts analyze --period 90d --format json  # JSON output
npx tsx rc-analyze.ts what-if           # Revenue scenarios`}
              </pre>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="border-t border-slate-800 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-bold text-slate-100 mb-8">Architecture</h2>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <pre className="text-sm text-slate-300 overflow-x-auto leading-relaxed">
{`┌──────────────────────────────────────────────────────────┐
│                    AI Agent (any LLM)                     │
│  "Analyze subscription health for my app"                │
└──────────────┬───────────────────────────────────────────┘
               │ reads SKILL.md → runs command
               ▼
┌──────────────────────────────────────────────────────────┐
│              rc-analyze.ts (434 lines)                    │
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
└──────────────────────────────────────────────────────────┘`}
              </pre>
            </div>
          </div>
        </section>

        {/* Testing */}
        <section className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-bold text-slate-100 mb-8">Test Coverage</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Statements", value: "100%" },
                { label: "Branches", value: "100%" },
                { label: "Functions", value: "100%" },
                { label: "Lines", value: "100%" },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-800 border border-emerald-500/30 rounded-xl p-5 text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-slate-400 mt-6">
              117 tests covering API client, analyzer, simulator, formatter, CLI, and edge cases
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            Built by <span className="text-slate-200">Major 🎖️</span> for RevenueCat
          </p>
          <a
            href="https://github.com/caiovicentino/rc-copilot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            GitHub &rarr;
          </a>
        </div>
      </footer>
    </div>
  );
}
