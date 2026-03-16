import { describe, it, expect } from 'vitest';
import { analyze } from '../src/analyzer.js';
import { generateReport } from '../src/report.js';
import { runAllScenarios } from '../src/simulator.js';
import { buildSimulatorInput } from '../src/cli.js';
import type { AnalysisResult, ChartResponse, WhatIfScenario } from '../src/types.js';

/**
 * Performance benchmarks:
 * - Full pipeline (analyze + simulate + report) must complete in < 1s
 * - Report generation alone must complete in < 100ms
 */

function makeChart(name: string, values: number[], unit = '$'): ChartResponse {
  return {
    category: name,
    display_name: name,
    measures: [{ display_name: name, unit, chartable: true }],
    summary: { average: {}, total: {} },
    values: values.map((v, i) => ({
      cohort: new Date(2024, i % 12, 1).getTime() / 1000,
      measure: 0,
      value: v,
      incomplete: false,
    })),
  };
}

function buildDarkNoiseMaps(): Map<string, ChartResponse> {
  const charts = new Map<string, ChartResponse>();
  charts.set('revenue', makeChart('revenue', [3800, 3100, 3900, 4000, 4100, 4200, 4300, 4400, 4300, 4400, 4500, 5800]));
  charts.set('mrr', makeChart('mrr', [3800, 3850, 3700, 3950, 4000, 4100, 4200, 4300, 4350, 4400, 4500, 4557]));
  charts.set('churn', makeChart('churn', [5.5, 5.8, 6.2, 5.7, 5.5, 5.4, 5.3, 5.6, 5.5, 5.4, 5.3, 5.5], '%'));
  charts.set('actives', makeChart('actives', [2400, 2410, 2380, 2420, 2450, 2470, 2490, 2500, 2510, 2515, 2520, 2529], '#'));
  charts.set('trial_conversion_rate', makeChart('trial_conversion_rate', [39, 40, 41, 42, 41, 40, 41, 42, 41, 40, 41, 42], '%'));
  charts.set('conversion_to_paying', makeChart('conversion_to_paying', [2.5, 2.6, 2.4, 2.7, 2.8, 2.9, 3.0, 2.9, 3.0, 3.1, 3.0, 3.1], '%'));
  charts.set('customers_new', makeChart('customers_new', [45, 48, 42, 50, 52, 55, 58, 56, 57, 58, 60, 62], '#'));
  charts.set('refund_rate', makeChart('refund_rate', [1.2, 1.3, 1.1, 1.4, 1.2, 1.3, 1.1, 1.2, 1.3, 1.2, 1.1, 1.2], '%'));
  charts.set('arr', makeChart('arr', [45600, 46200, 44400, 47400, 48000, 49200, 50400, 51600, 52200, 52800, 54000, 54684]));
  return charts as Map<any, any>;
}

function makeAnalysisResult(charts: Map<any, any>): AnalysisResult {
  return analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-12-31'));
}

describe('Performance Benchmarks', () => {

  it('full pipeline (analyze + simulate + report) completes in < 1000ms', () => {
    const charts = buildDarkNoiseMaps();
    const start = performance.now();

    // 1. Analyze
    const analysis = makeAnalysisResult(charts);

    // 2. Build simulator input
    const input = buildSimulatorInput(analysis);

    // 3. Run scenarios
    const scenarios = runAllScenarios(input);

    // 4. Generate report
    generateReport(analysis, scenarios);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000); // < 1 second
  });

  it('report generation alone completes in < 100ms', () => {
    const charts = buildDarkNoiseMaps();
    const analysis = makeAnalysisResult(charts);
    const input = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(input);

    const start = performance.now();
    generateReport(analysis, scenarios);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // < 100ms
  });

  it('analyze alone completes in < 500ms for 12 months of data', () => {
    const charts = buildDarkNoiseMaps();

    const start = performance.now();
    makeAnalysisResult(charts);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('runAllScenarios completes in < 50ms', () => {
    const charts = buildDarkNoiseMaps();
    const analysis = makeAnalysisResult(charts);
    const input = buildSimulatorInput(analysis);

    const start = performance.now();
    runAllScenarios(input);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('pipeline runs 10 times in under 5 seconds (no N² regressions)', () => {
    const charts = buildDarkNoiseMaps();
    const start = performance.now();

    for (let i = 0; i < 10; i++) {
      const analysis = makeAnalysisResult(charts);
      const input = buildSimulatorInput(analysis);
      const scenarios = runAllScenarios(input);
      generateReport(analysis, scenarios);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it('generates markdown report with consistent length (no infinite loops)', () => {
    const charts = buildDarkNoiseMaps();
    const analysis = makeAnalysisResult(charts);
    const input = buildSimulatorInput(analysis);
    const scenarios = runAllScenarios(input);
    const report = generateReport(analysis, scenarios);

    // Report should be a reasonable size
    expect(report.markdown.length).toBeGreaterThan(500);
    expect(report.markdown.length).toBeLessThan(1_000_000); // sanity check
  });
});
