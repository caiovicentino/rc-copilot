// ─── RevenueCat API Types ────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  created_at: number;
}

export interface ProjectsResponse {
  items: Project[];
  next_page: string | null;
}

export interface ChartMeasure {
  display_name: string;
  unit: string;
  chartable?: boolean;
  tabulable?: boolean;
  decimal_precision?: number;
  description?: string;
}

export interface ChartValue {
  cohort: number;
  measure: number;
  value: number;
  incomplete?: boolean;
}

export interface ChartSummary {
  average: Record<string, number>;
  total: Record<string, number>;
}

export interface ChartResponse {
  category: string;
  display_name: string;
  measures: ChartMeasure[];
  summary: ChartSummary;
  values: ChartValue[];
}

export interface OverviewMetric {
  id: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  period: string;
}

export interface OverviewResponse {
  metrics: OverviewMetric[];
}

// ─── Chart Names ─────────────────────────────────────────────────────────────

export const CHART_NAMES = [
  'actives',
  'actives_movement',
  'actives_new',
  'arr',
  'churn',
  'cohort_explorer',
  'conversion_to_paying',
  'customers_new',
  'ltv_per_customer',
  'ltv_per_paying_customer',
  'mrr',
  'mrr_movement',
  'refund_rate',
  'revenue',
  'subscription_retention',
  'subscription_status',
  'trials',
  'trials_movement',
  'trials_new',
  'customers_active',
  'trial_conversion_rate',
] as const;

export type ChartName = (typeof CHART_NAMES)[number];

/** Charts most critical for subscription health analysis */
export const CORE_CHARTS: ChartName[] = [
  'revenue',
  'mrr',
  'churn',
  'actives',
  'trials',
  'trial_conversion_rate',
  'conversion_to_paying',
  'customers_new',
  'refund_rate',
  'arr',
];

// ─── Analysis Types ──────────────────────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'flat';
export type Severity = 'info' | 'warning' | 'critical';

export interface TimeSeries {
  dates: Date[];
  values: number[];
  label: string;
  unit: string;
}

export interface TrendResult {
  direction: TrendDirection;
  changePercent: number;
  periodStart: number;
  periodEnd: number;
  label: string;
}

export interface Anomaly {
  date: Date;
  value: number;
  expected: number;
  deviation: number;
  label: string;
  severity: Severity;
}

export interface Insight {
  title: string;
  description: string;
  severity: Severity;
  metric?: string;
  value?: number;
  recommendation?: string;
}

export interface MetricSnapshot {
  name: string;
  current: number;
  previous: number;
  changePercent: number;
  trend: TrendDirection;
  unit: string;
  industryAvg?: string;
}

export interface AnalysisResult {
  projectName: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: MetricSnapshot[];
  trends: TrendResult[];
  anomalies: Anomaly[];
  insights: Insight[];
  charts: Map<ChartName, ChartResponse>;
}

// ─── Simulator Types ─────────────────────────────────────────────────────────

export interface WhatIfScenario {
  name: string;
  description: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  projectedImpact: string;
  mrrImpact12Months: number;
  revenueImpact12Months: number;
}

export interface SimulatorInput {
  currentMRR: number;
  currentChurnRate: number;
  currentTrialConversion: number;
  activeSubscriptions: number;
  monthlyNewCustomers: number;
  avgRevenuePerUser: number;
}

// ─── CLI Types ───────────────────────────────────────────────────────────────

export type OutputFormat = 'markdown' | 'json';
export type Period = '7d' | '14d' | '28d' | '30d' | '60d' | '90d' | '180d' | '365d';

export interface CLIOptions {
  apiKey: string;
  period: Period;
  format: OutputFormat;
  output?: string;
  slackWebhook?: string;
  verbose?: boolean;
}

// ─── Report Types ────────────────────────────────────────────────────────────

export interface Report {
  markdown: string;
  json: ReportJSON;
}

export interface ReportJSON {
  generatedAt: string;
  project: string;
  period: { start: string; end: string };
  summary: string[];
  metrics: MetricSnapshot[];
  anomalies: Anomaly[];
  insights: Insight[];
  scenarios: WhatIfScenario[];
}
