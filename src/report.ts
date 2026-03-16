import type {
  AnalysisResult,
  MetricSnapshot,
  Report,
  ReportJSON,
  WhatIfScenario,
} from './types.js';

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatValue(value: number, unit: string): string {
  if (unit === '$') return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === '#') return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit}`;
}

function trendArrow(trend: string): string {
  switch (trend) {
    case 'up':
      return '📈 Up';
    case 'down':
      return '📉 Down';
    default:
      return '→ Stable';
  }
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🚨';
    case 'warning':
      return '⚠️';
    default:
      return '✅';
  }
}

function formatDateStr(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Markdown Report ─────────────────────────────────────────────────────────

export function generateMarkdownReport(
  analysis: AnalysisResult,
  scenarios: WhatIfScenario[]
): string {
  const lines: string[] = [];
  const now = new Date();

  // Header
  lines.push(`# 📊 RC Copilot Report — ${analysis.projectName}`);
  lines.push(
    `*Generated: ${formatDateStr(now)} | Period: ${formatDateStr(analysis.periodStart)} – ${formatDateStr(analysis.periodEnd)}*`
  );
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  const summaryBullets = buildExecutiveSummary(analysis, scenarios);
  for (const bullet of summaryBullets) {
    lines.push(`- ${bullet}`);
  }
  lines.push('');

  // Key Metrics Table
  lines.push('## 📈 Key Metrics');
  lines.push('');
  lines.push('| Metric | Current | Previous | Change | Trend | Industry Avg |');
  lines.push('|--------|---------|----------|--------|-------|--------------|');

  for (const metric of analysis.metrics) {
    const change =
      metric.changePercent >= 0
        ? `+${metric.changePercent.toFixed(1)}%`
        : `${metric.changePercent.toFixed(1)}%`;
    lines.push(
      `| ${metric.name} | ${formatValue(metric.current, metric.unit)} | ${formatValue(metric.previous, metric.unit)} | ${change} | ${trendArrow(metric.trend)} | ${metric.industryAvg || '—'} |`
    );
  }
  lines.push('');

  // Anomalies
  if (analysis.anomalies.length > 0) {
    lines.push('## 🔍 Anomalies Detected');
    lines.push('');

    const sorted = [...analysis.anomalies].sort(
      (a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)
    );
    for (let i = 0; i < Math.min(sorted.length, 10); i++) {
      const a = sorted[i];
      const direction = a.value > a.expected ? 'above' : 'below';
      const unit = a.label.toLowerCase().includes('rate') ? '%' : a.label.toLowerCase().includes('revenue') || a.label.toLowerCase().includes('mrr') || a.label.toLowerCase().includes('arr') ? '$' : '#';
      lines.push(
        `${i + 1}. ${severityIcon(a.severity)} **${a.label}** on ${formatDateStr(a.date)}: ` +
          `${formatValue(a.value, unit)} is ${Math.abs(a.deviation).toFixed(1)}σ ${direction} average (${formatValue(a.expected, unit)})`
      );
    }
    lines.push('');
  }

  // Insights & Recommendations
  if (analysis.insights.length > 0) {
    lines.push('## 💡 Insights & Recommendations');
    lines.push('');

    for (const insight of analysis.insights) {
      lines.push(`### ${severityIcon(insight.severity)} ${insight.title}`);
      lines.push('');
      lines.push(insight.description);
      if (insight.recommendation) {
        lines.push('');
        lines.push(`> **Recommendation:** ${insight.recommendation}`);
      }
      lines.push('');
    }
  }

  // What-If Scenarios
  if (scenarios.length > 0) {
    lines.push('## 🔮 What-If Scenarios');
    lines.push('');
    lines.push('| Scenario | Current | Target | Projected 12-Month Impact |');
    lines.push('|----------|---------|--------|---------------------------|');

    for (const s of scenarios) {
      const currentStr =
        s.unit === '%'
          ? `${s.currentValue.toFixed(1)}%`
          : s.currentValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
      const targetStr =
        s.unit === '%'
          ? `${s.targetValue.toFixed(1)}%`
          : s.targetValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
      lines.push(
        `| ${s.name} | ${currentStr} | ${targetStr} | ${s.projectedImpact} |`
      );
    }
    lines.push('');

    // Detailed scenario breakdown
    lines.push('### Scenario Details');
    lines.push('');
    for (const s of scenarios) {
      lines.push(`**${s.name}:** ${s.description}`);
      lines.push(`- ${s.projectedImpact}`);
      lines.push(`- 12-month MRR impact: +$${s.mrrImpact12Months.toLocaleString('en-US')}`);
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push(
    `*Report generated by [RC Copilot](https://github.com/major-rc/rc-copilot) — an autonomous RevenueCat analytics agent.*`
  );

  return lines.join('\n');
}

// ─── Executive Summary Builder ───────────────────────────────────────────────

function buildExecutiveSummary(
  analysis: AnalysisResult,
  scenarios: WhatIfScenario[]
): string[] {
  const bullets: string[] = [];

  // Revenue trend
  const revMetric = analysis.metrics.find((m) => m.name === 'Revenue');
  if (revMetric) {
    if (revMetric.trend === 'down' && revMetric.changePercent < -10) {
      bullets.push(
        `⚠️ **Revenue declining** — recent period down ${Math.abs(revMetric.changePercent).toFixed(0)}% vs prior period. Investigate pricing, churn, or seasonal effects.`
      );
    } else if (revMetric.trend === 'up') {
      bullets.push(
        `📈 **Revenue growing** — up ${revMetric.changePercent.toFixed(0)}% in the recent period.`
      );
    }
  }

  // Trial conversion
  const trialMetric = analysis.metrics.find(
    (m) => m.name.toLowerCase().includes('trial') && m.name.toLowerCase().includes('conversion')
  );
  if (trialMetric && trialMetric.current > 30) {
    bullets.push(
      `✅ **Trial conversion rate is strong at ${trialMetric.current.toFixed(0)}%** — well above industry average (25-30%).`
    );
  }

  // Anomalies summary
  const criticalAnomalies = analysis.anomalies.filter((a) => Math.abs(a.deviation) >= 2);
  if (criticalAnomalies.length > 0) {
    const spikes = criticalAnomalies.filter((a) => a.value > a.expected);
    const drops = criticalAnomalies.filter((a) => a.value < a.expected);
    if (spikes.length > 0) {
      const biggest = spikes.sort((a, b) => b.deviation - a.deviation)[0];
      bullets.push(
        `📈 **${biggest.label} spike detected** on ${formatDateStr(biggest.date)} — ${biggest.deviation.toFixed(1)}σ above average. Possible seasonal/campaign effect.`
      );
    }
    if (drops.length > 0) {
      const biggest = drops.sort((a, b) => a.deviation - b.deviation)[0];
      bullets.push(
        `⚠️ **${biggest.label} dip detected** on ${formatDateStr(biggest.date)} — ${Math.abs(biggest.deviation).toFixed(1)}σ below average. Investigate root cause.`
      );
    }
  }

  // Churn
  const churnMetric = analysis.metrics.find(
    (m) => m.name.toLowerCase().includes('churn')
  );
  if (churnMetric) {
    const churnScenario = scenarios.find((s) => s.name === 'Reduce Churn');
    if (churnScenario) {
      bullets.push(
        `⚠️ **Churn at ${churnMetric.current.toFixed(1)}%** — reducing by 2% would add ~$${churnScenario.mrrImpact12Months.toLocaleString('en-US')} MRR over 12 months.`
      );
    }
  }

  // Conversion to paying
  const ctpMetric = analysis.metrics.find(
    (m) => m.name.toLowerCase().includes('conversion') && !m.name.toLowerCase().includes('trial')
  );
  if (ctpMetric && ctpMetric.current < 10) {
    bullets.push(
      `🎯 **${ctpMetric.current.toFixed(2)}% visitor-to-paying conversion** — room for paywall optimization.`
    );
  }

  if (bullets.length === 0) {
    bullets.push('📊 Metrics are within normal ranges for the analyzed period.');
  }

  return bullets;
}

// ─── JSON Report ─────────────────────────────────────────────────────────────

export function generateJSONReport(
  analysis: AnalysisResult,
  scenarios: WhatIfScenario[]
): ReportJSON {
  return {
    generatedAt: new Date().toISOString(),
    project: analysis.projectName,
    period: {
      start: analysis.periodStart.toISOString(),
      end: analysis.periodEnd.toISOString(),
    },
    summary: buildExecutiveSummary(analysis, scenarios),
    metrics: analysis.metrics,
    anomalies: analysis.anomalies,
    insights: analysis.insights,
    scenarios,
  };
}

// ─── Combined Report ─────────────────────────────────────────────────────────

export function generateReport(
  analysis: AnalysisResult,
  scenarios: WhatIfScenario[]
): Report {
  return {
    markdown: generateMarkdownReport(analysis, scenarios),
    json: generateJSONReport(analysis, scenarios),
  };
}
