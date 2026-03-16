import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock RevenueCat API responses ───────────────────────────────────────────

const mockProjectsResponse = {
  items: [{ id: "proj_abc123", name: "Dark Noise", created_at: 1700000000 }],
  next_page: null,
};

const mockOverviewResponse = {
  metrics: [
    { id: "mrr", name: "MRR", description: "Monthly recurring revenue", value: 4200, unit: "USD", period: "last_28_days" },
    { id: "revenue", name: "Revenue", description: "Total revenue", value: 6800, unit: "USD", period: "last_28_days" },
    { id: "active_subscriptions", name: "Active Subscriptions", description: "Active subs", value: 1200, unit: "count", period: "last_28_days" },
    { id: "active_trials", name: "Active Trials", description: "Active trials", value: 150, unit: "count", period: "last_28_days" },
    { id: "new_customers", name: "New Customers", description: "New customers", value: 65, unit: "count", period: "last_28_days" },
    { id: "active_users", name: "Active Users", description: "Active users", value: 3500, unit: "count", period: "last_28_days" },
  ],
};

function makeChartResponse(name: string, unit: string) {
  return {
    category: name,
    display_name: name,
    measures: [{ display_name: name, unit, chartable: true }],
    summary: { average: { "0": 5000 }, total: { "0": 60000 } },
    values: Array.from({ length: 12 }, (_, i) => ({
      cohort: 1704067200 + i * 2592000,
      measure: 0,
      value: 4000 + i * 250,
      incomplete: false,
    })),
  };
}

// ─── Fetch mock — matches URL path patterns precisely ───────────────────────

function setupFetchMock(responses: Record<string, unknown>) {
  const mockFn = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    const urlPath = new URL(urlStr).pathname;

    // Try exact path endings first (most specific), then substring match
    // Sort entries by pattern length descending so more specific patterns win
    const sortedEntries = Object.entries(responses).sort(
      ([a], [b]) => b.length - a.length
    );

    for (const [pattern, body] of sortedEntries) {
      // Match if the URL path ends with the pattern or contains it as a distinct segment
      if (urlPath.endsWith(pattern) || urlPath.includes(pattern + "/") || urlPath.includes(pattern + "?") || urlStr.includes(pattern)) {
        // But for "/v2/projects", only match if it's the exact endpoint (no more path after)
        if (pattern === "/v2/projects" && urlPath !== "/v2/projects") {
          continue;
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  });

  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

// ─── RevenueCat API Client Tests ────────────────────────────────────────────

describe("RevenueCat API Client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("discoverProject returns project id and name", async () => {
    setupFetchMock({ "/v2/projects": mockProjectsResponse });

    const { discoverProject } = await import("@/lib/revenuecat");
    const project = await discoverProject("sk_test_key");

    expect(project.id).toBe("proj_abc123");
    expect(project.name).toBe("Dark Noise");
  });

  it("fetchOverview returns metrics", async () => {
    setupFetchMock({
      "/v2/projects": mockProjectsResponse,
      "/metrics/overview": mockOverviewResponse,
    });

    const { fetchOverview } = await import("@/lib/revenuecat");
    const overview = await fetchOverview("sk_test_key");

    expect(overview.metrics).toBeDefined();
    expect(overview.metrics.length).toBe(6);
  });

  it("fetchChart returns chart response", async () => {
    setupFetchMock({
      "/v2/projects": mockProjectsResponse,
      "/charts/revenue": makeChartResponse("Revenue", "$"),
    });

    const { fetchChart } = await import("@/lib/revenuecat");
    const chart = await fetchChart("sk_test_key", "revenue", {
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      resolution: "month",
    });

    expect(chart.display_name).toBe("Revenue");
    expect(chart.values.length).toBe(12);
  });

  it("fetchCharts returns a Map of chart responses", async () => {
    setupFetchMock({
      "/v2/projects": mockProjectsResponse,
      "/charts/": makeChartResponse("Revenue", "$"),
    });

    const { fetchCharts } = await import("@/lib/revenuecat");
    const charts = await fetchCharts("sk_test_key", ["revenue", "mrr"], {
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    expect(charts.size).toBe(2);
    expect(charts.has("revenue")).toBe(true);
    expect(charts.has("mrr")).toBe(true);
  });

  it("throws on API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid API key", { status: 401, statusText: "Unauthorized" }))
    );

    const { discoverProject } = await import("@/lib/revenuecat");
    await expect(discoverProject("bad_key")).rejects.toThrow("RevenueCat API error");
  });

  it("throws when no projects found", async () => {
    setupFetchMock({ "/v2/projects": { items: [], next_page: null } });

    const { discoverProject } = await import("@/lib/revenuecat");
    await expect(discoverProject("sk_test_key")).rejects.toThrow("No projects found");
  });
});

// ─── API Route: /api/overview ────────────────────────────────────────────────

describe("API Route: /api/overview", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns overview data when API key is configured", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    setupFetchMock({
      "/v2/projects": mockProjectsResponse,
      "/metrics/overview": mockOverviewResponse,
    });

    const { GET } = await import("@/app/api/overview/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metrics).toBeDefined();
    expect(data.metrics.length).toBe(6);
  });

  it("returns 500 when API key is not set", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "");

    const { GET } = await import("@/app/api/overview/route");
    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

// ─── API Route: /api/charts ──────────────────────────────────────────────────

describe("API Route: /api/charts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    setupFetchMock({
      "/v2/projects": mockProjectsResponse,
      "/charts/revenue": makeChartResponse("Revenue", "$"),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns chart data for valid request", async () => {
    const { GET } = await import("@/app/api/charts/route");

    const url = new URL("http://localhost/api/charts?type=revenue&start_date=2024-01-01&end_date=2024-12-31");
    const request = new Request(url);
    const nextRequest = Object.assign(request, { nextUrl: url });

    const response = await GET(nextRequest as Parameters<typeof GET>[0]);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.display_name).toBe("Revenue");
    expect(data.values.length).toBe(12);
  });

  it("returns 400 for invalid chart type", async () => {
    const { GET } = await import("@/app/api/charts/route");

    const url = new URL("http://localhost/api/charts?type=invalid&start_date=2024-01-01&end_date=2024-12-31");
    const request = new Request(url);
    const nextRequest = Object.assign(request, { nextUrl: url });

    const response = await GET(nextRequest as Parameters<typeof GET>[0]);
    expect(response.status).toBe(400);
  });

  it("returns 400 when missing dates", async () => {
    const { GET } = await import("@/app/api/charts/route");

    const url = new URL("http://localhost/api/charts?type=revenue");
    const request = new Request(url);
    const nextRequest = Object.assign(request, { nextUrl: url });

    const response = await GET(nextRequest as Parameters<typeof GET>[0]);
    expect(response.status).toBe(400);
  });
});

// ─── API Route: /api/analysis ────────────────────────────────────────────────

describe("API Route: /api/analysis", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns analysis data", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    setupFetchMock({
      "/v2/projects": mockProjectsResponse,
      "/metrics/overview": mockOverviewResponse,
      "/charts/": makeChartResponse("Revenue", "$"),
    });

    const { GET } = await import("@/app/api/analysis/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.projectName).toBeDefined();
    expect(data.metrics).toBeDefined();
    expect(data.trends).toBeDefined();
    expect(data.insights).toBeDefined();
  });

  it("returns 500 when API key is missing", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "");

    const { GET } = await import("@/app/api/analysis/route");
    const response = await GET();

    expect(response.status).toBe(500);
  });
});
