import { errorJson, json } from "@/lib/http";
import { resolveHistoryStore } from "@/lib/history/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const resolved = resolveHistoryStore(req);
  if ("response" in resolved) return resolved.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return errorJson("Invalid analysis ID.", 400, "invalid_id");
  const record = await resolved.store.get(id);
  if (!record) return errorJson("Analysis not found.", 404, "not_found");
  return json({ storage: "file", item: record });
}
