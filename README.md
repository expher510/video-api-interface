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

### 1) Generate a video

```bash
curl -X POST https://eg-autonomous.vercel.app/api/generate \
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a premium product launch cinematic."}'
```

### 2) Poll status / get result

```bash
curl -X POST https://eg-autonomous.vercel.app/api/download \
  -H "Authorization: Bearer eg_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"job_id":"<job-id-from-generate>"}'
```

### 3) Upload Meta cookies (admin only)

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
