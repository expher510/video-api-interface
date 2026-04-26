import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import generateHandler from '../api/generate';

type Res = {
  statusCode: number;
  payload: any;
  status: (code: number) => Res;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const createRes = (): Res => {
  const state: Res = {
    statusCode: 200,
    payload: null,
    status(code: number) { state.statusCode = code; return state; },
    json(data: unknown) { state.payload = data; },
    setHeader() {},
  };
  return state;
};

const env = process.env;
const projectId = env.FIREBASE_PROJECT_ID!;
const clientEmail = env.FIREBASE_CLIENT_EMAIL!;
const privateKey = env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');
const databaseId = env.FIREBASE_DATABASE_ID!;

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore(undefined, databaseId);

const keyDocId = `live_${Date.now()}`;
const apiKey = `eg_live_${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

await db.collection('api_keys').doc(keyDocId).set({
  user_id: 'live-test-user',
  key: apiKey,
  name: 'Live Test Key',
  project: 'eg-live-test',
  permissions: [],
  daily_limit: 100,
  requests_today: 0,
  limit_reset_at: new Date(new Date().setHours(24,0,0,0)).getTime(),
  status: 'active',
  created_at: Date.now(),
});

try {
  const res = createRes();
  await generateHandler({
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      host: 'localhost:3000',
      'x-forwarded-proto': 'http',
    },
    body: {
      prompt: 'Create a professional product teaser for EG Autonomous with futuristic blue UI motion graphics.'
    }
  } as any, res as any);

  const token = env.GITHUB_TOKEN!;
  const repo = env.GITHUB_REPO!;
  const [owner, name] = repo.split('/');

  await new Promise(r => setTimeout(r, 6000));

  const runsResp = await fetch(`https://api.github.com/repos/${owner}/${name}/actions/runs?event=repository_dispatch&per_page=5`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'eg-autonomous-live-test',
    },
  });

  const runsJson = await runsResp.json() as any;
  const latest = runsJson.workflow_runs?.[0] ?? null;

  console.log(JSON.stringify({
    generateStatusCode: res.statusCode,
    generatePayload: res.payload,
    githubRunsHttpStatus: runsResp.status,
    latestRun: latest ? {
      id: latest.id,
      name: latest.name,
      status: latest.status,
      conclusion: latest.conclusion,
      html_url: latest.html_url,
      created_at: latest.created_at,
      event: latest.event,
      head_branch: latest.head_branch,
    } : null,
    note: 'Generate request is real and dispatches GitHub Actions. Full completion requires reachable callback URL in PUBLIC_API_BASE_URL.',
  }, null, 2));
} finally {
  await db.collection('api_keys').doc(keyDocId).delete();
}
