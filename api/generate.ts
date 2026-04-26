import { randomUUID } from 'node:crypto';
import { extractBearerToken } from './_lib/auth.js';
import { ApiError } from './_lib/errors.js';
import { getServerEnv, assertEnvFields } from './_lib/env.js';
import { validateAndConsumeApiKey } from './_lib/firestore.js';
import { dispatchGithubWorkflow } from './_lib/github.js';
import { parseJsonBody, requireMethod, sendJson, withErrorHandling, RequestLike, ResponseLike, getHeader } from './_lib/http.js';
import { getRedisValue, setRedisValue } from './_lib/redis.js';

type GenerateBody = {
  prompt?: string;
  body?: string;
};

const inferBaseUrl = (req: RequestLike) => {
  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host');
  const proto = getHeader(req, 'x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : '';
};

const buildJobId = () => {
  try {
    return randomUUID();
  } catch {
    return `job_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  await withErrorHandling(res, async () => {
    requireMethod(req, 'POST');

    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      throw new ApiError(401, 'missing_api_key', 'Missing API key. Use Authorization: Bearer eg_xxx');
    }

    const requestBody = parseJsonBody<GenerateBody>(req);
    const prompt = String(requestBody.prompt ?? requestBody.body ?? '').trim();

    if (prompt.length < 3) {
      throw new ApiError(400, 'invalid_prompt', 'Prompt must be at least 3 characters.');
    }

    if (prompt.length > 3000) {
      throw new ApiError(400, 'invalid_prompt', 'Prompt is too long. Maximum is 3000 characters.');
    }

    const env = getServerEnv();
    assertEnvFields(env, [
      'firebaseProjectId',
      'firebaseClientEmail',
      'firebasePrivateKey',
      'redisRestUrl',
      'redisRestToken',
      'githubRepo',
      'githubToken',
    ]);

    const keyInfo = await validateAndConsumeApiKey(env, apiKey);
    const cookiesB64 = await getRedisValue(env.redisRestUrl, env.redisRestToken, 'meta_cookies_b64');

    if (!cookiesB64) {
      throw new ApiError(503, 'cookies_unavailable', 'Meta cookies are not configured. Upload cookies first.');
    }

    const jobId = buildJobId();
    const workerPrompt = `Generate a video about: ${prompt}`;
    const baseUrl = env.pollBaseUrl || inferBaseUrl(req);
    const webhookUrl = baseUrl ? `${baseUrl}/api/received-video` : '/api/received-video';

    await dispatchGithubWorkflow(env.githubRepo, env.githubToken, env.githubEventType, {
      prompt: workerPrompt,
      original_prompt: prompt,
      webhook_url: webhookUrl,
      job_id: jobId,
      cookies_b64: cookiesB64,
      project: keyInfo.project,
      key_name: keyInfo.keyName,
      requested_by: keyInfo.userId,
    });

    await setRedisValue(
      env.redisRestUrl,
      env.redisRestToken,
      `job:${jobId}`,
      JSON.stringify({
        success: true,
        state: 'queued',
        job_id: jobId,
        message: 'Video generation job has been queued.',
        created_at: new Date().toISOString(),
      }),
      60 * 60 * 24,
    );

    sendJson(res, 202, {
      success: true,
      state: 'queued',
      job_id: jobId,
      message: 'Video generation job has been queued.',
      estimated_time: 120,
      poll_url: `${baseUrl || ''}/api/download`,
      poll_interval: 10,
      remaining_today: keyInfo.remaining,
      timestamp: new Date().toISOString(),
    });
  });
}
