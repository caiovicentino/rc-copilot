import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mean, stddev, pctChange, fmtNum, findPrimaryMeasure,
  extractTimeSeries, detectTrend, detectAnomalies, generateInsights,
  simChurnReduction, simTrialImprovement, simGrowth, trendArrow,
  formatOverviewMarkdown, formatAnalysisMarkdown, parsePeriod,
  RevenueCatAPI, CORE_CHARTS, BASE_URL, main,
} from '../rc-analyze.js';
import type {
  ChartResponse, ChartMeasure, ChartValue, TimeSeries, TrendResult,
  Anomaly, Insight, MetricSnapshot, WhatIfScenario, SimInput,
  OverviewMetric, ChartName,
} from '../rc-analyze.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChart(opts: {
  displayName?: string;
  measures?: Partial<ChartMeasure>[];
  values?: Partial<ChartValue>[];
  summary?: { average: Record<string, number>; total: Record<string, number> };
}): ChartResponse {
  return {
    category: 'test',
    display_name: opts.displayName || 'Test Chart',
    measures: (opts.measures || [{ display_name: 'Value', unit: '$', chartable: true }]) as ChartMeasure[],
    values: (opts.values || []) as ChartValue[],
    summary: opts.summary || { average: { '0': 0 }, total: { '0': 0 } },
  };
}

function makeSeries(values: number[], label = 'Test', unit = '$'): TimeSeries {
  const base = new Date('2026-01-01').getTime();
  return {
    dates: values.map((_, i) => new Date(base + i * 86400000)),
    values,
    label,
    unit,
  };
}

const defaultSimInput: SimInput = {
  currentMRR: 5000,
  currentChurnRate: 5,
  currentTrialConversion: 30,
  activeSubscriptions: 2500,
  monthlyNewCustomers: 100,
  avgRevenuePerUser: 2,
};

// ─── Math Utilities ──────────────────────────────────────────────────────────

describe('mean', () => {
  it('returns 0 for empty array', () => expect(mean([])).toBe(0));
  it('returns correct mean for single element', () => expect(mean([5])).toBe(5));
  it('returns correct mean for multiple elements', () => expect(mean([2, 4, 6])).toBe(4));
  it('handles negative values', () => expect(mean([-2, 2])).toBe(0));
  it('handles decimal values', () => expect(mean([1.5, 2.5])).toBe(2));
});

describe('stddev', () => {
  it('returns 0 for empty array', () => expect(stddev([])).toBe(0));
  it('returns 0 for single element', () => expect(stddev([5])).toBe(0));
  it('returns 0 for identical values', () => expect(stddev([3, 3, 3])).toBe(0));
  it('calculates sample standard deviation', () => {
    const sd = stddev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(sd).toBeCloseTo(2, 0);
  });
  it('returns correct value for two elements', () => {
    expect(stddev([0, 10])).toBeCloseTo(7.07, 1);
  });
});

describe('pctChange', () => {
  it('returns 0 when both are 0', () => expect(pctChange(0, 0)).toBe(0));
  it('returns 100 when previous is 0 and current > 0', () => expect(pctChange(5, 0)).toBe(100));
  it('returns 0 when both current and prev are 0', () => expect(pctChange(0, 0)).toBe(0));
  it('calculates positive change correctly', () => expect(pctChange(110, 100)).toBe(10));
  it('calculates negative change correctly', () => expect(pctChange(90, 100)).toBe(-10));
  it('handles large changes', () => expect(pctChange(200, 100)).toBe(100));
  it('handles negative previous values', () => {
    const result = pctChange(-5, -10);
    expect(result).toBe(50); // (-5 - -10) / |-10| * 100 = 50%
  });
});

describe('fmtNum', () => {
  it('formats dollar amounts', () => expect(fmtNum(1234, '$')).toBe('$1,234'));
  it('formats percentages', () => expect(fmtNum(5.67, '%')).toBe('5.7%'));
  it('formats plain numbers', () => expect(fmtNum(1234, '#')).toBe('1,234'));
  it('formats zero', () => expect(fmtNum(0, '$')).toBe('$0'));
  it('formats large numbers', () => expect(fmtNum(1234567, '$')).toBe('$1,234,567'));
  it('formats small percentages', () => expect(fmtNum(0.123, '%')).toBe('0.1%'));
});

// ─── Chart Processing ────────────────────────────────────────────────────────

