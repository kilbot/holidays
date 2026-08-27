import { readFareQuota } from "@/lib/flights/quota";
import { getKv } from "@/lib/store/kv";

export async function GET() {
  const quota = await readFareQuota(getKv());
  return Response.json(quota, { headers: { "Cache-Control": "no-store" } });
}
