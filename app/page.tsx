"use client";

import { useEffect, useRef, useState } from "react";

type Analysis = { status?: string; analysis?: string; error?: string; source?: string };
const REGIONS = ["Andhra Pradesh", "Telangana", "Tamil Nadu", "Karnataka", "Other India region", "Outside India"];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [area, setArea] = useState("Andhra Pradesh");
  const [district, setDistrict] = useState("");
  const [crop, setCrop] = useState("");
  const [season, setSeason] = useState("");
  const [irrigation, setIrrigation] = useState("");
  const [moisture, setMoisture] = useState("");
  const [ph, setPh] = useState("");
  const [npk, setNpk] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => setCameraError("Camera preview could not start. Check browser camera permissions."));
    }
  }, [cameraOpen]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function openCamera() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support direct camera access here. Use Upload image, or open the site in a current browser over HTTPS.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setCameraError(name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser/site settings, then try again."
        : name === "NotFoundError"
          ? "No camera was found on this device."
          : "Could not open the camera. Check that another app is not using it, and allow camera access.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera is still starting. Please wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture the camera image. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        setCameraError("Could not create the photo file. Please try again.");
        return;
      }
      choose(new File([blob], `soil-photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  function choose(next?: File) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setResult({ error: "Please select a JPG, PNG, or WebP image." });
      return;
    }
    if (next.size <= 0 || next.size > 5 * 1024 * 1024) {
      setResult({ error: "Image must be non-empty and 5 MB or smaller." });
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setResult(null);
  }

  async function analyze() {
    if (!file) { setResult({ error: "Take or upload a soil photo first." }); return; }
    if (moisture && (!Number.isFinite(Number(moisture)) || Number(moisture) < 0 || Number(moisture) > 100)) {
      setResult({ error: "Moisture must be between 0 and 100%, and should come from a sensor or lab report." }); return;
    }
    if (ph && (!Number.isFinite(Number(ph)) || Number(ph) < 0 || Number(ph) > 14)) {
      setResult({ error: "pH must be between 0 and 14, and should come from a soil test." }); return;
    }
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("area", area);
      form.append("district", district);
      form.append("crop", crop);
      form.append("season", season);
      form.append("irrigation", irrigation);
      form.append("measurements", JSON.stringify({ moisture, ph, npk }));
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      setResult(data);
    } catch {
      setResult({ error: "Could not reach the analysis service. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand"><div className="mark">✳</div>SoilSense <span className="brand-accent">AI</span></div>
          <span className="navtag">Evidence-aware soil insights</span>
        </div>
      </header>
      <main className="shell">
        <section className="hero">
          <div>
            <div className="eyebrow">A clearer picture of your soil</div>
            <h1>Understand your soil.<br /><span>Grow with confidence.</span></h1>
            <p>Take a photo or upload a soil image, add your area and optional measured values, and get cautious visual observations with practical next steps.</p>
            <span className="pill">Photo observations</span><span className="pill">Location context</span><span className="pill">Honest limitations</span>
          </div>
          <aside className="hero-card">
            <div className="orb">🌱</div>
            <h3>Good decisions start with good evidence.</h3>
            <p>Visual clues, geographic context, and measured values are kept separate so you can see what is known—and what still needs testing.</p>
          </aside>
        </section>

        <section className="grid">
          <div className="card">
            <h2>01 · Add a soil sample</h2>
            <p className="sub">On mobile, use your camera or choose a saved image. Use natural light and avoid filters for clearer visual observations.</p>
            <div className="upload">
              {preview ? <img src={preview} alt="Preview of selected soil sample" /> : <div><div className="camera-icon">📷</div><strong>Add a soil photo</strong><small>Choose camera or a saved image · JPG, PNG, WebP · Up to 5 MB</small></div>}
              <input ref={cameraInputRef} aria-label="Take a soil photo with your camera" type="file" accept="image/*" capture="environment" onChange={event => { choose(event.target.files?.[0]); event.currentTarget.value = ""; }} style={{ display: "none" }} />
              <input ref={galleryInputRef} aria-label="Upload a soil image from your gallery" type="file" accept="image/*" onChange={event => { choose(event.target.files?.[0]); event.currentTarget.value = ""; }} style={{ display: "none" }} />
            </div>
            <div className="two upload-actions">
              <button type="button" className="btn" onClick={openCamera}>📷 Take a photo</button>
              <button type="button" className="btn secondary" onClick={() => galleryInputRef.current?.click()}>🖼 Upload image</button>
            </div>
            {cameraError && <p className="result result-error" role="alert">{cameraError}</p>}
            {cameraOpen && <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.75)", display: "grid", placeItems: "center", padding: 16 }} className="camera-dialog" role="dialog" aria-modal="true" aria-label="Take a soil photo">
              <div className="camera-dialog-inner" style={{ background: "white", color: "#17202a", borderRadius: 16, padding: 20, width: "min(100%, 560px)", maxHeight: "90vh", overflow: "auto" }}>
                <h3>Take a soil photo</h3>
                <video ref={videoRef} autoPlay playsInline muted className="camera-preview" style={{ display: "block", width: "100%", maxHeight: "55vh", background: "#111", objectFit: "contain", borderRadius: 12 }} />
                <p className="sub">Keep the soil in frame and use good lighting.</p>
                {cameraError && <p className="result result-error" role="alert">{cameraError}</p>}
                <div className="two"><button type="button" className="btn" onClick={capturePhoto}>Capture photo</button><button type="button" className="btn secondary" onClick={stopCamera}>Cancel</button></div>
              </div>
            </div>}
            {preview && <button type="button" className="btn secondary" onClick={() => { setFile(null); setPreview(""); setResult(null); }}>Remove photo / choose another</button>}

            <div className="field"><label htmlFor="area">Country / region</label><select id="area" value={area} onChange={event => setArea(event.target.value)}>{REGIONS.map(region => <option key={region}>{region}</option>)}</select></div>
            <div className="field"><label htmlFor="district">District / nearest area (optional)</label><input id="district" placeholder="e.g. Tirupati, Chittoor" value={district} maxLength={100} onChange={event => setDistrict(event.target.value)} /></div>

            <h2 className="section-heading">02 · Personalize crop context <span className="status">Optional</span></h2>
            <p className="sub">This helps frame general next steps; it does not replace local agronomic advice.</p>
            <div className="field"><label htmlFor="crop">Crop you want to grow</label><input id="crop" placeholder="e.g. groundnut, paddy, tomato" value={crop} maxLength={100} onChange={event => setCrop(event.target.value)} /></div>
            <div className="two">
              <div className="field"><label htmlFor="season">Season</label><select id="season" value={season} onChange={event => setSeason(event.target.value)}><option value="">Select season</option><option>Kharif</option><option>Rabi</option><option>Summer</option><option>Not sure</option></select></div>
              <div className="field"><label htmlFor="irrigation">Water source</label><select id="irrigation" value={irrigation} onChange={event => setIrrigation(event.target.value)}><option value="">Select option</option><option>Rain-fed</option><option>Borewell</option><option>Canal</option><option>Drip / sprinkler</option><option>Other / not sure</option></select></div>
            </div>

            <h2 className="section-heading">03 · Add measured values <span className="status">Optional</span></h2>
            <p className="sub">Enter values only if you have them from a suitable sensor or lab report. Leave unknown values blank.</p>
            <div className="two">
              <div className="field"><label htmlFor="moisture">Moisture (%)</label><input id="moisture" type="number" min="0" max="100" step="any" placeholder="e.g. 24" value={moisture} onChange={event => setMoisture(event.target.value)} /></div>
              <div className="field"><label htmlFor="ph">pH</label><input id="ph" type="number" min="0" max="14" step="any" placeholder="e.g. 6.8" value={ph} onChange={event => setPh(event.target.value)} /></div>
            </div>
            <div className="field"><label htmlFor="npk">N-P-K or lab notes (optional)</label><input id="npk" placeholder="Only values from a soil test" maxLength={500} value={npk} onChange={event => setNpk(event.target.value)} /></div>
            <button className="btn" onClick={analyze} disabled={busy}>{busy ? "Analyzing image…" : "Analyze soil sample →"}</button>
            {result && <div className={result.error ? "result result-error" : "result"} role="status" aria-live="polite"><strong>{result.error ? "Analysis unavailable" : result.status || "Analysis result"}</strong><br />{result.error || result.analysis}{result.source && <div className="source-note">Model configured: {result.source}</div>}</div>}
          </div>

          <div className="card">
            <h2>What this can—and can’t—tell you</h2>
            <p className="sub">A trustworthy result distinguishes visual evidence from actual measurements.</p>
            <div className="explain-list">
              {[["👁", "Visible clues", "Colour, visible surface texture, stones, organic matter, and other image features."], ["📍", "Area context", "A selected region can frame research, but it is not a measurement of your exact sample."], ["🧪", "Lab or sensor values", "pH, moisture percentage, N-P-K, salinity, and other properties require suitable instruments or tests."], ["🌾", "Crop guidance", "Recommendations depend on measured soil properties, season, irrigation, crop, and local agricultural advice."]].map(([icon, title, description]) => <div className="explain-item" key={title}><div className="explain-icon">{icon}</div><div><strong>{title}</strong><p>{description}</p></div></div>)}
            </div>
            <div className="warning"><strong>Scientific note:</strong> A normal RGB photo cannot directly measure pH, moisture percentage, nutrients, minerals, or “vitamins.” Do not apply fertilizer based only on a visual guess. Use a soil test and local agricultural guidance.</div>
            <div className="pill-row"><span className="pill">No fake confidence scores</span><span className="pill">No invented measurements</span><span className="pill">Unknowns shown honestly</span></div>
          </div>
        </section>
      </main>
      <footer className="footer"><div className="shell">SoilSense AI · An evidence-first educational tool. Visual observations are not a laboratory diagnosis. Verify important agronomic decisions with a soil test and qualified local advice.</div></footer>
    </>
  );
}
