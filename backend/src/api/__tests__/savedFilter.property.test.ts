// Feature: live-airbrake-monitoring-portal, Property 19: Saved Filter Round-Trip

/**
 * Validates: Requirements 8.3, 8.4
 *
 * Property 19: Saved Filter Round-Trip
 * For any valid saved filter definition, saving the filter and then loading it
 * by its identifier should return a filter with identical criteria.
 */

import * as fc from 'fast-check';
import type { SavedFilter } from '@portal/shared';
import type { SavedFilterRepository } from '../filtersRouter';

// ─── In-Memory Repository ─────────────────────────────────────────────────────

class InMemoryFilterRepository implements SavedFilterRepository {
  private store = new Map<string, SavedFilter>();
  private nextId = 1;

  async create(filter: Omit<SavedFilter, 'id'>): Promise<SavedFilter> {
    const id = String(this.nextId++);
    const saved: SavedFilter = { ...filter, id };
    this.store.set(id, saved);
    return saved;
  }

  async findById(id: string): Promise<SavedFilter | null> {
    return this.store.get(id) ?? null;
  }

  async update(id: string, patch: Partial<Omit<SavedFilter, 'id'>>): Promise<SavedFilter | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: SavedFilter = { ...existing, ...patch };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const severities = ['info', 'warning', 'error', 'critical'] as const;

const arbitraryCriteria = (): fc.Arbitrary<SavedFilter['criteria']> =>
  fc.record(
    {
      keyword: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      tags: fc.option(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
        { nil: undefined },
      ),
      severity: fc.option(
        fc.array(fc.constantFrom(...severities), { minLength: 1, maxLength: 4 }),
        { nil: undefined },
      ),
      applications: fc.option(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
        { nil: undefined },
      ),
      timeRange: fc.option(
        fc.record({
          from: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          to: fc.date({ min: new Date('2025-01-01'), max: new Date('2030-01-01') }),
        }),
        { nil: undefined },
      ),
      errorCode: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    },
    { withDeletedKeys: false },
  );

const arbitraryFilterInput = (): fc.Arbitrary<Omit<SavedFilter, 'id'>> =>
  fc.record({
    userId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    criteria: arbitraryCriteria(),
  });

// ─── Property 19: Saved Filter Round-Trip ────────────────────────────────────

describe('Property 19: Saved Filter Round-Trip', () => {
  it('create then findById returns a filter with identical criteria', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryFilterInput(), async (input) => {
        const repo = new InMemoryFilterRepository();
        const created = await repo.create(input);
        const loaded = await repo.findById(created.id);

        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe(created.id);
        expect(loaded!.criteria).toEqual(created.criteria);
        expect(loaded!.name).toBe(input.name);
        expect(loaded!.userId).toBe(input.userId);
      }),
      { numRuns: 100 },
    );
  });

  it('create then update then findById returns the updated criteria', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFilterInput(),
        arbitraryCriteria(),
        async (input, newCriteria) => {
          const repo = new InMemoryFilterRepository();
          const created = await repo.create(input);
          await repo.update(created.id, { criteria: newCriteria });
          const loaded = await repo.findById(created.id);

          expect(loaded).not.toBeNull();
          expect(loaded!.criteria).toEqual(newCriteria);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('create then delete then findById returns null', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryFilterInput(), async (input) => {
        const repo = new InMemoryFilterRepository();
        const created = await repo.create(input);
        const deleted = await repo.delete(created.id);
        const loaded = await repo.findById(created.id);

        expect(deleted).toBe(true);
        expect(loaded).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('multiple filters can be stored and retrieved independently (no cross-contamination)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryFilterInput(), { minLength: 2, maxLength: 10 }),
        async (inputs) => {
          const repo = new InMemoryFilterRepository();
          const created = await Promise.all(inputs.map((input) => repo.create(input)));

          for (let i = 0; i < created.length; i++) {
            const loaded = await repo.findById(created[i].id);
            expect(loaded).not.toBeNull();
            expect(loaded!.id).toBe(created[i].id);
            expect(loaded!.criteria).toEqual(created[i].criteria);
            expect(loaded!.name).toBe(inputs[i].name);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
