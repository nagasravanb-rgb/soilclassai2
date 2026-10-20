"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHistoryBackend } from "@/lib/client/api";
import type { HistoryRecord } from "@/lib/schema";
import AnalysisResultView from "./AnalysisResultView";

export default function HistoryDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<HistoryRecord | null | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getHistoryBackend()
      .then(b => b.get(id))
      .then(r => { if (!cancelled) setRecord(r); })
      .catch(err => { if (!cancelled) { setError(err instanceof Error ? err.message : "Could not load this analysis."); setRecord(null); } });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div>
      <p className="no-print"><Link href="/history" className="link-btn">← Back to history</Link></p>
      {record === undefined && <p className="muted" role="status">Loading analysis…</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {record === null && !error && <p className="alert alert-warn">This analysis was not found. It may have been deleted or saved on another device.</p>}
      {record && <AnalysisResultView result={record.result} imageUrl={record.thumbnail} reportImageDataUrl={record.thumbnail} />}
    </div>
  );
}
