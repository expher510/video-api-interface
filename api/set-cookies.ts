import { assertAdminToken } from './_lib/auth.js';
import { parseMetaCookiesTxt, toBase64 } from './_lib/cookies.js';
import { ApiError } from './_lib/errors.js';
import { assertEnvFields, getServerEnv } from './_lib/env.js';
import { parseJsonBody, RequestLike, requireMethod, ResponseLike, sendJson, withErrorHandling } from './_lib/http.js';
import { setRedisValue } from './_lib/redis.js';

type SetCookiesBody = {
  cookies_txt?: string;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  await withErrorHandling(res, async () => {
    requireMethod(req, 'POST');

    const env = getServerEnv();
    assertEnvFields(env, ['adminApiToken', 'redisRestUrl', 'redisRestToken']);

    assertAdminToken(req, env.adminApiToken);

    const body = parseJsonBody<SetCookiesBody>(req);
    const cookiesTxt = String(body.cookies_txt ?? '');

    if (!cookiesTxt) {
      throw new ApiError(400, 'invalid_cookies', 'cookies_txt is required.');
    }

    const cookies = parseMetaCookiesTxt(cookiesTxt);
    const cookiesB64 = toBase64(cookies);

    await setRedisValue(env.redisRestUrl, env.redisRestToken, 'meta_cookies_b64', cookiesB64, 60 * 60 * 24 * 30);

    sendJson(res, 200, {
      success: true,
      message: 'Meta cookies updated successfully.',
      cookies_count: cookies.length,
    });
  });
}
