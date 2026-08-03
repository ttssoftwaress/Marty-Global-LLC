import { describe, expect, it } from 'vitest';

import {
  parseGroupedOptions,
  serializeGroupedOptions,
} from './field-registry';

/*
 * The grouped-choices textarea — how an admin authors a conditional dropdown.
 *
 * It is the only place the `[parent answer]` syntax is understood, and a
 * mis-parse is invisible on the admin's side: the field saves, and the customer
 * gets a dropdown that never fills in. The round trip matters as much as the
 * parse, because editing a saved field re-renders the text from the stored
 * choices and a lossy writer would quietly rewrite the tree.
 */

describe('parseGroupedOptions', () => {
  it('scopes each choice to the header above it', () => {
    expect(
      parseGroupedOptions('[us]\ntx|Texas\nca|California\n\n[gb]\neng|England'),
    ).toEqual([
      { value: 'tx', label: 'Texas', when: ['us'] },
      { value: 'ca', label: 'California', when: ['us'] },
      { value: 'eng', label: 'England', when: ['gb'] },
    ]);
  });

  it('leaves choices written before any header unscoped', () => {
    expect(parseGroupedOptions('Other\n\n[us]\ntx|Texas')).toEqual([
      { value: 'other', label: 'Other' },
      { value: 'tx', label: 'Texas', when: ['us'] },
    ]);
  });

  it('merges one choice listed under two headers into a single row', () => {
    // A dropdown can only ever store one value, so two rows would silently
    // shadow each other — this is "offered under both", not a duplicate.
    expect(parseGroupedOptions('[us]\nremote|Remote\n\n[gb]\nremote|Remote')).toEqual([
      { value: 'remote', label: 'Remote', when: ['us', 'gb'] },
    ]);
  });

  it('parses an ungrouped list exactly as a plain dropdown would', () => {
    expect(parseGroupedOptions('Delaware\nWyoming')).toEqual([
      { value: 'delaware', label: 'Delaware' },
      { value: 'wyoming', label: 'Wyoming' },
    ]);
  });
});

describe('serializeGroupedOptions', () => {
  it('round-trips a grouped tree', () => {
    const text = '[us]\ntx|Texas\n\n[gb]\neng|England';
    expect(serializeGroupedOptions(parseGroupedOptions(text))).toBe(text);
  });

  it('writes unscoped choices first, above the groups', () => {
    expect(
      serializeGroupedOptions([
        { value: 'tx', label: 'Texas', when: ['us'] },
        { value: 'other', label: 'Other' },
      ]),
    ).toBe('Other\n\n[us]\ntx|Texas');
  });

  it('leaves a plain dropdown untouched', () => {
    expect(
      serializeGroupedOptions([{ value: 'delaware', label: 'Delaware' }]),
    ).toBe('Delaware');
  });
});
