import { getRetentionDimension } from "@/lib/mixpanel";

export const revalidate = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dim = searchParams.get("dim") || "overall";
  const days = Number(searchParams.get("days")) || 30;
  const data = await getRetentionDimension(dim, days);
  return Response.json(data);
}