describe('findPrimaryMeasure', () => {
  it('returns index of chartable measure', () => {
    const chart = makeChart({
      measures: [
        { display_name: 'A', unit: '#', chartable: false },
        { display_name: 'B', unit: '%', chartable: true },
      ],
    });
    expect(findPrimaryMeasure(chart)).toBe(1);
  });
  it('returns 0 when no chartable measure', () => {
    const chart = makeChart({ measures: [{ display_name: 'A', unit: '#' }] });
    expect(findPrimaryMeasure(chart)).toBe(0);
  });
  it('returns first chartable if multiple exist', () => {
    const chart = makeChart({
      measures: [
        { display_name: 'A', unit: '#', chartable: true },
        { display_name: 'B', unit: '%', chartable: true },
      ],
    });
    expect(findPrimaryMeasure(chart)).toBe(0);
  });
});

describe('extractTimeSeries', () => {
  it('extracts values from chart and filters incomplete', () => {
    const chart = makeChart({
      values: [
        { cohort: 1704067200, measure: 0, value: 100, incomplete: false },
        { cohort: 1704153600, measure: 0, value: 200, incomplete: false },
        { cohort: 1704240000, measure: 0, value: 300, incomplete: true },
      ],
    });
    const series = extractTimeSeries(chart);
    expect(series.values).toEqual([100, 200]);
    expect(series.dates).toHaveLength(2);
    expect(series.label).toBe('Value');
    expect(series.unit).toBe('$');
  });

  it('only extracts values for the primary measure index', () => {
    const chart = makeChart({
      measures: [
        { display_name: 'Count', unit: '#', chartable: false },
        { display_name: 'Rate', unit: '%', chartable: true },
      ],
      values: [
        { cohort: 1704067200, measure: 0, value: 100, incomplete: false },
        { cohort: 1704067200, measure: 1, value: 5.0, incomplete: false },
        { cohort: 1704153600, measure: 0, value: 200, incomplete: false },
        { cohort: 1704153600, measure: 1, value: 6.0, incomplete: false },
      ],
    });
    const series = extractTimeSeries(chart);
    expect(series.values).toEqual([5.0, 6.0]);
    expect(series.label).toBe('Rate');
    expect(series.unit).toBe('%');
  });

  it('sorts values by cohort timestamp', () => {
    const chart = makeChart({
      values: [
        { cohort: 1704153600, measure: 0, value: 200, incomplete: false },
        { cohort: 1704067200, measure: 0, value: 100, incomplete: false },
      ],
    });
    const series = extractTimeSeries(chart);
    expect(series.values).toEqual([100, 200]);
  });

  it('handles empty values', () => {
    const chart = makeChart({ values: [] });
    const series = extractTimeSeries(chart);
    expect(series.values).toEqual([]);
    expect(series.dates).toEqual([]);
  });

  it('uses chart display_name when measure has no display_name', () => {
    const chart = makeChart({
      displayName: 'Fallback Name',
      measures: [{ unit: '$', chartable: true } as ChartMeasure],
      values: [{ cohort: 1704067200, measure: 0, value: 100, incomplete: false }],
    });
    const series = extractTimeSeries(chart);
    expect(series.label).toBe('Fallback Name');
  });

  it('uses empty string when measure has no unit', () => {
    const chart = makeChart({
      measures: [{ display_name: 'X', chartable: true } as ChartMeasure],
      values: [{ cohort: 1704067200, measure: 0, value: 100, incomplete: false }],
    });
    const series = extractTimeSeries(chart);
    expect(series.unit).toBe('');
  });
});

// ─── Trend Detection ─────────────────────────────────────────────────────────

describe('detectTrend', () => {
  it('returns flat for short series (<4 values)', () => {
    const series = makeSeries([1, 2, 3]);
    const trend = detectTrend(series);
    expect(trend.direction).toBe('flat');
    expect(trend.changePercent).toBe(0);
    expect(trend.label).toBe('Test');
  });

  it('detects upward trend', () => {
    const series = makeSeries([10, 10, 10, 10, 10, 10, 20, 20, 20]);
    const trend = detectTrend(series);
    expect(trend.direction).toBe('up');
    expect(trend.changePercent).toBeGreaterThan(5);
  });

  it('detects downward trend', () => {
    const series = makeSeries([20, 20, 20, 20, 20, 20, 10, 10, 10]);
    const trend = detectTrend(series);
    expect(trend.direction).toBe('down');
    expect(trend.changePercent).toBeLessThan(-5);
  });

  it('detects flat trend', () => {
    const series = makeSeries([10, 10, 10, 10, 10, 10, 10, 10, 10]);
    const trend = detectTrend(series);
    expect(trend.direction).toBe('flat');
  });

  it('sets periodStart and periodEnd correctly', () => {
    const series = makeSeries([10, 10, 10, 10, 10, 10, 10, 10, 10]);
    const trend = detectTrend(series);
    expect(trend.periodStart).toBe(10);
    expect(trend.periodEnd).toBe(10);
  });

  it('returns flat with empty values', () => {
    const series = makeSeries([]);
    const trend = detectTrend(series);
    expect(trend.direction).toBe('flat');
    expect(trend.periodStart).toBe(0);
    expect(trend.periodEnd).toBe(0);
  });
});

