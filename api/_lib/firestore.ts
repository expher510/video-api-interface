import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { ApiError } from './errors.js';
import { ServerEnv } from './env.js';

export type KeyValidationResult = {
  userId: string;
  project: string;
  keyName: string;
  permissions: string[];
  remaining: number;
};

type ApiKeyDoc = {
  user_id: string;
  key: string;
  name: string;
  project: string;
  permissions: string[];
  daily_limit: number;
  requests_today: number;
  limit_reset_at: number;
  status: 'active' | 'revoked' | string;
  created_at: number;
};

let firestoreClient: Firestore | null = null;

const getClient = (env: ServerEnv) => {
  if (firestoreClient) return firestoreClient;

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
      }),
    });
  }

  firestoreClient = getFirestore(undefined, env.firebaseDatabaseId);
  return firestoreClient;
};

export const validateAndConsumeApiKey = async (env: ServerEnv, apiKey: string): Promise<KeyValidationResult> => {
  const db = getClient(env);
  const querySnapshot = await db.collection('api_keys').where('key', '==', apiKey).limit(1).get();

  if (querySnapshot.empty) {
    throw new ApiError(401, 'api_key_not_found', 'API key was not found.');
  }

  const docRef = querySnapshot.docs[0].ref;

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const data = snapshot.data() as ApiKeyDoc | undefined;

    if (!data) {
      throw new ApiError(401, 'api_key_not_found', 'API key was not found.');
    }

    if (data.status === 'revoked') {
      throw new ApiError(403, 'api_key_revoked', 'API key has been revoked.');
    }

    if (data.status !== 'active') {
      throw new ApiError(403, 'api_key_inactive', `API key is ${data.status}.`);
    }

    const now = Date.now();
    const currentLimit = Number(data.daily_limit ?? 0);
    let requestsToday = Number(data.requests_today ?? 0);
    let nextResetAt = Number(data.limit_reset_at ?? 0);

    const shouldReset = !nextResetAt || now >= nextResetAt;
    if (shouldReset) {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0);
      nextResetAt = nextMidnight.getTime();
      requestsToday = 0;
      transaction.update(docRef, {
        requests_today: 0,
        limit_reset_at: nextResetAt,
      });
    }

    if (currentLimit > 0 && requestsToday >= currentLimit) {
      throw new ApiError(429, 'daily_limit_exceeded', `Daily request limit of ${currentLimit} has been reached.`);
    }

    transaction.update(docRef, {
      requests_today: FieldValue.increment(1),
    });

    const remaining = currentLimit > 0 ? Math.max(0, currentLimit - (requestsToday + 1)) : -1;

    return {
      userId: String(data.user_id ?? ''),
      project: String(data.project ?? ''),
      keyName: String(data.name ?? ''),
      permissions: Array.isArray(data.permissions) ? data.permissions.map((item) => String(item)) : [],
      remaining,
    } satisfies KeyValidationResult;
  });

  return result;
};
