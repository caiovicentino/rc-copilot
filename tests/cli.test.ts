import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSimulatorInput, getDateRange, parseArgs, printHelp } from '../src/cli.js';
import type { AnalysisResult } from '../src/types.js';

// ─── parseArgs ────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('defaults to analyze command when no args', () => {
    const result = parseArgs(['node', 'cli.js']);
    expect(result.command).toBe('analyze');
  });

  it('parses command as first positional arg', () => {
    const result = parseArgs(['node', 'cli.js', 'overview']);
    expect(result.command).toBe('overview');
  });

  it('parses --key value pairs', () => {
    const result = parseArgs(['node', 'cli.js', 'analyze', '--api-key', 'sk_test123', '--format', 'json']);
    expect(result.options['api-key']).toBe('sk_test123');
    expect(result.options['format']).toBe('json');
  });

  it('parses --flag without value as "true"', () => {
    const result = parseArgs(['node', 'cli.js', 'analyze', '--verbose']);
    expect(result.options['verbose']).toBe('true');
  });

  it('stops parsing flag value when next arg starts with --', () => {
    const result = parseArgs(['node', 'cli.js', 'analyze', '--verbose', '--format', 'json']);
    expect(result.options['verbose']).toBe('true');
    expect(result.options['format']).toBe('json');
  });

  it('parses multiple flags', () => {
    const result = parseArgs(['node', 'cli.js', 'what-if', '--reduce-churn', '2%', '--improve-trials', '50%']);
    expect(result.options['reduce-churn']).toBe('2%');
    expect(result.options['improve-trials']).toBe('50%');
  });

  it('handles help command', () => {
    expect(parseArgs(['node', 'cli.js', 'help']).command).toBe('help');
    expect(parseArgs(['node', 'cli.js', '--help']).command).toBe('--help');
    expect(parseArgs(['node', 'cli.js', '-h']).command).toBe('-h');
  });

  it('returns empty options when no flags', () => {
    const result = parseArgs(['node', 'cli.js', 'overview']);
    expect(Object.keys(result.options)).toHaveLength(0);
  });

  it('parses grow-customers flag', () => {
    const result = parseArgs(['node', 'cli.js', 'what-if', '--grow-customers', '2x']);
    expect(result.options['grow-customers']).toBe('2x');
  });
});

// ─── getDateRange ──────────────────────────────────────────────────────────

describe('getDateRange', () => {
  it('returns startDate and endDate as YYYY-MM-DD strings', () => {
    const { startDate, endDate } = getDateRange('90d');
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('endDate is today', () => {
    const { endDate } = getDateRange('30d');
    const today = new Date().toISOString().split('T')[0];
    expect(endDate).toBe(today);
  });

  it('startDate is N days before endDate', () => {
    const { startDate, endDate } = getDateRange('30d');
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
    expect(diffDays).toBe(30);
  });

  it('works for all valid periods', () => {
    const periods = ['7d', '14d', '28d', '30d', '60d', '90d', '180d', '365d'] as const;
    for (const period of periods) {
      const { startDate, endDate } = getDateRange(period);
      expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ─── buildSimulatorInput ──────────────────────────────────────────────────

function makeChart(values: number[], unit = '$') {
  return {
    category: 'test',
    display_name: 'Test',
    measures: [{ display_name: 'Test', unit, chartable: true }],
    summary: { average: {}, total: {} },
    values: values.map((v, i) => ({ cohort: 1700000000 + i * 86400, measure: 0, value: v, incomplete: false })),
  };
}

function makeAnalysis(chartsData: Record<string, number[]> = {}): AnalysisResult {
  const charts = new Map();
  for (const [name, values] of Object.entries(chartsData)) {
    charts.set(name, makeChart(values));
  }
  return {
    projectName: 'Test',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-03-31'),
    metrics: [],
    trends: [],
    anomalies: [],
    insights: [],
    charts,
  };
}

describe('buildSimulatorInput', () => {
  it('uses defaults when no charts available', () => {
    const input = buildSimulatorInput(makeAnalysis());
    expect(input.currentMRR).toBe(4500);
    expect(input.currentChurnRate).toBe(7);
    expect(input.currentTrialConversion).toBe(41);
    expect(input.activeSubscriptions).toBe(2529);
    expect(input.monthlyNewCustomers).toBe(500);
  });

  it('reads MRR from mrr chart last value', () => {
    const input = buildSimulatorInput(makeAnalysis({ mrr: [4000, 4200, 4557] }));
    expect(input.currentMRR).toBe(4557);
  });

  it('reads churn from average of last 3 values', () => {
    const input = buildSimulatorInput(makeAnalysis({ churn: [5, 6, 7, 8, 9] }));
    // last 3: [7, 8, 9] avg = 8
    expect(input.currentChurnRate).toBeCloseTo(8);
  });

  it('reads trial conversion from average of last 3 values', () => {
    const input = buildSimulatorInput(makeAnalysis({ trial_conversion_rate: [40, 41, 42, 43, 44] }));
    // last 3: [42, 43, 44] avg = 43
    expect(input.currentTrialConversion).toBeCloseTo(43);
  });

  it('reads active subscriptions from actives chart last value', () => {
    const input = buildSimulatorInput(makeAnalysis({ actives: [2400, 2500, 2529] }));
    expect(input.activeSubscriptions).toBe(2529);
  });

  it('reads monthly new customers from customers_new chart', () => {
    // 30 values of 10/day = ~300/month
    const vals = Array(30).fill(10);
    const input = buildSimulatorInput(makeAnalysis({ customers_new: vals }));
    expect(input.monthlyNewCustomers).toBeGreaterThan(0);
  });

  it('computes avgRevenuePerUser = MRR / activeSubscriptions', () => {
    const input = buildSimulatorInput(makeAnalysis({
      mrr: [4557],
      actives: [2529],
    }));
    expect(input.avgRevenuePerUser).toBeCloseTo(4557 / 2529, 2);
  });

  it('uses 1.8 as avgRevenuePerUser when activeSubscriptions is 0', () => {
    const input = buildSimulatorInput(makeAnalysis({ actives: [0] }));
    expect(input.avgRevenuePerUser).toBe(1.8);
  });
});

// ─── printHelp ────────────────────────────────────────────────────────────

describe('printHelp', () => {
  it('prints usage information to stdout', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain('RC Copilot');
    expect(output).toContain('USAGE:');
    expect(output).toContain('COMMANDS:');
    consoleSpy.mockRestore();
  });

  it('includes all commands in help output', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain('analyze');
    expect(output).toContain('overview');
    expect(output).toContain('what-if');
    consoleSpy.mockRestore();
  });

  it('includes option flags in help output', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain('--api-key');
    expect(output).toContain('--period');
    expect(output).toContain('--format');
    consoleSpy.mockRestore();
  });
});