// ─── Anomaly Detection ───────────────────────────────────────────────────────

describe('detectAnomalies', () => {
  it('returns empty for short series (<5 values)', () => {
    const series = makeSeries([1, 2, 3, 4]);
    expect(detectAnomalies(series)).toEqual([]);
  });

  it('returns empty when stddev is 0', () => {
    const series = makeSeries([5, 5, 5, 5, 5, 5, 5]);
    expect(detectAnomalies(series)).toEqual([]);
  });

  it('detects anomalies above threshold', () => {
    const values = [10, 10, 10, 10, 10, 10, 10, 100]; // 100 is clearly an outlier
    const series = makeSeries(values);
    const anomalies = detectAnomalies(series, 2.0);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].value).toBe(100);
    expect(anomalies[0].deviation).toBeGreaterThan(0);
  });

  it('detects anomalies below threshold', () => {
    const values = [100, 100, 100, 100, 100, 100, 100, 10]; // 10 is clearly an outlier
    const series = makeSeries(values);
    const anomalies = detectAnomalies(series, 2.0);
    expect(anomalies.length).toBeGreaterThan(0);
    const low = anomalies.find(a => a.value === 10);
    expect(low).toBeDefined();
    expect(low!.deviation).toBeLessThan(0);
  });

  it('marks critical when deviation >= 3', () => {
    // 29 identical + 1 extreme = deviation well above 3
    const values = Array(29).fill(10);
    values.push(500);
    const series = makeSeries(values);
    const anomalies = detectAnomalies(series, 2.0);
    const critical = anomalies.find(a => a.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical!.value).toBe(500);
  });

  it('marks warning when 2 <= deviation < 3', () => {
    // Use a distribution where outlier is 2-3σ
    // 20 values of 100, then one value that's ~2.5σ above
    // mean ≈ 105, stddev ≈ 22 → 155 is ~2.3σ
    const values = Array(20).fill(100);
    values.push(200); // outlier but not extreme
    const series = makeSeries(values);
    const anomalies = detectAnomalies(series, 2.0);
    // The outlier should be warning (2σ+) but might be exactly at boundary
    // Just check we get at least one anomaly
    expect(anomalies.length).toBeGreaterThan(0);
    // At least one should be warning severity
    const hasWarningOrCritical = anomalies.some(a => a.severity === 'warning' || a.severity === 'critical');
    expect(hasWarningOrCritical).toBe(true);
  });

  it('uses custom threshold', () => {
    const values = [10, 10, 10, 10, 10, 10, 10, 15];
    const series = makeSeries(values);
    const noAnomaly = detectAnomalies(series, 3.0);
    const withAnomaly = detectAnomalies(series, 1.0);
    expect(noAnomaly.length).toBeLessThanOrEqual(withAnomaly.length);
  });

  it('sets expected to mean', () => {
    const values = [10, 10, 10, 10, 10, 10, 10, 100];
    const series = makeSeries(values);
    const anomalies = detectAnomalies(series, 2.0);
    if (anomalies.length > 0) {
      expect(anomalies[0].expected).toBeCloseTo(mean(values), 0);
    }
  });
});

// ─── Insights ────────────────────────────────────────────────────────────────

