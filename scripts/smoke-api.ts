import generateHandler from '../api/generate';
import downloadHandler from '../api/download';
import setCookiesHandler from '../api/set-cookies';
import receivedVideoHandler from '../api/received-video';
import mediaHandler from '../api/media';

type Req = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, unknown>;
};

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

const runCase = async (name: string, handler: (req: Req, res: Res) => Promise<void>, req: Req, expectedCode: number) => {
  const res = createRes();
  await handler(req, res);

  if (res.statusCode !== expectedCode) {
    throw new Error(`${name} failed. Expected status ${expectedCode}, got ${res.statusCode}. Payload: ${JSON.stringify(res.payload)}`);
  }

  return { name, statusCode: res.statusCode, payload: res.payload };
};

const main = async () => {
  process.env.ADMIN_API_TOKEN = 'internal-admin-token';
  process.env.REDIS_REST_URL = 'https://example.upstash.io';
  process.env.REDIS_REST_TOKEN = 'redis-token';
  const results = [];

  results.push(
    await runCase('generate without API key', generateHandler, { method: 'POST', headers: {}, body: { prompt: 'Test prompt' } }, 401),
  );

  results.push(
    await runCase('download without API key', downloadHandler, { method: 'POST', headers: {}, body: { job_id: 'job_123' } }, 401),
  );

  results.push(
    await runCase('set-cookies without admin token', setCookiesHandler, { method: 'POST', headers: {}, body: { cookies_txt: 'x' } }, 401),
  );

  results.push(
    await runCase('received-video wrong method', receivedVideoHandler, { method: 'GET', headers: {} }, 405),
  );

  results.push(
    await runCase(
      'media without API key',
      mediaHandler,
      { method: 'GET', headers: {}, query: { job_id: 'job_123', type: 'video', index: '1' } },
      401,
    ),
  );

  console.log(JSON.stringify({ success: true, results }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
