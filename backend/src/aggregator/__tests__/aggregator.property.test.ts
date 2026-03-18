import * as fc from 'fast-check';
import { randomUUID } from 'node:crypto';
import { computeFingerprint } from '../fingerprint';
import { DefaultErrorAggregator } from '../errorAggregator';
import type { Break, BreakGroup } from '@portal/shared';
import type { BreakGroupRepository, BreakRepository, SearchIndexer } from '../errorAggregator';

// Feature: live-airbrake-monitoring-portal, Property 4: Fingerprint Grouping

/**
 * Validates: Requirements 2.2
 *
 * For any two Break records sharing the same fingerprint, the Error Aggregator
 * should assign them to the same BreakGroup, and for any two Break records with
 * different fingerprints, they should be assigned to different groups.
 */

const validSeverities = ['info', 'warning', 'error', 'critical'] as const;

/** Arbitrary for the three fields that determine the fingerprint. */
const arbitraryFingerprintFields = () =>
  fc.record({
    errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
    stackTrace: fc.string({ minLength: 1, maxLength: 1000 }),
    applicationId: fc.uuid(),
  });

/** Builds a minimal Break record from given fingerprint fields plus extras. */
function makeBreak(
  fields: { errorMessage: string; stackTrace: string; applicationId: string },
  overrides: Partial<Break> = {},
): Break {
  return {
    id: randomUUID(),
    applicationId: fields.applicationId,
    environment: 'production',
    severity: 'error',
    errorMessage: fields.errorMessage,
    stackTrace: fields.stackTrace,
    endpoint: null,
    requestPayload: null,
    userSession: null,
    timestamp: new Date(),
    fingerprint: '',
    ...overrides,
  };
}

// ─── In-memory stubs ──────────────────────────────────────────────────────────

function makeInMemoryRepos(): {
  breakGroupRepo: BreakGroupRepository;
  breakRepo: BreakRepository;
  indexer: SearchIndexer;
  savedGroups: Map<string, BreakGroup>;
} {
  const savedGroups = new Map<string, BreakGroup>();

  const breakGroupRepo: BreakGroupRepository = {
    async findByFingerprint(fingerprint) {
      return savedGroups.get(fingerprint) ?? null;
    },
    async save(group) {
      savedGroups.set(group.fingerprint, group);
      return group;
    },
    async update(group) {
      savedGroups.set(group.fingerprint, group);
      return group;
    },
  };

  const breakRepo: BreakRepository = {
    async save() {},
  };

  const indexer: SearchIndexer = {
    async indexBreak() {},
    async indexBreakGroup() {},
  };

  return { breakGroupRepo, breakRepo, indexer, savedGroups };
}

// ─── Property 4: Fingerprint Grouping ────────────────────────────────────────

