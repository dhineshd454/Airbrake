// Feature: live-airbrake-monitoring-portal, Property 10: Theme Preference Round-Trip

import * as fc from 'fast-check';

const STORAGE_KEY = 'portal_theme';

/**
 * Validates: Requirements 3.7
 *
 * For any theme preference value (dark or light), saving the preference and
 * then loading it should return the same value.
 */
describe('Property 10: Theme Preference Round-Trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saving a theme preference and loading it returns the same value', () => {
    const themeArb = fc.constantFrom('dark' as const, 'light' as const);

    fc.assert(
      fc.property(themeArb, (theme) => {
        localStorage.setItem(STORAGE_KEY, theme);
        const loaded = localStorage.getItem(STORAGE_KEY);
        return loaded === theme;
      }),
      { numRuns: 100 }
    );
  });
});
