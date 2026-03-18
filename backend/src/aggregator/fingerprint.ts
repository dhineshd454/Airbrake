import { createHash } from 'crypto';
import type { Break } from '@portal/shared';

/**
 * Computes a deterministic SHA-256 fingerprint for a Break record.
 * The fingerprint is derived from errorMessage, stackTrace, and applicationId.
 */
export function computeFingerprint(
  b: Pick<Break, 'errorMessage' | 'stackTrace' | 'applicationId'>
): string {
  return createHash('sha256')
    .update(b.errorMessage)
    .update(b.stackTrace)
    .update(b.applicationId)
    .digest('hex');
}
