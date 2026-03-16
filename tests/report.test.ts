import { describe, it, expect } from 'vitest';
import {
  generateJSONReport,
  generateMarkdownReport,
  generateReport,
} from '../src/report.js';
import type { AnalysisResult, WhatIfScenario } from '../src/types.js';

// ─── Mock Data ─────────────────────────────────────────────────────────────

function makeAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    projectName: 'Dark Noise',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-03-31'),
    metrics: [
      {
        name: 'Revenue',
        current: 4557,
        previous: 4200,
        changePercent: 8.5,
        trend: 'up',
        unit: '$',
        industryAvg: undefined,
      },
      {
        name: 'Churn Rate',
        current: 5.5,
        previous: 6.0,
        changePercent: -8.3,
        trend: 'down',
        unit: '%',
        industryAvg: '5-7%',
      },
      {
        name: 'Active Subscriptions',
        current: 2529,
        previous: 2400,
        changePercent: 5.4,
        trend: 'up',
        unit: '#',
        industryAvg: undefined,
      },
    ],
    trends: [],
    anomalies: [
      {
        date: new Date('2024-02-01'),
        value: 3000,
        expected: 4500,
        deviation: -2.5,
        label: 'Revenue',
        severity: 'warning',
      },
      {
        date: new Date('2024-12-01'),
        value: 6000,
        expected: 4500,
        deviation: 3.5,
        label: 'Revenue',
        severity: 'critical',
      },
    ],
    insights: [
      {
        title: 'Revenue Growing',
        description: 'Revenue up 8.5% in recent period.',
        severity: 'info',
        metric: 'Revenue',
        value: 4557,
        recommendation: 'Keep it up!',
      },
      {
        title: 'Churn Rate Concern',
        description: 'Churn is elevated.',
        severity: 'warning',
      },
    ],
    charts: new Map(),
    ...overrides,
  };
}

const mockScenarios: WhatIfScenario[] = [
  {
    name: 'Reduce Churn',
    description: 'Reduce monthly churn from 7.0% to 5.0%',
    currentValue: 7,
    targetValue: 5,
    unit: '%',
    projectedImpact: '+$546/mo saved, compounding to +$3,500 additional MRR over 12 months',
    mrrImpact12Months: 3500,
    revenueImpact12Months: 42000,
  },
  {
    name: 'Increase Customer Acquisition',
    description: '2x new customer acquisition (500 → 1000/month)',
    currentValue: 500,
    targetValue: 1000,
    unit: 'customers/mo',
    projectedImpact: '+205 paying users/month → +$369/mo MRR',
    mrrImpact12Months: 2214,
    revenueImpact12Months: 28782,
  },
];

// ─── generateMarkdownReport ────────────────────────────────────────────────

