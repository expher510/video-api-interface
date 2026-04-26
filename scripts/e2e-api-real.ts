import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import generateHandler from '../api/generate';
import downloadHandler from '../api/download';
import receivedVideoHandler from '../api/received-video';

type Req = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, unknown>;
};

type Res = {
  statusCode: number;
  payload: any;
  headers: Record<string, string>;
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const createRes = (): Res => {
  const state: Res = {
    statusCode: 200,
    payload: null,
    headers: {},
    status(code: number) {
      state.statusCode = code;
      return state;
    },
    json(data: unknown) {
      state.payload = data;
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
    },
  };

  return state;
};

const requireEnv = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
};

const projectId = requireEnv('FIREBASE_PROJECT_ID');
const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
const databaseId = requireEnv('FIREBASE_DATABASE_ID');

if (getApps().length === 0) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore(undefined, databaseId);

const main = async () => {
  const keyDocId = `e2e_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const apiKey = `eg_test_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const now = Date.now();
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);

  await db.collection('api_keys').doc(keyDocId).set({
    user_id: 'e2e-user',
    key: apiKey,
    name: 'E2E Temporary Key',
    project: 'eg-e2e',
    permissions: [],
    daily_limit: 100,
    requests_today: 0,
    limit_reset_at: nextMidnight.getTime(),
    status: 'active',
    created_at: now,
  });

  let generateRes: Res | null = null;
  let queuedDownloadRes: Res | null = null;
  let callbackRes: Res | null = null;
  let finalDownloadRes: Res | null = null;

  try {
    generateRes = createRes();
    await generateHandler(
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          host: 'localhost:3000',
          'x-forwarded-proto': 'http',
        },
        body: { prompt: 'Create a concise cinematic ad for EG Autonomous.' },
      } as any,
      generateRes as any,
    );

    if (generateRes.statusCode !== 202) {
      throw new Error(`Generate failed: ${generateRes.statusCode} ${JSON.stringify(generateRes.payload)}`);
    }

    const jobId = String(generateRes.payload?.job_id ?? '');
    if (!jobId) {
      throw new Error('Generate returned no job_id.');
    }

    queuedDownloadRes = createRes();
    await downloadHandler(
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        body: { job_id: jobId },
      } as any,
      queuedDownloadRes as any,
    );

    const webhookSecret = process.env.RECEIVED_VIDEO_SECRET?.trim() ?? '';
    callbackRes = createRes();
    await receivedVideoHandler(
      {
        method: 'POST',
        headers: {
          'x-webhook-secret': webhookSecret,
          ...(process.env.RECEIVED_VIDEO_ALLOWED_IP?.trim()
            ? { 'x-forwarded-for': process.env.RECEIVED_VIDEO_ALLOWED_IP.trim() }
            : {}),
        },
        body: {
          job_id: jobId,
          success: true,
          prompt: 'Create a concise cinematic ad for EG Autonomous.',
          video_urls: ['https://cdn.example.com/videos/eg-autonomous-demo.mp4'],
        },
      } as any,
      callbackRes as any,
    );

    finalDownloadRes = createRes();
    await downloadHandler(
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        body: { job_id: jobId },
      } as any,
      finalDownloadRes as any,
    );

    console.log(
      JSON.stringify(
        {
          success: true,
          generate: { statusCode: generateRes.statusCode, payload: generateRes.payload },
          queuedDownload: { statusCode: queuedDownloadRes.statusCode, payload: queuedDownloadRes.payload },
          callback: { statusCode: callbackRes.statusCode, payload: callbackRes.payload },
          finalDownload: { statusCode: finalDownloadRes.statusCode, payload: finalDownloadRes.payload },
        },
        null,
        2,
      ),
    );
  } finally {
    await db.collection('api_keys').doc(keyDocId).delete();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
