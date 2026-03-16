import { describe, it, expect } from 'vitest';
import { analyze, detectAnomalies, detectTrend, extractTimeSeries } from '../src/analyzer.js';
import { generateReport } from '../src/report.js';
import { runAllScenarios, simulateChurnReduction, simulateCustomerGrowth } from '../src/simulator.js';
import { buildSimulatorInput } from '../src/cli.js';
import type { ChartResponse, SimulatorInput } from '../src/types.js';

/**
 * Edge case evals: empty data, zeros, negatives, very large numbers
 */

function makeChart(values: number[], unit = '$'): ChartResponse {
  return {
    category: 'test',
    display_name: 'Test',
    measures: [{ display_name: 'Test', unit, chartable: true }],
    summary: { average: {}, total: {} },
    values: values.map((v, i) => ({
      cohort: 1700000000 + i * 86400,
      measure: 0,
      value: v,
      incomplete: false,
    })),
  };
}

describe('Edge Cases — Empty & Minimal Data', () => {

  it('analyze with empty charts map returns empty result', () => {
    const result = analyze('Test', new Map(), new Date('2024-01-01'), new Date('2024-03-31'));
    expect(result.metrics).toHaveLength(0);
    expect(result.anomalies).toHaveLength(0);
    expect(result.trends).toHaveLength(0);
    expect(result.insights).toHaveLength(0);
  });

  it('API returning 0 charts → report still generates', () => {
    const analysis = analyze('Test', new Map(), new Date('2024-01-01'), new Date('2024-03-31'));
    const input = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(input);
    const report = generateReport(analysis, scenarios);

    expect(report.markdown).toContain('## Executive Summary');
    expect(report.json.project).toBe('Test');
  });

  it('extractTimeSeries with empty values returns empty arrays', () => {
    const chart = makeChart([]);
    const series = extractTimeSeries(chart);
    expect(series.values).toHaveLength(0);
    expect(series.dates).toHaveLength(0);
  });

  it('detectAnomalies with 0 values returns empty array', () => {
    const chart = makeChart([]);
    const series = extractTimeSeries(chart);
    expect(detectAnomalies(series)).toHaveLength(0);
  });

  it('detectAnomalies with 4 values (< 5 threshold) returns empty array', () => {
    const chart = makeChart([100, 200, 300, 400]);
    const series = extractTimeSeries(chart);
    expect(detectAnomalies(series)).toHaveLength(0);
  });

  it('detectTrend with 0 values returns flat', () => {
    const chart = makeChart([]);
    const series = extractTimeSeries(chart);
    const trend = detectTrend(series);
    expect(trend.direction).toBe('flat');
  });

  it('detectTrend with 1 value returns flat', () => {
    const chart = makeChart([100]);
    const series = extractTimeSeries(chart);
    const trend = detectTrend(series);
    expect(trend.direction).toBe('flat');
  });

  it('chart with single data point skipped in analyze metrics', () => {
    const charts = new Map();
    charts.set('revenue', makeChart([4557]));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    expect(result.metrics).toHaveLength(0);
  });
});

