# SoilSense AI

SoilSense AI is a responsive, evidence-aware soil-photo assistant. It lets a user take a photo on a mobile device or upload an existing image, add a region, optionally enter measured values, and include crop/season/irrigation context for cautious next-step guidance.

## Current features

- Mobile camera capture and existing-image upload for JPG, PNG, and WebP (5 MB limit).
- Server-side image signature checks and basic image-dimension validation; the browser-provided MIME type alone is not trusted.
- Region/district selection, crop context, season, irrigation, and optional user-provided moisture, pH, and N-P-K notes.
- Gemini vision adapter configured with `GEMINI_API_KEY` and an overridable `GEMINI_MODEL`.
- Clear errors for missing credentials, invalid files, provider errors, and timeouts; no fabricated predictions or confidence scores.
- Responsive, low-glare interface with explicit scientific limitations.

## Local setup

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your Gemini API key to `.env.local` for local development. Never commit API keys. In Vercel, add `GEMINI_API_KEY` as a server-side environment variable for Preview/Production and redeploy. The code and `.env.example` default to `gemini-3.8-flash`. Set `GEMINI_MODEL` only when you need another currently supported vision-capable model that is available to your API key.

## Checks

```bash
npm run lint
npm run build
```

## Scientific limitations

A normal RGB photograph cannot directly measure pH, volumetric moisture, N-P-K, mineral/nutrient status, salinity, cation-exchange capacity, or contamination. Those require suitable calibrated sensors or laboratory methods. Region selection is contextual information, not a measurement of the user's sample. The Gemini response is a visual interpretation, not a validated formal soil classification or laboratory diagnosis. Crop and fertilizer decisions should be verified with a soil test and qualified local agricultural guidance.

## Data and privacy

The image is sent to the configured Gemini API provider for visual analysis when the server key is configured. Do not upload photos containing sensitive personal information. API credentials must remain server-side and must never be exposed in client-side code.
