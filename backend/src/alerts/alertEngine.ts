import type { AlertRule, AlertEvent, Break, NotificationChannel, BreakStatus } from '@portal/shared';

// ─── Repository & Dispatcher Interfaces ──────────────────────────────────────

export interface BreakCountRepository {
  countBreaksInWindow(windowSeconds: number): Promise<number>;
}

export interface NotificationDispatcher {
  send(channel: NotificationChannel, event: AlertEvent): Promise<void>;
}

export interface AlertNotificationRepository {
  markFailed(ruleId: string, event: AlertEvent): Promise<void>;
}

// ─── Delay helper (injectable for testing) ───────────────────────────────────

export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── AlertEngine ──────────────────────────────────────────────────────────────

export class AlertEngine {
  private readonly delay: DelayFn;

  constructor(
    private readonly breakCountRepo: BreakCountRepository,
    private readonly dispatcher: NotificationDispatcher,
    private readonly alertNotificationRepo: AlertNotificationRepository,
    delay?: DelayFn,
  ) {
    this.delay = delay ?? defaultDelay;
  }

  /**
   * Evaluate all active alert rules. For each enabled rule:
   * - Count breaks in the rolling window; dispatch if count >= threshold
   * - If a newBreak is provided with status 'new' and rule.triggerOnNewError is true, dispatch
   */
  async evaluate(rules: AlertRule[], newBreak?: Break, breakStatus?: BreakStatus): Promise<void> {
    for (const rule of rules) {
      if (!rule.enabled) continue;

      const count = await this.breakCountRepo.countBreaksInWindow(rule.windowSeconds);

      const thresholdMet = count >= rule.threshold;
      const newErrorTrigger =
        rule.triggerOnNewError &&
        newBreak !== undefined &&
        breakStatus === 'new';

      if (thresholdMet || newErrorTrigger) {
        const event: AlertEvent = {
          ruleId: rule.id,
          triggeredAt: new Date(),
          breakCount: count,
          newBreak: newBreak,
        };
        await this.dispatch(rule, event);
      }
    }
  }

  /**
   * Dispatch an alert event to all channels configured on the rule.
   * Retries up to 3 attempts with exponential backoff (1s, 2s, 4s).
   * Marks as failed after exhaustion.
   */
  async dispatch(rule: AlertRule, event: AlertEvent): Promise<void> {
    const backoffDelays = [1000, 2000, 4000];

    for (const channel of rule.channels) {
      let lastError: unknown;
      let succeeded = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.dispatcher.send(channel, event);
          succeeded = true;
          break;
        } catch (err) {
          lastError = err;
          if (attempt < 2) {
            await this.delay(backoffDelays[attempt]);
          }
        }
      }

      if (!succeeded) {
        await this.alertNotificationRepo.markFailed(rule.id, event);
      }
    }
  }
}
