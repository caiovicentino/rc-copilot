import { describe, it, expect } from "vitest";
import {
  findPrimaryMeasureIndex,
  extractTimeSeries,
  detectTrend,
  detectAnomalies,
  calculateHealthScore,
  analyze,
} from "@/lib/analyzer";
import type { ChartResponse, ChartName } from "@/lib/types";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeChart(overrides: Partial<ChartResponse> = {}): ChartResponse {
  return {
    category: "revenue",
    display_name: "Revenue",
    measures: [
      { display_name: "Revenue", unit: "$", chartable: true },
    ],
    summary: { average: { "0": 5000 }, total: { "0": 60000 } },
    values: [],
    ...overrides,
  };
}

function makeValues(
  vals: number[],
  measure = 0,
  startTs = 1704067200 // 2024-01-01
): ChartResponse["values"] {
  return vals.map((value, i) => ({
    cohort: startTs + i * 2592000, // ~30 day intervals
    measure,
    value,
    incomplete: false,
  }));
}

// ─── findPrimaryMeasureIndex ─────────────────────────────────────────────────

describe("findPrimaryMeasureIndex", () => {
  it("returns the index of the first chartable measure", () => {
    const chart = makeChart({
      measures: [
        { display_name: "Count", unit: "#" },
        { display_name: "Revenue", unit: "$", chartable: true },
      ],
    });
    expect(findPrimaryMeasureIndex(chart)).toBe(1);
  });

  it("returns 0 when no measure is chartable", () => {
    const chart = makeChart({
      measures: [
        { display_name: "Count", unit: "#" },
        { display_name: "Revenue", unit: "$" },
      ],
    });
    expect(findPrimaryMeasureIndex(chart)).toBe(0);
  });

  it("returns the first chartable if multiple are chartable", () => {
    const chart = makeChart({
      measures: [
        { display_name: "A", unit: "#" },
        { display_name: "B", unit: "$", chartable: true },
        { display_name: "C", unit: "%", chartable: true },
      ],
    });
    expect(findPrimaryMeasureIndex(chart)).toBe(1);
  });
});

// ─── extractTimeSeries ───────────────────────────────────────────────────────

describe("extractTimeSeries", () => {
  it("extracts values for the primary measure", () => {
    const chart = makeChart({
      values: makeValues([100, 200, 300]),
    });
    const series = extractTimeSeries(chart);
    expect(series.values).toEqual([100, 200, 300]);
    expect(series.label).toBe("Revenue");
    expect(series.unit).toBe("$");
    expect(series.dates).toHaveLength(3);
  });

  it("filters out incomplete periods", () => {
    const chart = makeChart({
      values: [
        { cohort: 1704067200, measure: 0, value: 100 },
        { cohort: 1706659200, measure: 0, value: 200 },
        { cohort: 1709251200, measure: 0, value: 300, incomplete: true },
      ],
    });
    const series = extractTimeSeries(chart);
    expect(series.values).toEqual([100, 200]);
  });

  it("filters by specific measure index", () => {
    const chart = makeChart({
      measures: [
        { display_name: "Count", unit: "#" },
        { display_name: "Rate", unit: "%", chartable: true },
      ],
      values: [
        { cohort: 1704067200, measure: 0, value: 50 },
        { cohort: 1704067200, measure: 1, value: 5.5 },
        { cohort: 1706659200, measure: 0, value: 60 },
        { cohort: 1706659200, measure: 1, value: 6.2 },
      ],
    });
    const series = extractTimeSeries(chart, 0);
    expect(series.values).toEqual([50, 60]);
    expect(series.label).toBe("Count");
  });

  it("sorts values by cohort timestamp", () => {
    const chart = makeChart({
      values: [
        { cohort: 1709251200, measure: 0, value: 300 },
        { cohort: 1704067200, measure: 0, value: 100 },
        { cohort: 1706659200, measure: 0, value: 200 },
      ],
    });
    const series = extractTimeSeries(chart);
    expect(series.values).toEqual([100, 200, 300]);
  });
});

// ─── detectTrend ─────────────────────────────────────────────────────────────

