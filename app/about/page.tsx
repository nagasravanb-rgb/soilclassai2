import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="prose">
      <h1 className="page-title">About SoilClass AI</h1>
      <p className="lead">SoilClass AI uses a vision-capable AI model to describe what is visible in a soil photograph and to suggest a likely soil texture category, together with general, responsible guidance.</p>

      <section className="card">
        <h2>How an analysis works</h2>
        <ol className="bullets">
          <li>Your photo is checked in the browser and again on the server (file type by content, size, and dimensions).</li>
          <li>The server sends the photo and city name to the configured AI provider with instructions to return structured observations only.</li>
          <li>The response is validated against a strict schema. Malformed or incomplete responses are rejected rather than guessed.</li>
          <li>Any statement containing numeric measurements a photo cannot support (pH, N-P-K, moisture %, dosages) is removed.</li>
          <li>Nutrient and chemical properties are always shown as “Laboratory test required”.</li>
        </ol>
      </section>

      <section className="card">
        <h2>How to read the results</h2>
        <dl className="kv">
          <div className="kv-row"><dt><span className="tag tag-visual_observation">Visual observation</span></dt><dd>Something directly visible in the photo.</dd></div>
          <div className="kv-row"><dt><span className="tag tag-ai_prediction">AI prediction</span></dt><dd>An inference by the AI model from visual evidence. It may be wrong.</dd></div>
          <div className="kv-row"><dt><span className="tag tag-sensor_measurement">Sensor measurement</span></dt><dd>A value from a calibrated sensor. None are collected by this app.</dd></div>
          <div className="kv-row"><dt><span className="tag tag-laboratory_measurement">Laboratory measurement</span></dt><dd>A value from a laboratory test. None are collected by this app.</dd></div>
          <div className="kv-row"><dt><span className="tag tag-not_measured">Not measured</span></dt><dd>Unknown. Requires a sensor or laboratory test.</dd></div>
        </dl>
        <p className="fineprint">Model confidence is the AI&apos;s own estimate for the visual classification. It is not a measure of scientific accuracy.</p>
      </section>

      <section className="card">
        <h2>Scientific limitations</h2>
        <p>An ordinary photograph cannot reliably measure soil pH, nutrients (N, P, K, micronutrients), electrical conductivity, salinity, mineral concentrations, organic carbon, fertility, or exact moisture content. Texture class can only be confirmed with a hand-texture test or laboratory particle-size analysis. Lighting, wetness, and camera settings change how soil looks.</p>
        <p>Use the results to decide what to test, not to decide fertilizer rates or crop choice.</p>
      </section>

      <section className="card">
        <h2>Privacy and data processing</h2>
        <ul className="bullets">
          <li>The only text you provide is a city name. No account, coordinates, or contact details are collected.</li>
          <li>When you press Analyze, the photo and city are sent to this app&apos;s server and forwarded to the configured external AI provider (for example Google Gemini) for analysis. That provider&apos;s data terms apply.</li>
          <li>The server does not store photos. By default, history (including an optional small thumbnail) is kept only in your browser&apos;s local storage.</li>
          <li>API keys stay on the server and are never sent to your browser.</li>
        </ul>
      </section>

      <section className="card">
        <h2>City context</h2>
        <p>The city is passed to the AI as context only. SoilClass AI does not use live weather, regional soil surveys, or local measurement data, and does not infer exact farm locations.</p>
      </section>
    </div>
  );
}
