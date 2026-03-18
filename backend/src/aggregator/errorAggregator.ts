import { randomUUID } from 'node:crypto';
import type { Break, BreakGroup, AggregationResult, BreakStatus } from '@portal/shared';
import { computeFingerprint } from './fingerprint';

// ─── Repository & Indexer Interfaces ─────────────────────────────────────────

export interface BreakGroupRepository {
  findByFingerprint(fingerprint: string): Promise<BreakGroup | null>;
  save(group: BreakGroup): Promise<BreakGroup>;
  update(group: BreakGroup): Promise<BreakGroup>;
}

export interface BreakRepository {
  save(b: Break & { groupId: string }): Promise<void>;
}

export interface SearchIndexer {
  indexBreak(b: Break & { groupId: string }): Promise<void>;
  indexBreakGroup(group: BreakGroup): Promise<void>;
}

// ─── ErrorAggregator ──────────────────────────────────────────────────────────

export interface ErrorAggregator {
  aggregate(b: Break): Promise<AggregationResult>;
}

export class DefaultErrorAggregator implements ErrorAggregator {
  constructor(
    private readonly breakGroups: BreakGroupRepository,
    private readonly breaks: BreakRepository,
    private readonly indexer: SearchIndexer,
  ) {}

  async aggregate(b: Break): Promise<AggregationResult> {
    const fingerprint = computeFingerprint(b);
    const now = b.timestamp;

    let group: BreakGroup;
    let status: BreakStatus;

    const existing = await this.breakGroups.findByFingerprint(fingerprint);

    if (existing === null) {
      // New error — no group exists yet
      group = {
        id: randomUUID(),
        fingerprint,
        applicationId: b.applicationId,
        firstOccurrence: now,
        lastOccurrence: now,
        occurrenceCount: 1,
        status: 'open',
        severity: b.severity,
        errorMessage: b.errorMessage,
      };
      group = await this.breakGroups.save(group);
      status = 'new';
    } else if (existing.status === 'resolved') {
      // Regression — previously resolved, now re-occurring
      group = {
        ...existing,
        status: 'regression',
        lastOccurrence: now,
        occurrenceCount: existing.occurrenceCount + 1,
        severity: b.severity,
      };
      group = await this.breakGroups.update(group);
      status = 'regression';
    } else {
      // Existing open or regression group — just update counters
      group = {
        ...existing,
        lastOccurrence: now,
        occurrenceCount: existing.occurrenceCount + 1,
      };
      group = await this.breakGroups.update(group);
      status = 'existing';
    }

    const breakWithGroup = { ...b, fingerprint, groupId: group.id };

    await this.breaks.save(breakWithGroup);
    await this.indexer.indexBreak(breakWithGroup);
    await this.indexer.indexBreakGroup(group);

    return { group, status };
  }
}