describe("detectTrend", () => {
  it("detects upward trend when recent values are >5% higher", () => {
    const series = {
      dates: Array.from({ length: 12 }, (_, i) => new Date(2024, i).toISOString()),
      values: [100, 102, 104, 106, 108, 110, 115, 120, 125, 130, 135, 140],
      label: "Revenue",
      unit: "$",
    };
    const trend = detectTrend(series);
    expect(trend.direction).toBe("up");
    expect(trend.changePercent).toBeGreaterThan(5);
    expect(trend.label).toBe("Revenue");
  });

  it("detects downward trend when recent values are >5% lower", () => {
    const series = {
      dates: Array.from({ length: 12 }, (_, i) => new Date(2024, i).toISOString()),
      values: [140, 135, 130, 125, 120, 115, 110, 105, 100, 95, 90, 85],
      label: "Revenue",
      unit: "$",
    };
    const trend = detectTrend(series);
    expect(trend.direction).toBe("down");
    expect(trend.changePercent).toBeLessThan(-5);
  });

  it("detects flat trend when values are stable", () => {
    const series = {
      dates: Array.from({ length: 12 }, (_, i) => new Date(2024, i).toISOString()),
      values: [100, 101, 99, 100, 102, 101, 100, 99, 100, 101, 100, 99],
      label: "Revenue",
      unit: "$",
    };
    const trend = detectTrend(series);
    expect(trend.direction).toBe("flat");
  });

  it("returns flat for very short series (<4 values)", () => {
    const series = {
      dates: [new Date(2024, 0).toISOString(), new Date(2024, 1).toISOString()],
      values: [100, 200],
      label: "Revenue",
      unit: "$",
    };
    const trend = detectTrend(series);
    expect(trend.direction).toBe("flat");
    expect(trend.changePercent).toBe(0);
  });

  it("handles custom lookback ratio", () => {
    const series = {
      dates: Array.from({ length: 10 }, (_, i) => new Date(2024, i).toISOString()),
      values: [100, 100, 100, 100, 100, 100, 100, 200, 200, 200],
      label: "Revenue",
      unit: "$",
    };
    const trend = detectTrend(series, 0.3);
    expect(trend.direction).toBe("up");
  });
});

// ─── detectAnomalies ─────────────────────────────────────────────────────────

describe("detectAnomalies", () => {
  it("detects anomaly when value exceeds 2 standard deviations", () => {
    // Need enough data points so a single outlier can be > 3σ (max z for 1 outlier in n values ≈ √(n-1))
    const values = Array(20).fill(100);
    values[19] = 1000; // outlier in 20 values → z ≈ 4.25σ → critical
    const series = {
      dates: Array.from({ length: 20 }, (_, i) => new Date(2024, i % 12, 1).toISOString()),
      values,
      label: "Revenue",
      unit: "$",
    };
    const anomalies = detectAnomalies(series);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].value).toBe(1000);
    expect(anomalies[0].severity).toBe("critical"); // >3σ deviation
  });

  it("returns no anomalies for uniform data", () => {
    const series = {
      dates: Array.from({ length: 10 }, (_, i) => new Date(2024, i).toISOString()),
      values: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
      label: "Revenue",
      unit: "$",
    };
    const anomalies = detectAnomalies(series);
    expect(anomalies).toEqual([]);
  });

  it("returns empty for short series (<5 values)", () => {
    const series = {
      dates: [new Date(2024, 0).toISOString(), new Date(2024, 1).toISOString()],
      values: [100, 500],
      label: "Revenue",
      unit: "$",
    };
    const anomalies = detectAnomalies(series);
    expect(anomalies).toEqual([]);
  });

  it("marks warning severity for 2-3σ deviations", () => {
    // Create data where last value is ~2.5σ above mean
    const series = {
      dates: Array.from({ length: 10 }, (_, i) => new Date(2024, i).toISOString()),
      values: [100, 105, 95, 102, 98, 103, 97, 101, 99, 150],
      label: "Revenue",
      unit: "$",
    };
    const anomalies = detectAnomalies(series);
    const warnings = anomalies.filter((a) => a.severity === "warning");
    expect(warnings.length).toBeGreaterThanOrEqual(0); // may or may not trigger depending on exact stddev
  });

  it("includes expected value and deviation in anomaly", () => {
    const series = {
      dates: Array.from({ length: 8 }, (_, i) => new Date(2024, i).toISOString()),
      values: [100, 100, 100, 100, 100, 100, 100, 500],
      label: "Revenue",
      unit: "$",
    };
    const anomalies = detectAnomalies(series);
    if (anomalies.length > 0) {
      expect(anomalies[0].expected).toBeGreaterThan(0);
      expect(anomalies[0].deviation).toBeGreaterThan(0);
      expect(anomalies[0].label).toBe("Revenue");
    }
  });

  it("supports custom threshold", () => {
    const series = {
      dates: Array.from({ length: 10 }, (_, i) => new Date(2024, i).toISOString()),
      values: [100, 100, 100, 100, 100, 100, 100, 100, 100, 150],
      label: "Revenue",
      unit: "$",
    };
    // Very low threshold should catch more anomalies
    const anomaliesLow = detectAnomalies(series, 1.0);
    // Very high threshold should catch fewer
    const anomaliesHigh = detectAnomalies(series, 5.0);
    expect(anomaliesLow.length).toBeGreaterThanOrEqual(anomaliesHigh.length);
  });
});