describe('generateMarkdownReport', () => {
  it('starts with a level-1 heading', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toMatch(/^# /m);
  });

  it('includes project name in heading', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('Dark Noise');
  });

  it('includes Executive Summary section', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('## Executive Summary');
  });

  it('includes Key Metrics section', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('## 📈 Key Metrics');
  });

  it('includes metrics table headers', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('| Metric |');
    expect(md).toContain('| Current |');
    expect(md).toContain('| Trend |');
  });

  it('formats dollar values with $ prefix', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('$4,557');
  });

  it('formats percentage values with % suffix', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('5.5%');
  });

  it('formats numeric values without $ or %', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('2,529');
  });

  it('shows trend arrows for up/down/stable', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('📈 Up');
    expect(md).toContain('📉 Down');
  });

  it('shows industry average when available', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('5-7%');
  });

  it('shows — when no industry average', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('—');
  });

  it('includes Anomalies section when anomalies present', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('## 🔍 Anomalies Detected');
  });

  it('does not include Anomalies section when none present', () => {
    const result = makeAnalysisResult({ anomalies: [] });
    const md = generateMarkdownReport(result, mockScenarios);
    expect(md).not.toContain('## 🔍 Anomalies Detected');
  });

  it('includes Insights section when insights present', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('## 💡 Insights & Recommendations');
  });

  it('does not include Insights section when none present', () => {
    const result = makeAnalysisResult({ insights: [] });
    const md = generateMarkdownReport(result, mockScenarios);
    expect(md).not.toContain('## 💡 Insights & Recommendations');
  });

  it('includes What-If Scenarios section', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('## 🔮 What-If Scenarios');
  });

  it('does not include What-If section when no scenarios', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), []);
    expect(md).not.toContain('## 🔮 What-If Scenarios');
  });

  it('includes footer with RC Copilot reference', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('RC Copilot');
    expect(md).toContain('---');
  });

  it('shows severity icons (🚨 for critical, ⚠️ for warning)', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('🚨');
    expect(md).toContain('⚠️');
  });

  it('shows ✅ for info severity insights', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('✅');
  });

  it('shows recommendation when present', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('**Recommendation:**');
    expect(md).toContain('Keep it up!');
  });

  it('limits anomalies to 10', () => {
    const manyAnomalies = Array.from({ length: 15 }, (_, i) => ({
      date: new Date('2024-01-01'),
      value: i * 100,
      expected: 500,
      deviation: 2.5,
      label: 'Revenue',
      severity: 'warning' as const,
    }));
    const result = makeAnalysisResult({ anomalies: manyAnomalies });
    const md = generateMarkdownReport(result, mockScenarios);
    // Count occurrence of anomaly lines (numbered)
    const matches = md.match(/^\d+\. /gm);
    expect(matches).toBeDefined();
    expect(matches!.length).toBeLessThanOrEqual(10);
  });

  it('scenario with % unit shows percentage format', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('7.0%'); // churn scenario
  });

  it('scenario with non-% unit shows numeric format', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('500'); // customer scenario
  });

  it('shows stable trend arrow', () => {
    const result = makeAnalysisResult({
      metrics: [
        { name: 'MRR', current: 4557, previous: 4557, changePercent: 0, trend: 'flat', unit: '$' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('→ Stable');
  });

  it('executive summary has revenue declining bullet when revenue trend down >10%', () => {
    const result = makeAnalysisResult({
      metrics: [
        { name: 'Revenue', current: 3000, previous: 5000, changePercent: -40, trend: 'down', unit: '$' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('Revenue declining');
  });

  it('executive summary has revenue growing bullet when trend up', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), []);
    expect(md).toContain('Revenue growing');
  });

  it('executive summary has trial conversion bullet when > 30%', () => {
    const result = makeAnalysisResult({
      metrics: [
        { name: 'Trial Conversion Rate', current: 41, previous: 38, changePercent: 7.9, trend: 'up', unit: '%' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('Trial conversion rate is strong');
  });

  it('executive summary has visitor-to-paying bullet when < 10%', () => {
    const result = makeAnalysisResult({
      metrics: [
        { name: 'Conversion to Paying', current: 3, previous: 3.5, changePercent: -14, trend: 'down', unit: '%' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('visitor-to-paying conversion');
  });

  it('executive summary has default bullet when no conditions met', () => {
    const result = makeAnalysisResult({ metrics: [], anomalies: [], insights: [] });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('Metrics are within normal ranges');
  });

  it('executive summary has churn bullet with scenario data', () => {
    const result = makeAnalysisResult({
      metrics: [
        { name: 'Churn Rate', current: 7.5, previous: 7.0, changePercent: 7.1, trend: 'up', unit: '%' },
      ],
      anomalies: [],
    });
    const md = generateMarkdownReport(result, mockScenarios);
    expect(md).toContain('Churn at');
  });

  it('anomalies section uses above/below direction correctly', () => {
    const result = makeAnalysisResult({
      anomalies: [
        { date: new Date('2024-02-01'), value: 300, expected: 4500, deviation: -2.5, label: 'Revenue', severity: 'warning' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('below');
  });

  it('anomaly with rate label uses % unit in format', () => {
    const result = makeAnalysisResult({
      anomalies: [
        { date: new Date('2024-02-01'), value: 15, expected: 5, deviation: 2.5, label: 'Churn Rate', severity: 'warning' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('15.0%');
  });

  it('anomaly with revenue/mrr/arr label uses $ unit in format', () => {
    const result = makeAnalysisResult({
      anomalies: [
        { date: new Date('2024-02-01'), value: 5000, expected: 4500, deviation: 2.5, label: 'MRR', severity: 'warning' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    expect(md).toContain('$5,000');
  });

  it('scenario detail section includes 12-month MRR impact', () => {
    const md = generateMarkdownReport(makeAnalysisResult(), mockScenarios);
    expect(md).toContain('12-month MRR impact');
  });
});

  it('formatValue uses default format for unknown unit (e.g. "bps")', () => {
    // Create metric with non-standard unit that hits the default formatValue branch
    const result = makeAnalysisResult({
      metrics: [
        { name: 'Custom Metric', current: 1234.56, previous: 1000, changePercent: 23.4, trend: 'up', unit: 'bps' },
      ],
    });
    const md = generateMarkdownReport(result, []);
    // Should render with the unit suffix
    expect(md).toContain('bps');
  });

// ─── generateJSONReport ────────────────────────────────────────────────────

describe('generateJSONReport', () => {
  it('returns object with generatedAt ISO string', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(json.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes project name', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(json.project).toBe('Dark Noise');
  });

  it('includes period start and end as ISO strings', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(json.period.start).toContain('2024-01-01');
    expect(json.period.end).toContain('2024-03-31');
  });

  it('includes metrics array', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(Array.isArray(json.metrics)).toBe(true);
    expect(json.metrics).toHaveLength(3);
  });

  it('includes anomalies array', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(Array.isArray(json.anomalies)).toBe(true);
    expect(json.anomalies).toHaveLength(2);
  });

  it('includes insights array', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(Array.isArray(json.insights)).toBe(true);
    expect(json.insights).toHaveLength(2);
  });

  it('includes scenarios array', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(Array.isArray(json.scenarios)).toBe(true);
    expect(json.scenarios).toHaveLength(2);
  });

  it('includes summary array of strings', () => {
    const json = generateJSONReport(makeAnalysisResult(), mockScenarios);
    expect(Array.isArray(json.summary)).toBe(true);
    expect(json.summary.every((s) => typeof s === 'string')).toBe(true);
  });
});

// ─── generateReport ────────────────────────────────────────────────────────

describe('generateReport', () => {
  it('returns object with markdown and json properties', () => {
    const report = generateReport(makeAnalysisResult(), mockScenarios);
    expect(typeof report.markdown).toBe('string');
    expect(typeof report.json).toBe('object');
  });

  it('markdown is non-empty string', () => {
    const report = generateReport(makeAnalysisResult(), mockScenarios);
    expect(report.markdown.length).toBeGreaterThan(100);
  });

  it('json has all required fields', () => {
    const report = generateReport(makeAnalysisResult(), mockScenarios);
    expect(report.json).toHaveProperty('generatedAt');
    expect(report.json).toHaveProperty('project');
    expect(report.json).toHaveProperty('period');
    expect(report.json).toHaveProperty('metrics');
    expect(report.json).toHaveProperty('anomalies');
    expect(report.json).toHaveProperty('insights');
    expect(report.json).toHaveProperty('scenarios');
    expect(report.json).toHaveProperty('summary');
  });
});
