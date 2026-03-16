import { NextRequest, NextResponse } from "next/server";
import { fetchChart } from "@/lib/revenuecat";
import type { ChartName } from "@/lib/types";

export const revalidate = 300;

const VALID_CHARTS = new Set([
  "revenue", "mrr", "churn", "trials", "trial_conversion_rate",
  "customers_new", "actives", "refund_rate", "arr", "conversion_to_paying",
]);

export async function GET(request: NextRequest) {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const resolution = (searchParams.get("resolution") || "month") as "day" | "week" | "month";

  if (!type || !VALID_CHARTS.has(type)) {
    return NextResponse.json({ error: "Invalid chart type" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date and end_date required" }, { status: 400 });
  }

  try {
    const chart = await fetchChart(apiKey, type as ChartName, {
      startDate,
      endDate,
      resolution,
    });
    return NextResponse.json(chart);
  } catch (err) {
    console.error(`Chart fetch error (${type}):`, err);
    return NextResponse.json(
      { error: `Failed to fetch chart data for ${type}` },
      { status: 502 }
    );
  }
}
