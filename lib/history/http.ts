import { getServerConfig } from "../config";
import { errorJson } from "../http";
import { getFileHistoryStore, type HistoryStore } from "./store";

/** Returns the server history store, or an error response when server-side history is disabled. */
export function resolveHistoryStore(): { store: HistoryStore } | { response: Response } {
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
  return { store: getFileHistoryStore(config.historyFilePath) };
}
