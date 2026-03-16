import type {
  ChartName,
  ChartResponse,
  OverviewResponse,
  ProjectsResponse,
} from "./types";

const BASE_URL = "https://api.revenuecat.com/v2";

let projectId: string | null = null;
let projectName: string | null = null;

async function request<T>(apiKey: string, path: string, retries = 3): Promise<T> {
  const url = `${BASE_URL}${path}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("retry-after") || "2", 10);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    if (response.status >= 500 && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      continue;
    }

    const errorBody = await response.text();
    throw new Error(`RevenueCat API error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  throw new Error(`Failed after ${retries} retries`);
}

export async function discoverProject(apiKey: string): Promise<{ id: string; name: string }> {
  if (projectId && projectName) {
    return { id: projectId, name: projectName };
  }

  const data = await request<ProjectsResponse>(apiKey, "/projects");

  if (!data.items || data.items.length === 0) {
    throw new Error("No projects found for this API key");
  }

  const project = data.items[0];
  projectId = project.id;
  projectName = project.name;

  return { id: project.id, name: project.name };
}

export async function fetchOverview(apiKey: string): Promise<OverviewResponse> {
  const { id } = await discoverProject(apiKey);
  return request<OverviewResponse>(apiKey, `/projects/${id}/metrics/overview`);
}

export async function fetchChart(
  apiKey: string,
  chartName: ChartName,
  options: { startDate: string; endDate: string; resolution?: "day" | "week" | "month" }
): Promise<ChartResponse> {
  const { id } = await discoverProject(apiKey);
  const resolution = options.resolution || "month";
  const path =
    `/projects/${id}/charts/${chartName}` +
    `?resolution=${resolution}` +
    `&start_date=${options.startDate}` +
    `&end_date=${options.endDate}`;
  return request<ChartResponse>(apiKey, path);
}

export async function fetchCharts(
  apiKey: string,
  chartNames: ChartName[],
  options: { startDate: string; endDate: string; resolution?: "day" | "week" | "month" }
): Promise<Map<ChartName, ChartResponse>> {
  const results = new Map<ChartName, ChartResponse>();

  for (const name of chartNames) {
    try {
      const chart = await fetchChart(apiKey, name, options);
      results.set(name, chart);
    } catch (err) {
      console.error(`Failed to fetch chart "${name}": ${(err as Error).message}`);
    }
  }

  return results;
}
