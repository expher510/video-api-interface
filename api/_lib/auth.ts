import { ApiError } from './errors';
import { RequestLike, getHeader } from './http';

export const extractBearerToken = (req: RequestLike) => {
  const rawAuthorization = getHeader(req, 'authorization');
  if (!rawAuthorization) return '';

  const [scheme, token] = rawAuthorization.split(' ');
  if (!scheme || !token) return '';
  if (!/^Bearer$/i.test(scheme)) return '';
  return token.trim();
};

export const assertAdminToken = (req: RequestLike, expectedToken: string) => {
  const incoming = getHeader(req, 'x-admin-token');
  if (!incoming || incoming !== expectedToken) {
    throw new ApiError(401, 'unauthorized_admin', 'Invalid or missing admin token.');
  }
};

export const assertWebhookSecret = (req: RequestLike, expectedSecret: string) => {
  if (!expectedSecret) return;

  const incoming = getHeader(req, 'x-webhook-secret');
  if (!incoming || incoming !== expectedSecret) {
    throw new ApiError(401, 'invalid_webhook_secret', 'Invalid webhook secret.');
  }
};

export const assertAllowedIp = (req: RequestLike, allowedIp: string) => {
  if (!allowedIp) return;

  const forwarded = getHeader(req, 'x-forwarded-for');
  if (!forwarded) {
    throw new ApiError(401, 'ip_not_allowed', 'Caller IP is not allowed.');
  }

  const firstIp = forwarded.split(',')[0]?.trim();
  if (firstIp !== allowedIp) {
    throw new ApiError(401, 'ip_not_allowed', 'Caller IP is not allowed.');
  }
};