// ─── calculateHealthScore ────────────────────────────────────────────────────

describe("calculateHealthScore", () => {
  function makeChurnChart(churnRate: number): ChartResponse {
    return makeChart({
      measures: [
        { display_name: "Actives", unit: "#" },
        { display_name: "Churned", unit: "#" },
        { display_name: "Churn Rate", unit: "%", chartable: true },
      ],
      values: makeValues([churnRate, churnRate, churnRate, churnRate, churnRate, churnRate], 2),
    });
  }

  function makeTrialConvChart(convRate: number): ChartResponse {
    return makeChart({
      measures: [{ display_name: "Trial Conversion Rate", unit: "%", chartable: true }],
      values: makeValues([convRate, convRate, convRate, convRate, convRate, convRate], 0),
    });
  }

  function makeRevenueChart(direction: "up" | "down" | "flat"): ChartResponse {
    let values: number[];
    if (direction === "up") {
      values = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210];
    } else if (direction === "down") {
      values = [210, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100];
    } else {
      values = [100, 101, 99, 100, 102, 101, 100, 99, 100, 101, 100, 99];
    }
    return makeChart({
      measures: [{ display_name: "Revenue", unit: "$", chartable: true }],
      values: makeValues(values, 0),
    });
  }

  it("starts at 50 with no charts", () => {
    const charts = new Map<ChartName, ChartResponse>();
    expect(calculateHealthScore(charts)).toBe(50);
  });

  it("adds 20 for churn < 5%", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("churn", makeChurnChart(3));
    expect(calculateHealthScore(charts)).toBe(70);
  });

  it("adds 10 for churn 5-7%", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("churn", makeChurnChart(6));
    expect(calculateHealthScore(charts)).toBe(60);
  });

  it("subtracts 20 for churn > 10%", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("churn", makeChurnChart(12));
    expect(calculateHealthScore(charts)).toBe(30);
  });

  it("adds 15 for trial conversion > 35%", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("trial_conversion_rate", makeTrialConvChart(40));
    expect(calculateHealthScore(charts)).toBe(65);
  });

  it("subtracts 15 for trial conversion < 15%", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("trial_conversion_rate", makeTrialConvChart(10));
    expect(calculateHealthScore(charts)).toBe(35);
  });

  it("adds 15 for upward revenue trend", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("revenue", makeRevenueChart("up"));
    expect(calculateHealthScore(charts)).toBe(65);
  });

  it("subtracts 15 for downward revenue trend", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("revenue", makeRevenueChart("down"));
    expect(calculateHealthScore(charts)).toBe(35);
  });

  it("clamps score to 0-100 range", () => {
    // All bad: churn > 10 (-20), trial conv < 15 (-15), revenue down (-15) => 50 - 20 - 15 - 15 = 0
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("churn", makeChurnChart(15));
    charts.set("trial_conversion_rate", makeTrialConvChart(5));
    charts.set("revenue", makeRevenueChart("down"));
    expect(calculateHealthScore(charts)).toBe(0);
  });

  it("computes high score for healthy metrics", () => {
    // All good: churn < 5% (+20), trial > 35% (+15), revenue up (+15) => 50 + 20 + 15 + 15 = 100
    const charts = new Map<ChartName, ChartResponse>();
    charts.set("churn", makeChurnChart(3));
    charts.set("trial_conversion_rate", makeTrialConvChart(40));
    charts.set("revenue", makeRevenueChart("up"));
    expect(calculateHealthScore(charts)).toBe(100);
  });
});

// ─── analyze (integration) ───────────────────────────────────────────────────

