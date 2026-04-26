import { ApiError } from './errors.js';

export type ServerEnv = {
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  firebaseDatabaseId: string;
  githubRepo: string;
  githubToken: string;
  githubEventType: string;
  redisRestUrl: string;
  redisRestToken: string;
  adminApiToken: string;
  receivedVideoSecret: string;
  receivedVideoAllowedIp: string;
  pollBaseUrl: string;
};

const read = (name: string, fallback = '') => (process.env[name] ?? fallback).trim();

export const getServerEnv = (): ServerEnv => ({
  firebaseProjectId: read('FIREBASE_PROJECT_ID'),
  firebaseClientEmail: read('FIREBASE_CLIENT_EMAIL'),
  firebasePrivateKey: read('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  firebaseDatabaseId: read('FIREBASE_DATABASE_ID', '(default)'),
  githubRepo: read('GITHUB_REPO'),
  githubToken: read('GITHUB_TOKEN'),
  githubEventType: read('GITHUB_EVENT_TYPE', 'generate_video'),
  redisRestUrl: read('REDIS_REST_URL') || read('UPSTASH_REDIS_REST_URL'),
  redisRestToken: read('REDIS_REST_TOKEN') || read('UPSTASH_REDIS_REST_TOKEN'),
  adminApiToken: read('ADMIN_API_TOKEN'),
  receivedVideoSecret: read('RECEIVED_VIDEO_SECRET'),
  receivedVideoAllowedIp: read('RECEIVED_VIDEO_ALLOWED_IP'),
  pollBaseUrl: read('PUBLIC_API_BASE_URL'),
});

export const assertEnvFields = (env: ServerEnv, keys: Array<keyof ServerEnv>) => {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new ApiError(500, 'misconfigured_server', `Missing environment variables: ${missing.join(', ')}`);
  }
};
