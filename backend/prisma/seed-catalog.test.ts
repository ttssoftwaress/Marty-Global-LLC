import { describe, expect, it } from 'vitest';

import { createFieldSchema } from '../src/modules/admin/fields/fields.validation.js';
import { createResultFieldSchema } from '../src/modules/admin/result-fields/result-fields.validation.js';
import {
  MAX_FIELD_DEPENDENCY_DEPTH,
  MAX_FIELD_OPTIONS,
} from '../src/modules/services/services.validation.js';
import { FIELDS, RESULT_FIELDS, SERVICES } from './seed-catalog.js';
import { ADDRESSES, LOCATIONS, addressOptions, stateOptions } from './seed-locations.js';

/*
 * The seed, checked against the rules the API would apply to the same data.
 *
 * Everything here is authored by hand and written straight to the database with
 * `prisma.upsert`, which skips every guard the admin screens go through. A
 * broken reference therefore doesn't fail the seed — it fails later, quietly, as
 * a question that renders blank or a dropdown that offers nothing, and it fails
 * on a customer's screen rather than in CI.
 *
 * So the rules are re-run here, against the same Zod schemas and the same
 * invariants the service layer enforces (`assertDependencyIsSound`,
 * `assertDependenciesSatisfied`, `singlePrimaryResultField`). No database: this
 * is the catalog as data, so the test is pure.
 */

type FieldConfig = {
  options?: { value: string; label: string; when?: string[] }[];
  dependsOn?: string;
};

const configOf = (key: string): FieldConfig =>
  (FIELDS.find((field) => field.key === key)?.config ?? {}) as FieldConfig;

const fieldsByKey = new Map(FIELDS.map((field) => [field.key, field]));
const resultFieldsByKey = new Map(RESULT_FIELDS.map((field) => [field.key, field]));

// Every question a service asks, in the order the customer meets it.
const orderedKeys = (service: (typeof SERVICES)[number]) =>
  service.formSteps.flatMap((step) => step.fields.map((ref) => ref.fieldKey));

describe('field registry', () => {
  it('has no duplicate keys', () => {
    expect(new Set(FIELDS.map((field) => field.key)).size).toBe(FIELDS.length);
  });

  it.each(FIELDS.map((field) => [field.key, field] as const))(
    'accepts %s through the create-field schema',
    (_key, field) => {
      const parsed = createFieldSchema.safeParse(field);
      expect(parsed.error?.issues ?? []).toEqual([]);
    },
  );

  it('keeps every dropdown inside the option cap', () => {
    for (const field of FIELDS) {
      expect(configOf(field.key).options?.length ?? 0).toBeLessThanOrEqual(
        MAX_FIELD_OPTIONS,
      );
    }
  });
});

/*
 * The dependent-dropdown rules, as `assertDependencyIsSound` applies them on
 * write: a parent that exists and is itself a dropdown, a chain that terminates
 * inside the depth cap, and no `when` naming a choice the parent doesn't offer.
 * The last one is the failure worth catching — an orphaned `when` doesn't throw
 * anywhere, it just silently hides the choice from every customer.
 */
describe('dependent dropdowns', () => {
  const dependents = FIELDS.filter((field) => configOf(field.key).dependsOn);

  it('has some, so the rest of this block is not vacuous', () => {
    expect(dependents.length).toBeGreaterThan(0);
  });

  it.each(dependents.map((field) => [field.key] as const))(
    '%s depends on a registered dropdown',
    (key) => {
      const parentKey = configOf(key).dependsOn as string;
      const parent = fieldsByKey.get(parentKey);

      expect(parent, `${key} depends on unregistered ${parentKey}`).toBeDefined();
      expect(parent?.type).toBe('select');
    },
  );

  it.each(dependents.map((field) => [field.key] as const))(
    '%s only scopes choices to values its parent offers',
    (key) => {
      const parentKey = configOf(key).dependsOn as string;
      const parentValues = new Set(
        (configOf(parentKey).options ?? []).map((option) => option.value),
      );

      const orphaned = [
        ...new Set(
          (configOf(key).options ?? []).flatMap((option) =>
            (option.when ?? []).filter((value) => !parentValues.has(value)),
          ),
        ),
      ];

      expect(orphaned).toEqual([]);
    },
  );

  it.each(dependents.map((field) => [field.key] as const))(
    '%s sits within the depth cap and in no cycle',
    (key) => {
      const seen = new Set<string>([key]);
      let cursor = configOf(key).dependsOn;

      for (let depth = 1; cursor; depth += 1) {
        expect(seen.has(cursor), `${key} is in a dependency cycle`).toBe(false);
        expect(depth).toBeLessThanOrEqual(MAX_FIELD_DEPENDENCY_DEPTH);
        seen.add(cursor);
        cursor = configOf(cursor).dependsOn;
      }
    },
  );
});

describe('result registry', () => {
  it('has no duplicate keys', () => {
    expect(new Set(RESULT_FIELDS.map((field) => field.key)).size).toBe(
      RESULT_FIELDS.length,
    );
  });

  it.each(RESULT_FIELDS.map((field) => [field.key, field] as const))(
    'accepts %s through the create-result-field schema',
    (_key, field) => {
      const parsed = createResultFieldSchema.safeParse(field);
      expect(parsed.error?.issues ?? []).toEqual([]);
    },
  );
});

