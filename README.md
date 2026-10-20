# SoilSense AI

A clean, responsive soil-photo and soil-information interface. It separates visual observations from user-provided measurements and geographic context.

## Features
- Mobile camera capture and existing-image upload (JPG, PNG, WebP; 5 MB limit).
- Region/district selection and optional sensor/lab values.
- Server-side Gemini vision adapter, configured with `GEMINI_API_KEY`.
- Clear provider errors when credentials are missing; no fabricated result or confidence score.
- Responsive interface and scientific limitations visible to users.

## Local setup
Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your Gemini API key to `.env.local` locally. Never commit secrets. Configure `GEMINI_API_KEY` in Vercel project environment variables. Optionally set `GEMINI_MODEL` to a currently supported model available to your API key.

## Verification
```bash
npm run build
```

## Scientific limitations
A regular photo cannot measure pH, volumetric moisture, N-P-K, minerals, salinity, or contamination. Those require calibrated sensors or laboratory methods. Area context is not a direct measurement of a sample. The AI output is a visual description, not a validated formal soil classification. Crop and fertilizer decisions should be checked against soil tests and local agricultural guidance.
