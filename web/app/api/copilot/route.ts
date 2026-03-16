import { discoverProject, fetchCharts, fetchOverview } from "@/lib/revenuecat";
import { analyze } from "@/lib/analyzer";
import type { ChartName, AnalysisResult, OverviewMetric } from "@/lib/types";

const CORE_CHARTS: ChartName[] = [
  "revenue", "mrr", "churn", "actives", "trials",
  "trial_conversion_rate", "conversion_to_paying",
  "customers_new", "refund_rate", "arr",
];

// ─── Data cache (5 minute TTL) ──────────────────────────────────────────────

let cachedContext: { text: string; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getDataContext(): Promise<string> {
  if (cachedContext && Date.now() - cachedContext.ts < CACHE_TTL) {
    return cachedContext.text;
  }

  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    return "No RevenueCat API key configured. You can still answer general subscription analytics questions.";
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 15);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    const [project, charts, overview] = await Promise.all([
      discoverProject(apiKey),
      fetchCharts(apiKey, CORE_CHARTS, {
        startDate: startStr,
        endDate: endStr,
        resolution: "month",
      }),
      fetchOverview(apiKey),
    ]);

    const result = analyze(project.name, charts, startDate, endDate);
    const text = buildContextText(result, overview.metrics);

    cachedContext = { text, ts: Date.now() };
    return text;
  } catch (err) {
    console.error("Failed to fetch RevenueCat data for copilot:", err);
    return "Failed to load RevenueCat data. You can still answer general subscription analytics questions, but note that live data is unavailable right now.";
  }
}

function buildContextText(result: AnalysisResult, overview: OverviewMetric[]): string {
  const lines: string[] = [];

  lines.push(`# Project: ${result.projectName}`);
  lines.push(`Analysis period: ${result.periodStart} to ${result.periodEnd}\n`);

  // Overview metrics
  lines.push("## Current Overview Metrics");
  for (const m of overview) {
    lines.push(`- ${m.name}: ${m.value} ${m.unit} (${m.period})`);
  }

  // Metric snapshots with trends
  lines.push("\n## Metric Snapshots (Current vs Previous Period)");
  for (const m of result.metrics) {
    lines.push(`- ${m.name}: ${m.current} ${m.unit} (was ${m.previous}, ${m.changePercent > 0 ? "+" : ""}${m.changePercent.toFixed(1)}%, trend: ${m.trend})${m.industryAvg ? ` [Industry avg: ${m.industryAvg}]` : ""}`);
  }

  // Trends
  lines.push("\n## Trends");
  for (const t of result.trends) {
    lines.push(`- ${t.label}: ${t.direction} (${t.changePercent > 0 ? "+" : ""}${t.changePercent.toFixed(1)}%)`);
  }

  // Anomalies
  if (result.anomalies.length > 0) {
    lines.push("\n## Anomalies Detected");
    for (const a of result.anomalies) {
      lines.push(`- [${a.severity.toUpperCase()}] ${a.label} on ${a.date}: value=${a.value.toFixed(2)}, expected=${a.expected.toFixed(2)}, deviation=${a.deviation.toFixed(1)}σ`);
    }
  }

  // Insights
  if (result.insights.length > 0) {
    lines.push("\n## Insights & Recommendations");
    for (const i of result.insights) {
      lines.push(`- [${i.severity}] ${i.title}: ${i.description}${i.recommendation ? ` → Recommendation: ${i.recommendation}` : ""}`);
    }
  }

  // Chart data summaries (last 6 data points)
  lines.push("\n## Chart Data (Last 6 Months)");
  for (const [key, data] of Object.entries(result.chartData)) {
    const recentDates = data.dates.slice(-6);
    const recentValues = data.values.slice(-6);
    const pairs = recentDates.map((d, i) => `${d}: ${recentValues[i].toFixed(2)}`);
    lines.push(`- ${data.label} (${data.unit}): ${pairs.join(", ")}`);
  }

  // Industry benchmarks
  lines.push("\n## Industry Benchmarks");
  lines.push("- Healthy churn rate: <5% monthly");
  lines.push("- Good trial conversion: >35%");
  lines.push("- Strong paywall conversion: >5%");
  lines.push("- Typical refund rate: <3%");
  lines.push("- MRR growth target: >10% month-over-month for early stage");

  return lines.join("\n");
}

// ─── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(dataContext: string): string {
  return `You are RC Copilot, an expert subscription analytics assistant for RevenueCat-powered apps. You have deep knowledge of subscription business metrics, mobile app monetization, and growth strategies.

You have access to the user's REAL RevenueCat data below. Always ground your answers in this data when relevant. Be specific with numbers, dates, and trends. If the data doesn't cover what the user asks, say so honestly.

When presenting data:
- Use specific numbers from the data
- Reference dates and time periods
- Compare to industry benchmarks when relevant
- Provide actionable recommendations
- Be concise but thorough
- Use markdown formatting for readability (headers, bullet points, bold for emphasis)

${dataContext}`;
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { messages?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array is required and must not be empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use OpenAI GPT-4o for high-quality analysis
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dataContext = await getDataContext();
  const systemPrompt = buildSystemPrompt(dataContext);

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let openaiResponse: Response;
  try {
    openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: openaiMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });
  } catch (err) {
    console.error("OpenAI API request failed:", err);
    return new Response(JSON.stringify({ error: "Failed to reach OpenAI API" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text().catch(() => "Unknown error");
    console.error("OpenAI API error:", openaiResponse.status, errorText);
    return new Response(JSON.stringify({ error: "OpenAI API error", details: errorText }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream the response back
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = openaiResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (err) {
        console.error("Stream processing error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
