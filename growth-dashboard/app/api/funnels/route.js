import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/mixpanel";

export const revalidate = 3600;

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({
    source: data.source,
    generatedAt: data.generatedAt,
    funnels: data.funnels,
  });
}
