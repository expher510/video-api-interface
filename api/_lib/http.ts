import { ApiError, isApiError } from './errors.js';

export type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

export const sendJson = (res: ResponseLike, statusCode: number, payload: unknown) => {
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.status(statusCode).json(payload);
};

export const getHeader = (req: RequestLike, headerName: string) => {
  const value = req.headers?.[headerName] ?? req.headers?.[headerName.toLowerCase()] ?? req.headers?.[headerName.toUpperCase()];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

export const requireMethod = (req: RequestLike, expected: string) => {
  if ((req.method ?? '').toUpperCase() !== expected.toUpperCase()) {
    throw new ApiError(405, 'method_not_allowed', `Method ${req.method ?? 'unknown'} is not allowed.`);
  }
};

export const parseJsonBody = <T>(req: RequestLike): T => {
  if (!req.body) return {} as T;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      throw new ApiError(400, 'invalid_json', 'Request body is not valid JSON.');
    }
  }
  return req.body as T;
};

export const withErrorHandling = async (res: ResponseLike, action: () => Promise<void>) => {
  try {
    await action();
  } catch (error: unknown) {
    if (isApiError(error)) {
      sendJson(res, error.statusCode, {
        success: false,
        code: error.errorCode,
        message: error.message,
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes('Missing environment variables:')) {
        sendJson(res, 500, {
          success: false,
          code: 'misconfigured_server',
          message: error.message,
        });
        return;
      }

      if (error.message.includes('permission-denied')) {
        sendJson(res, 500, {
          success: false,
          code: 'firebase_permission_denied',
          message: 'Server could not access Firestore. Check Firebase service account permissions.',
        });
        return;
      }
    }

    sendJson(res, 500, {
      success: false,
      code: 'internal_error',
      message: error instanceof Error ? error.message : 'Unexpected server error.',
    });
  }
};
