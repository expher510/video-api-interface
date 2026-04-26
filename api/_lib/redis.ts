import { ApiError } from './errors.js';

type RedisCommandResult = {
  result: unknown;
  error?: string;
};

const runRedisCommand = async (redisRestUrl: string, redisRestToken: string, command: unknown[]) => {
  const response = await fetch(redisRestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisRestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new ApiError(502, 'redis_http_error', `Redis HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as RedisCommandResult;
  if (data.error) {
    throw new ApiError(502, 'redis_command_error', data.error);
  }

  return data.result;
};

export const setRedisValue = async (
  redisRestUrl: string,
  redisRestToken: string,
  key: string,
  value: string,
  ttlSeconds?: number,
) => {
  if (ttlSeconds && ttlSeconds > 0) {
    await runRedisCommand(redisRestUrl, redisRestToken, ['SET', key, value, 'EX', String(ttlSeconds)]);
    return;
  }

  await runRedisCommand(redisRestUrl, redisRestToken, ['SET', key, value]);
};

export const getRedisValue = async (redisRestUrl: string, redisRestToken: string, key: string) => {
  const result = await runRedisCommand(redisRestUrl, redisRestToken, ['GET', key]);
  if (result == null) return '';
  return String(result);
};
