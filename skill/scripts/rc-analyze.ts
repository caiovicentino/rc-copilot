#!/usr/bin/env npx tsx
/**
 * RC Copilot — RevenueCat Subscription Intelligence
 * Standalone analysis script for any AI agent.
 * Zero production dependencies. Requires Node 18+ (native fetch).
 *
 * Usage:
 *   export REVENUECAT_API_KEY="sk_..."
 *   npx tsx rc-analyze.ts overview
 *   npx tsx rc-analyze.ts analyze [--period 90d] [--format json|markdown]
 *   npx tsx rc-analyze.ts what-if [--period 30d]
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project { id: string; name: string; }
interface ProjectsResponse { items: Project[]; next_page: string | null; }

interface ChartMeasure {
  display_name: string; unit: string; chartable?: boolean;
  tabulable?: boolean; decimal_precision?: number; description?: string;
}
interface ChartValue { cohort: number; measure: number; value: number; incomplete?: boolean; }
interface ChartSummary { average: Record<string, number>; total: Record<string, number>; }
interface ChartResponse {
  category: string; display_name: string; measures: ChartMeasure[];
  summary: ChartSummary; values: ChartValue[];
}
interface OverviewMetric { id: string; name: string; description: string; value: number; unit: string; period: string; }
interface OverviewResponse { metrics: OverviewMetric[]; }

type TrendDirection = 'up' | 'down' | 'flat';
type Severity = 'info' | 'warning' | 'critical';
interface TimeSeries { dates: Date[]; values: number[]; label: string; unit: string; }
interface TrendResult { direction: TrendDirection; changePercent: number; periodStart: number; periodEnd: number; label: string; }
interface Anomaly { date: Date; value: number; expected: number; deviation: number; label: string; severity: Severity; }
interface Insight { title: string; description: string; severity: Severity; metric?: string; value?: number; recommendation?: string; }
interface MetricSnapshot { name: string; current: number; previous: number; changePercent: number; trend: TrendDirection; unit: string; industryAvg?: string; }
interface WhatIfScenario { name: string; description: string; currentValue: number; targetValue: number; unit: string; projectedImpact: string; mrrImpact12Months: number; revenueImpact12Months: number; }

const CORE_CHARTS = [
  'revenue', 'mrr', 'churn', 'actives', 'trials',
  'trial_conversion_rate', 'conversion_to_paying',
  'customers_new', 'refund_rate', 'arr',
] as const;
type ChartName = (typeof CORE_CHARTS)[number];

type OutputFormat = 'markdown' | 'json';
type Period = '7d' | '14d' | '28d' | '30d' | '60d' | '90d' | '180d' | '365d';

// ─── API Client ──────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.revenuecat.com/v2';

class RevenueCatAPI {
  private apiKey: string;
  private projectId: string | null = null;
  private projectName: string | null = null;
  private lastRequestTime = 0;

  constructor(apiKey: string) { this.apiKey = apiKey; }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed));
    this.lastRequestTime = Date.now();
  }

  private async request<T>(path: string, retries = 3): Promise<T> {
    await this.throttle();
    for (let attempt = 1; attempt <= retries; attempt++) {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('retry-after') || '2', 10);
        console.error(`  ⏳ Rate limited, waiting ${wait}s (${attempt}/${retries})`);
        await new Promise(r => setTimeout(r, wait * 1000));
        continue;
      }
      if (res.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw new Error(`API ${res.status}: ${await res.text()}`);
    }
    throw new Error(`Failed after ${retries} retries`);
  }

  async discoverProject(): Promise<{ id: string; name: string }> {
    if (this.projectId && this.projectName) return { id: this.projectId, name: this.projectName };
    const data = await this.request<ProjectsResponse>('/projects');
    if (!data.items?.length) throw new Error('No projects found for this API key');
    this.projectId = data.items[0].id;
    this.projectName = data.items[0].name;
    return { id: this.projectId, name: this.projectName };
  }

  async fetchChart(chartName: string, startDate: string, endDate: string, resolution = 'day'): Promise<ChartResponse> {
    const { id } = await this.discoverProject();
    return this.request<ChartResponse>(`/projects/${id}/charts/${chartName}?resolution=${resolution}&start_date=${startDate}&end_date=${endDate}`);
  }

  async fetchCharts(chartNames: readonly string[], startDate: string, endDate: string): Promise<Map<ChartName, ChartResponse>> {
    const results = new Map<ChartName, ChartResponse>();
    for (const name of chartNames) {
      try { results.set(name as ChartName, await this.fetchChart(name, startDate, endDate)); }
      catch (e) { console.error(`  ⚠️ Failed: ${name}: ${(e as Error).message}`); }
    }
    return results;
  }

  async fetchOverview(): Promise<OverviewResponse> {
    const { id } = await this.discoverProject();
    return this.request<OverviewResponse>(`/projects/${id}/metrics/overview`);
  }

  getProjectName(): string | null { return this.projectName; }
}

// ─── Analyzer ────────────────────────────────────────────────────────────────

function mean(v: number[]): number { return v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length; }
function stddev(v: number[]): number {
  if (v.length < 2) return 0;
  const avg = mean(v);
  return Math.sqrt(v.map(x => (x - avg) ** 2).reduce((a, b) => a + b, 0) / (v.length - 1));
}
function pctChange(cur: number, prev: number): number { return prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / Math.abs(prev)) * 100; }
function fmtNum(v: number, u: string): string {
  if (u === '$') return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (u === '%') return `${v.toFixed(1)}%`;
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function findPrimaryMeasure(chart: ChartResponse): number {
  for (let i = 0; i < chart.measures.length; i++) if (chart.measures[i].chartable) return i;
  return 0;
}

function extractTimeSeries(chart: ChartResponse): TimeSeries {
  const idx = findPrimaryMeasure(chart);
  const measure = chart.measures[idx];
  const filtered = chart.values.filter(v => v.measure === idx && !v.incomplete).sort((a, b) => a.cohort - b.cohort);
  return {
    dates: filtered.map(v => new Date(v.cohort * 1000)),
    values: filtered.map(v => v.value),
    label: measure?.display_name || chart.display_name,
    unit: measure?.unit || '',
  };
}

function detectTrend(series: TimeSeries): TrendResult {
  const values = series.values;
  if (values.length < 4) return { direction: 'flat', changePercent: 0, periodStart: values[0] || 0, periodEnd: values[values.length - 1] || 0, label: series.label };
  const splitAt = Math.floor(values.length * 0.67);
  const recentAvg = mean(values.slice(splitAt));
  const priorAvg = mean(values.slice(0, splitAt));
  const change = pctChange(recentAvg, priorAvg);
  return { direction: change > 5 ? 'up' : change < -5 ? 'down' : 'flat', changePercent: Math.round(change * 100) / 100, periodStart: priorAvg, periodEnd: recentAvg, label: series.label };
}

function detectAnomalies(series: TimeSeries, threshold = 2.0): Anomaly[] {
  const values = series.values;
  if (values.length < 5) return [];
  const avg = mean(values);
  const sd = stddev(values);
  if (sd === 0) return [];
  return values
    .map((v, i) => ({ v, i, dev: (v - avg) / sd }))
    .filter(x => Math.abs(x.dev) >= threshold)
    .map(x => ({
      date: series.dates[x.i], value: x.v, expected: avg,
      deviation: Math.round(x.dev * 10) / 10, label: series.label,
      severity: (Math.abs(x.dev) >= 3 ? 'critical' : 'warning') as Severity,
    }));
}

function generateInsights(charts: Map<ChartName, ChartResponse>, anomalies: Anomaly[]): Insight[] {
  const insights: Insight[] = [];

  const revChart = charts.get('revenue');
  if (revChart) {
    const series = extractTimeSeries(revChart);
    const trend = detectTrend(series);
    const values = series.values;
    const max = Math.max(...values);
    const maxDate = series.dates[values.indexOf(max)];
    if (trend.direction === 'down' && trend.changePercent < -10) {
      insights.push({ title: 'Revenue Declining', description: `Revenue decreased ${Math.abs(trend.changePercent).toFixed(1)}% in recent period.`, severity: 'warning', metric: 'Revenue', value: trend.periodEnd, recommendation: 'Investigate pricing changes, increased churn, or seasonal effects.' });
    }
    if (maxDate?.getMonth() === 11) {
      insights.push({ title: 'Holiday Revenue Spike', description: `Peak revenue ${fmtNum(max, '$')} in December — ${((max / mean(values) - 1) * 100).toFixed(0)}% above average.`, severity: 'info', metric: 'Revenue', value: max, recommendation: 'Plan Q4 campaigns and holiday promotions.' });
    }
  }

  const churnChart = charts.get('churn');
  if (churnChart) {
    const series = extractTimeSeries(churnChart);
    const recentChurn = mean(series.values.slice(-3));
    if (recentChurn > 8) insights.push({ title: 'High Churn Rate', description: `${recentChurn.toFixed(1)}% exceeds the 5-7% industry average.`, severity: 'warning', metric: 'Churn', value: recentChurn, recommendation: 'Analyze cohort retention. Consider onboarding improvements, win-back campaigns, or annual plan incentives.' });
    else if (recentChurn <= 5) insights.push({ title: 'Excellent Churn Rate', description: `${recentChurn.toFixed(1)}% is at or below industry average.`, severity: 'info', metric: 'Churn', value: recentChurn });
    else insights.push({ title: 'Churn Within Range', description: `${recentChurn.toFixed(1)}% is within the 5-7% industry range.`, severity: 'info', metric: 'Churn', value: recentChurn });

    const mrrChart = charts.get('mrr');
    if (mrrChart) {
      const mrrSeries = extractTimeSeries(mrrChart);
      const currentMRR = mrrSeries.values[mrrSeries.values.length - 1] || 0;
      const impact = currentMRR * 0.01 * 12;
      insights.push({ title: 'Churn Reduction Opportunity', description: `Each 1% churn reduction saves ~${fmtNum(impact, '$')}/year in MRR.`, severity: 'info', metric: 'Churn Impact', value: impact, recommendation: 'Target highest-churn cohorts with retention campaigns.' });
    }
  }

  const trialChart = charts.get('trial_conversion_rate');
  if (trialChart) {
    const conv = mean(extractTimeSeries(trialChart).values.slice(-3));
    if (conv > 35) insights.push({ title: 'Strong Trial Conversion', description: `${conv.toFixed(0)}% is above the 25-30% industry average.`, severity: 'info', metric: 'Trial Conversion', value: conv, recommendation: 'Consider increasing trial volume or testing shorter trial periods.' });
    else if (conv < 20) insights.push({ title: 'Low Trial Conversion', description: `${conv.toFixed(0)}% is below the 25-30% average.`, severity: 'warning', metric: 'Trial Conversion', value: conv, recommendation: 'Optimize trial length, in-trial engagement, and paywall copy.' });
  }

  const refundChart = charts.get('refund_rate');
  if (refundChart) {
    const rate = mean(extractTimeSeries(refundChart).values.slice(-3));
    if (rate > 5) insights.push({ title: 'Elevated Refund Rate', description: `${rate.toFixed(1)}% exceeds the 1-3% norm.`, severity: 'warning', metric: 'Refund Rate', value: rate, recommendation: 'Check app reviews. Improve onboarding to set expectations.' });
  }

  for (const a of anomalies.filter(a => a.severity === 'critical')) {
    const dir = a.value > a.expected ? 'Spike' : 'Drop';
    insights.push({ title: `${a.label} ${dir}`, description: `${fmtNum(a.value, a.label.includes('Rate') ? '%' : '#')} on ${a.date.toLocaleDateString('en-US')} is ${Math.abs(a.deviation).toFixed(1)}σ from mean.`, severity: 'critical', metric: a.label, value: a.value, recommendation: `Investigate root cause — check external events, app updates, or campaigns around this date.` });
  }

  return insights;
}

// ─── Simulator ───────────────────────────────────────────────────────────────

interface SimInput { currentMRR: number; currentChurnRate: number; currentTrialConversion: number; activeSubscriptions: number; monthlyNewCustomers: number; avgRevenuePerUser: number; }

function simChurnReduction(input: SimInput, reduction: number): WhatIfScenario {
  const newChurn = Math.max(0, input.currentChurnRate - reduction);
  const monthlySavings = input.currentMRR * (reduction / 100);
  let cumMRR = 0, mrr = input.currentMRR;
  for (let m = 1; m <= 12; m++) { const ret = mrr * (reduction / 100); cumMRR += ret; mrr += ret; }
  return { name: 'Reduce Churn', description: `Reduce churn from ${input.currentChurnRate.toFixed(1)}% to ${newChurn.toFixed(1)}%`, currentValue: input.currentChurnRate, targetValue: newChurn, unit: '%', projectedImpact: `+$${Math.round(monthlySavings)}/mo → +$${Math.round(cumMRR)} MRR over 12mo`, mrrImpact12Months: Math.round(cumMRR), revenueImpact12Months: Math.round(cumMRR * 12) };
}

function simTrialImprovement(input: SimInput, target: number): WhatIfScenario {
  const addPerMonth = input.monthlyNewCustomers * ((target - input.currentTrialConversion) / 100);
  const addMRR = addPerMonth * input.avgRevenuePerUser;
  let cumMRR = 0;
  for (let m = 1; m <= 12; m++) cumMRR += addMRR * m;
  return { name: 'Improve Trial Conversion', description: `Increase conversion from ${input.currentTrialConversion.toFixed(0)}% to ${target.toFixed(0)}%`, currentValue: input.currentTrialConversion, targetValue: target, unit: '%', projectedImpact: `+${Math.round(addPerMonth)} paying users/mo → +$${Math.round(addMRR)}/mo MRR`, mrrImpact12Months: Math.round(cumMRR / 12), revenueImpact12Months: Math.round(cumMRR) };
}

function simGrowth(input: SimInput, multiplier: number): WhatIfScenario {
  const newCust = Math.round(input.monthlyNewCustomers * multiplier);
  const addPaying = (newCust - input.monthlyNewCustomers) * (input.currentTrialConversion / 100);
  const addMRR = addPaying * input.avgRevenuePerUser;
  let cumMRR = 0;
  for (let m = 1; m <= 12; m++) cumMRR += addMRR * m;
  return { name: 'Increase Acquisition', description: `${multiplier}x acquisition (${Math.round(input.monthlyNewCustomers)} → ${newCust}/mo)`, currentValue: input.monthlyNewCustomers, targetValue: newCust, unit: 'customers/mo', projectedImpact: `+${Math.round(addPaying)} paying/mo → +$${Math.round(addMRR)}/mo MRR`, mrrImpact12Months: Math.round(cumMRR / 12), revenueImpact12Months: Math.round(cumMRR) };
}

// ─── Report Formatters ───────────────────────────────────────────────────────

function trendArrow(dir: TrendDirection): string { return dir === 'up' ? '📈' : dir === 'down' ? '📉' : '➡️'; }

function formatOverviewMarkdown(projectName: string, metrics: OverviewMetric[]): string {
  let md = `# ${projectName} — Health Overview\n\n`;
  md += `*Generated: ${new Date().toISOString().split('T')[0]}*\n\n`;
  md += `| Metric | Value | Period |\n|--------|-------|--------|\n`;
  for (const m of metrics) {
    const val = m.unit === 'USD' ? `$${m.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : m.unit === '%' ? `${m.value.toFixed(1)}%` : m.value.toLocaleString('en-US');
    md += `| ${m.name} | ${val} | ${m.period} |\n`;
  }
  return md;
}

function formatAnalysisMarkdown(projectName: string, metrics: MetricSnapshot[], trends: TrendResult[], anomalies: Anomaly[], insights: Insight[], scenarios: WhatIfScenario[], periodStart: string, periodEnd: string): string {
  let md = `# ${projectName} — Subscription Analysis\n\n`;
  md += `*Period: ${periodStart} → ${periodEnd} | Generated: ${new Date().toISOString().split('T')[0]}*\n\n`;

  md += `## Key Metrics\n\n| Metric | Current | Previous | Change | Trend |\n|--------|---------|----------|--------|-------|\n`;
  for (const m of metrics) {
    const cur = fmtNum(m.current, m.unit);
    const prev = fmtNum(m.previous, m.unit);
    const arrow = trendArrow(m.trend);
    const change = m.changePercent >= 0 ? `+${m.changePercent.toFixed(1)}%` : `${m.changePercent.toFixed(1)}%`;
    md += `| ${m.name} | ${cur} | ${prev} | ${change} | ${arrow} |\n`;
  }

  if (anomalies.length > 0) {
    md += `\n## Anomalies Detected\n\n`;
    for (const a of anomalies) {
      const icon = a.severity === 'critical' ? '🔴' : '🟡';
      md += `- ${icon} **${a.label}**: ${fmtNum(a.value, a.label.includes('Rate') ? '%' : '#')} on ${a.date.toLocaleDateString('en-US')} (${a.deviation > 0 ? '+' : ''}${a.deviation.toFixed(1)}σ)\n`;
    }
  }

  if (insights.length > 0) {
    md += `\n## Insights & Recommendations\n\n`;
    for (const ins of insights) {
      const icon = ins.severity === 'critical' ? '🔴' : ins.severity === 'warning' ? '🟡' : '💡';
      md += `### ${icon} ${ins.title}\n${ins.description}\n`;
      if (ins.recommendation) md += `> **Action:** ${ins.recommendation}\n`;
      md += `\n`;
    }
  }

  if (scenarios.length > 0) {
    md += `## What-If Scenarios\n\n`;
    for (const s of scenarios) {
      md += `### ${s.name}\n${s.description}\n- ${s.projectedImpact}\n- 12-month MRR impact: ${fmtNum(s.mrrImpact12Months, '$')}\n- 12-month revenue impact: ${fmtNum(s.revenueImpact12Months, '$')}\n\n`;
    }
  }

  md += `---\n*Generated by RC Copilot*\n`;
  return md;
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

function parsePeriod(period: Period): { startDate: string; endDate: string } {
  const end = new Date();
  const days = parseInt(period.replace('d', ''), 10);
  const start = new Date(end.getTime() - days * 86400000);
  return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'overview';
  const apiKey = process.env.REVENUECAT_API_KEY;

  if (!apiKey) {
    console.error('❌ Set REVENUECAT_API_KEY environment variable');
    process.exit(1);
  }

  function getArg(name: string, def: string): string {
    const eqFlag = args.find(a => a.startsWith(`--${name}=`));
    if (eqFlag) return eqFlag.split('=')[1];
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
    return def;
  }
  const periodArg = getArg('period', '28d') as Period;
  const formatArg = getArg('format', 'markdown') as OutputFormat;

  const api = new RevenueCatAPI(apiKey);

  if (command === 'overview') {
    const { name } = await api.discoverProject();
    const overview = await api.fetchOverview();
    if (formatArg === 'json') console.log(JSON.stringify({ project: name, metrics: overview.metrics }, null, 2));
    else console.log(formatOverviewMarkdown(name, overview.metrics));
    return;
  }

  if (command === 'analyze' || command === 'what-if') {
    const { startDate, endDate } = parsePeriod(periodArg);
    const { name } = await api.discoverProject();
    console.error(`📊 Fetching ${CORE_CHARTS.length} charts for ${name} (${startDate} → ${endDate})...`);

    const charts = await api.fetchCharts(CORE_CHARTS, startDate, endDate);
    const metrics: MetricSnapshot[] = [];
    const allTrends: TrendResult[] = [];
    const allAnomalies: Anomaly[] = [];

    const industryAvgs: Partial<Record<ChartName, string>> = { churn: '5-7%', trial_conversion_rate: '25-30%', conversion_to_paying: '2-5%', refund_rate: '1-3%' };

    for (const [chartName, chart] of charts) {
      const series = extractTimeSeries(chart);
      if (series.values.length < 2) continue;
      const trend = detectTrend(series);
      allTrends.push(trend);
      allAnomalies.push(...detectAnomalies(series));
      const current = series.values[series.values.length - 1];
      const previous = series.values[series.values.length - 2];
      metrics.push({ name: series.label, current, previous, changePercent: Math.round(pctChange(current, previous) * 100) / 100, trend: trend.direction, unit: series.unit, industryAvg: industryAvgs[chartName as ChartName] });
    }

    const insights = generateInsights(charts, allAnomalies);

    // Build simulator input from real data
    const mrrSeries = charts.has('mrr') ? extractTimeSeries(charts.get('mrr')!) : null;
    const churnSeries = charts.has('churn') ? extractTimeSeries(charts.get('churn')!) : null;
    const trialSeries = charts.has('trial_conversion_rate') ? extractTimeSeries(charts.get('trial_conversion_rate')!) : null;
    const activesSeries = charts.has('actives') ? extractTimeSeries(charts.get('actives')!) : null;
    const newCustSeries = charts.has('customers_new') ? extractTimeSeries(charts.get('customers_new')!) : null;

    const simInput: SimInput = {
      currentMRR: mrrSeries ? mrrSeries.values[mrrSeries.values.length - 1] : 0,
      currentChurnRate: churnSeries ? churnSeries.values[churnSeries.values.length - 1] : 5,
      currentTrialConversion: trialSeries ? trialSeries.values[trialSeries.values.length - 1] : 30,
      activeSubscriptions: activesSeries ? activesSeries.values[activesSeries.values.length - 1] : 0,
      monthlyNewCustomers: newCustSeries ? mean(newCustSeries.values.slice(-3)) : 0,
      avgRevenuePerUser: mrrSeries && activesSeries ? (mrrSeries.values[mrrSeries.values.length - 1] / Math.max(1, activesSeries.values[activesSeries.values.length - 1])) : 2,
    };

    const scenarios = [simChurnReduction(simInput, 2), simTrialImprovement(simInput, 50), simGrowth(simInput, 2)];

    if (command === 'what-if') {
      if (formatArg === 'json') console.log(JSON.stringify({ project: name, scenarios }, null, 2));
      else {
        console.log(`# ${name} — What-If Scenarios\n`);
        for (const s of scenarios) {
          console.log(`## ${s.name}\n${s.description}\n- ${s.projectedImpact}\n- 12mo MRR: ${fmtNum(s.mrrImpact12Months, '$')}\n- 12mo Revenue: ${fmtNum(s.revenueImpact12Months, '$')}\n`);
        }
      }
      return;
    }

    if (formatArg === 'json') {
      console.log(JSON.stringify({
        generatedAt: new Date().toISOString(), project: name,
        period: { start: startDate, end: endDate },
        metrics, anomalies: allAnomalies.map(a => ({ ...a, date: a.date.toISOString() })),
        insights, scenarios,
      }, null, 2));
    } else {
      console.log(formatAnalysisMarkdown(name, metrics, allTrends, allAnomalies, insights, scenarios, startDate, endDate));
    }
    return;
  }

  console.error(`Unknown command: ${command}. Use: overview | analyze | what-if`);
  process.exit(1);
}

main().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
