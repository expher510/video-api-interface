import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { extractBearerToken } from './_lib/auth.js';
import { ApiError } from './_lib/errors.js';
import { assertEnvFields, getServerEnv } from './_lib/env.js';
import { validateApiKey } from './_lib/firestore.js';
import { verifyMediaSignature } from './_lib/media-signing.js';
import { getRedisValue } from './_lib/redis.js';
import { RequestLike, ResponseLike, getHeader, withErrorHandling } from './_lib/http.js';

type StoredJobStatus = {
  success: boolean;
  state: 'queued' | 'processing' | 'completed' | 'failed';
  mode?: 'text' | 'image' | 'video' | 'image_to_video';
  job_id: string;
  videos?: Array<{ index: number; url: string }>;
  images?: Array<{ index: number; url: string }>;
  payload?: Record<string, unknown>;
  error?: {
    reason: string;
  };
};

const getQueryParam = (req: RequestLike, key: string) => {
  const queryValue = (req as { query?: Record<string, unknown> }).query?.[key];
  if (typeof queryValue === 'string') return queryValue.trim();
  if (Array.isArray(queryValue)) return String(queryValue[0] ?? '').trim();
  if (typeof queryValue === 'number') return String(queryValue).trim();

  const rawUrl = (req as { url?: string }).url;
  if (rawUrl) {
    const value = new URL(rawUrl, 'http://localhost').searchParams.get(key);
    if (value) return value.trim();
  }

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
      mode: 'video',
      videos: urls.map((url, index) => ({ index: index + 1, url })),
      images: [],
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

const readGeneratedAssets = (stored: StoredJobStatus) => {
  const src = stored.payload ?? {};
  const payload = src as Record<string, unknown>;

  const videos =
    stored.videos ??
    mapUrls(payload.video_urls ?? payload.videoUrls ?? payload.videos ?? payload.video_url);
  const images =
    stored.images ??
    mapUrls(payload.image_urls ?? payload.imageUrls ?? payload.images);

  return { videos, images };
};

const forwardSelectedHeaders = (res: ResponseLike, upstream: Response) => {
  const headerNames = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
    'cache-control',
    'expires',
  ];

  for (const headerName of headerNames) {
    const value = upstream.headers.get(headerName);
    if (value && res.setHeader) {
      res.setHeader(headerName, value);
    }
  }
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  await withErrorHandling(res, async () => {
    const method = (req.method ?? '').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      throw new ApiError(405, 'method_not_allowed', `Method ${req.method ?? 'unknown'} is not allowed.`);
    }

    const jobId = getQueryParam(req, 'job_id');
    if (!jobId) {
      throw new ApiError(400, 'missing_job_id', 'job_id is required.');
    }

    const type = getQueryParam(req, 'type').toLowerCase();
    const assetType: 'video' | 'image' = type === 'image' ? 'image' : 'video';
    const indexRaw = getQueryParam(req, 'index') || '1';
    const index = Number.parseInt(indexRaw, 10);
    if (!Number.isFinite(index) || index < 1) {
      throw new ApiError(400, 'invalid_index', 'index must be a positive integer.');
    }

    const apiKey = extractBearerToken(req);
    const expRaw = getQueryParam(req, 'exp');
    const sigRaw = getQueryParam(req, 'sig');

    const env = getServerEnv();
    assertEnvFields(env, ['redisRestUrl', 'redisRestToken']);

    let signedAuthorized = false;
    if (expRaw || sigRaw) {
      if (!env.mediaSigningSecret) {
        if (!apiKey) {
          throw new ApiError(500, 'misconfigured_server', 'MEDIA_SIGNING_SECRET is required for signed media URLs.');
        }
      } else {
        const expiresAt = Number.parseInt(expRaw, 10);
        const now = Math.floor(Date.now() / 1000);
        const hasValidExpiry = Number.isFinite(expiresAt) && expiresAt > now;

        if (hasValidExpiry && sigRaw) {
          signedAuthorized = verifyMediaSignature(env.mediaSigningSecret, {
            jobId,
            type: assetType,
            index,
            expiresAt,
          }, sigRaw);
        }

        if (!signedAuthorized && !apiKey) {
          throw new ApiError(401, 'invalid_media_signature', 'Invalid or expired signed media URL.');
        }
      }
    }

    if (!signedAuthorized) {
      if (!apiKey) {
        throw new ApiError(401, 'missing_media_auth', 'Missing authorization. Provide Bearer token or signed URL.');
      }

      assertEnvFields(env, ['firebaseProjectId', 'firebaseClientEmail', 'firebasePrivateKey']);
      await validateApiKey(env, apiKey);
    }

    const storedRaw = await getRedisValue(env.redisRestUrl, env.redisRestToken, `job:${jobId}`);
    const stored = toStoredStatus(storedRaw);
    if (!stored) {
      throw new ApiError(404, 'job_not_found', 'No media found for this job_id yet.');
    }

    if (stored.state === 'failed') {
      throw new ApiError(409, 'job_failed', stored.error?.reason || 'Generation failed for this job.');
    }

    if (stored.state !== 'completed') {
      throw new ApiError(409, 'job_processing', 'Media is still being generated for this job.');
    }

    const { videos, images } = readGeneratedAssets(stored);
    const assets = assetType === 'image' ? images : videos;
    const selected = assets.find((item) => item.index === index);
    if (!selected?.url) {
      throw new ApiError(404, 'asset_not_found', `No ${assetType} found for index ${index}.`);
    }

    const upstreamHeaders: Record<string, string> = {
      Accept: getHeader(req, 'accept') || '*/*',
      'User-Agent': 'eg-autonomous-media-proxy',
    };

    const range = getHeader(req, 'range');
    if (range) {
      upstreamHeaders.Range = range;
    }

    const upstream = await fetch(selected.url, {
      method,
      headers: upstreamHeaders,
    });

    if (!upstream.ok && upstream.status !== 206) {
      throw new ApiError(502, 'upstream_media_unavailable', `Upstream media returned status ${upstream.status}.`);
    }

    forwardSelectedHeaders(res, upstream);

    const streamResponse = res as ResponseLike & {
      statusCode?: number;
      write?: (chunk: unknown) => void;
      end?: (chunk?: unknown) => void;
    };
    streamResponse.statusCode = upstream.status;

    if (method === 'HEAD') {
      streamResponse.end?.();
      return;
    }

    if (!upstream.body || typeof streamResponse.end !== 'function') {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      streamResponse.end?.(buffer);
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body as never), streamResponse as never);
  });
}
