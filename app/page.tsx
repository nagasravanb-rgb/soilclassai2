import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Soil photo analysis</p>
        <h1>Understand your soil from a <span>photograph</span>.</h1>
        <p className="lead">
          Take or upload a picture of soil, enter your city, and get an AI visual classification, observed characteristics,
          an estimated moisture condition, and responsible next steps — with honest limits on what a photo can tell you.
        </p>
        <div className="btn-row">
          <Link href="/analyze" className="btn btn-lg">Analyze soil</Link>
          <Link href="/about" className="btn btn-secondary btn-lg">How it works</Link>
        </div>
      </section>

      <section className="steps" aria-label="How it works">
        <div className="card step"><span className="step-num">1</span><h2>Take or upload a picture</h2><p>Use your phone camera or choose an existing JPEG, PNG, or WebP photo.</p></div>
        <div className="card step"><span className="step-num">2</span><h2>Enter your city</h2><p>The only required text. Used as context — no coordinates or other personal details.</p></div>
        <div className="card step"><span className="step-num">3</span><h2>Review the analysis</h2><p>See the predicted soil type, visual evidence, guidance, suggested tests, and a printable report.</p></div>
      </section>

      <section className="card honesty">
        <h2>What a photo can and cannot tell you</h2>
        <div className="two-col">
          <div>
            <h3>Can suggest</h3>
            <ul className="bullets">
              <li>Likely texture category (sandy, clayey, silty, loamy, mixed)</li>
              <li>Colour, visible particles, stones, and organic matter clues</li>
              <li>Whether the surface looks dry or wet</li>
            </ul>
          </div>
          <div>
            <h3>Cannot measure</h3>
            <ul className="bullets">
              <li>pH, nitrogen, phosphorus, potassium</li>
              <li>Salinity, electrical conductivity, minerals</li>
              <li>Exact moisture percentage or fertility</li>
            </ul>
          </div>
        </div>
        <p className="fineprint">These are shown as “Laboratory test required”. They are never estimated.</p>
      </section>
    </>
  );
}
