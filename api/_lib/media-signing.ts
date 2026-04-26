import { createHmac, timingSafeEqual } from 'node:crypto';

export type MediaAssetType = 'video' | 'image';

type SignatureInput = {
  jobId: string;
  type: MediaAssetType;
  index: number;
  expiresAt: number;
};

const canonicalPayload = ({ jobId, type, index, expiresAt }: SignatureInput) => `${jobId}:${type}:${index}:${expiresAt}`;

export const createMediaSignature = (secret: string, input: SignatureInput) =>
  createHmac('sha256', secret).update(canonicalPayload(input)).digest('hex');

export const verifyMediaSignature = (secret: string, input: SignatureInput, signature: string) => {
  const expected = createMediaSignature(secret, input);
  const provided = signature.trim().toLowerCase();
  if (expected.length !== provided.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  } catch {
    return false;
  }
};

