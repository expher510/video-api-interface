# EG Autonomous - Secure Video API Console

A production-ready React + Vercel project for:

- Secure API key management (Firebase Auth + Firestore)
- Video generation orchestration through GitHub Repository Dispatch
- Job status tracking with Redis (Upstash REST)
- Callback ingestion from automation workers
- Built-in API Playground in the dashboard

## Architecture

- Frontend: Vite + React (`src/`)
- Server API (Vercel Functions):
  - `POST /api/generate`
  - `POST /api/download` (also supports `GET`)
  - `GET /api/media` (secure proxy for generated media)
  - `POST /api/set-cookies`
  - `POST /api/received-video`
- Persistence:
  - Firestore for API keys and quotas
  - Redis for cookies and job state

## Environment Variables

Copy `.env.example` to `.env` locally, then configure the same variables in Vercel Project Settings.

Required variables are fully documented in `.env.example`.

## Local Development

1. Install dependencies:
   `npm install`
2. Run frontend:
   `npm run dev`
3. Type-check:
   `npm run lint`
4. Production build:
   `npm run build`
5. API smoke tests:
   `npm run test:api`

## API Usage

### 1) Generate content (text, image, video, image_to_video)

```bash
curl -X POST https://eg-autonomous.vercel.app/api/generate \
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"provider":"veo","prompt":"Create a premium product launch cinematic.","mode":"video","aspect_ratio":"landscape"}'
```

```bash
curl -X POST https://eg-autonomous.vercel.app/api/generate \
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"provider":"meta","prompt":"Create a futuristic city poster for EG Autonomous.","mode":"image"}'
```

```bash
curl -X POST https://eg-autonomous.vercel.app/api/generate \
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Animate this brand image","mode":"image_to_video","image_url":"https://example.com/image.jpg"}'
```

### 2) Poll status / get result

```bash
curl -X POST https://eg-autonomous.vercel.app/api/download \
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"job_id":"<job-id-from-generate>"}'
```

`/api/download` returns EG Autonomous proxy URLs only (no direct Meta CDN links).

### 3) Access proxied media URL

```bash
curl -L "https://eg-autonomous.vercel.app/api/media?job_id=<job-id>&type=video&index=1&exp=<unix-seconds>&sig=<signature>"
```

Signed media URLs are returned by `/api/download` and can be used directly without Authorization headers until they expire.

### 4) Upload Meta cookies (admin only)

```bash
curl -X POST https://eg-autonomous.vercel.app/api/set-cookies \
  -H "x-admin-token: <ADMIN_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"cookies_txt":"<netscape-cookies-text>"}'
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import repository in Vercel.
3. Add all environment variables from `.env.example`.
4. Deploy.
5. Verify security headers in `vercel.json` and test endpoints.

## Security Notes

- Do not expose server secrets in frontend code.
- Rotate `ADMIN_API_TOKEN`, `RECEIVED_VIDEO_SECRET`, and `GITHUB_TOKEN` periodically.
- Keep Firestore rules restrictive (per-user access only).
- Restrict callback endpoint with secret and optional source IP.
