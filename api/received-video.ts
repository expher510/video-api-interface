import { assertAllowedIp, assertWebhookSecret } from './_lib/auth.js';
import { ApiError } from './_lib/errors.js';
import { assertEnvFields, getServerEnv } from './_lib/env.js';
import { parseJsonBody, RequestLike, requireMethod, ResponseLike, sendJson, withErrorHandling } from './_lib/http.js';
import { setRedisValue } from './_lib/redis.js';

type ReceivedVideoBody = {
  job_id?: string;
  success?: boolean;
  mode?: 'text' | 'image' | 'video' | 'image_to_video';
  prompt?: string;
  video_urls?: string[];
  image_urls?: string[];
  text?: string;
  response?: string;
  output_text?: string;
  error?: string;
};

const toStringList = (value: unknown): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        return toStringList(JSON.parse(trimmed));
      } catch {
        // Continue with comma/new-line split fallback.
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
    .map((url) => String(url).trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url, index) => ({ index: index + 1, url }));

export default async function handler(req: RequestLike, res: ResponseLike) {
  await withErrorHandling(res, async () => {
    requireMethod(req, 'POST');

    const env = getServerEnv();
    assertEnvFields(env, ['redisRestUrl', 'redisRestToken']);

    assertWebhookSecret(req, env.receivedVideoSecret);
    assertAllowedIp(req, env.receivedVideoAllowedIp);

    const payload = parseJsonBody<ReceivedVideoBody>(req);
    const jobId = String(payload.job_id ?? '').trim();

    if (!jobId) {
      throw new ApiError(400, 'missing_job_id', 'job_id is required.');
    }

    const mode = String(payload.mode ?? '').trim().toLowerCase();
    const payloadRecord = payload as Record<string, unknown>;

    let videos = mapUrls(
      payload.video_urls ??
        payloadRecord.videoUrls ??
        payloadRecord.videos ??
        payloadRecord.video_results ??
        payloadRecord.videoResults,
    );
    let images = mapUrls(
      payload.image_urls ??
        payloadRecord.imageUrls ??
        payloadRecord.images ??
        payloadRecord.image_results ??
        payloadRecord.imageResults,
    );

    // Some workers return generic URL fields.
    const fallbackUrls = mapUrls(
      payloadRecord.urls ?? payloadRecord.output_urls ?? payloadRecord.outputUrls ?? payloadRecord.media_urls ?? payloadRecord.mediaUrls,
    );
    if (videos.length === 0 && images.length === 0 && fallbackUrls.length > 0) {
      if (mode === 'image') {
        images = fallbackUrls;
      } else {
        videos = fallbackUrls;
      }
    }

    if (mode === 'image' && images.length === 0 && videos.length > 0) {
      images = videos;
      videos = [];
    }

    const text = String(
      payload.output_text ??
        payload.response ??
        payload.text ??
        payloadRecord.output ??
        payloadRecord.result ??
        payloadRecord.generated_text ??
        payloadRecord.generatedText ??
        '',
    ).trim();

    const detectedMode =
      mode === 'text' || mode === 'image' || mode === 'video' || mode === 'image_to_video'
        ? mode
        : videos.length > 0
          ? 'video'
          : images.length > 0
            ? 'image'
            : text
              ? 'text'
              : 'video';

    const resultCount = videos.length + images.length + (text ? 1 : 0);
    const isSuccess = payload.success === false ? false : resultCount > 0;
    const contentLabel = detectedMode === 'image' ? 'Image' : detectedMode === 'text' ? 'Text' : 'Video';

    const storedStatus = isSuccess
      ? {
          success: true,
          state: 'completed',
          mode: detectedMode,
          job_id: jobId,
          message: `${contentLabel} generated successfully.`,
          prompt: String(payload.prompt ?? ''),
          videos,
          images,
          text: text || undefined,
          timestamp: new Date().toISOString(),
        }
      : {
          success: false,
          state: 'failed',
          mode: detectedMode,
          job_id: jobId,
          message: `${contentLabel} generation failed.`,
          error: {
            reason: String(payload.error ?? 'Unknown upstream failure'),
          },
          timestamp: new Date().toISOString(),
        };

    await setRedisValue(env.redisRestUrl, env.redisRestToken, `job:${jobId}`, JSON.stringify(storedStatus), 60 * 60 * 24);

    sendJson(res, 200, {
      success: true,
      message: 'Callback accepted.',
      job_id: jobId,
    });
  });
}
