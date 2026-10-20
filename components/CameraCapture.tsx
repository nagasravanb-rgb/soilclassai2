"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CameraState = "requesting" | "live" | "captured" | "error";

export interface CameraCaptureProps {
  onConfirm: (photo: Blob) => void;
  onClose: () => void;
  onUseFallback: () => void;
}

export function describeCameraError(error: unknown): string {
  const name = error instanceof Error || (typeof error === "object" && error && "name" in error) ? String((error as { name: string }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access in your browser settings, or use your device's camera app instead.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device. You can upload a photo instead.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is in use by another app or could not be started. Close other camera apps and try again.";
    default:
      return "The camera could not be started. You can use your device's camera app or upload a photo instead.";
  }
}

export default function CameraCapture({ onConfirm, onClose, onUseFallback }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<CameraState>("requesting");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const stop = useCallback(() => {
    requestIdRef.current += 1; // invalidates any pending getUserMedia request
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState("requesting");
    setError("");
    setVideoReady(false);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Live camera preview is not supported in this browser (it requires HTTPS and a modern browser). Use your device's camera app instead.");
      setState("error");
      return;
    }
    stop();
    const requestId = ++requestIdRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
      if (requestId !== requestIdRef.current) {
        // Dialog closed or a newer request started while permission was pending.
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setState("live");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(describeCameraError(err));
      setState("error");
    }
  }, [stop]);

  useEffect(() => {
    // Camera is requested only because the user opened this dialog via a button press.
    void start(); // eslint-disable-line react-hooks/set-state-in-effect
    return stop;
  }, [start, stop]);

  useEffect(() => {
    const video = videoRef.current;
    if (state === "live" && video && streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {
        setError("The camera preview could not start. Check your browser's camera permissions.");
        setState("error");
      });
    }
  }, [state]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("The camera is not ready yet. Please wait a moment and try again.");
      return;
    }
    const maxSide = 2048;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        setError("The photo could not be captured. Please try again.");
        return;
      }
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setState("captured");
      stop();
    }, "image/jpeg", 0.9);
  }

  function retake() {
    setPhoto(null);
    void start();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="modal">
        <div className="modal-head">
          <h2 id="camera-title">Take a picture of the soil</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close camera">✕</button>
        </div>

        {state === "requesting" && <p className="muted" role="status">Requesting camera access…</p>}

        {(state === "live" || state === "requesting") && (
          <video ref={videoRef} className="camera-video" playsInline muted autoPlay aria-label="Live camera preview" hidden={state !== "live"}
            onLoadedData={() => { setVideoReady(true); setError(""); }} />
        )}

        {state === "captured" && photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="Captured soil photo preview" className="camera-video" />
        )}

        {state === "error" && (
          <div className="alert alert-error" role="alert">
            <p>{error}</p>
          </div>
        )}
        {state !== "error" && error && <p className="alert alert-error" role="alert">{error}</p>}

        <p className="hint">Tip: fill the frame with soil, use daylight, avoid shadows and filters.</p>

        <div className="btn-row">
          {state === "live" && (
            <button type="button" className="btn" onClick={capture} disabled={!videoReady} aria-describedby={videoReady ? undefined : "camera-wait"}>
              Capture photo
            </button>
          )}
          {state === "live" && !videoReady && <span id="camera-wait" className="muted" role="status">Starting camera…</span>}
          {state === "captured" && photo && (
            <>
              <button type="button" className="btn" onClick={() => onConfirm(photo.blob)}>Use this photo</button>
              <button type="button" className="btn btn-secondary" onClick={retake}>Retake</button>
            </>
          )}
          {state === "error" && (
            <>
              <button type="button" className="btn" onClick={onUseFallback}>Use device camera app</button>
              <button type="button" className="btn btn-secondary" onClick={() => void start()}>Try again</button>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
