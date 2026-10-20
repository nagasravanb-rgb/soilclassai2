import { errorJson, json } from "@/lib/http";
import { resolveHistoryStore } from "@/lib/history/http";
import { HistoryRecordSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 400 * 1024;

export async function GET() {
  const resolved = resolveHistoryStore();
  if ("response" in resolved) return resolved.response;
  const records = await resolved.store.list();
  return json({ storage: "file", items: records.map(({ result: _result, ...summary }) => summary) });
}

export async function POST(req: Request) {
  const resolved = resolveHistoryStore();
  if ("response" in resolved) return resolved.response;
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return errorJson("History record is too large.", 413, "too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorJson("Request body must be valid JSON.", 400, "invalid_json");
  }
  const parsed = HistoryRecordSchema.safeParse(body);
  if (!parsed.success) return errorJson("History record is invalid or incomplete.", 400, "invalid_record");
  const record = parsed.data;
  if (record.id !== record.result.id) return errorJson("History record ID does not match its analysis.", 400, "invalid_record");
  await resolved.store.add(record);
  return json({ storage: "file", item: record }, 201);
}

export async function DELETE() {
  const resolved = resolveHistoryStore();
  if ("response" in resolved) return resolved.response;
  const deleted = await resolved.store.clear();
  return json({ storage: "file", deleted });
}