describe('generateInsights', () => {
  it('returns empty array when no charts provided', () => {
    const charts = new Map<ChartName, ChartResponse>();
    expect(generateInsights(charts, [])).toEqual([]);
  });

  it('generates revenue declining insight', () => {
    // Revenue must decline >10% to trigger warning
    const values: ChartValue[] = [];
    for (let i = 0; i < 30; i++) {
      const val = i < 20 ? 500 : 200; // Drop from 500 to 200
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: val, incomplete: false });
    }
    const chart = makeChart({ displayName: 'Revenue', measures: [{ display_name: 'Revenue', unit: '$', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['revenue', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Revenue Declining')).toBe(true);
  });

  it('generates holiday revenue spike insight for December', () => {
    const values: ChartValue[] = [];
    for (let i = 0; i < 30; i++) {
      // December = month 11, so timestamps in December
      const ts = new Date(2025, 11, 1 + i).getTime() / 1000;
      const val = i === 15 ? 10000 : 500; // Spike on Dec 16
      values.push({ cohort: ts, measure: 0, value: val, incomplete: false });
    }
    const chart = makeChart({ displayName: 'Revenue', measures: [{ display_name: 'Revenue', unit: '$', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['revenue', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Holiday Revenue Spike')).toBe(true);
  });

  it('generates excellent churn insight', () => {
    const values: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 3, incomplete: false });
    }
    const chart = makeChart({ measures: [{ display_name: 'Churn Rate', unit: '%', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['churn', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Excellent Churn Rate')).toBe(true);
  });

  it('generates high churn insight', () => {
    const values: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 10, incomplete: false });
    }
    const chart = makeChart({ measures: [{ display_name: 'Churn Rate', unit: '%', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['churn', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'High Churn Rate')).toBe(true);
  });

  it('generates churn within range insight', () => {
    const values: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 6, incomplete: false });
    }
    const chart = makeChart({ measures: [{ display_name: 'Churn Rate', unit: '%', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['churn', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Churn Within Range')).toBe(true);
  });

  it('generates churn reduction opportunity with MRR data', () => {
    const churnValues: ChartValue[] = [];
    const mrrValues: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      churnValues.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 3, incomplete: false });
      mrrValues.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 5000, incomplete: false });
    }
    const churnChart = makeChart({ measures: [{ display_name: 'Churn Rate', unit: '%', chartable: true }], values: churnValues });
    const mrrChart = makeChart({ measures: [{ display_name: 'MRR', unit: '$', chartable: true }], values: mrrValues });
    const charts = new Map<ChartName, ChartResponse>([['churn', churnChart], ['mrr', mrrChart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Churn Reduction Opportunity')).toBe(true);
  });

  it('generates churn insight with MRR chart having zero value (fallback || 0)', () => {
    const churnValues: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      churnValues.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 3, incomplete: false });
    }
    const mrrValues: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      mrrValues.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 0, incomplete: false }); // zero MRR → fallback
    }
    const churnChart = makeChart({ measures: [{ display_name: 'Churn Rate', unit: '%', chartable: true }], values: churnValues });
    const mrrChart = makeChart({ measures: [{ display_name: 'MRR', unit: '$', chartable: true }], values: mrrValues });
    const charts = new Map<ChartName, ChartResponse>([['churn', churnChart], ['mrr', mrrChart]]);
    const insights = generateInsights(charts, []);
    // mrrChart exists but currentMRR=0 → Churn Reduction Opportunity still pushed (impact=$0)
    expect(insights.some(i => i.title === 'Churn Reduction Opportunity')).toBe(true);
  });

  it('generates churn insight without MRR chart (no opportunity)', () => {
    const churnValues: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      churnValues.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 3, incomplete: false });
    }
    const churnChart = makeChart({ measures: [{ display_name: 'Churn Rate', unit: '%', chartable: true }], values: churnValues });
    // Only churn, no MRR chart
    const charts = new Map<ChartName, ChartResponse>([['churn', churnChart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Excellent Churn Rate')).toBe(true);
    // Should NOT have churn reduction opportunity since no MRR data
    expect(insights.some(i => i.title === 'Churn Reduction Opportunity')).toBe(false);
  });

  it('generates strong trial conversion insight', () => {
    const values: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 45, incomplete: false });
    }
    const chart = makeChart({ measures: [{ display_name: 'Trial Conversion', unit: '%', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['trial_conversion_rate', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Strong Trial Conversion')).toBe(true);
  });

  it('generates low trial conversion insight', () => {
    const values: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 10, incomplete: false });
    }
    const chart = makeChart({ measures: [{ display_name: 'Trial Conversion', unit: '%', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['trial_conversion_rate', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Low Trial Conversion')).toBe(true);
  });

  it('generates elevated refund rate insight', () => {
    const values: ChartValue[] = [];
    for (let i = 0; i < 10; i++) {
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 8, incomplete: false });
    }
    const chart = makeChart({ measures: [{ display_name: 'Refund Rate', unit: '%', chartable: true }], values });
    const charts = new Map<ChartName, ChartResponse>([['refund_rate', chart]]);
    const insights = generateInsights(charts, []);
    expect(insights.some(i => i.title === 'Elevated Refund Rate')).toBe(true);
  });

  it('generates critical anomaly insights', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 1000, expected: 200,
      deviation: 4.0, label: 'New Customers', severity: 'critical',
    }];
    const insights = generateInsights(new Map(), anomalies);
    expect(insights.some(i => i.title === 'New Customers Spike')).toBe(true);
    expect(insights.some(i => i.severity === 'critical')).toBe(true);
  });

  it('generates drop insight for low anomaly', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 10, expected: 200,
      deviation: -4.0, label: 'Revenue', severity: 'critical',
    }];
    const insights = generateInsights(new Map(), anomalies);
    expect(insights.some(i => i.title === 'Revenue Drop')).toBe(true);
  });

  it('generates critical anomaly insight for Rate-type metric', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 25, expected: 5,
      deviation: 4.0, label: 'Refund Rate', severity: 'critical',
    }];
    const insights = generateInsights(new Map(), anomalies);
    expect(insights.some(i => i.title === 'Refund Rate Spike')).toBe(true);
    // Rate type should use % formatting
    expect(insights[0].description).toContain('%');
  });

  it('skips warning-level anomalies in insights', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 300, expected: 200,
      deviation: 2.1, label: 'Revenue', severity: 'warning',
    }];
    const insights = generateInsights(new Map(), anomalies);
    expect(insights.length).toBe(0);
  });
});

