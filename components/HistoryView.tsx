"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHistoryBackend, type HistoryBackend, type HistorySummary } from "@/lib/client/api";
import { CATEGORY_LABELS } from "@/lib/schema";

export default function HistoryView() {
  const [backend, setBackend] = useState<HistoryBackend | null>(null);
  const [items, setItems] = useState<HistorySummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getHistoryBackend()
      .then(async b => {
        const list = await b.list();
        if (!cancelled) { setBackend(b); setItems(list); }
      })
      .catch(err => { if (!cancelled) { setError(err instanceof Error ? err.message : "Could not load history."); setItems([]); } });
    return () => { cancelled = true; };
  }, []);

  async function clearAll() {
    if (!backend || !window.confirm("Delete all saved analyses? This cannot be undone.")) return;
    try {
      await backend.clear();
      setItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear history.");
    }
  }

  return (
    <div>
      <p className="muted">
        {backend?.kind === "file"
          ? "History is stored on this app's server."
          : "History is stored only in this browser on this device. It does not sync between devices and is removed if you clear browser data."}
      </p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {items === null && <p className="muted" role="status">Loading history…</p>}
      {items && items.length === 0 && !error && (
        <div className="card empty">
          <p>No saved analyses yet.</p>
          <Link href="/analyze" className="btn">Analyze a soil sample</Link>
        </div>
      )}
      {items && items.length > 0 && (
        <>
          <ul className="history-list">
            {items.map(item => (
              <li key={item.id}>
                <Link href={`/history/${item.id}`} className="history-item card">
                  {item.thumbnail
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.thumbnail} alt="" className="history-thumb" />
                    : <span className="history-thumb placeholder" aria-hidden="true">🌱</span>}
                  <span className="history-body">
                    <strong>{CATEGORY_LABELS[item.category]}</strong>
                    <span className="muted"> · {Math.round(item.confidence * 100)}% model confidence</span>
                    <span className="history-meta">{item.city} · {new Date(item.createdAt).toLocaleString()}</span>
                    <span className="history-summary">{item.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-danger" onClick={clearAll}>Clear history</button>
        </>
      )}
    </div>
  );
}
