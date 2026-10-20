"use client";

import { useEffect, useRef, useState } from "react";
import { checkImageFile } from "@/lib/client/images";
import CameraCapture from "./CameraCapture";

export interface SelectedImage {
  blob: Blob;
  name: string;
  previewUrl: string;
  source: "camera" | "upload";
  resized?: boolean;
}

interface Props {
  value: SelectedImage | null;
  onChange: (image: SelectedImage | null) => void;
  maxBytes: number;
  disabled?: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp";

export default function ImageInput({ value, onChange, maxBytes, disabled }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraFallbackRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => { if (value) URL.revokeObjectURL(value.previewUrl); }, [value]);

  async function accept(blob: Blob | undefined | null, name: string, source: SelectedImage["source"]) {
    if (!blob) return;
    setError("");
    const check = await checkImageFile(blob, maxBytes);
    if (!check.ok) {
      setError(check.error || "This file cannot be used.");
      return;
    }
    const upload = check.blob ?? blob;
    const finalName = check.resized ? name.replace(/\.[^.]+$/, "") + ".jpg" : name;
    onChange({ blob: upload, name: finalName, previewUrl: URL.createObjectURL(upload), source, resized: check.resized });
  }

  return (
    <div className="image-input">
      <div className="choice-grid">
        <button type="button" className="choice" onClick={() => { setError(""); setCameraOpen(true); }} disabled={disabled}>
          <span className="choice-icon" aria-hidden="true">📷</span>
          <span className="choice-title">Take a Picture</span>
          <span className="choice-sub">Use your phone or webcam</span>
        </button>
        <button type="button" className="choice" onClick={() => { setError(""); uploadRef.current?.click(); }} disabled={disabled}>
          <span className="choice-icon" aria-hidden="true">🖼️</span>
          <span className="choice-title">Upload a Picture</span>
          <span className="choice-sub">JPEG, PNG or WebP · large photos are resized to {Math.round(maxBytes / 1024 / 1024)} MB</span>
        </button>
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept={ACCEPT}
        className="visually-hidden"
        aria-label="Upload a soil picture"
        data-testid="upload-input"
        onChange={e => { const f = e.target.files?.[0]; void accept(f, f?.name || "upload", "upload"); e.target.value = ""; }}
      />
      <input
        ref={cameraFallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        aria-label="Take a soil picture with your device camera app"
        onChange={e => { const f = e.target.files?.[0]; void accept(f, f?.name || "camera.jpg", "camera"); e.target.value = ""; }}
      />

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {value && (
        <figure className="preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.previewUrl} alt="Selected soil photo preview" />
          <figcaption>
            <span>{value.source === "camera" ? "Captured photo" : value.name}</span>
            {value.resized && <span className="muted"> · resized in your browser to fit the upload limit</span>}
            <button type="button" className="link-btn" onClick={() => onChange(null)} disabled={disabled}>Replace photo</button>
          </figcaption>
        </figure>
      )}

      {cameraOpen && (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onConfirm={blob => { setCameraOpen(false); void accept(blob, "camera.jpg", "camera"); }}
          onUseFallback={() => { setCameraOpen(false); cameraFallbackRef.current?.click(); }}
        />
      )}
    </div>
  );
}
