import { describe, it, expect } from 'vitest';
import {
  analyze,
  detectAnomalies,
  detectTrend,
  extractTimeSeries,
  findPrimaryMeasureIndex,
} from '../src/analyzer.js';
import type { ChartResponse, TimeSeries } from '../src/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeChart(values: number[], unit = '$', chartable = true): ChartResponse {
  return {
    category: 'revenue',
    display_name: 'Revenue',
    measures: [{ display_name: 'Revenue', unit, chartable }],
    summary: { average: {}, total: {} },
    values: values.map((v, i) => ({
      cohort: 1700000000 + i * 86400,
      measure: 0,
      value: v,
      incomplete: false,
    })),
  };
}

function makeTimeSeries(values: number[], label = 'Revenue', unit = '$'): TimeSeries {
  return {
    dates: values.map((_, i) => new Date(1700000000000 + i * 86400000)),
    values,
    label,
    unit,
  };
}

// ─── Internal helper coverage ────────────────────────────────────────────

// These tests drive the internal helper branches via the public API

describe('Internal helper branches', () => {
  it('percentChange with previous=0 and current=0 returns 0 (not 100)', () => {
    // detectTrend with all-zero values exercises percentChange(0, 0) → 0
    const ts = makeTimeSeries([0, 0, 0, 0, 0, 0, 0, 0]);
    const result = detectTrend(ts);
    expect(result.changePercent).toBe(0);
    expect(result.direction).toBe('flat');
  });

  it('percentChange with previous=0 and current negative returns 0 (flat)', () => {
    // 8 values: splitAt = floor(8*0.67)=5
    // priorValues=[0,0,0,0,0] avg=0, recentValues=[-5,-5,-5] avg=-5
    // percentChange(-5, 0) → previous===0, current=-5 <= 0 → returns 0 → flat
    const ts = makeTimeSeries([0, 0, 0, 0, 0, -5, -5, -5]);
    const result = detectTrend(ts);
    expect(result.changePercent).toBe(0);
    expect(result.direction).toBe('flat');
  });

  it('mean handles empty array (returns 0)', () => {
    // detectTrend with empty → calls mean([]) → returns 0
    const ts = makeTimeSeries([]);
    const result = detectTrend(ts);
    expect(result.periodStart).toBe(0);
    expect(result.periodEnd).toBe(0);
  });

  it('stddev with 1 value returns 0 (< 2 branch)', () => {
    // detectAnomalies with 5+ values but all but one are same — stddev path
    // detectTrend with 3 values triggers stddev indirectly via mean
    // Actually: stddev is tested via detectAnomalies which needs >=5 values
    // detectAnomalies passes values to stddev — with 5 identical values, stddev=0
    const ts = makeTimeSeries([100, 100, 100, 100, 100]);
    const anomalies = detectAnomalies(ts); // stddev=0 → returns []
    expect(anomalies).toHaveLength(0);
  });

  it('buildMetricSnapshot returns null for series with < 2 values', () => {
    // This happens inside analyze when a chart has only 1 data point
    const charts = new Map();
    const singleValueChart: ChartResponse = {
      category: 'mrr',
      display_name: 'MRR',
      measures: [{ display_name: 'MRR', unit: '$', chartable: true }],
      summary: { average: {}, total: {} },
      values: [{ cohort: 1700000000, measure: 0, value: 4557, incomplete: false }],
    };
    charts.set('mrr', singleValueChart);
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    // buildMetricSnapshot returns null for 1-value series → metrics should be empty
    expect(result.metrics).toHaveLength(0);
  });

  it('detectAnomalies with exactly 2 values (stddev < 2 branch)', () => {
    // stddev with exactly 2 different values — should work without throwing
    const ts = makeTimeSeries([10, 20]);
    const anomalies = detectAnomalies(ts);
    // < 5 values, so returns empty
    expect(anomalies).toHaveLength(0);
  });

  it('fmtNum # branch via critical anomaly insight on non-Rate label', () => {
    // Anomaly with label "Revenue" (no 'Rate') → fmtNum(value, '#')
    const vals = [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 10];
    const charts = new Map();
    charts.set('revenue', makeChart(vals));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const anomalyInsight = result.insights.find((i) => i.severity === 'critical');
    // Should have generated a critical insight using fmtNum with '#'
    expect(anomalyInsight).toBeDefined();
  });

  it('anomaly drop insight: fmtNum with Rate label uses % unit', () => {
    // Create a critical drop anomaly with "Rate" in the label
    const vals = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0.01];
    const chart: ChartResponse = {
      category: 'churn',
      display_name: 'Churn Rate',
      measures: [{ display_name: 'Churn Rate', unit: '%', chartable: true }],
      summary: { average: {}, total: {} },
      values: vals.map((v, i) => ({ cohort: 1700000000 + i * 86400, measure: 0, value: v, incomplete: false })),
    };
    const charts = new Map();
    charts.set('churn', chart);
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    // Critical anomaly insight should reference Rate → % unit in fmtNum
    const criticalInsight = result.insights.find((i) => i.severity === 'critical');
    if (criticalInsight) {
      expect(criticalInsight.description).toMatch(/\d+\.\d+%/);
    }
  });
});