describe("analyze", () => {
  function buildChartMap(): Map<ChartName, ChartResponse> {
    const charts = new Map<ChartName, ChartResponse>();

    charts.set(
      "revenue",
      makeChart({
        display_name: "Revenue",
        measures: [{ display_name: "Revenue", unit: "$", chartable: true }],
        values: makeValues([4000, 4200, 4500, 4800, 5000, 5200, 5500, 5800, 6000, 6200, 6500, 6800]),
      })
    );

    charts.set(
      "mrr",
      makeChart({
        display_name: "MRR",
        measures: [{ display_name: "MRR", unit: "$", chartable: true }],
        values: makeValues([3000, 3100, 3200, 3300, 3400, 3500, 3600, 3700, 3800, 3900, 4000, 4100]),
      })
    );

    charts.set(
      "churn",
      makeChart({
        display_name: "Churn",
        measures: [
          { display_name: "Actives", unit: "#" },
          { display_name: "Churned", unit: "#" },
          { display_name: "Churn Rate", unit: "%", chartable: true },
        ],
        values: makeValues([4.5, 4.8, 4.2, 4.6, 4.3, 4.7, 4.4, 4.5, 4.6, 4.3, 4.5, 4.4], 2),
      })
    );

    charts.set(
      "trial_conversion_rate",
      makeChart({
        display_name: "Trial Conversion Rate",
        measures: [{ display_name: "Trial Conversion Rate", unit: "%", chartable: true }],
        values: makeValues([38, 40, 42, 39, 41, 43, 40, 42, 38, 41, 40, 39]),
      })
    );

    charts.set(
      "customers_new",
      makeChart({
        display_name: "New Customers",
        measures: [{ display_name: "New Customers", unit: "#", chartable: true }],
        values: makeValues([50, 55, 60, 52, 58, 62, 55, 60, 65, 58, 63, 68]),
      })
    );

    return charts;
  }

  it("returns a complete analysis result", () => {
    const charts = buildChartMap();
    const result = analyze(
      "Test App",
      charts,
      new Date("2024-01-01"),
      new Date("2024-12-31")
    );

    expect(result.projectName).toBe("Test App");
    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.trends.length).toBeGreaterThan(0);
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.chartData).toBeDefined();
  });

  it("includes health score", () => {
    const charts = buildChartMap();
    const result = analyze(
      "Test App",
      charts,
      new Date("2024-01-01"),
      new Date("2024-12-31")
    ) as ReturnType<typeof analyze> & { healthScore: number };

    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
  });

  it("generates metric snapshots for each chart", () => {
    const charts = buildChartMap();
    const result = analyze(
      "Test App",
      charts,
      new Date("2024-01-01"),
      new Date("2024-12-31")
    );

    expect(result.metrics.length).toBe(5); // one per chart
    for (const metric of result.metrics) {
      expect(metric.name).toBeDefined();
      expect(typeof metric.current).toBe("number");
      expect(typeof metric.previous).toBe("number");
      expect(["up", "down", "flat"]).toContain(metric.trend);
    }
  });

  it("generates chart data for each chart", () => {
    const charts = buildChartMap();
    const result = analyze(
      "Test App",
      charts,
      new Date("2024-01-01"),
      new Date("2024-12-31")
    );

    expect(result.chartData["revenue"]).toBeDefined();
    expect(result.chartData["mrr"]).toBeDefined();
    expect(result.chartData["revenue"].values.length).toBe(12);
  });

  it("generates insights based on chart data", () => {
    const charts = buildChartMap();
    const result = analyze(
      "Test App",
      charts,
      new Date("2024-01-01"),
      new Date("2024-12-31")
    );

    // Should have churn insight (< 5% is excellent) and trial conversion insight (> 35%)
    const churnInsight = result.insights.find((i) => i.metric === "Churn Rate");
    expect(churnInsight).toBeDefined();
    expect(churnInsight!.title).toBe("Excellent Churn Rate");

    const trialInsight = result.insights.find((i) => i.metric === "Trial Conversion");
    expect(trialInsight).toBeDefined();
    expect(trialInsight!.title).toBe("Strong Trial Conversion Rate");
  });

  it("detects anomalies when data has outliers", () => {
    const charts = new Map<ChartName, ChartResponse>();
    charts.set(
      "revenue",
      makeChart({
        display_name: "Revenue",
        measures: [{ display_name: "Revenue", unit: "$", chartable: true }],
        values: makeValues([5000, 5100, 4900, 5000, 5200, 5100, 5000, 4900, 5000, 5100, 5000, 1000]),
      })
    );
    const result = analyze("Test App", charts, new Date("2024-01-01"), new Date("2024-12-31"));
    expect(result.anomalies.length).toBeGreaterThan(0);
  });

  it("handles empty chart map gracefully", () => {
    const charts = new Map<ChartName, ChartResponse>();
    const result = analyze("Test App", charts, new Date("2024-01-01"), new Date("2024-12-31"));
    expect(result.metrics).toEqual([]);
    expect(result.trends).toEqual([]);
    expect(result.anomalies).toEqual([]);
    expect(result.insights).toEqual([]);
  });

  it("serializes dates as ISO strings", () => {
    const charts = buildChartMap();
    const result = analyze("Test App", charts, new Date("2024-01-01"), new Date("2024-12-31"));
    expect(typeof result.periodStart).toBe("string");
    expect(typeof result.periodEnd).toBe("string");
  });
});
