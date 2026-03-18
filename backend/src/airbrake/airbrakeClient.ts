import * as crypto from 'node:crypto';
import { Break } from '@portal/shared';
import { parseBreak, serializeBreak } from '../parsers/breakParser';

// ─── Encryption Helpers ───────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits (recommended for GCM)
const TAG_LENGTH = 16; // 128 bits

/**
 * Derives a 256-bit key from an arbitrary-length passphrase using SHA-256.
 * In production, use a dedicated KMS-managed key instead.
 */
function deriveKey(passphrase: string): Buffer {
  return crypto.createHash('sha256').update(passphrase).digest();
}

export interface EncryptedValue {
  iv: string;       // hex
  tag: string;      // hex
  ciphertext: string; // hex
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The passphrase is used to derive the encryption key.
 * Returns an EncryptedValue — never the plaintext.
 */
export function encryptApiKey(plaintext: string, passphrase: string): EncryptedValue {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

/**
 * Decrypts an EncryptedValue produced by encryptApiKey.
 * Returns the original plaintext string.
 */
export function decryptApiKey(encrypted: EncryptedValue, passphrase: string): string {
  const key = deriveKey(passphrase);
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// ─── Dependency Interfaces ────────────────────────────────────────────────────

export interface HttpClient {
  get(url: string, headers: Record<string, string>): Promise<unknown>;
}

export interface RedisPublisher {
  publish(channel: string, message: string): Promise<void>;
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[] = RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < delays.length) {
        await sleep(delays[attempt]);
      }
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Response Helpers ─────────────────────────────────────────────────────────

function hasGroupsArray(v: unknown): v is { groups: unknown[] } {
  return (
    v !== null &&
    typeof v === 'object' &&
    'groups' in (v as Record<string, unknown>) &&
    Array.isArray((v as Record<string, unknown>).groups)
  );
}

function extractItems(response: unknown): unknown[] {
  if (hasGroupsArray(response)) return response.groups;
  if (Array.isArray(response)) return response;
  return [];
}

// ─── AirbrakeClient Config ────────────────────────────────────────────────────

export interface AirbrakeClientConfig {
  apiKey: string;          // plaintext — encrypted immediately on construction
  projectId: string;
  pollIntervalMs: number;  // configurable per Requirement 2.6
}

// Internal passphrase used to encrypt the API key in memory.
// In production this should come from an environment variable / secrets manager.
const INTERNAL_PASSPHRASE = process.env.AIRBRAKE_KEY_PASSPHRASE ?? 'default-dev-passphrase';

// ─── AirbrakeClient ───────────────────────────────────────────────────────────

export class AirbrakeClient {
  private readonly encryptedApiKey: EncryptedValue;
  private readonly projectId: string;
  private readonly pollIntervalMs: number;
  private readonly httpClient: HttpClient;
  private readonly redisPublisher: RedisPublisher;
  private readonly breakHandlers: Array<(b: Break) => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: AirbrakeClientConfig,
    httpClient: HttpClient,
    redisPublisher: RedisPublisher,
  ) {
    // Encrypt the API key immediately — plaintext is never stored
    this.encryptedApiKey = encryptApiKey(config.apiKey, INTERNAL_PASSPHRASE);
    this.projectId = config.projectId;
    this.pollIntervalMs = config.pollIntervalMs;
    this.httpClient = httpClient;
    this.redisPublisher = redisPublisher;
  }

  /** Start polling the Airbrake API at the configured interval. */
  start(): void {
    if (this.timer !== null) return; // already running
    this.timer = setInterval(() => {
      this.poll().catch(() => {
        // errors are already logged inside poll(); prevent unhandled rejection
      });
    }, this.pollIntervalMs);
  }

  /** Stop polling. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Register a handler called for each successfully parsed Break. */
  onBreak(handler: (b: Break) => void): void {
    this.breakHandlers.push(handler);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    let rawItems: unknown[];
    try {
      rawItems = await withRetry(() => this.fetchBreaks());
    } catch (err) {
      // All 3 attempts failed — log without exposing the API key and bail
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AirbrakeClient] Failed to fetch breaks after retries:', message);
      return;
    }

    for (const item of rawItems) {
      await this.processItem(item);
    }
  }

  private async processItem(item: unknown): Promise<void> {
    const result = await parseBreak(item);
    if (!result.success) return;

    const breakRecord = result.record;

    try {
      await this.redisPublisher.publish('breaks', serializeBreak(breakRecord));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AirbrakeClient] Failed to publish break to Redis:', message);
    }

    for (const handler of this.breakHandlers) {
      try {
        handler(breakRecord);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[AirbrakeClient] Break handler threw:', message);
      }
    }
  }

  private async fetchBreaks(): Promise<unknown[]> {
    // Decrypt the key only at the moment of use — never store plaintext
    const apiKey = decryptApiKey(this.encryptedApiKey, INTERNAL_PASSPHRASE);
    const url = `https://api.airbrake.io/api/v4/projects/${this.projectId}/groups`;
    const response = await this.httpClient.get(url, {
      Authorization: `Bearer ${apiKey}`,
    });
    return extractItems(response);
  }
}