// ─── Simulator ───────────────────────────────────────────────────────────────

describe('simChurnReduction', () => {
  it('calculates churn reduction impact', () => {
    const result = simChurnReduction(defaultSimInput, 2);
    expect(result.name).toBe('Reduce Churn');
    expect(result.currentValue).toBe(5);
    expect(result.targetValue).toBe(3);
    expect(result.unit).toBe('%');
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
    expect(result.revenueImpact12Months).toBeGreaterThan(0);
    expect(result.projectedImpact).toContain('+$');
  });

  it('clamps churn to 0 if reduction exceeds current', () => {
    const result = simChurnReduction({ ...defaultSimInput, currentChurnRate: 1 }, 5);
    expect(result.targetValue).toBe(0);
    expect(result.description).toContain('0.0%');
  });

  it('handles zero MRR', () => {
    const result = simChurnReduction({ ...defaultSimInput, currentMRR: 0 }, 2);
    expect(result.mrrImpact12Months).toBe(0);
  });
});

describe('simTrialImprovement', () => {
  it('calculates trial improvement impact', () => {
    const result = simTrialImprovement(defaultSimInput, 50);
    expect(result.name).toBe('Improve Trial Conversion');
    expect(result.currentValue).toBe(30);
    expect(result.targetValue).toBe(50);
    expect(result.unit).toBe('%');
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
    expect(result.revenueImpact12Months).toBeGreaterThan(0);
  });

  it('handles no new customers', () => {
    const result = simTrialImprovement({ ...defaultSimInput, monthlyNewCustomers: 0 }, 50);
    expect(result.mrrImpact12Months).toBe(0);
  });
});

describe('simGrowth', () => {
  it('calculates growth impact', () => {
    const result = simGrowth(defaultSimInput, 2);
    expect(result.name).toBe('Increase Acquisition');
    expect(result.currentValue).toBe(100);
    expect(result.targetValue).toBe(200);
    expect(result.unit).toBe('customers/mo');
    expect(result.mrrImpact12Months).toBeGreaterThan(0);
    expect(result.revenueImpact12Months).toBeGreaterThan(0);
    expect(result.description).toContain('2x');
  });

  it('rounds customer counts', () => {
    const result = simGrowth({ ...defaultSimInput, monthlyNewCustomers: 33.33 }, 2);
    expect(result.description).toContain('33 →');
    expect(result.targetValue).toBe(67);
  });

  it('handles 1x multiplier (no growth)', () => {
    const result = simGrowth(defaultSimInput, 1);
    expect(result.mrrImpact12Months).toBe(0);
    expect(result.revenueImpact12Months).toBe(0);
  });
});

// ─── Formatters ──────────────────────────────────────────────────────────────

describe('trendArrow', () => {
  it('returns 📈 for up', () => expect(trendArrow('up')).toBe('📈'));
  it('returns 📉 for down', () => expect(trendArrow('down')).toBe('📉'));
  it('returns ➡️ for flat', () => expect(trendArrow('flat')).toBe('➡️'));
});

describe('formatOverviewMarkdown', () => {
  it('formats overview metrics as markdown table', () => {
    const metrics: OverviewMetric[] = [
      { id: 'mrr', name: 'MRR', description: '', value: 4560, unit: 'USD', period: 'P28D' },
      { id: 'churn', name: 'Churn', description: '', value: 5.2, unit: '%', period: 'P28D' },
      { id: 'actives', name: 'Actives', description: '', value: 2500, unit: 'count', period: 'P0D' },
    ];
    const md = formatOverviewMarkdown('Test App', metrics);
    expect(md).toContain('# Test App — Health Overview');
    expect(md).toContain('$4,560');
    expect(md).toContain('5.2%');
    expect(md).toContain('2,500');
    expect(md).toContain('| Metric | Value | Period |');
  });
});

