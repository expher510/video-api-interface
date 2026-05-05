import { assertAllowedIp, assertWebhookSecret } from './_lib/auth.js';
import { ApiError } from './_lib/errors.js';
import { assertEnvFields, getServerEnv } from './_lib/env.js';
import { parseJsonBody, RequestLike, requireMethod, ResponseLike, sendJson, withErrorHandling } from './_lib/http.js';
import { setRedisValue } from './_lib/redis.js';

type ReceivedVideoBody = {
  job_id?: string;
  success?: boolean;
  status?: string;
  message?: string;
  error?: string;
  [key: string]: unknown;
};

const pickFirstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const isSuccessPayload = (payload: ReceivedVideoBody) => {
  if (payload.success === true) return true;
  const status = String(payload.status ?? '').trim().toLowerCase();
  return status === 'success' || status === 'completed';
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

    const payloadRecord = payload as Record<string, unknown>;
    const ok = isSuccessPayload(payload);
    const message = pickFirstText(
      payload.message,
      payload.error,
      payloadRecord.errorMessage,
      payloadRecord.error_message,
      payloadRecord.reason,
      payloadRecord.msg,
      payloadRecord.response,
    );

    const storedStatus = {
      success: ok,
      state: ok ? 'completed' : 'failed',
      job_id: jobId,
      message: message || (ok ? 'Generation completed successfully.' : 'Generation failed.'),
      payload,
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
