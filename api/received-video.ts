import { assertAllowedIp, assertWebhookSecret } from './_lib/auth';
import { ApiError } from './_lib/errors';
import { assertEnvFields, getServerEnv } from './_lib/env';
import { parseJsonBody, RequestLike, requireMethod, ResponseLike, sendJson, withErrorHandling } from './_lib/http';
import { setRedisValue } from './_lib/redis';

type ReceivedVideoBody = {
  job_id?: string;
  success?: boolean;
  prompt?: string;
  video_urls?: string[];
  error?: string;
};

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

    const rawUrls = Array.isArray(payload.video_urls) ? payload.video_urls : [];
    const videos = rawUrls
      .map((url) => String(url).trim())
      .filter((url) => /^https?:\/\//i.test(url))
      .map((url, index) => ({ index: index + 1, url }));

    const isSuccess = payload.success === true && videos.length > 0;

    const storedStatus = isSuccess
      ? {
          success: true,
          state: 'completed',
          job_id: jobId,
          message: 'Video generated successfully.',
          prompt: String(payload.prompt ?? ''),
          videos,
          timestamp: new Date().toISOString(),
        }
      : {
          success: false,
          state: 'failed',
          job_id: jobId,
          message: 'Video generation failed.',
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
