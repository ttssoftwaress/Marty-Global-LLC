import { describe, expect, it } from 'vitest';

import type {
  OrderableService,
  ServiceField,
} from '../../types/order-new-service';
import {
  answersByServiceFrom,
  buildApplicationSteps,
  isStepComplete,
} from './applicationSteps';

/*
 * The master form's merge. This is the one place the "ask a duplicate question
 * once" rule lives, and getting it wrong is silent — the customer would either
 * be asked the same thing twice or an order would reach the backend missing an
 * answer a service required. Hence the coverage.
 */

function service(
  id: string,
  name: string,
  steps: { key: string; title: string; fields: ServiceField[] }[],
): OrderableService {
  return {
    id,
    iconKey: 'default',
    name,
    description: '',
    features: [],
    footer: { label: '' },
    formSteps: steps,
    detailFields: steps.flatMap((step) => step.fields),
  };
}

const companyName: ServiceField = {
  type: 'text',
  name: 'company_name',
  label: 'Company name',
  required: true,
};

describe('buildApplicationSteps', () => {
  it('asks a question shared by two services only once', () => {
    const formation = service('formation', 'Company Formation', [
      {
        key: 'entity',
        title: 'Entity details',
        fields: [companyName, { type: 'text', name: 'directors', label: 'Directors' }],
      },
    ]);
    const bank = service('bank', 'Bank Account', [
      {
        key: 'entity',
        title: 'Entity details',
        fields: [companyName, { type: 'text', name: 'bank_pref', label: 'Preferred bank' }],
      },
    ]);

    const steps = buildApplicationSteps([formation, bank]);

    // Both services define an "entity" step, so it is one screen, not two.
    expect(steps).toHaveLength(1);
    expect(steps[0]!.fields.map((entry) => entry.field.name)).toEqual([
      'company_name',
      'directors',
      'bank_pref',
    ]);

    // The shared question records both claimants; the unique ones record one.
    const shared = steps[0]!.fields.find((f) => f.field.name === 'company_name');
    expect(shared!.askedBy.map((s) => s.id)).toEqual(['formation', 'bank']);
  });

  it('keeps distinct step keys as separate screens', () => {
    const a = service('a', 'A', [
      { key: 'entity', title: 'Entity details', fields: [companyName] },
    ]);
    const b = service('b', 'B', [
      {
        key: 'mail',
        title: 'Mail preferences',
        fields: [{ type: 'text', name: 'forwarding', label: 'Forwarding address' }],
      },
    ]);

    expect(buildApplicationSteps([a, b]).map((step) => step.key)).toEqual([
      'entity',
      'mail',
    ]);
  });

  it('requires a merged field if any service requires it', () => {
    const optional = service('a', 'A', [
      {
        key: 'entity',
        title: 'Entity details',
        fields: [{ type: 'text', name: 'company_name', label: 'Company name' }],
      },
    ]);
    const mandatory = service('b', 'B', [
      { key: 'entity', title: 'Entity details', fields: [companyName] },
    ]);

    const [step] = buildApplicationSteps([optional, mandatory]);

    expect(step!.fields[0]!.field.required).toBe(true);
    expect(isStepComplete(step!, {})).toBe(false);
    expect(isStepComplete(step!, { company_name: 'Acme' })).toBe(true);
  });

  it('unions the choices of a shared dropdown', () => {
    const a = service('a', 'A', [
      {
        key: 'entity',
        title: 'Entity details',
        fields: [
          {
            type: 'select',
            name: 'jurisdiction',
            label: 'Jurisdiction',
            options: [{ value: 'us', label: 'United States' }],
          },
        ],
      },
    ]);
    const b = service('b', 'B', [
      {
        key: 'entity',
        title: 'Entity details',
        fields: [
          {
            type: 'select',
            name: 'jurisdiction',
            label: 'Jurisdiction',
            options: [
              { value: 'us', label: 'United States' },
              { value: 'uk', label: 'United Kingdom' },
            ],
          },
        ],
      },
    ]);

    const field = buildApplicationSteps([a, b])[0]!.fields[0]!.field;

    // Dropping B's extra choice would make B's form unanswerable.
    expect(field.type === 'select' && field.options.map((o) => o.value)).toEqual([
      'us',
      'uk',
    ]);
  });

  it('takes the stricter cap when two services share a document upload', () => {
    const upload = (maxSizeMb: number, multiple: boolean): ServiceField => ({
      type: 'file',
      name: 'passport',
      label: 'Passport',
      maxSizeMb,
      multiple,
    });

    const a = service('a', 'A', [
      { key: 'docs', title: 'Documents', fields: [upload(20, true)] },
    ]);
    const b = service('b', 'B', [
      { key: 'docs', title: 'Documents', fields: [upload(5, false)] },
    ]);

    const field = buildApplicationSteps([a, b])[0]!.fields[0]!.field;

    expect(field.type === 'file' && field.maxSizeMb).toBe(5);
    // Only offer a multi-file picker if every asking service can take a set.
    expect(field.type === 'file' && field.multiple).toBe(false);
  });

  it('falls back to a single step for a service with only flat fields', () => {
    const flat: OrderableService = {
      id: 'flat',
      iconKey: 'default',
      name: 'Flat',
      description: '',
      features: [],
      footer: { label: '' },
      detailFields: [companyName],
    };

    const steps = buildApplicationSteps([flat]);

    expect(steps).toHaveLength(1);
    expect(steps[0]!.title).toBe('Application details');
    expect(steps[0]!.fields[0]!.field.name).toBe('company_name');
  });
});

describe('answersByServiceFrom', () => {
  it('fans one merged answer back out to every service that asked', () => {
    const formation = service('formation', 'Company Formation', [
      {
        key: 'entity',
        title: 'Entity details',
        fields: [companyName, { type: 'text', name: 'directors', label: 'Directors' }],
      },
    ]);
    const bank = service('bank', 'Bank Account', [
      { key: 'entity', title: 'Entity details', fields: [companyName] },
    ]);

    const payload = answersByServiceFrom([formation, bank], {
      company_name: 'Acme LLC',
      directors: 'Jane Doe',
    });

    // Each OrderItem must hold a complete set of answers to its own service's
    // questions — never a cross-reference to another service's answers.
    expect(payload).toEqual({
      formation: { company_name: 'Acme LLC', directors: 'Jane Doe' },
      bank: { company_name: 'Acme LLC' },
    });
  });

  it('omits blank answers rather than sending empty strings', () => {
    const only = service('only', 'Only', [
      {
        key: 'entity',
        title: 'Entity details',
        fields: [companyName, { type: 'text', name: 'notes', label: 'Notes' }],
      },
    ]);

    expect(answersByServiceFrom([only], { company_name: 'Acme', notes: '   ' })).toEqual(
      { only: { company_name: 'Acme' } },
    );
  });
});