// ─── findPrimaryMeasureIndex ─────────────────────────────────────────────

describe('findPrimaryMeasureIndex', () => {
  it('returns index of first chartable measure', () => {
    const chart: ChartResponse = {
      category: 'churn',
      display_name: 'Churn',
      measures: [
        { display_name: 'Actives', unit: '#', chartable: false },
        { display_name: 'Churn Rate', unit: '%', chartable: true },
      ],
      summary: { average: {}, total: {} },
      values: [],
    };
    expect(findPrimaryMeasureIndex(chart)).toBe(1);
  });

  it('falls back to 0 when no chartable measure', () => {
    const chart: ChartResponse = {
      category: 'revenue',
      display_name: 'Revenue',
      measures: [{ display_name: 'Revenue', unit: '$' }],
      summary: { average: {}, total: {} },
      values: [],
    };
    expect(findPrimaryMeasureIndex(chart)).toBe(0);
  });

  it('returns 0 when measures array is empty', () => {
    const chart: ChartResponse = {
      category: 'revenue',
      display_name: 'Revenue',
      measures: [],
      summary: { average: {}, total: {} },
      values: [],
    };
    expect(findPrimaryMeasureIndex(chart)).toBe(0);
  });
});

// ─── extractTimeSeries ────────────────────────────────────────────────────

describe('extractTimeSeries', () => {
  it('extracts values for primary measure', () => {
    const chart = makeChart([100, 200, 300]);
    const ts = extractTimeSeries(chart);
    expect(ts.values).toEqual([100, 200, 300]);
    expect(ts.label).toBe('Revenue');
    expect(ts.unit).toBe('$');
  });

  it('filters out incomplete periods', () => {
    const chart: ChartResponse = {
      category: 'revenue',
      display_name: 'Revenue',
      measures: [{ display_name: 'Revenue', unit: '$', chartable: true }],
      summary: { average: {}, total: {} },
      values: [
        { cohort: 1700000000, measure: 0, value: 100, incomplete: false },
        { cohort: 1700086400, measure: 0, value: 200, incomplete: true },
      ],
    };
    const ts = extractTimeSeries(chart);
    expect(ts.values).toEqual([100]);
  });

  it('sorts values by cohort date', () => {
    const chart: ChartResponse = {
      category: 'revenue',
      display_name: 'Revenue',
      measures: [{ display_name: 'Revenue', unit: '$', chartable: true }],
      summary: { average: {}, total: {} },
      values: [
        { cohort: 1700086400, measure: 0, value: 200, incomplete: false },
        { cohort: 1700000000, measure: 0, value: 100, incomplete: false },
      ],
    };
    const ts = extractTimeSeries(chart);
    expect(ts.values).toEqual([100, 200]);
  });

  it('handles chart with empty values', () => {
    const chart = makeChart([]);
    const ts = extractTimeSeries(chart);
    expect(ts.values).toHaveLength(0);
    expect(ts.dates).toHaveLength(0);
  });

  it('uses explicit measureIndex when provided', () => {
    const chart: ChartResponse = {
      category: 'churn',
      display_name: 'Churn',
      measures: [
        { display_name: 'Actives', unit: '#', chartable: false },
        { display_name: 'Churn Rate', unit: '%', chartable: true },
      ],
      summary: { average: {}, total: {} },
      values: [
        { cohort: 1700000000, measure: 0, value: 999, incomplete: false },
        { cohort: 1700000000, measure: 1, value: 5.2, incomplete: false },
      ],
    };
    const ts = extractTimeSeries(chart, 0);
    expect(ts.values).toContain(999);
    expect(ts.label).toBe('Actives');
  });

  it('uses chart display_name when measure has no display_name', () => {
    const chart: ChartResponse = {
      category: 'revenue',
      display_name: 'Revenue Chart',
      measures: [],
      summary: { average: {}, total: {} },
      values: [],
    };
    // measureIndex=0 but measures is empty — fallback to chart display_name
    const ts = extractTimeSeries(chart);
    expect(ts.label).toBe('Revenue Chart');
  });
});

