export const dynamic = "force-dynamic";

import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import HealthGauge from "@/components/HealthGauge";
import AnomalyCard from "@/components/AnomalyCard";
import TrendChart from "@/components/TrendChart";
import WhatIfSimulator from "@/components/WhatIfSimulator";
import InsightCard from "@/components/InsightCard";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import { discoverProject, fetchCharts, fetchOverview } from "@/lib/revenuecat";
import { analyze } from "@/lib/analyzer";
import type { ChartName, OverviewMetric, TrendResult } from "@/lib/types";

const CORE_CHARTS: ChartName[] = [
  "revenue", "mrr", "churn", "actives", "trials",
  "trial_conversion_rate", "conversion_to_paying",
  "customers_new", "refund_rate", "arr",
];

// Priority charts to show as trend lines
const CHART_DISPLAY_ORDER: { key: string; title: string; color: string }[] = [
  { key: "revenue", title: "Revenue", color: "#10b981" },
  { key: "mrr", title: "MRR", color: "#3b82f6" },
  { key: "churn", title: "Churn Rate", color: "#ef4444" },
  { key: "trial_conversion_rate", title: "Trial Conversion Rate", color: "#f59e0b" },
  { key: "customers_new", title: "New Customers", color: "#8b5cf6" },
];

// Overview metric display config
const OVERVIEW_DISPLAY: { id: string; label: string }[] = [
  { id: "mrr", label: "MRR" },
  { id: "revenue", label: "Revenue" },
  { id: "active_subscriptions", label: "Active Subs" },
  { id: "active_trials", label: "Active Trials" },
  { id: "new_customers", label: "New Customers" },
  { id: "active_users", label: "Active Users" },
];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default async function DashboardPage() {
  const apiKey = process.env.REVENUECAT_API_KEY;

  if (!apiKey) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-slate-800 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
            <h2 className="text-xl font-bold text-red-400 mb-2">Configuration Error</h2>
            <p className="text-slate-400">REVENUECAT_API_KEY environment variable is not set.</p>
          </div>
        </div>
      </div>
    );
  }

  let project: { id: string; name: string };
  let overview: { metrics: OverviewMetric[] };
  let analysisResult: Awaited<ReturnType<typeof analyze>> & { healthScore: number };

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 15);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    [project, overview] = await Promise.all([
      discoverProject(apiKey),
      fetchOverview(apiKey),
    ]);

    const charts = await fetchCharts(apiKey, CORE_CHARTS, {
      startDate: startStr,
      endDate: endStr,
      resolution: "month",
    });

    analysisResult = analyze(project.name, charts, startDate, endDate) as typeof analysisResult;
  } catch (err) {
    console.error("Dashboard data fetch error:", err);
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-slate-800 border border-red-500/30 rounded-xl p-8 text-center max-w-md">
            <h2 className="text-xl font-bold text-red-400 mb-2">Unable to Fetch Data</h2>
            <p className="text-slate-400 text-sm">{(err as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, trends, anomalies, insights, chartData, healthScore } = analysisResult;

  // Find trend for a chart
  function findTrend(chartKey: string): TrendResult | undefined {
    const cd = chartData[chartKey];
    if (!cd) return undefined;
    return trends.find((t) => t.label === cd.label);
  }

  // Extract simulator inputs from real data
  const mrrData = chartData["mrr"];
  const churnData = chartData["churn"];
  const trialConvData = chartData["trial_conversion_rate"];
  const customersNewData = chartData["customers_new"];
  const activesData = chartData["actives"];

  const currentMRR = mrrData?.values[mrrData.values.length - 1] ?? 0;
  const currentChurnRate = churnData ? mean(churnData.values.slice(-3)) : 5;
  const currentTrialConversion = trialConvData ? mean(trialConvData.values.slice(-3)) : 30;
  const monthlyNewCustomers = customersNewData ? mean(customersNewData.values.slice(-3)) : 100;
  const activeSubscriptions = activesData?.values[activesData.values.length - 1] ?? 0;
  const avgRevenuePerUser = activeSubscriptions > 0 ? currentMRR / activeSubscriptions : 3;

  // Build overview cards from overview API data, falling back to chart data
  const overviewCards = OVERVIEW_DISPLAY.map((item) => {
    const overviewMetric = overview.metrics.find((m) => m.id === item.id);
    if (overviewMetric) {
      const metric = metrics.find((m) => m.name.toLowerCase().includes(item.label.toLowerCase().split(" ")[0]));
      return {
        name: item.label,
        value: overviewMetric.value,
        unit: overviewMetric.unit === "USD" ? "$" : overviewMetric.unit,
        period: overviewMetric.period,
        trend: metric?.trend,
        changePercent: metric?.changePercent,
      };
    }
    // Fallback to chart data
    const metric = metrics.find((m) => m.name.toLowerCase().includes(item.label.toLowerCase().split(" ")[0]));
    return metric
      ? {
          name: item.label,
          value: metric.current,
          unit: metric.unit,
          period: undefined,
          trend: metric.trend,
          changePercent: metric.changePercent,
        }
      : null;
  }).filter(Boolean) as Array<{
    name: string;
    value: number;
    unit: string;
    period?: string;
    trend?: "up" | "down" | "flat";
    changePercent?: number;
  }>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
          <p className="text-sm text-slate-400 mt-1">Subscription analytics dashboard — live data from RevenueCat</p>
        </div>

        {/* Overview Strip + Health Score */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {overviewCards.map((card) => (
              <MetricCard
                key={card.name}
                name={card.name}
                value={card.value}
                unit={card.unit}
                period={card.period}
                trend={card.trend}
                changePercent={card.changePercent}
              />
            ))}
          </div>
          <HealthGauge score={healthScore} />
        </section>

        {/* Anomalies */}
        {anomalies.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              Anomalies Detected
              <span className="ml-2 text-sm font-normal text-slate-400">({anomalies.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {anomalies.slice(0, 6).map((anomaly, i) => (
                <AnomalyCard key={i} anomaly={anomaly} />
              ))}
            </div>
          </section>
        )}

        {/* Trend Charts */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Trends</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {CHART_DISPLAY_ORDER.map((chart) => {
              const cd = chartData[chart.key];
              if (!cd || cd.values.length < 2) return null;
              const trend = findTrend(chart.key);
              return (
                <TrendChart
                  key={chart.key}
                  title={chart.title}
                  dates={cd.dates}
                  values={cd.values}
                  unit={cd.unit}
                  trend={trend?.direction}
                  changePercent={trend?.changePercent}
                  color={chart.color}
                />
              );
            })}
          </div>
        </section>

        {/* What-If Simulator */}
        <section className="mb-8">
          <WhatIfSimulator
            currentMRR={currentMRR}
            currentChurnRate={currentChurnRate}
            currentTrialConversion={currentTrialConversion}
            monthlyNewCustomers={monthlyNewCustomers}
            avgRevenuePerUser={avgRevenuePerUser}
            activeSubscriptions={activeSubscriptions}
          />
        </section>

        {/* Executive Summary */}
        <section className="mb-8">
          <ExecutiveSummary
            projectName={project.name}
            metrics={metrics}
            insights={insights}
            anomalies={anomalies}
            healthScore={healthScore}
            periodStart={analysisResult.periodStart}
            periodEnd={analysisResult.periodEnd}
          />
        </section>

        {/* Insights */}
        {insights.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.slice(0, 6).map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-slate-800 py-6 mt-8">
          <p className="text-sm text-slate-500 text-center">
            Built by <span className="text-slate-300">Major 🎖️</span> for RevenueCat &middot;{" "}
            Powered by RC Copilot
          </p>
        </footer>
      </main>
    </div>
  );
}
