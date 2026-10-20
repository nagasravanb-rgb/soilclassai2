"use client";

import { renderReportHtml, reportFileName } from "@/lib/report";
import { downloadText } from "@/lib/client/images";
import { SOURCE_LABELS, type AnalysisResult, type DataSource } from "@/lib/schema";

interface Props {
  result: AnalysisResult;
  imageUrl?: string | null;
  reportImageDataUrl?: string | null;
}

function SourceTag({ source }: { source: DataSource }) {
  return <span className={`tag tag-${source}`}>{SOURCE_LABELS[source]}</span>;
}

function List({ items, empty = "No information provided." }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return <ul className="bullets">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

export default function AnalysisResultView({ result, imageUrl, reportImageDataUrl }: Props) {
  const r = result;
  const pct = Math.round(r.classification.confidence * 100);
  const date = new Date(r.createdAt);
  const obs = r.observations;
  const rec = r.recommendations;

  return (
    <article className="result" aria-labelledby="result-title">
      {r.provider.isMock && (
        <div className="alert alert-warn" role="note">
          <strong>Demo result.</strong> This was produced by the mock provider for testing. It is <strong>not</strong> a real AI analysis of your photo.
        </div>
      )}

      <header className="result-head card">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Analyzed soil sample" className="result-image" />
        )}
        <div className="result-head-body">
          <p className="eyebrow">Predicted soil category · <SourceTag source="ai_prediction" /></p>
          <h2 id="result-title" className="result-title">{r.classification.label}</h2>
          <div className="confidence" aria-label={`Model confidence ${pct} percent, ${r.classification.confidenceLevel}`}>
            <div className="confidence-bar"><div className={`confidence-fill level-${r.classification.confidenceLevel}`} style={{ width: `${pct}%` }} /></div>
            <span className="confidence-label">{pct}% model confidence · {r.classification.confidenceLevel}</span>
          </div>
          <p className="fineprint">Confidence is the AI model&apos;s own estimate from the photo, not a measure of scientific certainty.</p>
          {r.classification.alternatives.length > 0 && (
            <p className="muted">Also possible: {r.classification.alternatives.map(a => `${a.label} (${Math.round(a.confidence * 100)}%)`).join(", ")}</p>
          )}
          <p className="summary">{r.summary}</p>
          <p className="meta">
            {r.city} · {Number.isNaN(date.getTime()) ? r.createdAt : date.toLocaleString()} · {r.provider.isMock ? "Mock provider" : `${r.provider.name} (${r.provider.model})`}
          </p>
        </div>
      </header>

      <div className="result-actions no-print">
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
        <button type="button" className="btn btn-secondary" onClick={() => downloadText(renderReportHtml(r, reportImageDataUrl), reportFileName(r), "text/html")}>Download report (HTML)</button>
        <button type="button" className="btn btn-ghost" onClick={() => downloadText(JSON.stringify(r, null, 2), reportFileName(r).replace(/\.html$/, ".json"), "application/json")}>Export JSON</button>
      </div>

      <div className="result-grid">
        <section className="card">
          <h3>Visual evidence for classification</h3>
          <List items={r.classification.evidence} />
          {r.imageAssessment.issues.length > 0 && (
            <>
              <h4>Image quality: {r.imageAssessment.quality}</h4>
              <List items={r.imageAssessment.issues} />
            </>
          )}
        </section>

        <section className="card">
          <h3>Visual observations</h3>
          <dl className="kv">
            {([
              ["Colour", obs.color],
              ["Texture", obs.texture],
              ["Particles", obs.particles],
              ["Stones / debris", obs.stonesDebris],
              ["Organic matter indicators", obs.organicMatter],
            ] as const).map(([label, v]) => (
              <div key={label} className="kv-row"><dt>{label}</dt><dd>{v.value} <SourceTag source={v.source} /></dd></div>
            ))}
          </dl>
          {obs.additional.length > 0 && <List items={obs.additional} />}
        </section>

        <section className="card">
          <h3>Estimated moisture condition</h3>
          <p className="big">{r.moisture.label} <SourceTag source="ai_prediction" /></p>
          <p>{r.moisture.evidence}</p>
          <dl className="kv"><div className="kv-row"><dt>Measured moisture</dt><dd><strong>Not measured</strong> <SourceTag source="not_measured" /></dd></div></dl>
          <p className="fineprint">{r.moisture.note}</p>
        </section>

        <section className="card">
          <h3>Soil properties &amp; possible limitations</h3>
          {r.properties.length ? (
            <dl className="kv">
              {r.properties.map((p, i) => (
                <div key={i} className="kv-row"><dt>{p.name}</dt><dd>{p.assessment} <SourceTag source={p.source} /></dd></div>
              ))}
            </dl>
          ) : <p className="muted">No properties provided.</p>}
          <h4>Possible limitations</h4>
          <List items={r.limitations} />
        </section>

        <section className="card span-2">
          <h3>Nutrients &amp; chemical properties</h3>
          <p className="alert alert-info">No nutrient or chemical values were measured. A photograph cannot determine pH, N-P-K, salinity, or other chemical properties.</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Property</th><th scope="col">Value</th><th scope="col">How to measure</th></tr></thead>
              <tbody>
                {r.nutrients.map(n => (
                  <tr key={n.name}><th scope="row">{n.name}</th><td><span className="tag tag-not_measured">{n.status}</span></td><td>{n.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {rec.nutrientEducation.length > 0 && (<><h4>Nutrient education</h4><List items={rec.nutrientEducation} /></>)}
        </section>

        <section className="card span-2">
          <h3>Agricultural guidance</h3>
          <p className="fineprint">General guidance based on visual evidence only — not based on measured soil data. Do not apply fertilizers based on this result alone.</p>
          <div className="rec-grid">
            <div><h4>Soil management</h4><List items={rec.soilManagement} /></div>
            <div><h4>Organic matter</h4><List items={rec.organicMatter} /></div>
            <div><h4>Water management</h4><List items={rec.waterManagement} /></div>
            <div><h4>Drainage</h4><List items={rec.drainage} /></div>
          </div>
        </section>

        <section className="card">
          <h3>Suggested follow-up tests</h3>
          <ul className="bullets">
            {r.suggestedTests.map((t, i) => <li key={i}><strong>{t.name}</strong> — {t.reason}</li>)}
          </ul>
        </section>

        <section className="card">
          <h3>Uncertainty &amp; context</h3>
          <List items={r.uncertainty} />
          <h4>City: {r.cityContext.city}</h4>
          <p className="fineprint">{r.cityContext.note}</p>
        </section>

        <section className="card span-2">
          <h3>Scientific limitations</h3>
          <List items={r.scientificLimitations} />
          {r.removedClaims > 0 && (
            <p className="fineprint">{r.removedClaims} AI statement(s) containing unsupported numeric measurements were removed from this result.</p>
          )}
        </section>
      </div>
    </article>
  );
}
