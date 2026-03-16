import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RevenueCatAPI } from '../../src/api.js';
import { analyze } from '../../src/analyzer.js';
import { generateReport } from '../../src/report.js';
import { runAllScenarios } from '../../src/simulator.js';
import { buildSimulatorInput } from '../../src/cli.js';

// ─── Dark Noise Mock Data (real-world values) ──────────────────────────────

const DARK_NOISE = {
  mrr: 4557,
  activeSubs: 2529,
  trialConversion: 41,
  churnRate: 5.5,
};

function makeChart(
  name: string,
  monthlyValues: number[],
  unit: string = '$',
  chartable = true
) {
  return {
    category: name,
    display_name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    measures: [{ display_name: name, unit, chartable }],
    summary: { average: {}, total: {} },
    values: monthlyValues.map((v, i) => ({
      cohort: new Date(2024, i, 1).getTime() / 1000,
      measure: 0,
      value: v,
      incomplete: false,
    })),
  };
}

// 12 months of realistic Dark Noise data
const DARK_NOISE_CHARTS = {
  revenue: [3800, 3900, 3700, 4000, 4100, 4200, 4300, 4400, 4300, 4400, 4500, 5200], // Dec spike
  mrr: [3800, 3850, 3700, 3950, 4000, 4100, 4200, 4300, 4350, 4400, 4500, 4557],
  churn: [5.5, 5.8, 6.2, 5.7, 5.5, 5.4, 5.3, 5.6, 5.5, 5.4, 5.3, 5.5],
  actives: [2400, 2410, 2380, 2420, 2450, 2470, 2490, 2500, 2510, 2515, 2520, 2529],
  trial_conversion_rate: [39, 40, 41, 42, 41, 40, 41, 42, 41, 40, 41, 42],
  conversion_to_paying: [2.5, 2.6, 2.4, 2.7, 2.8, 2.9, 3.0, 2.9, 3.0, 3.1, 3.0, 3.1],
  customers_new: [45, 48, 42, 50, 52, 55, 58, 56, 57, 58, 60, 62],
  refund_rate: [1.2, 1.3, 1.1, 1.4, 1.2, 1.3, 1.1, 1.2, 1.3, 1.2, 1.1, 1.2],
  arr: [45600, 46200, 44400, 47400, 48000, 49200, 50400, 51600, 52200, 52800, 54000, 54684],
};

function buildMockCharts() {
  const charts = new Map();
  charts.set('revenue', makeChart('revenue', DARK_NOISE_CHARTS.revenue));
  charts.set('mrr', makeChart('mrr', DARK_NOISE_CHARTS.mrr));
  charts.set('churn', makeChart('churn', DARK_NOISE_CHARTS.churn, '%'));
  charts.set('actives', makeChart('actives', DARK_NOISE_CHARTS.actives, '#'));
  charts.set('trial_conversion_rate', makeChart('trial_conversion_rate', DARK_NOISE_CHARTS.trial_conversion_rate, '%'));
  charts.set('conversion_to_paying', makeChart('conversion_to_paying', DARK_NOISE_CHARTS.conversion_to_paying, '%'));
  charts.set('customers_new', makeChart('customers_new', DARK_NOISE_CHARTS.customers_new, '#'));
  charts.set('refund_rate', makeChart('refund_rate', DARK_NOISE_CHARTS.refund_rate, '%'));
  charts.set('arr', makeChart('arr', DARK_NOISE_CHARTS.arr));
  return charts;
}

// ─── Mock API for integration ─────────────────────────────────────────────

const mockProjectsResponse = {
  items: [{ id: 'proj_dark_noise', name: 'Dark Noise', created_at: 1700000000 }],
  next_page: null,
};

function makeFetchMock() {
  let callIndex = 0;
  return vi.fn().mockImplementation((url: string) => {
    callIndex++;
    if (url.endsWith('/projects')) {
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => mockProjectsResponse,
        text: async () => '',
        headers: { get: () => null },
      });
    }

    // Return appropriate chart data based on URL
    for (const [chartName, values] of Object.entries(DARK_NOISE_CHARTS)) {
      if (url.includes(`/charts/${chartName}`)) {
        const unit = ['churn', 'trial_conversion_rate', 'conversion_to_paying', 'refund_rate'].includes(chartName) ? '%'
          : ['actives', 'customers_new'].includes(chartName) ? '#' : '$';
        return Promise.resolve({
          ok: true, status: 200,
          json: async () => makeChart(chartName, values, unit),
          text: async () => '',
          headers: { get: () => null },
        });
      }
    }

    // Default chart response
    return Promise.resolve({
      ok: true, status: 200,
      json: async () => makeChart('unknown', [100, 200, 300]),
      text: async () => '',
      headers: { get: () => null },
    });
  });
}

