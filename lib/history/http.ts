import { timingSafeEqual } from "crypto";
import { getServerConfig } from "../config";
import { errorJson } from "../http";
import { getFileHistoryStore, type HistoryStore } from "./store";

function tokenMatches(expected: string, header: string | null): boolean {
  const provided = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Returns the server history store, or an error response when server-side history is disabled,
 * not secured with HISTORY_ACCESS_TOKEN, or the request lacks the matching bearer token.
 */
export function resolveHistoryStore(req: Request): { store: HistoryStore } | { response: Response } {
  const config = getServerConfig();
  if (config.historyStorage !== "file") {
    return {
      response: errorJson(
        "Server-side history is disabled (HISTORY_STORAGE=browser). History is stored only in the user's browser.",
        501,
        "history_browser_only",
      ),
    };
  }
  if (!config.historyAccessToken) {
    return { response: errorJson("Server history requires HISTORY_ACCESS_TOKEN to be configured on the server.", 503, "history_not_secured") };
  }
  if (!tokenMatches(config.historyAccessToken, req.headers.get("authorization"))) {
    return { response: errorJson("Enter the history access token in Settings to use server history.", 401, "history_unauthorized") };
  }
  return { store: getFileHistoryStore(config.historyFilePath) };
}
