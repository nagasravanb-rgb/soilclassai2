"use client";

import { useEffect, useState } from "react";
import { fetchHealth, getHistoryBackend, type HealthInfo } from "@/lib/client/api";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Preferences } from "@/lib/client/prefs";

export default function SettingsView() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPrefs(loadPrefs()); // eslint-disable-line react-hooks/set-state-in-effect
    fetchHealth().then(setHealth).catch(() => setHealthError("Could not reach the server."));
  }, []);

  function update(next: Preferences) {
    setPrefs(next);
    savePrefs(next);
    setMessage("Preferences saved.");
  }

  async function clearHistory() {
    if (!window.confirm("Delete all saved analyses? This cannot be undone.")) return;
    try {
      await (await getHistoryBackend()).clear();
      setMessage("History cleared.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not clear history.");
    }
  }

  return (
    <div className="settings">
      <section className="card">
        <h2>AI service status</h2>
        {healthError && <p className="alert alert-error" role="alert">{healthError}</p>}
        {!health && !healthError && <p className="muted" role="status">Checking…</p>}
        {health && (
          <dl className="kv">
            <div className="kv-row"><dt>Provider</dt><dd>{health.provider.name}{health.provider.isMock ? " (mock — demo results)" : ""}</dd></div>
            <div className="kv-row"><dt>Model</dt><dd>{health.provider.model}</dd></div>
            <div className="kv-row"><dt>Status</dt><dd><span className={health.analysisAvailable ? "tag tag-ok" : "tag tag-bad"}>{health.analysisAvailable ? "Available" : "Not configured"}</span> {health.provider.message}</dd></div>
            <div className="kv-row"><dt>History storage</dt><dd>{health.historyStorage === "file" ? "Server (file)" : "This browser only"}</dd></div>
            <div className="kv-row"><dt>Upload limit</dt><dd>{Math.round(health.limits.maxUploadBytes / 1024 / 1024)} MB · JPEG, PNG, WebP</dd></div>
          </dl>
        )}
        <p className="fineprint">The AI provider and API key are configured by the server administrator through environment variables. Keys are never sent to the browser.</p>
      </section>

      <section className="card">
        <h2>Preferences</h2>
        <label className="toggle">
          <input type="checkbox" checked={prefs.saveHistory} onChange={e => update({ ...prefs, saveHistory: e.target.checked })} />
          <span>Save analyses to history</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={prefs.saveThumbnails} disabled={!prefs.saveHistory} onChange={e => update({ ...prefs, saveThumbnails: e.target.checked })} />
          <span>Include a small photo thumbnail in history</span>
        </label>
        <p className="fineprint">Preferences are stored in this browser.</p>
      </section>

      <section className="card">
        <h2>Data</h2>
        <button type="button" className="btn btn-danger" onClick={clearHistory}>Clear analysis history</button>
      </section>

      {message && <p className="alert alert-success" role="status">{message}</p>}
    </div>
  );
}
