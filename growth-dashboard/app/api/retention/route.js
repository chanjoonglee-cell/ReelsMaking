import { getRetentionDimension } from "@/lib/mixpanel";

export const revalidate = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dim = searchParams.get("dim") || "overall";
  const since = searchParams.get("since") || undefined;
  const data = await getRetentionDimension(dim, since);
  return Response.json(data);
}