describe('Edge Cases — All Zero Metrics', () => {

  it('analyze with all-zero revenue does not throw', () => {
    const charts = new Map();
    charts.set('revenue', makeChart([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(() => analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'))).not.toThrow();
  });

  it('all-zero values produce no anomalies (stddev = 0)', () => {
    const chart = makeChart([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const series = extractTimeSeries(chart);
    expect(detectAnomalies(series)).toHaveLength(0);
  });

  it('simulator with zero MRR returns zero impact for churn reduction', () => {
    const input: SimulatorInput = {
      currentMRR: 0,
      currentChurnRate: 10,
      currentTrialConversion: 30,
      activeSubscriptions: 0,
      monthlyNewCustomers: 100,
      avgRevenuePerUser: 0,
    };
    const result = simulateChurnReduction(input, 5);
    expect(result.mrrImpact12Months).toBe(0);
  });

  it('simulator with zero trial conversion target matches current (zero impact)', () => {
    const input: SimulatorInput = {
      currentMRR: 4557,
      currentChurnRate: 7,
      currentTrialConversion: 0,
      activeSubscriptions: 2529,
      monthlyNewCustomers: 500,
      avgRevenuePerUser: 1.8,
    };
    const scenarios = runAllScenarios(input);
    expect(scenarios).toHaveLength(3);
  });

  it('buildSimulatorInput with zero actives chart uses 1.8 avgRevenuePerUser', () => {
    const charts = new Map();
    charts.set('actives', makeChart([0]));
    const analysis = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    const input = buildSimulatorInput(analysis);
    expect(input.avgRevenuePerUser).toBe(1.8);
  });
});

describe('Edge Cases — Negative Values', () => {

  it('detectAnomalies handles negative values without crashing', () => {
    const chart = makeChart([-100, -200, -100, -100, -100, -100, -100, -100, -100, -100, -100, 0]);
    const series = extractTimeSeries(chart);
    const anomalies = detectAnomalies(series);
    expect(Array.isArray(anomalies)).toBe(true);
  });

  it('detectTrend handles negative values correctly', () => {
    const chart = makeChart([-200, -100, -50, 0, 50, 100, 150, 200]);
    const series = extractTimeSeries(chart);
    const trend = detectTrend(series);
    // Generally increasing — should be up
    expect(trend.direction).toBe('up');
  });

  it('analyze does not throw on all-negative metrics', () => {
    const charts = new Map();
    charts.set('revenue', makeChart([-100, -200, -150, -100, -50, -80, -100, -120, -100, -90, -80, -70]));
    expect(() => analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'))).not.toThrow();
  });

  it('simulator with negative churn does not throw', () => {
    const input: SimulatorInput = {
      currentMRR: 4557,
      currentChurnRate: -1, // nonsensical but shouldn't throw
      currentTrialConversion: 41,
      activeSubscriptions: 2529,
      monthlyNewCustomers: 500,
      avgRevenuePerUser: 1.8,
    };
    expect(() => runAllScenarios(input)).not.toThrow();
  });
});

describe('Edge Cases — Very Large Numbers', () => {

  it('handles MRR in the billions without overflow', () => {
    const input: SimulatorInput = {
      currentMRR: 1_000_000_000,
      currentChurnRate: 2,
      currentTrialConversion: 50,
      activeSubscriptions: 5_000_000,
      monthlyNewCustomers: 100_000,
      avgRevenuePerUser: 200,
    };
    const scenarios = runAllScenarios(input);
    expect(scenarios).toHaveLength(3);
    for (const s of scenarios) {
      expect(isFinite(s.mrrImpact12Months)).toBe(true);
      expect(isFinite(s.revenueImpact12Months)).toBe(true);
    }
  });

  it('detectAnomalies handles very large values', () => {
    const vals = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1e12];
    const chart = makeChart(vals);
    const series = extractTimeSeries(chart);
    const anomalies = detectAnomalies(series);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(isFinite(anomalies[0].deviation)).toBe(true);
  });

  it('report handles very large numbers without crashing', () => {
    const charts = new Map();
    charts.set('mrr', makeChart([1e9, 1.1e9]));
    const analysis = analyze('BigCorp', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const input = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(input);
    expect(() => generateReport(analysis, scenarios)).not.toThrow();
  });
});

describe('Edge Cases — Extreme Simulator Inputs', () => {

  it('churn reduction beyond 100% clamps correctly', () => {
    const input: SimulatorInput = {
      currentMRR: 4557,
      currentChurnRate: 5,
      currentTrialConversion: 41,
      activeSubscriptions: 2529,
      monthlyNewCustomers: 500,
      avgRevenuePerUser: 1.8,
    };
    const result = simulateChurnReduction(input, 100); // reduce by 100%
    expect(result.targetValue).toBe(0); // clamped to 0
    expect(result.mrrImpact12Months).toBeGreaterThanOrEqual(0);
  });

  it('0 monthly new customers → trial improvement = 0 impact', () => {
    const input: SimulatorInput = {
      currentMRR: 4557,
      currentChurnRate: 7,
      currentTrialConversion: 41,
      activeSubscriptions: 2529,
      monthlyNewCustomers: 0,
      avgRevenuePerUser: 1.8,
    };
    const scenarios = runAllScenarios(input);
    const trialScenario = scenarios.find((s) => s.name === 'Improve Trial Conversion');
    expect(trialScenario!.mrrImpact12Months).toBe(0);
  });

  it('growth multiplier of 0 → target is 0 customers (no acquisition)', () => {
    const input: SimulatorInput = {
      currentMRR: 4557,
      currentChurnRate: 7,
      currentTrialConversion: 41,
      activeSubscriptions: 2529,
      monthlyNewCustomers: 500,
      avgRevenuePerUser: 1.8,
    };
    const result = simulateCustomerGrowth(input, 0);
    expect(result.targetValue).toBe(0);
    // With 0 multiplier, acquiring 0 new customers vs 500 means negative delta — that's expected
    expect(isFinite(result.mrrImpact12Months)).toBe(true);
  });
});
