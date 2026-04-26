import { ApiError } from './errors';

export type MetaCookie = {
  domain: string;
  path: string;
  secure: boolean;
  expires: number;
  name: string;
  value: string;
};

export const parseMetaCookiesTxt = (cookiesTxt: string) => {
  if (!cookiesTxt.trim()) {
    throw new ApiError(400, 'invalid_cookies', 'cookies_txt is required.');
  }

  const lines = cookiesTxt.split('\n');
  const parsed: MetaCookie[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split('\t');
    if (parts.length < 7) continue;

    const domain = parts[0] ?? '';
    if (!domain.includes('meta.ai')) continue;

    const expires = Number(parts[4] ?? 0);

    parsed.push({
      domain,
      path: parts[2] ?? '/',
      secure: (parts[3] ?? '').toUpperCase() === 'TRUE',
      expires: Number.isFinite(expires) ? expires : 0,
      name: parts[5] ?? '',
      value: parts[6] ?? '',
    });
  }

  if (parsed.length === 0) {
    throw new ApiError(400, 'invalid_cookies', 'No meta.ai cookies were found in cookies_txt.');
  }

  return parsed;
};

export const toBase64 = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
