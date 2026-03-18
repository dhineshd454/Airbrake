import type { RetentionPolicy } from '@portal/shared';

// ─── Repository Interfaces ────────────────────────────────────────────────────

export interface PurgeRepository {
  deleteLogsBefore(cutoff: Date): Promise<number>;
  deleteBreaksBefore(cutoff: Date): Promise<number>;
}

export interface RetentionPolicyReader {
  findAll(): Promise<RetentionPolicy[]>;
}

// ─── Timer helper (injectable for testing) ───────────────────────────────────

export type SetIntervalFn = (callback: () => void, ms: number) => NodeJS.Timeout;

const defaultSetInterval: SetIntervalFn = (callback, ms) => setInterval(callback, ms);

// ─── PurgeJob ─────────────────────────────────────────────────────────────────

export class PurgeJob {
  private readonly setIntervalFn: SetIntervalFn;

  constructor(
    private readonly purgeRepo: PurgeRepository,
    private readonly policyReader: RetentionPolicyReader,
    setIntervalFn?: SetIntervalFn,
  ) {
    this.setIntervalFn = setIntervalFn ?? defaultSetInterval;
  }

  /**
   * Run the purge for all retention policies.
   * For each policy, computes cutoff = now - retentionDays, then deletes
   * logs and breaks older than that cutoff. Returns total counts deleted.
   */
  async run(now: Date = new Date()): Promise<{ logsDeleted: number; breaksDeleted: number }> {
    const policies = await this.policyReader.findAll();

    let logsDeleted = 0;
    let breaksDeleted = 0;

    for (const policy of policies) {
      const cutoff = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);

      const logs = await this.purgeRepo.deleteLogsBefore(cutoff);
      const breaks = await this.purgeRepo.deleteBreaksBefore(cutoff);

      console.log(
        `[PurgeJob] app=${policy.applicationId} retentionDays=${policy.retentionDays} ` +
        `logsDeleted=${logs} breaksDeleted=${breaks}`,
      );

      logsDeleted += logs;
      breaksDeleted += breaks;
    }

    return { logsDeleted, breaksDeleted };
  }

  /**
   * Schedule the purge job to run on a recurring interval.
   * @param intervalMs - interval in milliseconds (e.g. 86_400_000 for daily)
   */
  schedule(intervalMs: number): void {
    this.setIntervalFn(() => {
      this.run().catch((err) => {
        console.error('[PurgeJob] scheduled run failed:', err);
      });
    }, intervalMs);
  }
}
