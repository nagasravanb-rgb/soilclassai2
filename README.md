# SoilClass AI

SoilClass AI is a responsive web app that gives a **visual, AI-assisted interpretation of a soil photograph**. You take or upload one soil picture, enter the city where it was taken, and get:

- a predicted soil texture category (sandy, clayey, silty, loamy, mixed or undetermined) with model confidence,
- visible characteristics (colour, texture, structure, organic matter, stones, cracks, surface crust),
- an estimated moisture *condition* (never a percentage),
- possible soil properties and limitations,
- nutrient information that is explicitly marked **Not measured / Laboratory test required**,
- general agricultural guidance and suggested follow-up tests,
- uncertainty notes and scientific limitations,
- saved history and a printable / downloadable report.

> A photograph cannot measure pH, N-P-K, electrical conductivity, salinity, mineral concentrations, fertility or exact moisture. SoilClass AI never fabricates these values. Use a laboratory soil test or calibrated sensors for quantitative measurements.

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript, deployed as a single app (frontend + API route handlers)
- Zod for provider-response and history validation
- Vitest + Testing Library (unit, API, component tests), Playwright (end-to-end, desktop and mobile)

## Project structure

```
app/                     Pages (/, /analyze, /history, /history/[id], /about, /settings) and API routes
app/api/                 health, analyze, history, history/[id]
components/              Camera capture, image input, analysis flow, results, history, settings, nav
lib/config.ts            Server-only environment configuration
lib/image.ts             Image signature / dimension / size validation
lib/providers/           Provider interface, Gemini adapter, mock provider, prompt, response validation
lib/analysis.ts          Analysis pipeline (validate → provider → validate → normalize)
lib/normalize.ts         Normalization into the result schema + scientific safeguards
lib/guard.ts             Removes unsupported quantitative claims (pH, %, ppm, EC, dosages…)
lib/report.ts            Standalone printable HTML report
lib/history/             JSON-file history store (optional server mode)
lib/client/              Browser API client, local history, preferences, image helpers
tests/                   unit, api, components (Vitest) and e2e (Playwright)
```

## Local development

Requires **Node.js 20.9+** (Node 22 recommended).

```bash
npm install
cp .env.example .env.local      # then edit .env.local
npm run dev                      # http://localhost:3000
```

To try the full flow without an API key, run with the mock provider:

```bash
AI_PROVIDER=mock npm run dev
```

The mock provider returns a fixed demo result and does **not** look at the image. The UI shows a "Mock provider active / Demo result" banner whenever it is used.

Production build:

```bash
npm run build
npm start
```

## Environment variables

All variables are read on the server only. Only `NEXT_PUBLIC_API_BASE_URL` is exposed to the browser.

| Variable | Default | Description |
| --- | --- | --- |
| `AI_PROVIDER` | `gemini` | `gemini` (real image analysis) or `mock` (demo fixtures for tests). |
| `AI_API_KEY` | — | API key for the provider. `GEMINI_API_KEY` is accepted as a fallback. |
| `AI_MODEL` | `gemini-3.8-flash` | Vision-capable model ID. `GEMINI_MODEL` is accepted as a fallback. |
| `AI_TIMEOUT_MS` | `25000` | Provider request timeout (1000–120000). |
| `MAX_UPLOAD_MB` | `4` | Maximum upload size (1–20). Larger photos are downscaled in the browser first. |
| `HISTORY_STORAGE` | `browser` | `browser` (localStorage per device) or `file` (server JSON file). |
| `HISTORY_FILE_PATH` | `.data/history.json` | File used when `HISTORY_STORAGE=file`. |
| `NEXT_PUBLIC_API_BASE_URL` | empty (same origin) | Set only if the API is hosted on a different origin. |
| `MOCK_DELAY_MS` | `0` | Artificial latency for the mock provider. |

If no API key is configured, the app still starts; the Analyze page and Settings show that analysis is unavailable and `POST /api/analyze` returns `503 not_configured`.

## How analysis works

1. The browser checks the file type/size and downscales oversized photos (the server re-validates everything).
2. `POST /api/analyze` validates the city and the image bytes (JPEG/PNG/WebP magic bytes, dimensions, size; the browser MIME type is not trusted).
3. The configured provider is called with the image and a prompt that requests structured JSON and forbids quantitative claims. Gemini is called with `responseMimeType: application/json` and a response schema; the key is sent in the `x-goog-api-key` header.
4. The provider response is validated with Zod. Malformed responses return `502 invalid_response`.
5. The result is normalized: unsupported numeric claims are removed, nutrients are set to `null` with "Laboratory test required", moisture is a condition only, and limitations are always attached.

Each value carries a source label: **Visual observation**, **AI prediction**, **Sensor measurement**, **Laboratory measurement** or **Not measured**. The current app only produces visual observations and AI predictions.

### City context

The city is used only as context in the prompt and in the report. SoilClass AI does not geocode the city and does not fetch weather, soil-survey or regional data; results say so explicitly.

## API

All responses are JSON with `Cache-Control: no-store`. Errors have the shape `{ "error": "message", "code": "machine_code" }` and never include stack traces or secrets.

### `GET /api/health`