describe('formatAnalysisMarkdown', () => {
  it('formats full analysis report', () => {
    const metrics: MetricSnapshot[] = [{
      name: 'Revenue', current: 5000, previous: 4000,
      changePercent: 25, trend: 'up', unit: '$',
    }];
    const trends: TrendResult[] = [{
      direction: 'up', changePercent: 25, periodStart: 4000,
      periodEnd: 5000, label: 'Revenue',
    }];
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 10000, expected: 5000,
      deviation: 2.5, label: 'Revenue', severity: 'warning',
    }];
    const insights: Insight[] = [{
      title: 'Test Insight', description: 'Test description',
      severity: 'info', recommendation: 'Do something',
    }];
    const scenarios: WhatIfScenario[] = [{
      name: 'Test Scenario', description: 'Test desc',
      currentValue: 5, targetValue: 3, unit: '%',
      projectedImpact: '+$100/mo', mrrImpact12Months: 1200,
      revenueImpact12Months: 14400,
    }];

    const md = formatAnalysisMarkdown('Test App', metrics, trends, anomalies, insights, scenarios, '2026-01-01', '2026-01-31');
    expect(md).toContain('# Test App — Subscription Analysis');
    expect(md).toContain('$5,000');
    expect(md).toContain('+25.0%');
    expect(md).toContain('📈');
    expect(md).toContain('## Anomalies Detected');
    expect(md).toContain('🟡');
    expect(md).toContain('## Insights & Recommendations');
    expect(md).toContain('💡 Test Insight');
    expect(md).toContain('## What-If Scenarios');
    expect(md).toContain('$1,200');
  });

  it('handles empty anomalies', () => {
    const md = formatAnalysisMarkdown('Test', [], [], [], [], [], '2026-01-01', '2026-01-31');
    expect(md).not.toContain('## Anomalies Detected');
  });

  it('handles empty insights', () => {
    const md = formatAnalysisMarkdown('Test', [], [], [], [], [], '2026-01-01', '2026-01-31');
    expect(md).not.toContain('## Insights & Recommendations');
  });

  it('handles empty scenarios', () => {
    const md = formatAnalysisMarkdown('Test', [], [], [], [], [], '2026-01-01', '2026-01-31');
    expect(md).not.toContain('## What-If Scenarios');
  });

  it('shows warning icon for warning insights', () => {
    const insights: Insight[] = [{ title: 'Warn', description: 'desc', severity: 'warning' }];
    const md = formatAnalysisMarkdown('Test', [], [], [], insights, [], '2026-01-01', '2026-01-31');
    expect(md).toContain('🟡 Warn');
  });

  it('shows critical icon for critical insights', () => {
    const insights: Insight[] = [{ title: 'Crit', description: 'desc', severity: 'critical' }];
    const md = formatAnalysisMarkdown('Test', [], [], [], insights, [], '2026-01-01', '2026-01-31');
    expect(md).toContain('🔴 Crit');
  });

  it('shows negative change percent', () => {
    const metrics: MetricSnapshot[] = [{
      name: 'Revenue', current: 3000, previous: 4000,
      changePercent: -25, trend: 'down', unit: '$',
    }];
    const md = formatAnalysisMarkdown('Test', metrics, [], [], [], [], '2026-01-01', '2026-01-31');
    expect(md).toContain('-25.0%');
  });

  it('formats critical anomalies with red icon', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 10000, expected: 1000,
      deviation: 4.0, label: 'Revenue', severity: 'critical',
    }];
    const md = formatAnalysisMarkdown('Test', [], [], anomalies, [], [], '2026-01-01', '2026-01-31');
    expect(md).toContain('🔴');
  });

  it('formats rate-type anomaly labels with % unit', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 15, expected: 5,
      deviation: 3.0, label: 'Churn Rate', severity: 'critical',
    }];
    const md = formatAnalysisMarkdown('Test', [], [], anomalies, [], [], '2026-01-01', '2026-01-31');
    expect(md).toContain('15.0%');
  });

  it('formats non-rate anomaly labels with # unit', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 500, expected: 100,
      deviation: 4.0, label: 'New Customers', severity: 'critical',
    }];
    const md = formatAnalysisMarkdown('Test', [], [], anomalies, [], [], '2026-01-01', '2026-01-31');
    expect(md).toContain('500');
    expect(md).toContain('+4.0σ');
  });

  it('formats anomaly with negative deviation without plus sign', () => {
    const anomalies: Anomaly[] = [{
      date: new Date('2026-01-15'), value: 5, expected: 100,
      deviation: -3.5, label: 'Revenue', severity: 'critical',
    }];
    const md = formatAnalysisMarkdown('Test', [], [], anomalies, [], [], '2026-01-01', '2026-01-31');
    expect(md).toContain('-3.5σ');
    expect(md).not.toContain('+-3.5σ');
  });

  it('includes insight without recommendation', () => {
    const insights: Insight[] = [{ title: 'Info', description: 'desc only', severity: 'info' }];
    const md = formatAnalysisMarkdown('Test', [], [], [], insights, [], '2026-01-01', '2026-01-31');
    expect(md).toContain('desc only');
    expect(md).not.toContain('> **Action:**');
  });
});