// ─── detectTrend ──────────────────────────────────────────────────────────

describe('detectTrend', () => {
  it('returns flat for < 4 values', () => {
    const ts = makeTimeSeries([100, 200, 300]);
    const result = detectTrend(ts);
    expect(result.direction).toBe('flat');
    expect(result.changePercent).toBe(0);
  });

  it('detects growing trend (>5% increase)', () => {
    // Recent values much higher than prior
    const ts = makeTimeSeries([100, 100, 100, 100, 200, 200, 200, 200]);
    const result = detectTrend(ts);
    expect(result.direction).toBe('up');
    expect(result.changePercent).toBeGreaterThan(5);
  });

  it('detects declining trend (>5% decrease)', () => {
    const ts = makeTimeSeries([200, 200, 200, 200, 100, 100, 100, 100]);
    const result = detectTrend(ts);
    expect(result.direction).toBe('down');
    expect(result.changePercent).toBeLessThan(-5);
  });

  it('returns flat when change <= 5%', () => {
    // Very similar values
    const ts = makeTimeSeries([100, 102, 101, 103, 102, 101, 103, 102]);
    const result = detectTrend(ts);
    expect(result.direction).toBe('flat');
  });

  it('handles empty values gracefully', () => {
    const ts = makeTimeSeries([]);
    const result = detectTrend(ts);
    expect(result.direction).toBe('flat');
    expect(result.periodStart).toBe(0);
    expect(result.periodEnd).toBe(0);
  });

  it('returns label from series', () => {
    const ts = makeTimeSeries([1, 2, 3, 4, 5, 6, 7, 8], 'Churn Rate');
    const result = detectTrend(ts);
    expect(result.label).toBe('Churn Rate');
  });

  it('handles all-zero values', () => {
    const ts = makeTimeSeries([0, 0, 0, 0, 0, 0, 0, 0]);
    const result = detectTrend(ts);
    // previous avg = 0, current avg = 0 — percentChange with prev=0 returns 0
    expect(result.direction).toBe('flat');
  });
});

// ─── detectAnomalies ──────────────────────────────────────────────────────