// ─── Integration Tests ─────────────────────────────────────────────────────

describe('Full Pipeline Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('completes full pipeline: API → analyze → simulate → report', async () => {
    // 1. API Layer
    const api = new RevenueCatAPI('test-key', { minRequestInterval: 0 });
    const project = await api.discoverProject();
    expect(project.name).toBe('Dark Noise');

    // 2. Analysis Layer
    const charts = buildMockCharts();
    const analysis = analyze(
      project.name,
      charts,
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    expect(analysis.projectName).toBe('Dark Noise');
    expect(analysis.metrics.length).toBeGreaterThan(0);

    // 3. Simulator Layer
    const simulatorInput = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(simulatorInput);
    expect(scenarios).toHaveLength(3);

    // 4. Report Layer
    const report = generateReport(analysis, scenarios);
    expect(report.markdown).toContain('Dark Noise');
    expect(report.json.project).toBe('Dark Noise');
  });

  it('analyze produces correct metrics for Dark Noise data', () => {
    const charts = buildMockCharts();
    const analysis = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));

    const mrrMetric = analysis.metrics.find((m) => m.name.toLowerCase().includes('mrr'));
    if (mrrMetric) {
      expect(mrrMetric.current).toBeCloseTo(4557, 0);
    }

    const activesMetric = analysis.metrics.find((m) => m.name.toLowerCase().includes('actives') || m.name.toLowerCase().includes('active'));
    if (activesMetric) {
      expect(activesMetric.current).toBeCloseTo(2529, 0);
    }
  });

  it('simulator input reflects real Dark Noise data', () => {
    const charts = buildMockCharts();
    const analysis = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const input = buildSimulatorInput(analysis);

    expect(input.currentMRR).toBeCloseTo(DARK_NOISE.mrr, -1);
    expect(input.activeSubscriptions).toBeCloseTo(DARK_NOISE.activeSubs, -1);
  });

  it('detect December revenue spike as anomaly', () => {
    const charts = buildMockCharts();
    const analysis = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));

    // Revenue in December (5200) is much higher than average
    const revAnomalies = analysis.anomalies.filter(
      (a) => a.label.toLowerCase().includes('revenue') && a.value > a.expected
    );
    expect(revAnomalies.length).toBeGreaterThan(0);
  });

  it('report markdown contains key sections', () => {
    const charts = buildMockCharts();
    const analysis = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const input = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(input);
    const report = generateReport(analysis, scenarios);

    expect(report.markdown).toContain('## Executive Summary');
    expect(report.markdown).toContain('## 📈 Key Metrics');
    expect(report.markdown).toContain('## 🔮 What-If Scenarios');
  });

  it('report JSON is serializable', () => {
    const charts = buildMockCharts();
    const analysis = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const input = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(input);
    const report = generateReport(analysis, scenarios);

    expect(() => JSON.stringify(report.json)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(report.json));
    expect(parsed.project).toBe('Dark Noise');
  });

  it('all 3 what-if scenarios have positive revenue impact', () => {
    const charts = buildMockCharts();
    const analysis = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const input = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(input);

    for (const s of scenarios) {
      expect(s.revenueImpact12Months).toBeGreaterThanOrEqual(0);
    }
  });

  it('fetchCharts via API returns correct number of charts', async () => {
    const api = new RevenueCatAPI('test-key', { minRequestInterval: 0 });
    const chartNames = ['mrr', 'churn', 'trial_conversion_rate'] as const;
    const charts = await api.fetchCharts(chartNames, {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      resolution: 'month',
    });
    expect(charts.size).toBe(3);
  });

  it('trial conversion in dark noise is around 41%', () => {
    const charts = buildMockCharts();
    const analysis = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const input = buildSimulatorInput(analysis);
    expect(input.currentTrialConversion).toBeCloseTo(41, 0);
  });
});
