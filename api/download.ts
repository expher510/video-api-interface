import { extractBearerToken } from './_lib/auth.js';
import { ApiError } from './_lib/errors.js';
import { assertEnvFields, getServerEnv } from './_lib/env.js';
import { validateApiKey } from './_lib/firestore.js';
import { createMediaSignature } from './_lib/media-signing.js';
import { getRedisValue } from './_lib/redis.js';
import { getHeader, parseJsonBody, RequestLike, requireMethod, ResponseLike, sendJson, withErrorHandling } from './_lib/http.js';

type DownloadBody = {
  job_id?: string;
};

type StoredJobStatus = {
  success?: boolean;
  state?: 'queued' | 'processing' | 'completed' | 'failed';
  mode?: 'text' | 'image' | 'video' | 'image_to_video';
  job_id?: string;
  message?: string;
  videos?: Array<{ index: number; url: string }>;
  images?: Array<{ index: number; url: string }>;
  text?: string;
  error?: {
    reason: string;
  };
  payload?: Record<string, unknown>;
  timestamp?: string;
};

const inferBaseUrl = (req: RequestLike, configuredBaseUrl: string) => {
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');

  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
  const proto = getHeader(req, 'x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : '';
};

const buildProxyAssetUrl = (
  baseUrl: string,
  jobId: string,
  type: 'video' | 'image',
  index: number,
  signingSecret: string,
  expiresAt: number,
) => {
  const signature = createMediaSignature(signingSecret, {
    jobId,
    type,
    index,
    expiresAt,
  });

  const query = new URLSearchParams({
    job_id: jobId,
    type,
    index: String(index),
    exp: String(expiresAt),
    sig: signature,
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
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as StoredJobStatus;
  } catch {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    return {
      success: false,
      state: 'failed',
      message: trimmed,
      error: { reason: trimmed },
      timestamp: new Date().toISOString(),
    };
  }
};

const toStringList = (value: unknown): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return toStringList(JSON.parse(trimmed));
      } catch {
        // fallback below
      }
    }

    return trimmed
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const mapUrls = (value: unknown) =>
  toStringList(value)
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url, index) => ({ index: index + 1, url }));

const readGeneratedContent = (stored: StoredJobStatus) => {
  const src = stored.payload ?? {};
  const videos =
    stored.videos ??
    mapUrls((src as Record<string, unknown>).video_urls ?? (src as Record<string, unknown>).videoUrls ?? (src as Record<string, unknown>).videos ?? (src as Record<string, unknown>).video_url);
  const images =
    stored.images ??
    mapUrls((src as Record<string, unknown>).image_urls ?? (src as Record<string, unknown>).imageUrls ?? (src as Record<string, unknown>).images);
  const text =
    stored.text ??
    String(
      (src as Record<string, unknown>).text ??
        (src as Record<string, unknown>).output_text ??
        (src as Record<string, unknown>).response ??
        '',
    ).trim();

  return { videos, images, text };
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
    assertEnvFields(env, [
      'firebaseProjectId',
      'firebaseClientEmail',
      'firebasePrivateKey',
      'redisRestUrl',
      'redisRestToken',
      'mediaSigningSecret',
    ]);
    const baseUrl = inferBaseUrl(req, env.pollBaseUrl);

    await validateApiKey(env, apiKey);

    const storedRaw = await getRedisValue(env.redisRestUrl, env.redisRestToken, `job:${jobId}`);
    const stored = toStoredStatus(storedRaw);

    if (!stored) {
      sendJson(res, 200, {
        success: true,
        state: 'queued',
        job_id: jobId,
        message: 'Video generation job is queued.',
        retry_after: 10,
      });
      return;
    }

    const state = stored.state ?? (stored.success === true ? 'completed' : stored.success === false ? 'failed' : 'processing');

    if (state === 'completed') {
      const { videos, images, text } = readGeneratedContent(stored);
      const count = videos.length + images.length + (text ? 1 : 0);
      const ttlSeconds = Math.min(Math.max(env.mediaSignedUrlTtlSeconds, 60), 60 * 60 * 24);
      const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
      const proxiedVideos = videos.map((item) => ({
        index: item.index,
        url: buildProxyAssetUrl(baseUrl, jobId, 'video', item.index, env.mediaSigningSecret, expiresAt),
      }));
      const proxiedImages = images.map((item) => ({
        index: item.index,
        url: buildProxyAssetUrl(baseUrl, jobId, 'image', item.index, env.mediaSigningSecret, expiresAt),
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
        media_url_expires_at: new Date(expiresAt * 1000).toISOString(),
        timestamp: stored.timestamp ?? new Date().toISOString(),
      });
      return;
    }

    if (state === 'failed') {
      const reason = stored.error?.reason ?? stored.message ?? 'Unknown error';
      sendJson(res, 200, {
        success: false,
        state: 'failed',
        mode: stored.mode ?? 'video',
        job_id: jobId,
        message: stored.message ?? 'Generation failed.',
        error: { reason },
        timestamp: stored.timestamp ?? new Date().toISOString(),
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      state,
      job_id: jobId,
      message: stored.message ?? 'Video is being processed.',
      retry_after: 10,
      timestamp: stored.timestamp ?? new Date().toISOString(),
    });
  });
}
