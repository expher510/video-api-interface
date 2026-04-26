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
  mode?: 'text' | 'image' | 'video' | 'image_to_video';
  job_id: string;
  message?: string;
  videos?: Array<{ index: number; url: string }>;
  images?: Array<{ index: number; url: string }>;
  text?: string;
  error?: {
    reason: string;
  };
  timestamp?: string;
};

const inferBaseUrl = (req: RequestLike, configuredBaseUrl: string) => {
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');

  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
  const proto = getHeader(req, 'x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : '';
};

const buildProxyAssetUrl = (baseUrl: string, jobId: string, type: 'video' | 'image', index: number) => {
  const query = new URLSearchParams({
    job_id: jobId,
    type,
    index: String(index),
  }).toString();

  return `${baseUrl || ''}/api/media?${query}`;
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
    const baseUrl = inferBaseUrl(req, env.pollBaseUrl);

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
      const videos = stored.videos ?? [];
      const images = stored.images ?? [];
      const text = stored.text ?? '';
      const count = videos.length + images.length + (text ? 1 : 0);
      const proxiedVideos = videos.map((item) => ({
        index: item.index,
        url: buildProxyAssetUrl(baseUrl, jobId, 'video', item.index),
      }));
      const proxiedImages = images.map((item) => ({
        index: item.index,
        url: buildProxyAssetUrl(baseUrl, jobId, 'image', item.index),
      }));

      sendJson(res, 200, {
        success: true,
        state: 'completed',
        mode: stored.mode ?? (images.length > 0 ? 'image' : text ? 'text' : 'video'),
        job_id: jobId,
        message: stored.message ?? 'Generation completed successfully.',
        count,
        videos: proxiedVideos,
        images: proxiedImages,
        text: text || undefined,
        timestamp: stored.timestamp ?? new Date().toISOString(),
      });
      return;
    }

    if (stored.state === 'failed') {
      sendJson(res, 200, {
        success: false,
        state: 'failed',
        mode: stored.mode ?? 'video',
        job_id: jobId,
        message: stored.message ?? 'Generation failed.',
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