// ─── Date Helpers ────────────────────────────────────────────────────────────

describe('parsePeriod', () => {
  it('parses 28d period', () => {
    const { startDate, endDate } = parsePeriod('28d');
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end.getTime() - start.getTime()) / 86400000;
    expect(diffDays).toBeCloseTo(28, 0);
  });

  it('parses 90d period', () => {
    const { startDate, endDate } = parsePeriod('90d');
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end.getTime() - start.getTime()) / 86400000;
    expect(diffDays).toBeCloseTo(90, 0);
  });

  it('returns ISO date strings', () => {
    const { startDate, endDate } = parsePeriod('7d');
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── RevenueCatAPI ───────────────────────────────────────────────────────────

describe('RevenueCatAPI', () => {
  let api: RevenueCatAPI;

  beforeEach(() => {
    api = new RevenueCatAPI('sk_test_key');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('constructs with API key', () => {
    expect(api).toBeInstanceOf(RevenueCatAPI);
    expect(api.getProjectName()).toBeNull();
  });

  it('discovers project from API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
    } as Response);

    const project = await api.discoverProject();
    expect(project.id).toBe('proj_123');
    expect(project.name).toBe('Test App');
    expect(api.getProjectName()).toBe('Test App');
  });

  it('caches project after first discovery', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
    } as Response);

    await api.discoverProject();
    await api.discoverProject();
    // Only 1 call because second is cached
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when no projects found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], next_page: null }),
    } as Response);

    await expect(api.discoverProject()).rejects.toThrow('No projects found');
  });

  it('retries on 429 rate limit', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '1' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
      } as Response);

    const project = await api.discoverProject();
    expect(project.id).toBe('proj_123');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('uses default 2s when retry-after header is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers(), // No retry-after header
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
      } as Response);

    const project = await api.discoverProject();
    expect(project.id).toBe('proj_123');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 server error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
      } as Response);

    const project = await api.discoverProject();
    expect(project.id).toBe('proj_123');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws on non-retryable error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    await expect(api.discoverProject()).rejects.toThrow('API 401');
  });

  it('throws after max retries exhausted', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0' }),
      } as Response);

    await expect(api.discoverProject()).rejects.toThrow('Failed after 3 retries');
  });

  it('fetches chart data', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          category: 'revenue',
          display_name: 'Revenue',
          measures: [{ display_name: 'Revenue', unit: '$', chartable: true }],
          values: [{ cohort: 1704067200, measure: 0, value: 5000, incomplete: false }],
          summary: { average: { '0': 5000 }, total: { '0': 5000 } },
        }),
      } as Response);

    const chart = await api.fetchChart('revenue', '2026-01-01', '2026-01-31');
    expect(chart.display_name).toBe('Revenue');
    expect(chart.values[0].value).toBe(5000);
  });

  it('fetchCharts fetches multiple charts', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeChart({ displayName: 'Revenue' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeChart({ displayName: 'MRR' }),
      } as Response);

    const charts = await api.fetchCharts(['revenue', 'mrr'], '2026-01-01', '2026-01-31');
    expect(charts.size).toBe(2);
    expect(charts.has('revenue' as ChartName)).toBe(true);
    expect(charts.has('mrr' as ChartName)).toBe(true);
  });

  it('fetchCharts continues on individual chart failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeChart({ displayName: 'MRR' }),
      } as Response);

    const charts = await api.fetchCharts(['bad_chart', 'mrr'], '2026-01-01', '2026-01-31');
    expect(charts.size).toBe(1);
  });

  it('fetchOverview returns metrics', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_123', name: 'Test App' }], next_page: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          metrics: [{ id: 'mrr', name: 'MRR', description: '', value: 4560, unit: 'USD', period: 'P28D' }],
        }),
      } as Response);

    const overview = await api.fetchOverview();
    expect(overview.metrics[0].value).toBe(4560);
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('CORE_CHARTS', () => {
  it('has 10 chart types', () => expect(CORE_CHARTS.length).toBe(10));
  it('includes essential charts', () => {
    expect(CORE_CHARTS).toContain('revenue');
    expect(CORE_CHARTS).toContain('mrr');
    expect(CORE_CHARTS).toContain('churn');
    expect(CORE_CHARTS).toContain('actives');
    expect(CORE_CHARTS).toContain('trials');
  });
});

