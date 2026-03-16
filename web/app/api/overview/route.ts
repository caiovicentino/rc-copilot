import { NextResponse } from "next/server";
import { fetchOverview } from "@/lib/revenuecat";

export const revalidate = 300; // 5 minutes

export async function GET() {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const overview = await fetchOverview(apiKey);
    return NextResponse.json(overview);
  } catch (err) {
    console.error("Overview fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch overview data" },
      { status: 502 }
    );
  }
}
