import { randomUUID } from 'node:crypto';
import { extractBearerToken } from './_lib/auth.js';
import { ApiError } from './_lib/errors.js';
import { getServerEnv, assertEnvFields } from './_lib/env.js';
import { validateAndConsumeApiKey } from './_lib/firestore.js';
import { dispatchGithubWorkflow } from './_lib/github.js';
import { parseJsonBody, requireMethod, sendJson, withErrorHandling, RequestLike, ResponseLike, getHeader } from './_lib/http.js';
import { getRedisValue, setRedisValue } from './_lib/redis.js';

type GenerateBody = {
  provider?: 'meta' | 'veo';
  prompt?: string;
  body?: string;
  mode?: 'text' | 'image' | 'video' | 'image_to_video';
  aspect_ratio?: 'landscape' | 'portrait';
  image_url?: string;
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

const resolveMode = (rawMode: unknown) => {
  const mode = String(rawMode ?? 'video').trim().toLowerCase();
  const allowedModes = new Set(['text', 'image', 'video', 'image_to_video']);
  if (!allowedModes.has(mode)) {
    throw new ApiError(400, 'invalid_mode', 'mode must be one of: text, image, video, image_to_video.');
  }
  return mode as 'text' | 'image' | 'video' | 'image_to_video';
};

const buildWorkerPrompt = (mode: 'text' | 'image' | 'video' | 'image_to_video', prompt: string) => {
  if (mode === 'text') return `Generate a text response about: ${prompt}`;
  if (mode === 'image') return `Generate an image about: ${prompt}`;
  if (mode === 'image_to_video') return `Generate a video animation about: ${prompt}`;
  return `Generate a video about: ${prompt}`;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  await withErrorHandling(res, async () => {
    requireMethod(req, 'POST');

    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      throw new ApiError(401, 'missing_api_key', 'Missing API key. Use Authorization: Bearer eg_xxx');
    }

    const requestBody = parseJsonBody<GenerateBody>(req);
    const provider = String(requestBody.provider ?? 'meta').trim().toLowerCase();
    const prompt = String(requestBody.prompt ?? requestBody.body ?? '').trim();
    const mode = resolveMode(requestBody.mode);
    const imageUrl = String(requestBody.image_url ?? '').trim();
    
    // Map standard aspect ratio to Veo's expected format, defaulting to landscape
    const veoAspectRatio = requestBody.aspect_ratio === 'portrait' 
      ? 'VIDEO_ASPECT_RATIO_PORTRAIT' 
      : 'VIDEO_ASPECT_RATIO_LANDSCAPE';

    if (provider !== 'meta' && provider !== 'veo') {
      throw new ApiError(400, 'invalid_provider', 'provider must be meta or veo.');
    }

    if (prompt.length < 3) {
      throw new ApiError(400, 'invalid_prompt', 'Prompt must be at least 3 characters.');
    }

    if (prompt.length > 3000) {
      throw new ApiError(400, 'invalid_prompt', 'Prompt is too long. Maximum is 3000 characters.');
    }

    if (mode === 'image_to_video' && !imageUrl) {
      throw new ApiError(400, 'missing_image_url', 'image_url is required when mode is image_to_video.');
    }

    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      throw new ApiError(400, 'invalid_image_url', 'image_url must be a valid http/https URL.');
    }

    const env = getServerEnv();
    assertEnvFields(env, [
      'firebaseProjectId',
      'firebaseClientEmail',
      'firebasePrivateKey',
      'redisRestUrl',
      'redisRestToken',
      provider === 'veo' ? 'veoGithubRepo' : 'githubRepo',
      provider === 'veo' ? 'veoGithubToken' : 'githubToken',
    ]);

    const keyInfo = await validateAndConsumeApiKey(env, apiKey);
    
    let cookiesB64 = '';
    if (provider === 'meta') {
      cookiesB64 = await getRedisValue(env.redisRestUrl, env.redisRestToken, 'meta_cookies_b64') || '';
      if (!cookiesB64) {
        throw new ApiError(503, 'cookies_unavailable', 'Meta cookies are not configured. Upload cookies first.');
      }
    }

    const jobId = buildJobId();
    const workerPrompt = buildWorkerPrompt(mode, prompt);
    const baseUrl = env.pollBaseUrl || inferBaseUrl(req);
    const webhookUrl = baseUrl ? `${baseUrl}/api/received-video` : '/api/received-video';

    if (provider === 'veo') {
      await dispatchGithubWorkflow(env.veoGithubRepo, env.veoGithubToken, env.veoGithubEventType, {
        prompt: prompt, // Veo expects the raw prompt
        aspect_ratio: veoAspectRatio,
        webhook_url: webhookUrl,
        job_id: jobId,
      });
    } else {
      await dispatchGithubWorkflow(env.githubRepo, env.githubToken, env.githubEventType, {
        prompt: workerPrompt,
        original_prompt: prompt,
        mode,
        aspect_ratio: veoAspectRatio, // Pass it to Meta too, just in case they support it in the future
        image_url: imageUrl || undefined,
        webhook_url: webhookUrl,
        job_id: jobId,
        cookies_b64: cookiesB64,
        project: keyInfo.project,
        key_name: keyInfo.keyName,
        requested_by: keyInfo.userId,
      });
    }

    await setRedisValue(
      env.redisRestUrl,
      env.redisRestToken,
      `job:${jobId}`,
      JSON.stringify({
        success: true,
        state: 'queued',
        mode,
        job_id: jobId,
        message: `${mode.replaceAll('_', ' ')} generation job has been queued.`,
        created_at: new Date().toISOString(),
      }),
      60 * 60 * 24,
    );

    sendJson(res, 202, {
      success: true,
      state: 'queued',
      mode,
      job_id: jobId,
      message: `${mode.replaceAll('_', ' ')} generation job has been queued.`,
      estimated_time: 120,
      poll_url: `${baseUrl || ''}/api/download`,
      poll_interval: 10,
      remaining_today: keyInfo.remaining,
      timestamp: new Date().toISOString(),
    });
  });
}
