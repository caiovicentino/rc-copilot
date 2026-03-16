import Link from "next/link";
import Navbar from "@/components/Navbar";

const features = [
  {
    title: "AI Copilot",
    description:
      "Ask your data anything — AI-powered chat that understands your subscription metrics. Get instant answers, executive summaries, and actionable recommendations grounded in real data.",
    icon: "✨",
    color: "bg-purple-500/20 text-purple-400",
    href: "/copilot",
  },
  {
    title: "Anomaly Detection",
    description:
      "Automatically detects statistical anomalies in your subscription metrics using z-score analysis. Surfaces revenue drops, churn spikes, and conversion changes before they become problems.",
    icon: "!!",
    color: "bg-red-500/20 text-red-400",
  },
  {
    title: "Trend Analysis",
    description:
      "Tracks directional trends across revenue, MRR, churn, trial conversion, and customer growth. Identifies inflection points and provides context against industry benchmarks.",
    icon: "↗",
    color: "bg-emerald-500/20 text-emerald-400",
  },
  {
    title: "What-If Simulator",
    description:
      "Interactive scenario modeling — adjust churn reduction, trial conversion, and customer growth to see projected 12-month impact on MRR and revenue in real time.",
    icon: "⚡",
    color: "bg-blue-500/20 text-blue-400",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live Demo Available
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-100 tracking-tight mb-4">
            RC Copilot
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Your autonomous subscription analyst. Real-time anomaly detection, trend analysis, and
            what-if simulations — powered by RevenueCat data.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors text-lg"
          >
            View Live Demo
            <span className="text-xl">&rarr;</span>
          </Link>
        </section>

        {/* Feature Cards */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const card = (
                <div
                  className={`bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-colors ${"href" in feature ? "cursor-pointer" : ""}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-lg font-bold ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                </div>
              );
              return "href" in feature && feature.href ? (
                <Link key={feature.title} href={feature.href}>{card}</Link>
              ) : (
                <div key={feature.title}>{card}</div>
              );
            })}
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-slate-800 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-bold text-slate-100 text-center mb-12">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { step: "1", title: "Connect", desc: "Point RC Copilot at your RevenueCat project via API key" },
                { step: "2", title: "Analyze", desc: "Fetches 15 months of data, runs statistical analysis on every metric" },
                { step: "3", title: "Act", desc: "Get actionable insights, anomaly alerts, and revenue projections" },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold mx-auto mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-slate-100 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            Built by <span className="text-slate-200">Caio Vicentino</span> for RevenueCat
          </p>
          <a
            href="https://github.com/caio-vicentino"
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
