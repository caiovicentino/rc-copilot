import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RevenueCatAPI } from '../src/api.js';

// ─── Mock Data ─────────────────────────────────────────────────────────────

const mockProjectsResponse = {
  items: [{ id: 'proj_abc', name: 'Dark Noise', created_at: 1700000000 }],
  next_page: null,
};

const mockChartResponse = {
  category: 'revenue',
  display_name: 'Revenue',
  measures: [{ display_name: 'Revenue', unit: '$', chartable: true }],
  summary: { average: {}, total: {} },
  values: [
    { cohort: 1700000000, measure: 0, value: 4557, incomplete: false },
  ],
};

const mockOverviewResponse = {
  metrics: [
    { id: 'mrr', name: 'MRR', description: 'Monthly Recurring Revenue', value: 4557, unit: '$', period: 'last_30_days' },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeApi(options = {}) {
  // minRequestInterval=0 and retryDelayMs=0 speeds tests up
  return new RevenueCatAPI('test-key', { minRequestInterval: 0, retryDelayMs: 0, ...options });
}

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
  });
}

function mockFetchStatus(status: number, body = 'Error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: String(status),
    json: async () => ({}),
    text: async () => body,
    headers: { get: () => null },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('RevenueCatAPI', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchOk(mockProjectsResponse));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── constructor / accessors ─────────────────────────────────────────────

  it('constructor defaults to 500ms interval when no options provided', () => {
    const api = new RevenueCatAPI('test-key');
    expect((api as any).minRequestInterval).toBe(500);
    expect((api as any).retryDelayMs).toBe(2000);
  });

  it('getProjectName returns null before discovery', () => {
    const api = makeApi();
    expect(api.getProjectName()).toBeNull();
  });

  it('getRequestCount starts at 0', () => {
    const api = makeApi();
    expect(api.getRequestCount()).toBe(0);
  });

  // ── discoverProject ─────────────────────────────────────────────────────

  it('discoverProject returns project id and name', async () => {
    const api = makeApi();
    const project = await api.discoverProject();
    expect(project.id).toBe('proj_abc');
    expect(project.name).toBe('Dark Noise');
  });

  it('discoverProject caches result on second call', async () => {
    const fetchMock = mockFetchOk(mockProjectsResponse);
    vi.stubGlobal('fetch', fetchMock);
    const api = makeApi();

    await api.discoverProject();
    await api.discoverProject(); // second call — should not hit fetch again

    // Only 1 fetch call total (first call)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(api.getProjectName()).toBe('Dark Noise');
  });

  it('discoverProject throws when no projects returned', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ items: [], next_page: null }));
    const api = makeApi();
    await expect(api.discoverProject()).rejects.toThrow('No projects found');
  });

  // ── fetchChart ───────────────────────────────────────────────────────────

  it('fetchChart fetches with correct URL and returns ChartResponse', async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      if (url.includes('/projects')) {
        // First call = discoverProject, second = chart
        if (url.endsWith('/projects')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockProjectsResponse,
            text: async () => '',
            headers: { get: () => null },
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockChartResponse,
          text: async () => '',
          headers: { get: () => null },
        });
      }
    }));

    const api = makeApi();
    const chart = await api.fetchChart('revenue', { startDate: '2024-01-01', endDate: '2024-03-31' });
    expect(chart.display_name).toBe('Revenue');
    expect(chart.values).toHaveLength(1);
  });

  it('fetchChart uses default resolution=day', async () => {
    const capturedUrls: string[] = [];
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockChartResponse, text: async () => '', headers: { get: () => null } });
    }));

    const api = makeApi();
    await api.fetchChart('revenue', { startDate: '2024-01-01', endDate: '2024-01-31' });
    const chartUrl = capturedUrls[1];
    expect(chartUrl).toContain('resolution=day');
  });

  it('fetchChart passes custom resolution', async () => {
    const capturedUrls: string[] = [];
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockChartResponse, text: async () => '', headers: { get: () => null } });
    }));

    const api = makeApi();
    await api.fetchChart('revenue', { startDate: '2024-01-01', endDate: '2024-12-31', resolution: 'month' });
    const chartUrl = capturedUrls[1];
    expect(chartUrl).toContain('resolution=month');
  });

  // ── fetchCharts ──────────────────────────────────────────────────────────

  it('fetchCharts returns map of results for multiple charts', async () => {
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockChartResponse, text: async () => '', headers: { get: () => null } });
    }));

    const api = makeApi();
    const charts = await api.fetchCharts(['revenue', 'mrr'], { startDate: '2024-01-01', endDate: '2024-03-31' });
    expect(charts.size).toBe(2);
    expect(charts.has('revenue')).toBe(true);
    expect(charts.has('mrr')).toBe(true);
  });

  it('fetchCharts skips failed charts and logs error', async () => {
    let callIndex = 0;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // discoverProject
        return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
      }
      if (callIndex === 2) {
        // first chart — success
        return Promise.resolve({ ok: true, status: 200, json: async () => mockChartResponse, text: async () => '', headers: { get: () => null } });
      }
      // second chart — failure
      return Promise.resolve({ ok: false, status: 500, statusText: 'Server Error', json: async () => ({}), text: async () => 'Server Error', headers: { get: () => null } });
    }));

    const api = makeApi();
    const charts = await api.fetchCharts(['revenue', 'churn'], { startDate: '2024-01-01', endDate: '2024-03-31' });
    expect(charts.size).toBe(1);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  // ── fetchOverview ────────────────────────────────────────────────────────

  it('fetchOverview returns overview response', async () => {
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockOverviewResponse, text: async () => '', headers: { get: () => null } });
    }));

    const api = makeApi();
    const overview = await api.fetchOverview();
    expect(overview.metrics).toHaveLength(1);
    expect(overview.metrics[0].name).toBe('MRR');
  });

  // ── HTTP error handling ───────────────────────────────────────────────────

  it('throws on 401 Unauthorized without retry', async () => {
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
      }
      return Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}), text: async () => 'Unauthorized', headers: { get: () => null } });
    }));

    const api = makeApi();
    await expect(api.fetchChart('revenue', { startDate: '2024-01-01', endDate: '2024-03-31' })).rejects.toThrow('401');
  });

  it('throws on 500 after exhausting retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
      text: async () => 'Server Error',
      headers: { get: () => null },
    }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeApi();
    await expect(api.discoverProject()).rejects.toThrow('500');
    consoleSpy.mockRestore();
  });

  it('retries on 500 and succeeds on second attempt', async () => {
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Server Error', json: async () => ({}), text: async () => 'Server Error', headers: { get: () => null } });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
    }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeApi();
    const result = await api.discoverProject();
    expect(result.name).toBe('Dark Noise');
    consoleSpy.mockRestore();
  });

  it('handles 429 rate limiting with retry-after header (value provided)', async () => {
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({}),
          text: async () => 'Rate limited',
          headers: { get: (h: string) => h === 'retry-after' ? '0' : null },
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
    }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeApi();
    const result = await api.discoverProject();
    expect(result.name).toBe('Dark Noise');
    consoleSpy.mockRestore();
  });

  it('handles 429 rate limiting with no retry-after header (null → uses 0)', async () => {
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({}),
          text: async () => 'Rate limited',
          headers: { get: () => null }, // no retry-after header → fallback to '0'
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
    }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeApi();
    const result = await api.discoverProject();
    expect(result.name).toBe('Dark Noise');
    consoleSpy.mockRestore();
  });

  it('throws when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')));
    const api = makeApi();
    await expect(api.discoverProject()).rejects.toThrow('Network timeout');
  });

  it('increments requestCount on each call', async () => {
    let callIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockProjectsResponse, text: async () => '', headers: { get: () => null } });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => mockOverviewResponse, text: async () => '', headers: { get: () => null } });
    }));

    const api = makeApi();
    await api.discoverProject();
    expect(api.getRequestCount()).toBe(1);
    await api.fetchOverview();
    expect(api.getRequestCount()).toBe(2);
  });

  it('throttles requests when called rapidly (elapsed < minRequestInterval)', async () => {
    const fetchMock = mockFetchOk(mockProjectsResponse);
    vi.stubGlobal('fetch', fetchMock);
    // Use a small non-zero interval to trigger the sleep path
    const api = new RevenueCatAPI('test-key', { minRequestInterval: 10, retryDelayMs: 0 });
    // Make two rapid calls — second will trigger throttle
    await api.discoverProject();
    // Force lastRequestTime to now so second call sleeps
    (api as any).lastRequestTime = Date.now();
    (api as any).projectId = null;
    (api as any).projectName = null;
    vi.stubGlobal('fetch', mockFetchOk(mockProjectsResponse));
    const start = Date.now();
    await api.discoverProject();
    const elapsed = Date.now() - start;
    // Should have waited ~10ms
    expect(elapsed).toBeGreaterThanOrEqual(5);
  });

  it('handles invalid JSON gracefully (json() throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => { throw new SyntaxError('Unexpected token'); },
      text: async () => 'not json',
      headers: { get: () => null },
    }));

    const api = makeApi();
    await expect(api.discoverProject()).rejects.toThrow('Unexpected token');
  });
});
