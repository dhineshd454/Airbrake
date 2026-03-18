import * as fc from 'fast-check';
import { randomUUID } from 'node:crypto';
import { AlertEngine } from '../alertEngine';
import type {
  BreakCountRepository,
  NotificationDispatcher,
  AlertNotificationRepository,
  DelayFn,
} from '../alertEngine';
import type { AlertRule, Break, NotificationChannel } from '@portal/shared';

// Feature: live-airbrake-monitoring-portal, Property 13: Alert Threshold Triggering
// Feature: live-airbrake-monitoring-portal, Property 14: New Error Alert Triggering

// ─── Helpers ──────────────────────────────────────────────────────────────────

const noopDelay: DelayFn = () => Promise.resolve();

function makeBreakCountRepo(count: number): BreakCountRepository {
  return { countBreaksInWindow: jest.fn().mockResolvedValue(count) };
}

function makeDispatcher(): { dispatcher: NotificationDispatcher } {
  const dispatcher: NotificationDispatcher = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  return { dispatcher };
}

function makeAlertNotificationRepo(): AlertNotificationRepository {
  return { markFailed: jest.fn().mockResolvedValue(undefined) };
}

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: randomUUID(),
    name: 'Test Rule',
    threshold: 5,
    windowSeconds: 300,
    triggerOnNewError: false,
    channels: [{ type: 'email', address: 'ops@example.com' }],
    createdBy: 'user-1',
    enabled: true,
    ...overrides,
  };
}

function makeBreak(overrides: Partial<Break> = {}): Break {
  return {
    id: randomUUID(),
    applicationId: 'app-123',
    environment: 'production',
    severity: 'error',
    errorMessage: 'TypeError: Cannot read property of undefined',
    stackTrace: 'at Object.<anonymous> (app.js:10:5)',
    endpoint: '/api/users',
    requestPayload: null,
    userSession: null,
    timestamp: new Date(),
    fingerprint: 'abc123',
    ...overrides,
  };
}

/** Arbitrary for a threshold T in [1, 100] */
const arbThreshold = fc.integer({ min: 1, max: 100 });

/** Arbitrary for a single NotificationChannel */
const arbChannel: fc.Arbitrary<NotificationChannel> = fc.oneof(
  fc.record({ type: fc.constant('email' as const), address: fc.emailAddress() }),
  fc.record({ type: fc.constant('slack' as const), webhookUrl: fc.webUrl() }),
  fc.record({ type: fc.constant('webhook' as const), url: fc.webUrl() }),
);

/** Arbitrary for a non-empty array of channels (1–3) */
const arbChannels = fc.array(arbChannel, { minLength: 1, maxLength: 3 });

// ─── Property 13: Alert Threshold Triggering ─────────────────────────────────

/**
 * Validates: Requirements 5.1, 5.2
 *
 * For any alert rule with threshold T and window W:
 * - If break count >= T, dispatch is called for all channels.
 * - If break count < T, dispatch is NOT called.
 */
describe('Property 13: Alert Threshold Triggering', () => {
  // Feature: live-airbrake-monitoring-portal, Property 13: Alert Threshold Triggering

  it('count >= threshold → dispatch called for all channels', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbThreshold,
        arbChannels,
        fc.integer({ min: 0, max: 200 }),
        async (threshold, channels, extra) => {
          const count = threshold + extra; // count >= threshold always
          const { dispatcher } = makeDispatcher();
          const engine = new AlertEngine(
            makeBreakCountRepo(count),
            dispatcher,
            makeAlertNotificationRepo(),
            noopDelay,
          );
          const rule = makeRule({ threshold, channels, triggerOnNewError: false });

          await engine.evaluate([rule]);

          expect((dispatcher.send as jest.Mock).mock.calls.length).toBe(channels.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('count < threshold → dispatch NOT called', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 100 }), // threshold >= 2 so count can be threshold-1 >= 1
        arbChannels,
        async (threshold, channels) => {
          const count = threshold - 1; // count < threshold always
          const { dispatcher } = makeDispatcher();
          const engine = new AlertEngine(
            makeBreakCountRepo(count),
            dispatcher,
            makeAlertNotificationRepo(),
            noopDelay,
          );
          const rule = makeRule({ threshold, channels, triggerOnNewError: false });

          await engine.evaluate([rule]);

          expect((dispatcher.send as jest.Mock).mock.calls.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 14: New Error Alert Triggering ─────────────────────────────────

/**
 * Validates: Requirements 5.3
 *
 * For any alert rule with triggerOnNewError=true:
 * - A Break classified as 'new' → dispatch is called.
 * - A Break classified as 'existing' → dispatch is NOT called.
 * - For any rule with triggerOnNewError=false and a 'new' break (count < threshold) → dispatch is NOT called.
 */
describe('Property 14: New Error Alert Triggering', () => {
  // Feature: live-airbrake-monitoring-portal, Property 14: New Error Alert Triggering

  it('triggerOnNewError=true + new break → dispatch called', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbChannels,
        async (channels) => {
          // Use a very high threshold so count-based trigger won't fire
          const { dispatcher } = makeDispatcher();
          const engine = new AlertEngine(
            makeBreakCountRepo(0),
            dispatcher,
            makeAlertNotificationRepo(),
            noopDelay,
          );
          const rule = makeRule({ threshold: 1000, channels, triggerOnNewError: true });
          const newBreak = makeBreak();

          await engine.evaluate([rule], newBreak, 'new');

          expect((dispatcher.send as jest.Mock).mock.calls.length).toBe(channels.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('triggerOnNewError=true + existing break → dispatch NOT called', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbChannels,
        async (channels) => {
          const { dispatcher } = makeDispatcher();
          const engine = new AlertEngine(
            makeBreakCountRepo(0),
            dispatcher,
            makeAlertNotificationRepo(),
            noopDelay,
          );
          const rule = makeRule({ threshold: 1000, channels, triggerOnNewError: true });
          const existingBreak = makeBreak();

          await engine.evaluate([rule], existingBreak, 'existing');

          expect((dispatcher.send as jest.Mock).mock.calls.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('triggerOnNewError=false + new break (count < threshold) → dispatch NOT called', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 100 }),
        arbChannels,
        async (threshold, channels) => {
          const count = threshold - 1; // below threshold
          const { dispatcher } = makeDispatcher();
          const engine = new AlertEngine(
            makeBreakCountRepo(count),
            dispatcher,
            makeAlertNotificationRepo(),
            noopDelay,
          );
          const rule = makeRule({ threshold, channels, triggerOnNewError: false });
          const newBreak = makeBreak();

          await engine.evaluate([rule], newBreak, 'new');

          expect((dispatcher.send as jest.Mock).mock.calls.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