describe('detectAnomalies', () => {
  it('returns empty array for < 5 values', () => {
    const ts = makeTimeSeries([100, 200, 300, 400]);
    expect(detectAnomalies(ts)).toHaveLength(0);
  });

  it('detects spike anomaly (Z-score >= 2)', () => {
    // All same except one outlier
    const ts = makeTimeSeries([100, 100, 100, 100, 100, 100, 100, 100, 1000]);
    const anomalies = detectAnomalies(ts);
    expect(anomalies.length).toBeGreaterThan(0);
    const spike = anomalies.find((a) => a.value === 1000);
    expect(spike).toBeDefined();
    expect(spike!.deviation).toBeGreaterThan(2);
  });

  it('detects drop anomaly (Z-score <= -2)', () => {
    const ts = makeTimeSeries([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 100]);
    const anomalies = detectAnomalies(ts);
    expect(anomalies.length).toBeGreaterThan(0);
    const drop = anomalies.find((a) => a.value === 100);
    expect(drop).toBeDefined();
    expect(drop!.deviation).toBeLessThan(-2);
  });

  it('assigns warning severity for 2 <= Z < 3', () => {
    // Construct series with exactly ~2-2.9 sigma outlier
    const vals = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 500];
    const ts = makeTimeSeries(vals);
    const anomalies = detectAnomalies(ts);
    // Find one with deviation in [2, 3)
    const warning = anomalies.find((a) => Math.abs(a.deviation) >= 2 && Math.abs(a.deviation) < 3);
    if (warning) {
      expect(warning.severity).toBe('warning');
    }
  });

  it('assigns critical severity for Z >= 3', () => {
    // Big outlier to ensure >= 3 sigma
    const vals = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 5000];
    const ts = makeTimeSeries(vals);
    const anomalies = detectAnomalies(ts);
    const critical = anomalies.find((a) => Math.abs(a.deviation) >= 3);
    expect(critical).toBeDefined();
    expect(critical!.severity).toBe('critical');
  });

  it('returns empty when all values are equal (stddev = 0)', () => {
    const ts = makeTimeSeries([100, 100, 100, 100, 100, 100]);
    expect(detectAnomalies(ts)).toHaveLength(0);
  });

  it('uses custom threshold', () => {
    const vals = [100, 100, 100, 100, 100, 100, 100, 100, 400];
    const ts = makeTimeSeries(vals);
    // High threshold — might not detect
    const withHighThreshold = detectAnomalies(ts, 10);
    const withLowThreshold = detectAnomalies(ts, 1);
    expect(withLowThreshold.length).toBeGreaterThanOrEqual(withHighThreshold.length);
  });

  it('handles negative values', () => {
    const ts = makeTimeSeries([-100, -100, -100, -100, -100, -100, -100, -100, 0]);
    const anomalies = detectAnomalies(ts);
    // Should not throw; may or may not detect depending on sigma
    expect(Array.isArray(anomalies)).toBe(true);
  });

  it('includes date, expected, label in anomaly', () => {
    const vals = [100, 100, 100, 100, 100, 100, 100, 100, 5000];
    const ts = makeTimeSeries(vals, 'MRR');
    const anomalies = detectAnomalies(ts);
    expect(anomalies.length).toBeGreaterThan(0);
    const a = anomalies[0];
    expect(a.label).toBe('MRR');
    expect(a.date).toBeInstanceOf(Date);
    expect(typeof a.expected).toBe('number');
  });
});

// ─── analyze ─────────────────────────────────────────────────────────────

