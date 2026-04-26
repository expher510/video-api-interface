import 'dotenv/config';
import { getServerEnv, assertEnvFields } from '../api/_lib/env';
import { validateAndConsumeApiKey } from '../api/_lib/firestore';
import setCookiesHandler from '../api/set-cookies';
import { getRedisValue } from '../api/_lib/redis';

type Req = { method?: string; headers?: Record<string, string>; body?: unknown };
type Res = {
  statusCode: number;
  payload: unknown;
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
    status(code: number) { state.statusCode = code; return state; },
    json(data: unknown) { state.payload = data; },
    setHeader(name: string, value: string) { state.headers[name.toLowerCase()] = value; },
  };
  return state;
};

const env = getServerEnv();
assertEnvFields(env, ['firebaseProjectId', 'firebaseClientEmail', 'firebasePrivateKey', 'redisRestUrl', 'redisRestToken']);

const firestoreCheck = async () => {
  try {
    await validateAndConsumeApiKey(env, 'eg_nonexistent_key_for_connectivity_test');
    return { ok: false, message: 'Unexpectedly validated fake key.' };
  } catch (error: any) {
    // Expected path if Firestore connection works
    return {
      ok: error?.errorCode === 'api_key_not_found',
      code: error?.errorCode || 'unknown',
      message: error?.message || String(error),
    };
  }
};

const setCookiesCheck = async () => {
  process.env.ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || 'replace-with-a-long-random-token';

  const req: Req = {
    method: 'POST',
    headers: {
      'x-admin-token': process.env.ADMIN_API_TOKEN as string,
      'content-type': 'application/json',
    },
    body: {
      cookies_txt: `.meta.ai\tTRUE\t/\tTRUE\t2147483647\tfoo\tbar\n.meta.ai\tTRUE\t/\tTRUE\t2147483647\tbaz\tqux`,
    },
  };

  const res = createRes();
  await setCookiesHandler(req as any, res as any);

  const stored = await getRedisValue(env.redisRestUrl, env.redisRestToken, 'meta_cookies_b64');

  return {
    statusCode: res.statusCode,
    payload: res.payload,
    redisStored: !!stored,
    redisLength: stored.length,
  };
};

const main = async () => {
  const firestore = await firestoreCheck();
  const setCookies = await setCookiesCheck();

  console.log(JSON.stringify({ success: true, firestore, setCookies }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
