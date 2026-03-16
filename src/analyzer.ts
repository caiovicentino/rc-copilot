import type {
  AnalysisResult,
  Anomaly,
  ChartName,
  ChartResponse,
  Insight,
  MetricSnapshot,
  Severity,
  TimeSeries,
  TrendDirection,
  TrendResult,
} from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatDate(ts: number): Date {
  return new Date(ts * 1000);
}

function fmtNum(value: number, unit: string): string {
  if (unit === '$') return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ─── Chartable Measure Discovery ─────────────────────────────────────────────

/**
 * Find the primary measure index for a chart.
 * RevenueCat charts mark their primary metric with `chartable: true`.
 * For charts like "churn", measure 0 is "Actives" (count) but
 * measure 2 is "Churn Rate" (%) which is the actual metric.
 */
export function findPrimaryMeasureIndex(chart: ChartResponse): number {
  // Look for the first chartable measure
  for (let i = 0; i < chart.measures.length; i++) {
    if (chart.measures[i].chartable === true) return i;
  }
  // Fallback: use the first measure
  return 0;
}

// ─── Time Series Extraction ──────────────────────────────────────────────────

export function extractTimeSeries(chart: ChartResponse, measureIndex?: number): TimeSeries {
  const idx = measureIndex ?? findPrimaryMeasureIndex(chart);
  const measure = chart.measures[idx];
  const filtered = chart.values
    .filter((v) => v.measure === idx)
    // Filter out incomplete periods (e.g., current week/month not yet finished)
    .filter((v) => !v.incomplete)
    .sort((a, b) => a.cohort - b.cohort);

  return {
    dates: filtered.map((v) => formatDate(v.cohort)),
    values: filtered.map((v) => v.value),
    label: measure?.display_name || chart.display_name,
    unit: measure?.unit || '',
  };
}

// ─── Trend Detection ─────────────────────────────────────────────────────────

export function detectTrend(series: TimeSeries, lookbackRatio = 0.33): TrendResult {
  const values = series.values;
  if (values.length < 4) {
    return {
      direction: 'flat',
      changePercent: 0,
      periodStart: values[0] || 0,
      periodEnd: values[values.length - 1] || 0,
      label: series.label,
    };
  }

  const splitAt = Math.floor(values.length * (1 - lookbackRatio));
  const recentValues = values.slice(splitAt);
  const priorValues = values.slice(0, splitAt);

  const recentAvg = mean(recentValues);
  const priorAvg = mean(priorValues);
  const change = percentChange(recentAvg, priorAvg);

  let direction: TrendDirection = 'flat';
  if (change > 5) direction = 'up';
  else if (change < -5) direction = 'down';

  return {
    direction,
    changePercent: Math.round(change * 100) / 100,
    periodStart: priorAvg,
    periodEnd: recentAvg,
    label: series.label,
  };
}

// ─── Anomaly Detection ───────────────────────────────────────────────────────

export function detectAnomalies(series: TimeSeries, threshold = 2.0): Anomaly[] {
  const values = series.values;
  if (values.length < 5) return [];

  const avg = mean(values);
  const sd = stddev(values);
  if (sd === 0) return [];

  const anomalies: Anomaly[] = [];

  for (let i = 0; i < values.length; i++) {
    const deviation = (values[i] - avg) / sd;
    if (Math.abs(deviation) >= threshold) {
      const severity: Severity = Math.abs(deviation) >= 3 ? 'critical' : 'warning';
      anomalies.push({
        date: series.dates[i],
        value: values[i],
        expected: avg,
        deviation: Math.round(deviation * 10) / 10,
        label: series.label,
        severity,
      });
    }
  }

  return anomalies;
}

// ─── Metric Snapshots ────────────────────────────────────────────────────────

function buildMetricSnapshot(
  chart: ChartResponse,
  chartName: ChartName,
): MetricSnapshot | null {
  const series = extractTimeSeries(chart);
  if (series.values.length < 2) return null;

  const trend = detectTrend(series);
  const current = series.values[series.values.length - 1];
  const previous = series.values[series.values.length - 2];

  const industryAvgs: Partial<Record<ChartName, string>> = {
    churn: '5-7%',
    trial_conversion_rate: '25-30%',
    conversion_to_paying: '2-5%',
    refund_rate: '1-3%',
  };

  return {
    name: series.label,
    current,
    previous,
    changePercent: Math.round(percentChange(current, previous) * 100) / 100,
    trend: trend.direction,
    unit: series.unit,
    industryAvg: industryAvgs[chartName],
  };
}

// ─── Insight Generation ──────────────────────────────────────────────────────

function generateInsights(
  charts: Map<ChartName, ChartResponse>,
  anomalies: Anomaly[],
  _metrics: MetricSnapshot[]
): Insight[] {
  const insights: Insight[] = [];

  // Revenue trend insights
  const revChart = charts.get('revenue');
  if (revChart) {
    const series = extractTimeSeries(revChart);
    const trend = detectTrend(series);
    const values = series.values;
    const max = Math.max(...values);
    const maxIndex = values.indexOf(max);
    const maxDate = series.dates[maxIndex];

    if (trend.direction === 'down' && trend.changePercent < -10) {
      insights.push({
        title: 'Revenue Declining',
        description: `Revenue has decreased ${Math.abs(trend.changePercent).toFixed(1)}% in the recent period compared to the prior period.`,
        severity: 'warning',
        metric: 'Revenue',
        value: trend.periodEnd,
        recommendation:
          'Investigate potential causes: pricing changes, increased churn, or seasonal effects. Review acquisition channels and conversion funnels.',
      });
    }

    // December / holiday spike detection
    if (maxDate && maxDate.getMonth() === 11) {
      insights.push({
        title: 'Holiday Revenue Spike Detected',
        description: `Peak revenue of ${fmtNum(max, '$')} occurred in December — ${((max / mean(values) - 1) * 100).toFixed(0)}% above average.`,
        severity: 'info',
        metric: 'Revenue',
        value: max,
        recommendation:
          'Plan Q4 marketing campaigns and holiday promotions. Consider gift subscriptions, seasonal pricing, or featured placement campaigns.',
      });
    }
  }

  // Churn insights
  const churnChart = charts.get('churn');
  if (churnChart) {
    const series = extractTimeSeries(churnChart);
    const recentChurn = mean(series.values.slice(-3));

    if (recentChurn > 8) {
      insights.push({
        title: 'Churn Rate Above Industry Average',
        description: `Monthly churn of ${recentChurn.toFixed(1)}% exceeds the typical 5-7% range for subscription apps.`,
        severity: 'warning',
        metric: 'Churn Rate',
        value: recentChurn,
        recommendation:
          'Analyze cohort retention curves. Consider onboarding improvements, engagement features, win-back campaigns, or annual plan incentives.',
      });
    } else if (recentChurn <= 5) {
      insights.push({
        title: 'Excellent Churn Rate',
        description: `Monthly churn of ${recentChurn.toFixed(1)}% is at or below industry average.`,
        severity: 'info',
        metric: 'Churn Rate',
        value: recentChurn,
      });
    } else {
      insights.push({
        title: 'Churn Rate Within Industry Range',
        description: `Monthly churn of ${recentChurn.toFixed(1)}% is within the typical 5-7% range for subscription apps.`,
        severity: 'info',
        metric: 'Churn Rate',
        value: recentChurn,
      });
    }

    // Churn impact calculation
    const mrrChart = charts.get('mrr');
    if (mrrChart) {
      const mrrSeries = extractTimeSeries(mrrChart);
      const currentMRR = mrrSeries.values[mrrSeries.values.length - 1] || 0;
      const churnImpact = currentMRR * 0.01 * 12;
      insights.push({
        title: 'Churn Reduction Opportunity',
        description: `Each 1% reduction in churn rate would save approximately ${fmtNum(churnImpact, '$')} in annual MRR.`,
        severity: 'info',
        metric: 'Churn Impact',
        value: churnImpact,
        recommendation:
          'Target the highest-churn cohorts with retention campaigns. Even small improvements compound significantly over time.',
      });
    }
  }

  // Trial conversion insights
  const trialConvChart = charts.get('trial_conversion_rate');
  if (trialConvChart) {
    const series = extractTimeSeries(trialConvChart);
    const recentConv = mean(series.values.slice(-3));

    if (recentConv > 35) {
      insights.push({
        title: 'Strong Trial Conversion Rate',
        description: `Trial-to-paid conversion of ${recentConv.toFixed(0)}% is well above the industry average of 25-30%.`,
        severity: 'info',
        metric: 'Trial Conversion',
        value: recentConv,
        recommendation:
          'Consider expanding trial offerings or increasing trial volume since conversion is strong. Test shorter trial periods to accelerate revenue.',
      });
    } else if (recentConv < 20) {
      insights.push({
        title: 'Low Trial Conversion Rate',
        description: `Trial-to-paid conversion of ${recentConv.toFixed(0)}% is below industry average of 25-30%.`,
        severity: 'warning',
        metric: 'Trial Conversion',
        value: recentConv,
        recommendation:
          'Review the trial experience. Consider trial length optimization, in-trial engagement messaging, and paywall copy improvements.',
      });
    }
  }

  // Conversion to paying insights
  const ctpChart = charts.get('conversion_to_paying');
  if (ctpChart) {
    const series = extractTimeSeries(ctpChart);
    const recentCtp = mean(series.values.slice(-3));

    if (recentCtp < 5) {
      insights.push({
        title: 'Paywall Optimization Opportunity',
        description: `Visitor-to-paying conversion is ${recentCtp.toFixed(2)}% — there's room to improve paywall effectiveness.`,
        severity: 'info',
        metric: 'Conversion to Paying',
        value: recentCtp,
        recommendation:
          'A/B test paywall designs, pricing tiers, and copy. Consider showing social proof, offering limited-time discounts, or restructuring the feature gate.',
      });
    }
  }

  // Refund rate insights
  const refundChart = charts.get('refund_rate');
  if (refundChart) {
    const series = extractTimeSeries(refundChart);
    const recentRefund = mean(series.values.slice(-3));

    if (recentRefund > 5) {
      insights.push({
        title: 'Elevated Refund Rate',
        description: `Refund rate of ${recentRefund.toFixed(1)}% is above the typical 1-3% range.`,
        severity: 'warning',
        metric: 'Refund Rate',
        value: recentRefund,
        recommendation:
          'Review recent app reviews for quality complaints. Consider improving onboarding to set expectations before purchase.',
      });
    }
  }

  // Anomaly-based insights
  for (const anomaly of anomalies) {
    if (anomaly.severity === 'critical') {
      const direction = anomaly.value > anomaly.expected ? 'spike' : 'drop';
      insights.push({
        title: `${anomaly.label} ${direction === 'spike' ? 'Spike' : 'Drop'} Detected`,
        description: `${anomaly.label} of ${fmtNum(anomaly.value, anomaly.label.includes('Rate') ? '%' : '#')} on ${anomaly.date.toLocaleDateString('en-US')} is ${Math.abs(anomaly.deviation).toFixed(1)}σ ${direction === 'spike' ? 'above' : 'below'} the mean.`,
        severity: 'critical',
        metric: anomaly.label,
        value: anomaly.value,
        recommendation: `Investigate the root cause of this ${direction}. Check for external events, app updates, or marketing campaigns that coincide with this date.`,
      });
    }
  }

  return insights;
}

// ─── Main Analysis ───────────────────────────────────────────────────────────

export function analyze(
  projectName: string,
  charts: Map<ChartName, ChartResponse>,
  periodStart: Date,
  periodEnd: Date
): AnalysisResult {
  const metrics: MetricSnapshot[] = [];
  const allTrends: TrendResult[] = [];
  const allAnomalies: Anomaly[] = [];

  for (const [chartName, chart] of charts) {
    // Use the primary (chartable) measure
    const series = extractTimeSeries(chart);
    if (series.values.length < 2) continue;

    // Trend
    const trend = detectTrend(series);
    allTrends.push(trend);

    // Anomalies
    const anomalies = detectAnomalies(series);
    allAnomalies.push(...anomalies);

    // Metric snapshot
    const snapshot = buildMetricSnapshot(chart, chartName);
    if (snapshot) metrics.push(snapshot);
  }

  // Generate rule-based insights
  const insights = generateInsights(charts, allAnomalies, metrics);

  return {
    projectName,
    periodStart,
    periodEnd,
    metrics,
    trends: allTrends,
    anomalies: allAnomalies,
    insights,
    charts,
  };
}
