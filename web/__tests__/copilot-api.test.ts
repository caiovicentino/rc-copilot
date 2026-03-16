import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock data ──────────────────────────────────────────────────────────────

const mockProjectsResponse = {
  items: [{ id: "proj_abc123", name: "Dark Noise", created_at: 1700000000 }],
  next_page: null,
};

const mockOverviewResponse = {
  metrics: [
    { id: "mrr", name: "MRR", description: "Monthly recurring revenue", value: 4200, unit: "USD", period: "last_28_days" },
    { id: "revenue", name: "Revenue", description: "Total revenue", value: 6800, unit: "USD", period: "last_28_days" },
    { id: "active_subscriptions", name: "Active Subscriptions", description: "Active subs", value: 1200, unit: "count", period: "last_28_days" },
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

// ─── LLM mock streaming response ─────────────────────────────────────────

function makeOpenAIStreamResponse(text: string) {
  const chunks = text.split("").map((char) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content: char } }] })}\n\n`
  );
  chunks.push("data: [DONE]\n\n");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ─── Fetch mock ─────────────────────────────────────────────────────────────

function setupFetchMock(options: { openaiResponse?: Response; openaiError?: boolean } = {}) {
  const mockFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

    // LLM API (OpenRouter)
    if (urlStr.includes("api.openai.com")) {
      if (options.openaiError) {
        return new Response("Internal Server Error", { status: 500 });
      }
      return options.openaiResponse || makeOpenAIStreamResponse("Hello! I can help with your data.");
    }

    // RevenueCat API
    const urlPath = new URL(urlStr).pathname;

    if (urlPath === "/v2/projects") {
      return new Response(JSON.stringify(mockProjectsResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlPath.includes("/metrics/overview")) {
      return new Response(JSON.stringify(mockOverviewResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlPath.includes("/charts/")) {
      return new Response(JSON.stringify(makeChartResponse("Revenue", "$")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  });

  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("API Route: /api/copilot", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns 405 for GET requests", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");

    const { POST } = await import("@/app/api/copilot/route");

    // POST is the only exported handler — a GET request to this route
    // would return 405 from Next.js automatically since there's no GET export.
    expect(POST).toBeDefined();
    expect(await import("@/app/api/copilot/route").then((m) => m.GET)).toBeUndefined();
  });

  it("returns 400 for empty messages", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    setupFetchMock();

    const { POST } = await import("@/app/api/copilot/route");

    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("messages");
  });

  it("returns 400 for missing messages field", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    setupFetchMock();

    const { POST } = await import("@/app/api/copilot/route");

    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns streaming response for valid request", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    setupFetchMock();

    const { POST } = await import("@/app/api/copilot/route");

    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is my MRR?" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");

    // Read the streamed response
    const text = await response.text();
    expect(text).toBe("Hello! I can help with your data.");
  });

  it("system prompt includes real data context", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");

    const fetchMock = setupFetchMock();

    const { POST } = await import("@/app/api/copilot/route");

    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Tell me about my data" }],
      }),
    });

    await POST(request);

    // Find the OpenAI call
    const openaiCall = fetchMock.mock.calls.find(
      (call: unknown[]) => {
        const url = typeof call[0] === "string" ? call[0] : "";
        return url.includes("api.openai.com");
      }
    );

    expect(openaiCall).toBeDefined();

    const body = JSON.parse((openaiCall![1] as RequestInit).body as string);
    const systemMessage = body.messages[0];

    expect(systemMessage.role).toBe("system");
    expect(systemMessage.content).toContain("RC Copilot");
    expect(systemMessage.content).toContain("Dark Noise");
    expect(systemMessage.content).toContain("MRR");
    expect(systemMessage.content).toContain("Industry Benchmarks");
  });

  it("handles OpenAI API errors gracefully", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");
    setupFetchMock({ openaiError: true });

    const { POST } = await import("@/app/api/copilot/route");

    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(502);

    const data = await response.json();
    expect(data.error).toContain("OpenAI");
  });

  it("returns 500 when OpenAI API key is missing", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "");
    setupFetchMock();

    const { POST } = await import("@/app/api/copilot/route");

    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain("OpenAI");
  });

  it("sends full message history to OpenAI for multi-turn conversation", async () => {
    vi.stubEnv("REVENUECAT_API_KEY", "sk_test_key");
    vi.stubEnv("OPENAI_API_KEY", "sk-test-openai");

    const fetchMock = setupFetchMock();

    const { POST } = await import("@/app/api/copilot/route");

    const request = new Request("http://localhost/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "What is my MRR?" },
          { role: "assistant", content: "Your MRR is $4,200." },
          { role: "user", content: "How does that compare to last month?" },
        ],
      }),
    });

    await POST(request);

    const openaiCall = fetchMock.mock.calls.find(
      (call: unknown[]) => {
        const url = typeof call[0] === "string" ? call[0] : "";
        return url.includes("api.openai.com");
      }
    );

    const body = JSON.parse((openaiCall![1] as RequestInit).body as string);

    // System + 3 user/assistant messages = 4 total
    expect(body.messages.length).toBe(4);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toBe("What is my MRR?");
    expect(body.messages[2].content).toBe("Your MRR is $4,200.");
    expect(body.messages[3].content).toBe("How does that compare to last month?");
  });
});