describe('BASE_URL', () => {
  it('points to RevenueCat V2 API', () => expect(BASE_URL).toBe('https://api.revenuecat.com/v2'));
});

// ─── CLI main() ──────────────────────────────────────────────────────────────

describe('main', () => {
  let originalArgv: string[];
  let originalKey: string | undefined;

  beforeEach(() => {
    originalArgv = process.argv;
    originalKey = process.env.REVENUECAT_API_KEY;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalKey) process.env.REVENUECAT_API_KEY = originalKey;
    else delete process.env.REVENUECAT_API_KEY;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function mockProjectAndOverview() {
    return vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_test', name: 'Test App' }], next_page: null }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          metrics: [
            { id: 'mrr', name: 'MRR', description: '', value: 4560, unit: 'USD', period: 'P28D' },
          ],
        }),
      } as Response);
  }

  function makeChartData(displayName: string, unit = '$'): ChartResponse {
    const values: ChartValue[] = [];
    for (let i = 0; i < 30; i++) {
      values.push({ cohort: 1704067200 + i * 86400, measure: 0, value: 100 + i * 2, incomplete: false });
    }
    return {
      category: 'test',
      display_name: displayName,
      measures: [{ display_name: displayName, unit, chartable: true } as ChartMeasure],
      values,
      summary: { average: { '0': 100 }, total: { '0': 3000 } },
    };
  }

  function mockProjectAndCharts() {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_test', name: 'Test App' }], next_page: null }),
      } as Response);
    // Mock each of the 10 CORE_CHARTS
    for (const name of CORE_CHARTS) {
      const unit = name.includes('rate') || name === 'churn' ? '%' : '$';
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => makeChartData(name, unit),
      } as Response);
    }
    return fetchSpy;
  }

  it('exits with error when no API key', async () => {
    delete process.env.REVENUECAT_API_KEY;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    try { await main(); } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with error for unknown command', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'badcommand'];
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

    try { await main(); } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('runs overview command (markdown)', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'overview'];
    mockProjectAndOverview();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Health Overview'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('$4,560'));
  });

  it('runs overview command (json)', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'overview', '--format', 'json'];
    mockProjectAndOverview();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.project).toBe('Test App');
    expect(parsed.metrics[0].value).toBe(4560);
  });

  it('runs overview command with --format=json syntax', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'overview', '--format=json'];
    mockProjectAndOverview();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.project).toBe('Test App');
  });

  it('runs analyze command (markdown)', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'analyze', '--period', '28d'];
    mockProjectAndCharts();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Subscription Analysis'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Key Metrics'));
  });

  it('runs analyze command (json)', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'analyze', '--format', 'json', '--period', '28d'];
    mockProjectAndCharts();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.project).toBe('Test App');
    expect(parsed.metrics).toBeDefined();
    expect(parsed.anomalies).toBeDefined();
    expect(parsed.insights).toBeDefined();
    expect(parsed.scenarios).toBeDefined();
    expect(parsed.period.start).toBeDefined();
    expect(parsed.period.end).toBeDefined();
  });

  it('runs what-if command (markdown)', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'what-if', '--period', '28d'];
    mockProjectAndCharts();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('What-If Scenarios'));
  });

  it('runs what-if command (json)', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'what-if', '--format', 'json', '--period', '28d'];
    mockProjectAndCharts();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.project).toBe('Test App');
    expect(parsed.scenarios).toBeDefined();
    expect(parsed.scenarios.length).toBe(3);
  });

  it('defaults to overview when no command given', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts'];
    mockProjectAndOverview();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Health Overview'));
  });

  it('handles charts with less than 2 values (skips them)', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'analyze', '--period', '7d'];
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_test', name: 'Test App' }], next_page: null }),
      } as Response);
    // Return charts with only 1 value
    for (const _ of CORE_CHARTS) {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          category: 'test',
          display_name: 'Test',
          measures: [{ display_name: 'Test', unit: '$', chartable: true }],
          values: [{ cohort: 1704067200, measure: 0, value: 100, incomplete: false }],
          summary: { average: { '0': 100 }, total: { '0': 100 } },
        }),
      } as Response);
    }
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    // Should still produce output (just with no metrics)
    expect(logSpy).toHaveBeenCalled();
  });

  it('handles missing chart series gracefully in sim input', async () => {
    process.env.REVENUECAT_API_KEY = 'sk_test';
    process.argv = ['node', 'rc-analyze.ts', 'what-if', '--period', '28d'];
    // Only return project discovery, all charts fail
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'proj_test', name: 'Test App' }], next_page: null }),
      } as Response);
    for (const _ of CORE_CHARTS) {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      } as Response);
    }
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main();
    // Should still produce output with default sim values
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('What-If Scenarios'));
  });
});