describe('services', () => {
  it('are uniquely identified and ordered', () => {
    expect(new Set(SERVICES.map((service) => service.id)).size).toBe(SERVICES.length);
    expect(SERVICES.map((service) => service.sortOrder)).toEqual(
      [...SERVICES.map((service) => service.sortOrder)].sort((a, b) => a - b),
    );
  });

  it.each(SERVICES.map((service) => [service.id, service] as const))(
    '%s asks only registered, live questions',
    (_id, service) => {
      for (const key of orderedKeys(service)) {
        const field = fieldsByKey.get(key);
        expect(field, `${key} is not in the registry`).toBeDefined();
        // An archived field still resolves, but asking one on a live form means
        // the retirement was never finished.
        expect(field?.archived ?? false, `${key} is archived`).toBe(false);
      }
    },
  );

  it.each(SERVICES.map((service) => [service.id, service] as const))(
    '%s asks each question once',
    (_id, service) => {
      const keys = orderedKeys(service);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  /*
   * `assertDependenciesSatisfied`, applied to the form as the customer reads it.
   * A dependent dropdown offers nothing until its parent is answered, so asking
   * it first is a control that sits dead until they scroll back up.
   */
  it.each(SERVICES.map((service) => [service.id, service] as const))(
    '%s asks every parent dropdown before the field that depends on it',
    (_id, service) => {
      const seen = new Set<string>();

      for (const key of orderedKeys(service)) {
        const parentKey = configOf(key).dependsOn;
        if (parentKey) {
          expect(seen.has(parentKey), `${key} is asked before ${parentKey}`).toBe(true);
        }
        seen.add(key);
      }
    },
  );

  it.each(SERVICES.map((service) => [service.id, service] as const))(
    '%s delivers registered facts, with exactly one title',
    (_id, service) => {
      const refs = service.resultFields ?? [];
      if (refs.length === 0) return;

      for (const ref of refs) {
        const field = resultFieldsByKey.get(ref.fieldKey);
        expect(field, `${ref.fieldKey} is not in the result registry`).toBeDefined();
        expect(field?.archived ?? false, `${ref.fieldKey} is archived`).toBe(false);
      }

      const primaries = refs.filter(
        (ref) => ref.isPrimary ?? resultFieldsByKey.get(ref.fieldKey)?.isPrimary,
      );
      expect(primaries).toHaveLength(1);
    },
  );

  it.each(SERVICES.map((service) => [service.id, service] as const))(
    '%s has request types that resolve and read in dependency order',
    (_id, service) => {
      const types = service.requestTypes ?? [];
      expect(new Set(types.map((type) => type.key)).size).toBe(types.length);

      for (const type of types) {
        const seen = new Set<string>();

        for (const ref of type.fields ?? []) {
          const field = fieldsByKey.get(ref.fieldKey);
          expect(field, `${type.key} asks unregistered ${ref.fieldKey}`).toBeDefined();

          const parentKey = configOf(ref.fieldKey).dependsOn;
          if (parentKey) expect(seen.has(parentKey)).toBe(true);
          seen.add(ref.fieldKey);
        }
      }
    },
  );

  it.each(SERVICES.map((service) => [service.id, service] as const))(
    '%s is offered only in seeded locations',
    (_id, service) => {
      const known = new Set(LOCATIONS.map((location) => location.code));

      for (const region of service.coverage) {
        expect(known.has(region.code), `${region.code} is not a seeded location`).toBe(
          true,
        );
        expect(region.processingTime.length).toBeGreaterThan(0);
      }
    },
  );
});

/*
 * The region an order is filed under is denormalised from any answer whose FIELD
 * NAME reads as a region, country, or jurisdiction, by upper-casing the part
 * before the first hyphen (orders.service.ts, REGION_FIELD_PATTERN). Any live
 * dropdown caught by that pattern therefore has to answer in codes that resolve
 * to a real location — otherwise the order files under nothing, or worse, under
 * the wrong desk.
 */
describe('order region derivation', () => {
  const REGION_FIELD_PATTERN = /region|jurisdiction|country/i;

  const asked = new Set(SERVICES.flatMap((service) => orderedKeys(service)));
  const regionish = FIELDS.filter(
    (field) => asked.has(field.key) && REGION_FIELD_PATTERN.test(field.key),
  );

  it('catches the two country dropdowns and nothing else', () => {
    expect(regionish.map((field) => field.key).sort()).toEqual([
      'address_region',
      'formation_country',
    ]);
  });

  it.each(regionish.map((field) => [field.key] as const))(
    'every choice on %s maps to a seeded location',
    (key) => {
      const known = new Set(LOCATIONS.map((location) => location.code));

      for (const option of configOf(key).options ?? []) {
        const root = option.value.split('-')[0]?.toUpperCase() ?? '';
        expect(known.has(root), `${option.value} resolves to no location`).toBe(true);
      }
    },
  );
});

describe('address book', () => {
  it('has a unique value per address', () => {
    expect(new Set(ADDRESSES.map((address) => address.value)).size).toBe(
      ADDRESSES.length,
    );
  });

  it('holds every address in a seeded country', () => {
    const known = new Set(LOCATIONS.map((location) => location.code.toLowerCase()));
    for (const address of ADDRESSES) {
      expect(known.has(address.country), `${address.value}`).toBe(true);
    }
  });

  // The cascade is generated, so this is really a test of the generator: every
  // rung has to be reachable from the one above it.
  it('generates a state for every address and an address for every state', () => {
    const states = new Set(stateOptions().map((option) => option.value));
    const addressParents = new Set(
      addressOptions().flatMap((option) => option.when ?? []),
    );

    expect([...addressParents].filter((state) => !states.has(state))).toEqual([]);
    expect([...states].filter((state) => !addressParents.has(state))).toEqual([]);
  });

  it('labels every choice within the storable length', () => {
    for (const option of [...stateOptions(), ...addressOptions()]) {
      expect(option.value.length, option.value).toBeLessThanOrEqual(60);
      expect(option.label.length, option.label).toBeLessThanOrEqual(120);
    }
  });
});
