import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function errorJson(message: string, status: number, code?: string): NextResponse {
  return json({ error: message, ...(code ? { code } : {}) }, status);
}