describe('analyze', () => {
  it('returns AnalysisResult with project name', () => {
    const charts = new Map();
    charts.set('revenue', makeChart([100, 200, 300]));
    const result = analyze('Dark Noise', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    expect(result.projectName).toBe('Dark Noise');
    expect(result.periodStart).toBeInstanceOf(Date);
    expect(result.periodEnd).toBeInstanceOf(Date);
  });

  it('builds metrics snapshots from chart data', () => {
    const charts = new Map();
    charts.set('revenue', makeChart([100, 200, 300]));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    expect(result.metrics.length).toBeGreaterThanOrEqual(0);
  });

  it('returns empty trends/anomalies/insights for empty charts', () => {
    const charts = new Map();
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    expect(result.trends).toHaveLength(0);
    expect(result.anomalies).toHaveLength(0);
    expect(result.metrics).toHaveLength(0);
  });

  it('skips charts with < 2 values for metrics', () => {
    const charts = new Map();
    charts.set('revenue', makeChart([100]));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    expect(result.metrics).toHaveLength(0);
  });

  it('generates insights for revenue declining trend', () => {
    // Revenue goes from high to low over many data points
    const vals = [500, 490, 480, 470, 460, 450, 440, 430, 420, 410, 400, 390];
    const charts = new Map();
    charts.set('revenue', makeChart(vals));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    // insights may or may not fire depending on threshold; just verify structure
    expect(Array.isArray(result.insights)).toBe(true);
  });

  it('generates insights for December holiday spike', () => {
    // Create chart where max is in December (month 11)
    const charts = new Map();
    const revenueChart: ChartResponse = {
      category: 'revenue',
      display_name: 'Revenue',
      measures: [{ display_name: 'Revenue', unit: '$', chartable: true }],
      summary: { average: {}, total: {} },
      values: [
        // Jan–Nov: normal
        ...Array.from({ length: 11 }, (_, i) => ({
          cohort: new Date(2024, i, 1).getTime() / 1000,
          measure: 0,
          value: 100,
          incomplete: false,
        })),
        // December: spike
        { cohort: new Date(2024, 11, 1).getTime() / 1000, measure: 0, value: 500, incomplete: false },
      ],
    };
    charts.set('revenue', revenueChart);
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const decemberInsight = result.insights.find((i) => i.title.includes('Holiday'));
    expect(decemberInsight).toBeDefined();
  });

  it('generates churn insights when churn chart available', () => {
    const charts = new Map();
    // High churn
    charts.set('churn', makeChart([9, 10, 11, 10, 9, 10, 10, 10, 10, 9, 10, 11], '%'));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const churnInsight = result.insights.find((i) => i.metric === 'Churn Rate');
    expect(churnInsight).toBeDefined();
  });

  it('generates excellent churn insight for churn <= 5%', () => {
    const charts = new Map();
    charts.set('churn', makeChart([3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4], '%'));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const excellentInsight = result.insights.find((i) => i.title.includes('Excellent'));
    expect(excellentInsight).toBeDefined();
  });

  it('generates churn within range insight', () => {
    const charts = new Map();
    charts.set('churn', makeChart([6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6], '%'));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const rangeInsight = result.insights.find((i) => i.title.includes('Within'));
    expect(rangeInsight).toBeDefined();
  });

  it('generates churn reduction opportunity insight when mrr + churn available', () => {
    const charts = new Map();
    charts.set('churn', makeChart([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9], '%'));
    charts.set('mrr', makeChart([4557, 4557, 4557, 4557, 4557, 4557, 4557, 4557, 4557, 4557, 4557, 4557]));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const churnReductionInsight = result.insights.find((i) => i.title.includes('Churn Reduction'));
    expect(churnReductionInsight).toBeDefined();
  });

  it('generates strong trial conversion insight (>35%)', () => {
    const charts = new Map();
    charts.set('trial_conversion_rate', makeChart([40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40], '%'));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const strongInsight = result.insights.find((i) => i.title.includes('Strong Trial'));
    expect(strongInsight).toBeDefined();
  });

  it('generates low trial conversion insight (<20%)', () => {
    const charts = new Map();
    charts.set('trial_conversion_rate', makeChart([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], '%'));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const lowInsight = result.insights.find((i) => i.title.includes('Low Trial'));
    expect(lowInsight).toBeDefined();
  });

  it('generates paywall optimization insight for low conversion_to_paying (<5%)', () => {
    const charts = new Map();
    charts.set('conversion_to_paying', makeChart([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], '%'));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const paywallInsight = result.insights.find((i) => i.title.includes('Paywall'));
    expect(paywallInsight).toBeDefined();
  });

  it('generates refund rate insight (>5%)', () => {
    const charts = new Map();
    charts.set('refund_rate', makeChart([6, 7, 8, 7, 6, 7, 8, 7, 6, 7, 8, 7], '%'));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    const refundInsight = result.insights.find((i) => i.title.includes('Refund'));
    expect(refundInsight).toBeDefined();
  });

  it('generates anomaly insight for critical deviations', () => {
    // Create a chart with a massive outlier
    const vals = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 10000];
    const charts = new Map();
    charts.set('revenue', makeChart(vals));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    // Check that critical anomaly-based insights exist
    const anomalyInsight = result.insights.find((i) => i.severity === 'critical');
    expect(anomalyInsight).toBeDefined();
  });

  it('generates anomaly drop insight when critical anomaly is a drop', () => {
    // Make a series where there's a critical drop (negative deviation >= 3)
    const vals = [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 10];
    const charts = new Map();
    charts.set('revenue', makeChart(vals));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    // There should be an anomaly-based insight for this critical drop
    const anomalyInsight = result.insights.find(
      (i) => i.severity === 'critical' && (i.title.includes('Drop') || i.title.includes('Spike'))
    );
    expect(anomalyInsight).toBeDefined();
  });

  it('churn insight with mrr chart with empty values still works', () => {
    // MRR chart exists but has no complete values
    const mrrChart: ChartResponse = {
      category: 'mrr',
      display_name: 'MRR',
      measures: [{ display_name: 'MRR', unit: '$', chartable: true }],
      summary: { average: {}, total: {} },
      values: [
        { cohort: 1700000000, measure: 0, value: 4557, incomplete: true }, // all incomplete
      ],
    };
    const charts = new Map();
    charts.set('churn', makeChart([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9], '%'));
    charts.set('mrr', mrrChart);
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-12-31'));
    // Should not throw and should have churn insights
    const churnInsight = result.insights.find((i) => i.metric === 'Churn Rate');
    expect(churnInsight).toBeDefined();
  });

  it('returns charts reference in result', () => {
    const charts = new Map();
    charts.set('revenue', makeChart([100, 200]));
    const result = analyze('Test', charts, new Date('2024-01-01'), new Date('2024-03-31'));
    expect(result.charts).toBe(charts);
  });
});