describe('Property 4: Fingerprint Grouping', () => {
  // Feature: live-airbrake-monitoring-portal, Property 4: Fingerprint Grouping

  it('same (errorMessage, stackTrace, applicationId) → same fingerprint', () => {
    fc.assert(
      fc.property(arbitraryFingerprintFields(), (fields) => {
        const fp1 = computeFingerprint(fields);
        const fp2 = computeFingerprint({ ...fields });
        expect(fp1).toBe(fp2);
      }),
      { numRuns: 100 },
    );
  });

  it('different inputs → different fingerprints (with high probability)', () => {
    fc.assert(
      fc.property(
        arbitraryFingerprintFields(),
        arbitraryFingerprintFields(),
        (fieldsA, fieldsB) => {
          // Only assert when the inputs are actually different
          const inputsAreSame =
            fieldsA.errorMessage === fieldsB.errorMessage &&
            fieldsA.stackTrace === fieldsB.stackTrace &&
            fieldsA.applicationId === fieldsB.applicationId;

          if (!inputsAreSame) {
            const fpA = computeFingerprint(fieldsA);
            const fpB = computeFingerprint(fieldsB);
            expect(fpA).not.toBe(fpB);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('two breaks with same fingerprint-producing fields → same group id via DefaultErrorAggregator', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryFingerprintFields(), async (fields) => {
        const { breakGroupRepo, breakRepo, indexer } = makeInMemoryRepos();
        const aggregator = new DefaultErrorAggregator(breakGroupRepo, breakRepo, indexer);

        const breakA = makeBreak(fields);
        const breakB = makeBreak(fields);

        const resultA = await aggregator.aggregate(breakA);
        const resultB = await aggregator.aggregate(breakB);

        // Both breaks share the same fingerprint fields → same group
        expect(resultA.group.id).toBe(resultB.group.id);
        expect(resultA.group.fingerprint).toBe(resultB.group.fingerprint);
      }),
      { numRuns: 100 },
    );
  });

  it('two breaks with different fingerprint-producing fields → different group ids via DefaultErrorAggregator', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFingerprintFields(),
        arbitraryFingerprintFields(),
        async (fieldsA, fieldsB) => {
          const inputsAreSame =
            fieldsA.errorMessage === fieldsB.errorMessage &&
            fieldsA.stackTrace === fieldsB.stackTrace &&
            fieldsA.applicationId === fieldsB.applicationId;

          if (inputsAreSame) return; // skip identical inputs

          const { breakGroupRepo, breakRepo, indexer } = makeInMemoryRepos();
          const aggregator = new DefaultErrorAggregator(breakGroupRepo, breakRepo, indexer);

          const breakA = makeBreak(fieldsA);
          const breakB = makeBreak(fieldsB);

          const resultA = await aggregator.aggregate(breakA);
          const resultB = await aggregator.aggregate(breakB);

          // Different fingerprint fields → different groups
          expect(resultA.group.id).not.toBe(resultB.group.id);
          expect(resultA.group.fingerprint).not.toBe(resultB.group.fingerprint);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: New Error Classification ────────────────────────────────────

describe('Property 5: New Error Classification', () => {
  // Feature: live-airbrake-monitoring-portal, Property 5: New Error Classification

  /**
   * Validates: Requirements 2.3
   *
   * For any Break whose fingerprint does not exist in the current set of
   * BreakGroups, the Error Aggregator should classify it as "new" and the
   * resulting group should carry the "New" label (status='open').
   */
  it('break with no existing group → status=new and group.status=open', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
          stackTrace: fc.string({ minLength: 1, maxLength: 1000 }),
          applicationId: fc.uuid(),
          environment: fc.constantFrom<string>('production', 'qa', 'development'),
          severity: fc.constantFrom<Break['severity']>('info', 'warning', 'error', 'critical'),
        }),
        async (fields) => {
          // Start with an empty group store — no pre-existing BreakGroups
          const { breakGroupRepo, breakRepo, indexer } = makeInMemoryRepos();
          const aggregator = new DefaultErrorAggregator(breakGroupRepo, breakRepo, indexer);

          const b = makeBreak(
            {
              errorMessage: fields.errorMessage,
              stackTrace: fields.stackTrace,
              applicationId: fields.applicationId,
            },
            {
              environment: fields.environment,
              severity: fields.severity,
            },
          );

          const result = await aggregator.aggregate(b);

          // Classification must be 'new'
          expect(result.status).toBe('new');
          // The created group must be 'open'
          expect(result.group.status).toBe('open');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 6: Regression Classification ───────────────────────────────────

describe('Property 6: Regression Classification', () => {
  // Feature: live-airbrake-monitoring-portal, Property 6: Regression Classification

  /**
   * Validates: Requirements 2.4
   *
   * For any BreakGroup in "resolved" status, receiving a new Break with the
   * same fingerprint should transition the group to "regression" status.
   */
  it('resolved group + new break with same fingerprint → status=regression and group.status=regression', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
          stackTrace: fc.string({ minLength: 1, maxLength: 1000 }),
          applicationId: fc.uuid(),
          environment: fc.constantFrom<string>('production', 'qa', 'development'),
          severity: fc.constantFrom<Break['severity']>('info', 'warning', 'error', 'critical'),
        }),
        async (fields) => {
          const { breakGroupRepo, breakRepo, indexer, savedGroups } = makeInMemoryRepos();
          const aggregator = new DefaultErrorAggregator(breakGroupRepo, breakRepo, indexer);

          // Compute the fingerprint for these fields so we can pre-seed the store
          const fingerprint = computeFingerprint({
            errorMessage: fields.errorMessage,
            stackTrace: fields.stackTrace,
            applicationId: fields.applicationId,
          });

          // Pre-seed the in-memory store with a resolved BreakGroup for this fingerprint
          const resolvedGroup: BreakGroup = {
            id: randomUUID(),
            fingerprint,
            applicationId: fields.applicationId,
            firstOccurrence: new Date(Date.now() - 10_000),
            lastOccurrence: new Date(Date.now() - 5_000),
            occurrenceCount: 3,
            status: 'resolved',
            severity: fields.severity,
            errorMessage: fields.errorMessage,
          };
          savedGroups.set(fingerprint, resolvedGroup);

          // Aggregate a new Break with the same fingerprint-producing fields
          const newBreak = makeBreak(
            {
              errorMessage: fields.errorMessage,
              stackTrace: fields.stackTrace,
              applicationId: fields.applicationId,
            },
            {
              environment: fields.environment,
              severity: fields.severity,
            },
          );

          const result = await aggregator.aggregate(newBreak);

          // The aggregation result status must be 'regression'
          expect(result.status).toBe('regression');
          // The group itself must also carry 'regression' status
          expect(result.group.status).toBe('regression');
        },
      ),
      { numRuns: 100 },
    );
  });
});