```json
{
  "status": "ok",
  "app": "SoilClass AI",
  "provider": { "name": "gemini", "model": "gemini-3.8-flash", "configured": true, "isMock": false },
  "analysisAvailable": true,
  "historyStorage": "browser",
  "limits": { "maxUploadBytes": 4194304, "acceptedTypes": ["image/jpeg", "image/png", "image/webp"] }
}
```

### `POST /api/analyze`

`multipart/form-data` with fields `image` (file) and `city` (2–100 characters).

```bash
curl -F "city=Pune" -F "image=@soil.jpg" http://localhost:3000/api/analyze
```

Returns an analysis result (`id`, `createdAt`, `city`, `provider`, `classification`, `observations`, `moisture`, `properties`, `nutrients`, `recommendations`, `suggestedTests`, `uncertainty`, `limitations`, …).

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_city`, `missing_image`, `invalid_request` | Missing or invalid input |
| 400 / 413 / 415 | `invalid_image` | Corrupted, too small/large, or unsupported image content |
| 413 | `file_too_large` | Upload exceeds `MAX_UPLOAD_MB` |
| 422 | `blocked` | The photo does not appear to show soil, or the provider blocked it |
| 429 | `rate_limited` | Provider rate limit / quota reached |
| 502 | `upstream_error` | Provider error (including rejected key or unavailable model; see message) |
| 502 | `invalid_response` | Provider returned malformed or schema-invalid output |
| 503 | `not_configured`, `unsupported_provider` | No API key, or unknown `AI_PROVIDER` |
| 504 | `timeout` | Provider timed out |

### History

Server history endpoints are active when `HISTORY_STORAGE=file`. In the default `browser` mode they return `501 history_browser_only` and the app stores history in the browser's localStorage.

- `GET /api/history` — list summaries (`id`, `createdAt`, `city`, `category`, `confidence`, `summary`).
- `GET /api/history/{id}` — full saved record (UUID id; 400 if malformed, 404 if missing).
- `POST /api/history` — save a record `{ "result": <analysis result>, "thumbnail": "data:image/jpeg;base64,…" | null }` (validated; max 200 records kept).
- `DELETE /api/history` — clear all saved records.

## History and privacy

- **Browser mode (default):** history lives in localStorage on the current device/browser only. It is not synced between devices and is cleared if browser data is cleared.
- **File mode:** history is stored in a JSON file on the server. Use only on a host with a persistent writable disk. It is shared by everyone using that server (there are no user accounts).
- Saving history and saving image thumbnails can be turned off in **Settings**.
- Uploaded images are sent to the configured AI provider (Google Gemini by default) for analysis. SoilClass AI itself does not store the original image on the server. Avoid photos that include people or other personal information.

## Testing

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Vitest: unit, API route and component tests (mock / stubbed providers)
npm run build         # production build
npx playwright install chromium   # first time only
npm run test:e2e      # Playwright: builds must exist; starts `next start` with AI_PROVIDER=mock
npm run check         # lint + typecheck + test + build
```

Automated tests use the mock provider or stubbed `fetch`, so they need no API key. They cover health, missing city/image, invalid and corrupted images, mock analysis, missing credentials, provider timeouts, malformed provider responses, fabricated-claim filtering, history persistence, report generation, camera permission failures (unit and e2e with a fake camera), and mobile layout (Pixel 7 viewport, no horizontal overflow).

## Deployment

### Vercel

1. Import the repository in Vercel (framework: Next.js; `vercel.json` already sets the commands).
2. In **Project → Settings → Environment Variables** add `AI_API_KEY` (and optionally `AI_MODEL`) for Production and Preview.
3. Keep `HISTORY_STORAGE=browser` (the default). Vercel functions have no persistent disk, so file history would be lost.
4. Keep `MAX_UPLOAD_MB` at 4 or lower: Vercel limits function request bodies to 4.5 MB.
5. Deploy, then open `/api/health` and confirm `analysisAvailable: true`.

### Any Node host / container

```bash
npm ci && npm run build
AI_API_KEY=... PORT=3000 npm start
```

Set `HISTORY_STORAGE=file` and a persistent `HISTORY_FILE_PATH` if you want server-side history.

## Troubleshooting

- **"AI analysis is not configured"** — set `AI_API_KEY` (or `GEMINI_API_KEY`) on the server and restart/redeploy.
- **`upstream_error` mentioning the API key** — the key is invalid, revoked, or not enabled for the Gemini API.
- **`upstream_error` mentioning the model** — the model ID is not available to your key; set `AI_MODEL` to a supported vision model.
- **`rate_limited`** — provider quota reached; wait or check your plan.
- **`timeout`** — try again, or raise `AI_TIMEOUT_MS`.
- **Camera does not open** — live camera requires HTTPS (or localhost) and permission. Use "Use device camera app" or "Upload a Picture" instead.
- **History disappeared** — browser history is per device/browser and is removed when site data is cleared.

## Scientific limitations

SoilClass AI provides a visual interpretation, not a laboratory diagnosis or a formal soil classification. Lighting, camera settings, moisture and surface residue strongly affect appearance. Model confidence reflects the model's uncertainty, not scientific certainty. Recommendations are general guidance; they do not include fertilizer dosages or definite crop-suitability claims. Confirm decisions with a soil test and local agricultural extension advice.
