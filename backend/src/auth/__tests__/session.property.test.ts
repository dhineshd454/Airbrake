/**
 * Property-based tests for session expiry redirect behaviour
 * Feature: live-airbrake-monitoring-portal, Property 18: Session Expiry Preserves Redirect URL
 *
 * Validates: Requirements 7.4
 */

// Feature: live-airbrake-monitoring-portal, Property 18: Session Expiry Preserves Redirect URL

import * as fc from 'fast-check';
import { buildAuthRedirectUrl } from '../oauthHandler';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/**
 * Generates realistic URL paths that a user might be visiting when their
 * session expires (e.g. /breaks, /logs/123, /dashboard?tab=errors).
 */
const urlPath = fc.oneof(
  // Simple paths
  fc.constantFrom('/breaks', '/logs', '/dashboard', '/alerts', '/filters', '/users', '/retention'),
  // Paths with numeric segments
  fc.integer({ min: 1, max: 9999 }).map((id) => `/logs/${id}`),
  fc.integer({ min: 1, max: 9999 }).map((id) => `/breaks/${id}`),
  // Paths with query params
  fc.constantFrom(
    '/dashboard?tab=errors',
    '/logs?severity=critical',
    '/breaks?status=open',
    '/logs/123?highlight=true',
  ),
);

const oauthBaseUrl = fc.constantFrom(
  'https://auth.example.com/oauth/authorize',
  'https://sso.corp.internal/authorize',
  'https://accounts.google.com/o/oauth2/auth',
  'https://auth.example.com/oauth/authorize?client_id=portal&response_type=code',
);

// ─── Property 18: Session Expiry Preserves Redirect URL ──────────────────────

/**
 * Validates: Requirements 7.4
 */
describe('Property 18: Session Expiry Preserves Redirect URL', () => {
  it('the redirect URL always contains the original URL as redirect_uri', () => {
    fc.assert(
      fc.property(urlPath, oauthBaseUrl, (originalUrl, baseUrl) => {
        const result = buildAuthRedirectUrl(originalUrl, baseUrl);

        // The result must be a valid URL
        const parsed = new URL(result);

        // redirect_uri must be present
        const redirectUri = parsed.searchParams.get('redirect_uri');
        expect(redirectUri).not.toBeNull();

        // The decoded redirect_uri must equal the original URL
        expect(redirectUri).toBe(originalUrl);
      }),
      { numRuns: 100 },
    );
  });

  it('the redirect_uri is never lost or corrupted regardless of special characters in the path', () => {
    // Paths with characters that require URL encoding
    const encodedPaths = fc.constantFrom(
      '/logs?q=error message',
      '/breaks?filter=type:critical',
      '/dashboard?search=foo&bar=baz',
      '/logs/abc+def',
    );

    fc.assert(
      fc.property(encodedPaths, oauthBaseUrl, (originalUrl, baseUrl) => {
        const result = buildAuthRedirectUrl(originalUrl, baseUrl);
        const parsed = new URL(result);

        const redirectUri = parsed.searchParams.get('redirect_uri');
        expect(redirectUri).not.toBeNull();
        expect(redirectUri).toBe(originalUrl);
      }),
      { numRuns: 100 },
    );
  });

  it('the OAuth base URL host and path are preserved after appending redirect_uri', () => {
    fc.assert(
      fc.property(urlPath, oauthBaseUrl, (originalUrl, baseUrl) => {
        const base = new URL(baseUrl);
        const result = buildAuthRedirectUrl(originalUrl, baseUrl);
        const parsed = new URL(result);

        // Host must be unchanged
        expect(parsed.host).toBe(base.host);
        // Pathname must be unchanged
        expect(parsed.pathname).toBe(base.pathname);
      }),
      { numRuns: 100 },
    );
  });

  it('existing query parameters on the OAuth base URL are not dropped', () => {
    // Base URLs that already carry query params (e.g. client_id, response_type)
    const baseWithParams = fc.constantFrom(
      'https://auth.example.com/oauth/authorize?client_id=portal&response_type=code',
      'https://auth.example.com/oauth/authorize?scope=openid+email',
    );

    fc.assert(
      fc.property(urlPath, baseWithParams, (originalUrl, baseUrl) => {
        const base = new URL(baseUrl);
        const result = buildAuthRedirectUrl(originalUrl, baseUrl);
        const parsed = new URL(result);

        // Every original param must still be present
        base.searchParams.forEach((value, key) => {
          expect(parsed.searchParams.get(key)).toBe(value);
        });

        // redirect_uri must also be present
        expect(parsed.searchParams.get('redirect_uri')).toBe(originalUrl);
      }),
      { numRuns: 100 },
    );
  });
});
