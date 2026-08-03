import { describe, expect, it } from 'vitest';

import {
  orderByDependency,
  orphanedDependents,
  visibleOptions,
} from './services.service.js';
import type { ServiceField } from './services.validation.js';

/*
 * The cascade rules, as pure functions.
 *
 * These three are what stops a dependent dropdown from offering an answer that
 * contradicts the one above it — the address in a state nobody selected, the
 * state in a country nobody selected. They run in the request path on every
 * order and every follow-up request, so they are tested here rather than only
 * through the DB-backed order tests: no Postgres, no seed, no fixtures.
 */

const country: ServiceField = {
  name: 'country',
  label: 'Country',
  type: 'select',
  options: [
    { value: 'us', label: 'United States' },
    { value: 'gb', label: 'United Kingdom' },
  ],
};

const state: ServiceField = {
  name: 'state',
  label: 'State',
  type: 'select',
  dependsOn: 'country',
  options: [
    { value: 'tx', label: 'Texas', when: ['us'] },
    { value: 'ca', label: 'California', when: ['us'] },
    { value: 'eng', label: 'England', when: ['gb'] },
    { value: 'other', label: 'Somewhere else' },
  ],
};

const address: ServiceField = {
  name: 'address',
  label: 'Address',
  type: 'select',
  dependsOn: 'state',
  options: [
    { value: 'tx_austin_1', label: '901 S MoPac, Austin TX', when: ['tx'] },
    { value: 'ca_sf_1', label: '535 Mission St, San Francisco CA', when: ['ca'] },
  ],
};

const asSelect = (field: ServiceField) =>
  field as Extract<ServiceField, { type: 'select' }>;

describe('visibleOptions', () => {
  it('offers nothing while the parent is unanswered', () => {
    expect(visibleOptions(asSelect(state), {})).toEqual([]);
    expect(visibleOptions(asSelect(state), { country: '  ' })).toEqual([]);
  });

  it('offers only the choices scoped to the parent answer, plus unscoped ones', () => {
    const values = visibleOptions(asSelect(state), { country: 'us' }).map(
      (option) => option.value,
    );

    expect(values).toEqual(['tx', 'ca', 'other']);
  });

  it('never leaks another branch of the tree', () => {
    const values = visibleOptions(asSelect(address), { state: 'ca' }).map(
      (option) => option.value,
    );

    // The Austin address exists on the field and is still not on offer — that
    // is the whole point of the feature.
    expect(values).toEqual(['ca_sf_1']);
  });

  it('returns the full list for an independent dropdown', () => {
    expect(visibleOptions(asSelect(country), {})).toHaveLength(2);
  });
});

describe('orderByDependency', () => {
  it('puts every parent ahead of its children, however the form was authored', () => {
    const ordered = orderByDependency([address, state, country]);
    expect(ordered.map((field) => field.name)).toEqual([
      'country',
      'state',
      'address',
    ]);
  });

  it('leaves an independent field where it was', () => {
    const notes: ServiceField = { name: 'notes', label: 'Notes', type: 'text' };
    const ordered = orderByDependency([notes, state, country]);
    expect(ordered.map((field) => field.name)).toEqual([
      'notes',
      'country',
      'state',
    ]);
  });

  it('terminates on a cycle the registry should never have stored', () => {
    const a = { ...asSelect(state), name: 'a', dependsOn: 'b' } as ServiceField;
    const b = { ...asSelect(state), name: 'b', dependsOn: 'a' } as ServiceField;

    expect(orderByDependency([a, b]).map((field) => field.name)).toHaveLength(2);
  });
});

describe('orphanedDependents', () => {
  it('finds nothing when the whole chain is present', () => {
    expect(orphanedDependents([country, state, address]).size).toBe(0);
  });

  it('drops the child and everything below it when the parent is gone', () => {
    expect([...orphanedDependents([state, address])]).toEqual([
      'state',
      'address',
    ]);
  });
});
