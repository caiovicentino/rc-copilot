import type {
  ChartName,
  ChartResponse,
  OverviewResponse,
  Project,
  ProjectsResponse,
} from './types.js';

const BASE_URL = 'https://api.revenuecat.com/v2';

export interface RevenueCatAPIOptions {
  minRequestInterval?: number;
  retryDelayMs?: number;
}

export class RevenueCatAPI {
  private apiKey: string;
  private projectId: string | null = null;
  private projectName: string | null = null;
  private requestCount = 0;
  private lastRequestTime = 0;
  private minRequestInterval: number;
  private retryDelayMs: number;

  constructor(apiKey: string, options: RevenueCatAPIOptions = {}) {
    this.apiKey = apiKey;
    this.minRequestInterval = options.minRequestInterval ?? 500;
    this.retryDelayMs = options.retryDelayMs ?? 2000;
  }

  // ─── Rate Limiting ──────────────────────────────────────────────────────

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    // Keep under 120 requests/min — wait at least minRequestInterval ms between requests
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  // ─── HTTP Client ────────────────────────────────────────────────────────

  private async request<T>(path: string, retries = 3): Promise<T> {
    await this.throttle();

    const url = `${BASE_URL}${path}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
        console.error(`  ⏳ Rate limited. Retrying in ${retryAfter}s... (attempt ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (response.status >= 500 && attempt < retries) {
        console.error(`  ⚠️  Server error ${response.status}. Retrying... (attempt ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
        continue;
      }

      const errorBody = await response.text();
      throw new Error(
        `RevenueCat API error: ${response.status} ${response.statusText}\n${errorBody}`
      );
    }

    throw new Error(`Failed after ${retries} retries`);
  }

  // ─── Project Discovery ─────────────────────────────────────────────────

  async discoverProject(): Promise<{ id: string; name: string }> {
    if (this.projectId && this.projectName) {
      return { id: this.projectId, name: this.projectName };
    }

    const data = await this.request<ProjectsResponse>('/projects');

    if (!data.items || data.items.length === 0) {
      throw new Error('No projects found for this API key');
    }

    const project = data.items[0];
    this.projectId = project.id;
    this.projectName = project.name;

    return { id: project.id, name: project.name };
  }

  // ─── Chart Data ─────────────────────────────────────────────────────────

  async fetchChart(
    chartName: ChartName,
    options: {
      startDate: string;
      endDate: string;
      resolution?: 'day' | 'week' | 'month';
    }
  ): Promise<ChartResponse> {
    const { id } = await this.discoverProject();
    const resolution = options.resolution || 'day';

    const path =
      `/projects/${id}/charts/${chartName}` +
      `?resolution=${resolution}` +
      `&start_date=${options.startDate}` +
      `&end_date=${options.endDate}`;

    return this.request<ChartResponse>(path);
  }

  async fetchCharts(
    chartNames: ChartName[],
    options: { startDate: string; endDate: string; resolution?: 'day' | 'week' | 'month' }
  ): Promise<Map<ChartName, ChartResponse>> {
    const results = new Map<ChartName, ChartResponse>();

    for (const name of chartNames) {
      try {
        const chart = await this.fetchChart(name, options);
        results.set(name, chart);
      } catch (err) {
        console.error(`  ⚠️  Failed to fetch chart "${name}": ${(err as Error).message}`);
      }
    }

    return results;
  }

  // ─── Overview ───────────────────────────────────────────────────────────

  async fetchOverview(): Promise<OverviewResponse> {
    const { id } = await this.discoverProject();
    return this.request<OverviewResponse>(`/projects/${id}/metrics/overview`);
  }

  // ─── Accessors ──────────────────────────────────────────────────────────

  getProjectName(): string | null {
    return this.projectName;
  }

  getRequestCount(): number {
    return this.requestCount;
  }
}
