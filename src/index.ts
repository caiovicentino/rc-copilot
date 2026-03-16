export { RevenueCatAPI } from './api.js';
export { analyze, extractTimeSeries, detectTrend, detectAnomalies, findPrimaryMeasureIndex } from './analyzer.js';
export { generateReport, generateMarkdownReport, generateJSONReport } from './report.js';
export {
  runAllScenarios,
  simulateChurnReduction,
  simulateTrialImprovement,
  simulateCustomerGrowth,
} from './simulator.js';

export type {
  ChartName,
  ChartResponse,
  ChartMeasure,
  ChartValue,
  ChartSummary,
  OverviewResponse,
  OverviewMetric,
  Project,
  ProjectsResponse,
  AnalysisResult,
  Anomaly,
  Insight,
  MetricSnapshot,
  TimeSeries,
  TrendResult,
  TrendDirection,
  Severity,
  SimulatorInput,
  WhatIfScenario,
  Report,
  ReportJSON,
  CLIOptions,
  OutputFormat,
  Period,
} from './types.js';

export { CHART_NAMES, CORE_CHARTS } from './types.js';
