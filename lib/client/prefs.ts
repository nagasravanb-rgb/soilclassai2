export interface Preferences {
  saveHistory: boolean;
  saveThumbnails: boolean;
}

const KEY = "soilclass.prefs.v1";
export const DEFAULT_PREFS: Preferences = { saveHistory: true, saveThumbnails: true };

export function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const data = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return {
      saveHistory: typeof data.saveHistory === "boolean" ? data.saveHistory : DEFAULT_PREFS.saveHistory,
      saveThumbnails: typeof data.saveThumbnails === "boolean" ? data.saveThumbnails : DEFAULT_PREFS.saveThumbnails,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Preferences): void {
  window.localStorage.setItem(KEY, JSON.stringify(prefs));
}
