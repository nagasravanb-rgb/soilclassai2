"use client";

import { useEffect, useState } from "react";
import { analyzeSoil, fetchHealth, getHistoryBackend, toHistoryRecord, type HealthInfo } from "@/lib/client/api";
import { toScaledDataUrl } from "@/lib/client/images";
import { loadPrefs } from "@/lib/client/prefs";
import type { AnalysisResult } from "@/lib/schema";
import { validateCity } from "@/lib/validation";
import AnalysisResultView from "./AnalysisResultView";
import ImageInput, { type SelectedImage } from "./ImageInput";

const DEFAULT_MAX = 4 * 1024 * 1024;

export default function AnalyzeFlow() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState("");
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [city, setCity] = useState("");
  const [cityError, setCityError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState("");

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealthError("Could not reach the server to check AI availability."));
  }, []);

  const maxBytes = health?.limits.maxUploadBytes ?? DEFAULT_MAX;
  const providerReady = health ? health.analysisAvailable : true;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setHistoryNote("");
    const c = validateCity(city);
    if (!c.ok) {
      setCityError(c.error);
      document.getElementById("city")?.focus();
      return;
    }
    setCityError("");
    if (!image) {
      setError("Please take or upload a soil picture first.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const analysis = await analyzeSoil(image.blob, image.name, c.city);
      const reportDataUrl = await toScaledDataUrl(image.blob, 800, 0.82);
      setReportImage(reportDataUrl);
      setResult(analysis);
      const prefs = loadPrefs();
      if (prefs.saveHistory) {
        const thumb = prefs.saveThumbnails ? await toScaledDataUrl(image.blob, 240, 0.7) : null;
        try {
          const backend = await getHistoryBackend();
          await backend.add(toHistoryRecord(analysis, thumb));
          setHistoryNote(backend.kind === "browser" ? "Saved to history in this browser." : "Saved to server history.");
        } catch {
          setHistoryNote("The result could not be saved to history.");
        }
      }
      requestAnimationFrame(() => document.getElementById("result-title")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setImage(null);
    setError("");
    setHistoryNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="analyze">
      {health && !health.analysisAvailable && (
        <div className="alert alert-error" role="alert">
          <strong>AI analysis is not available.</strong> {health.provider.message} An administrator must configure the server (see README).
        </div>
      )}
      {health?.provider.isMock && (
        <div className="alert alert-warn" role="note"><strong>Mock provider active.</strong> Results are demo fixtures for testing, not real AI analysis.</div>
      )}
      {healthError && <div className="alert alert-warn" role="status">{healthError}</div>}

      {!result && (
        <form className="card analyze-form" onSubmit={submit} noValidate>
          <h2>1. Add a soil picture</h2>
          <ImageInput value={image} onChange={setImage} maxBytes={maxBytes} disabled={busy} />

          <h2>2. Where was it taken?</h2>
          <div className="field">
            <label htmlFor="city">City name <span aria-hidden="true">*</span></label>
            <input
              id="city"
              name="city"
              autoComplete="address-level2"
              required
              maxLength={100}
              placeholder="e.g. Nairobi, Pune, Fresno"
              value={city}
              onChange={e => { setCity(e.target.value); if (cityError) setCityError(""); }}
              aria-invalid={cityError ? true : undefined}
              aria-describedby={cityError ? "city-error city-help" : "city-help"}
              disabled={busy}
            />
            <p id="city-help" className="fineprint">Used only as context. No exact location, weather, or local soil data is collected or looked up.</p>
            {cityError && <p id="city-error" className="field-error" role="alert">{cityError}</p>}
          </div>

          <p className="privacy-note">
            When you press Analyze, your photo and city are sent to this app&apos;s server and{" "}
            {health?.provider.isMock ? "processed by a local mock provider (no external service)." : <>forwarded to an external AI provider{health ? ` (${health.provider.name})` : ""} for image analysis.</>}{" "}
            Avoid photos showing people or private information.
          </p>

          {error && <p className="alert alert-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-lg" disabled={busy || !providerReady}>
            {busy ? <><span className="spinner" aria-hidden="true" /> Analyzing soil photo…</> : "Analyze soil"}
          </button>
          {busy && <p className="muted" role="status" aria-live="polite">This usually takes 5–20 seconds.</p>}
        </form>
      )}

      {result && (
        <>
          <div className="alert alert-success no-print" role="status">
            Analysis complete. {historyNote}
          </div>
          <AnalysisResultView result={result} imageUrl={image?.previewUrl} reportImageDataUrl={reportImage} />
          <div className="btn-row no-print">
            <button type="button" className="btn" onClick={reset}>Analyze another sample</button>
          </div>
        </>
      )}
    </div>
  );
}
