import { NextResponse } from "next/server";
import { discoverProject, fetchCharts, fetchOverview } from "@/lib/revenuecat";
import { analyze } from "@/lib/analyzer";
import type { ChartName } from "@/lib/types";

export const revalidate = 600; // 10 minutes

const CORE_CHARTS: ChartName[] = [
  "revenue", "mrr", "churn", "actives", "trials",
  "trial_conversion_rate", "conversion_to_paying",
  "customers_new", "refund_rate", "arr",
];

export async function GET() {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
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

    return NextResponse.json({
      ...result,
      overview: overview.metrics,
    });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Failed to run analysis" },
      { status: 502 }
    );
  }
}
