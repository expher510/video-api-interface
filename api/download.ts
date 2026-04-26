import { extractBearerToken } from './_lib/auth.js';
import { ApiError } from './_lib/errors.js';
import { assertEnvFields, getServerEnv } from './_lib/env.js';
import { validateAndConsumeApiKey } from './_lib/firestore.js';
import { getRedisValue } from './_lib/redis.js';
import { getHeader, parseJsonBody, RequestLike, requireMethod, ResponseLike, sendJson, withErrorHandling } from './_lib/http.js';

type DownloadBody = {
  job_id?: string;
};

type StoredJobStatus = {
  success: boolean;
  state: 'queued' | 'processing' | 'completed' | 'failed';
  job_id: string;
  message?: string;
  videos?: Array<{ index: number; url: string }>;
  error?: {
    reason: string;
  };
  timestamp?: string;
};

const extractJobId = (req: RequestLike) => {
  const body = parseJsonBody<DownloadBody>(req);
  const fromBody = String(body.job_id ?? '').trim();
  if (fromBody) return fromBody;

  const queryValue = (req as { query?: Record<string, unknown> }).query?.job_id;
  if (typeof queryValue === 'string' && queryValue.trim()) return queryValue.trim();

  return '';
};

const toStoredStatus = (raw: string): StoredJobStatus | null => {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredJobStatus;
  } catch {
    const urls = raw
      .replace(/^"/, '')
      .replace(/"$/, '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (urls.length === 0) return null;

    return {
      success: true,
      state: 'completed',
      job_id: '',
      videos: urls.map((url, index) => ({ index: index + 1, url })),
      timestamp: new Date().toISOString(),
    };
  }
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  await withErrorHandling(res, async () => {
    const method = (req.method ?? '').toUpperCase();
    if (method !== 'POST' && method !== 'GET') {
      requireMethod(req, 'POST');
    }

    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      throw new ApiError(401, 'missing_api_key', 'Missing API key. Use Authorization: Bearer eg_xxx');
    }

    const jobId = extractJobId(req);
    if (!jobId) {
      throw new ApiError(400, 'missing_job_id', 'job_id is required.');
    }

    const env = getServerEnv();
    assertEnvFields(env, ['firebaseProjectId', 'firebaseClientEmail', 'firebasePrivateKey', 'redisRestUrl', 'redisRestToken']);

    await validateAndConsumeApiKey(env, apiKey);

    const storedRaw = await getRedisValue(env.redisRestUrl, env.redisRestToken, `job:${jobId}`);
    const stored = toStoredStatus(storedRaw);

    if (!stored) {
      sendJson(res, 200, {
        success: true,
        state: 'processing',
        job_id: jobId,
        message: 'Video is still being generated.',
        retry_after: 10,
      });
      return;
    }

    if (stored.state === 'completed') {
      sendJson(res, 200, {
        success: true,
        state: 'completed',
        job_id: jobId,
        message: stored.message ?? 'Video generated successfully.',
        count: stored.videos?.length ?? 0,
        videos: stored.videos ?? [],
        timestamp: stored.timestamp ?? new Date().toISOString(),
      });
      return;
    }

    if (stored.state === 'failed') {
      sendJson(res, 200, {
        success: false,
        state: 'failed',
        job_id: jobId,
        message: stored.message ?? 'Video generation failed.',
        error: stored.error ?? { reason: 'Unknown error' },
        timestamp: stored.timestamp ?? new Date().toISOString(),
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      state: stored.state,
      job_id: jobId,
      message: stored.message ?? 'Video is being processed.',
      retry_after: 10,
    });
  });
}
