#!/usr/bin/env node

import { RevenueCatAPI } from './api.js';
import { analyze, extractTimeSeries } from './analyzer.js';
import { generateReport } from './report.js';
import { runAllScenarios, simulateChurnReduction, simulateTrialImprovement, simulateCustomerGrowth } from './simulator.js';
import type { CLIOptions, ChartName, Period, SimulatorInput, WhatIfScenario } from './types.js';
import { CORE_CHARTS } from './types.js';

// ─── Argument Parsing ────────────────────────────────────────────────────────

export function parseArgs(argv: string[]): { command: string; options: Record<string, string> } {
  const args = argv.slice(2);
  const command = args[0] || 'analyze';
  const options: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      options[key] = value;
    }
  }

  return { command, options };
}

export function getDateRange(period: Period): { startDate: string; endDate: string } {
  const days = parseInt(period.replace('d', ''), 10);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// ─── Commands ────────────────────────────────────────────────────────────────

export async function cmdAnalyze(apiKey: string, period: Period, format: string): Promise<string> {
  const api = new RevenueCatAPI(apiKey);

  console.error('🔍 Discovering project...');
  const project = await api.discoverProject();
  console.error(`📱 Project: ${project.name} (${project.id})`);

  const { startDate, endDate } = getDateRange(period);
  const resolution = parseInt(period) > 90 ? 'month' : parseInt(period) > 30 ? 'week' : 'day';
  console.error(`📅 Period: ${startDate} to ${endDate} (${resolution} resolution)`);

  console.error(`📊 Fetching ${CORE_CHARTS.length} charts...`);
  const charts = await api.fetchCharts(CORE_CHARTS, {
    startDate,
    endDate,
    resolution: resolution as 'day' | 'week' | 'month',
  });
  console.error(`✅ Fetched ${charts.size} charts (${api.getRequestCount()} API calls)`);

  console.error('🧠 Analyzing data...');
  const result = analyze(project.name, charts, new Date(startDate), new Date(endDate));

  // Build simulator input from real data
  const simulatorInput = buildSimulatorInput(result);
  const scenarios = runAllScenarios(simulatorInput);

  const report = generateReport(result, scenarios);

  if (format === 'json') {
    return JSON.stringify(report.json, null, 2);
  }
  return report.markdown;
}

export async function cmdOverview(apiKey: string): Promise<string> {
  const api = new RevenueCatAPI(apiKey);

  console.error('🔍 Discovering project...');
  const project = await api.discoverProject();
  console.error(`📱 Project: ${project.name} (${project.id})`);

  console.error('📊 Fetching overview metrics...');
  const overview = await api.fetchOverview();

  const lines: string[] = [];
  lines.push(`# 📊 ${project.name} — Overview`);
  lines.push(`*Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*`);
  lines.push('');
  lines.push('| Metric | Value | Period |');
  lines.push('|--------|-------|--------|');

  for (const metric of overview.metrics) {
    const value =
      metric.unit === '$'
        ? `$${metric.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        : metric.unit === '%'
          ? `${metric.value.toFixed(2)}%`
          : metric.value.toLocaleString('en-US');
    lines.push(`| ${metric.name} | ${value} | ${metric.period} |`);
  }

  return lines.join('\n');
}

export async function cmdWhatIf(
  apiKey: string,
  period: Period,
  options: Record<string, string>
): Promise<string> {
  const api = new RevenueCatAPI(apiKey);

  console.error('🔍 Discovering project...');
  const project = await api.discoverProject();

  const { startDate, endDate } = getDateRange(period);
  console.error('📊 Fetching data for simulation...');

  const chartsNeeded: ChartName[] = ['mrr', 'churn', 'trial_conversion_rate', 'actives', 'customers_new'];
  const charts = await api.fetchCharts(chartsNeeded, { startDate, endDate, resolution: 'month' });

  const result = analyze(project.name, charts, new Date(startDate), new Date(endDate));
  const input = buildSimulatorInput(result);

  const scenarios: WhatIfScenario[] = [];

  if (options['reduce-churn']) {
    const reduction = parseFloat(options['reduce-churn'].replace('%', ''));
    scenarios.push(simulateChurnReduction(input, reduction));
  }

  if (options['improve-trials']) {
    const target = parseFloat(options['improve-trials'].replace('%', ''));
    scenarios.push(simulateTrialImprovement(input, target));
  }

  if (options['grow-customers']) {
    const multiplier = parseFloat(options['grow-customers'].replace('x', ''));
    scenarios.push(simulateCustomerGrowth(input, multiplier));
  }

  // Default: run all scenarios
  if (scenarios.length === 0) {
    scenarios.push(...runAllScenarios(input));
  }

  const lines: string[] = [];
  lines.push(`# 🔮 What-If Scenarios — ${project.name}`);
  lines.push(`*Based on data from ${startDate} to ${endDate}*`);
  lines.push('');
  lines.push('| Scenario | Current | Target | 12-Month Impact |');
  lines.push('|----------|---------|--------|-----------------|');

  for (const s of scenarios) {
    const currentStr =
      s.unit === '%'
        ? `${s.currentValue.toFixed(1)}%`
        : s.currentValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const targetStr =
      s.unit === '%'
        ? `${s.targetValue.toFixed(1)}%`
        : s.targetValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
    lines.push(`| ${s.name} | ${currentStr} | ${targetStr} | ${s.projectedImpact} |`);
  }

  lines.push('');
  for (const s of scenarios) {
    lines.push(`### ${s.name}`);
    lines.push(`${s.description}`);
    lines.push(`- ${s.projectedImpact}`);
    lines.push(`- Projected 12-month MRR impact: **+$${s.mrrImpact12Months.toLocaleString('en-US')}**`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Simulator Input Builder ─────────────────────────────────────────────────

export function buildSimulatorInput(analysis: import('./types.js').AnalysisResult): SimulatorInput {
  let currentMRR = 4500;
  let currentChurnRate = 7;
  let currentTrialConversion = 41;
  let activeSubscriptions = 2529;
  let monthlyNewCustomers = 500;

  const mrrChart = analysis.charts.get('mrr');
  if (mrrChart) {
    const series = extractTimeSeries(mrrChart);
    if (series.values.length > 0) {
      currentMRR = series.values[series.values.length - 1];
    }
  }

  const churnChart = analysis.charts.get('churn');
  if (churnChart) {
    const series = extractTimeSeries(churnChart);
    if (series.values.length > 0) {
      const recent = series.values.slice(-3);
      currentChurnRate = recent.reduce((a, b) => a + b, 0) / recent.length;
    }
  }

  const trialConvChart = analysis.charts.get('trial_conversion_rate');
  if (trialConvChart) {
    const series = extractTimeSeries(trialConvChart);
    if (series.values.length > 0) {
      const recent = series.values.slice(-3);
      currentTrialConversion = recent.reduce((a, b) => a + b, 0) / recent.length;
    }
  }

  const activesChart = analysis.charts.get('actives');
  if (activesChart) {
    const series = extractTimeSeries(activesChart);
    if (series.values.length > 0) {
      activeSubscriptions = series.values[series.values.length - 1];
    }
  }

  const newCustChart = analysis.charts.get('customers_new');
  if (newCustChart) {
    const series = extractTimeSeries(newCustChart);
    if (series.values.length > 0) {
      // Average monthly new customers
      const total = series.values.reduce((a, b) => a + b, 0);
      const months = Math.max(1, series.values.length / 30);
      monthlyNewCustomers = Math.round(total / months);
    }
  }

  const avgRevenuePerUser = activeSubscriptions > 0 ? currentMRR / activeSubscriptions : 1.8;

  return {
    currentMRR,
    currentChurnRate,
    currentTrialConversion,
    activeSubscriptions,
    monthlyNewCustomers,
    avgRevenuePerUser,
  };
}

// ─── Help ────────────────────────────────────────────────────────────────────

export function printHelp(): void {
  console.log(`
RC Copilot — RevenueCat AI Analyst

USAGE:
  rc-copilot <command> [options]

COMMANDS:
  analyze     Full subscription analysis with insights and recommendations
  overview    Quick metrics overview
  what-if     Run what-if scenario simulations

OPTIONS:
  --api-key <key>          RevenueCat API key (or set REVENUECAT_API_KEY env var)
  --period <period>        Analysis period: 7d, 14d, 28d, 30d, 60d, 90d, 180d, 365d (default: 90d)
  --format <format>        Output format: markdown, json (default: markdown)
  --verbose                Show debug output

WHAT-IF OPTIONS:
  --reduce-churn <pct>     Simulate churn reduction (e.g., --reduce-churn 2%)
  --improve-trials <pct>   Simulate trial conversion improvement (e.g., --improve-trials 50%)
  --grow-customers <mult>  Simulate customer growth (e.g., --grow-customers 2x)

EXAMPLES:
  rc-copilot analyze --api-key sk_xxx --period 90d --format markdown
  rc-copilot overview --api-key sk_xxx
  rc-copilot what-if --api-key sk_xxx --reduce-churn 2%
`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv);

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const apiKey = options['api-key'] || process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    console.error('Error: API key required. Use --api-key <key> or set REVENUECAT_API_KEY env var.');
    process.exit(1);
  }

  const period = (options['period'] || '90d') as Period;
  const format = options['format'] || 'markdown';

  try {
    let output: string;

    switch (command) {
      case 'analyze':
        output = await cmdAnalyze(apiKey, period, format);
        break;
      case 'overview':
        output = await cmdOverview(apiKey);
        break;
      case 'what-if':
        output = await cmdWhatIf(apiKey, period, options);
        break;
      default:
        console.error(`Unknown command: ${command}. Use "help" for usage information.`);
        process.exit(1);
    }

    console.log(output);
  } catch (err) {
    console.error(`\n❌ Error: ${(err as Error).message}`);
    if (options['verbose'] === 'true') {
      console.error((err as Error).stack);
    }
    process.exit(1);
  }
}

// Only run main when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
