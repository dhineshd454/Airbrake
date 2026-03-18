import { computeFingerprint } from '../fingerprint';

const base = {
  errorMessage: 'TypeError: Cannot read property of undefined',
  stackTrace: 'at Object.<anonymous> (app.js:10:5)',
  applicationId: 'app-123',
};

describe('computeFingerprint', () => {
  it('returns a 64-character hex string', () => {
    const fp = computeFingerprint(base);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same inputs produce the same fingerprint', () => {
    expect(computeFingerprint(base)).toBe(computeFingerprint({ ...base }));
  });

  it('differs when errorMessage changes', () => {
    const fp1 = computeFingerprint(base);
    const fp2 = computeFingerprint({ ...base, errorMessage: 'ReferenceError: x is not defined' });
    expect(fp1).not.toBe(fp2);
  });

  it('differs when stackTrace changes', () => {
    const fp1 = computeFingerprint(base);
    const fp2 = computeFingerprint({ ...base, stackTrace: 'at foo (bar.js:1:1)' });
    expect(fp1).not.toBe(fp2);
  });

  it('differs when applicationId changes', () => {
    const fp1 = computeFingerprint(base);
    const fp2 = computeFingerprint({ ...base, applicationId: 'app-456' });
    expect(fp1).not.toBe(fp2);
  });

  it('handles empty strings without throwing', () => {
    const fp = computeFingerprint({ errorMessage: '', stackTrace: '', applicationId: '' });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
