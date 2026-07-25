import { useState } from 'react';

import {
  CATALOG_CURRENCIES,
  emptyTierDraft,
  formatTierPrice,
  toMinorUnits,
} from '../../../lib/catalog';
import type {
  PricingTierDraft,
  ServiceFormErrors,
  ServiceRegion,
} from '../../../types/catalog';
import { Field, SelectInput, TextInput } from '../FormControls';
import { DashedAddButton, DetailCard } from './DetailCard';

/*
 * "Pricing & quote templates" — the reference prices staff quote from.
 *
 * Three renderings of one list, matching the three links:
 *   - desktop: a five-column table (Region, Base price, Includes / notes,
 *     Est. turnaround, and the Edit action)
 *   - tablet: four columns, with the notes folded under the region name so the
 *     row still fits
 *   - mobile: a card per tier — region and price on one line, notes and
 *     turnaround beneath, a full-width Edit button
 *
 * A row is read-only until Edit opens it, at which point it becomes an inline
 * editor. That is the design's Edit button given a behaviour: the design shows
 * the control but not what it opens, and an inline editor keeps the admin on one
 * screen rather than stacking a modal over a page that is already a form.
 *
 * Money is integer minor units on the wire (AGENTS.md). The amount is typed as
 * text and converted exactly once, at submit, via `toMinorUnits` — nothing here
 * multiplies a float. A tier whose amount is still unparseable renders its raw
 * text rather than a formatted price, so a half-typed value never displays as
 * something it isn't.
 */

type PricingTemplatesCardProps = {
  tiers: PricingTierDraft[];
  regions: ServiceRegion[];
  errors: ServiceFormErrors;
  onChange: (tiers: PricingTierDraft[]) => void;
};

const COPY =
  'These reference prices are used by the team when preparing customer quotes — actual quotes may vary based on specific requirements.';

export function PricingTemplatesCard({
  tiers,
  regions,
  errors,
  onChange,
}: PricingTemplatesCardProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const updateTier = (index: number, patch: Partial<PricingTierDraft>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
    setEditingKey(null);
  };

  const addTier = () => {
    const tier = emptyTierDraft();
    onChange([...tiers, tier]);
    // A new tier is empty, so it opens straight into its editor — otherwise the
    // admin would add a blank row and have to press Edit to fill it in.
    setEditingKey(tier.key);
  };

  const regionLabel = (code: string) =>
    regions.find((region) => region.code === code)?.label ?? 'All regions';

  // A tier row flags an error anywhere in its own fields, so a collapsed row
  // still signals that it needs attention.
  const tierHasError = (index: number) =>
    Object.keys(errors).some((key) => key.startsWith(`tiers.${index}.`));

  return (
    <DetailCard title="Pricing & quote templates" description={COPY}>
      {tiers.length === 0 ? (
        <p className="rounded-card border border-dashed border-gray-300 px-4 py-5 text-center text-body text-gray-500">
          No pricing tiers yet. Add one per region so the team has a reference
          price when quoting this service.
        </p>
      ) : (
        <>
          {/* Mobile — a card per tier. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {tiers.map((tier, index) => (
              <li
                key={tier.key}
                className={`flex flex-col gap-3 rounded-[12px] border bg-white p-4 ${
                  tierHasError(index) ? 'border-error' : 'border-gray-200'
                }`}
              >
                {editingKey === tier.key ? (
                  <TierEditor
                    tier={tier}
                    index={index}
                    regions={regions}
                    errors={errors}
                    onChange={(patch) => updateTier(index, patch)}
                    onRemove={() => removeTier(index)}
                    onDone={() => setEditingKey(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-body font-semibold text-text">
                        {tier.name || regionLabel(tier.regionCode)}
                      </span>
                      <span className="text-body-lg font-bold text-text">
                        <TierPrice tier={tier} />
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 text-small text-gray-500">
                      {tier.description ? <p>{tier.description}</p> : null}
                      {tier.turnaround ? <p>Est. {tier.turnaround}</p> : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingKey(tier.key)}
                      className="flex h-10 w-full items-center justify-center rounded-control border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Edit
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* Tablet & desktop — the table. */}
          <div className="hidden w-full overflow-hidden rounded-card border border-gray-200 md:block">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="h-12 bg-[var(--table-header-bg)] text-left">
                  <th
                    scope="col"
                    className="w-[240px] border-b border-gray-200 px-4 text-caption font-medium uppercase text-gray-500 lg:w-[180px]"
                  >
                    Region
                  </th>
                  <th
                    scope="col"
                    className="w-[120px] border-b border-gray-200 px-4 text-caption font-medium uppercase text-gray-500 lg:w-[140px]"
                  >
                    Base price
                  </th>
                  {/* The notes column folds under the region name on tablet. */}
                  <th
                    scope="col"
                    className="hidden border-b border-gray-200 px-4 text-caption font-medium uppercase text-gray-500 lg:table-cell"
                  >
                    Includes / notes
                  </th>
                  <th
                    scope="col"
                    className="border-b border-gray-200 px-4 text-caption font-medium uppercase text-gray-500 lg:w-[180px]"
                  >
                    Est. turnaround
                  </th>
                  <th
                    scope="col"
                    className="w-[100px] border-b border-gray-200 px-4 text-right text-caption font-medium uppercase text-gray-500"
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {tiers.map((tier, index) =>
                  editingKey === tier.key ? (
                    <tr key={tier.key} className="border-b border-gray-200 last:border-b-0">
                      <td colSpan={5} className="bg-gray-50 p-4">
                        <TierEditor
                          tier={tier}
                          index={index}
                          regions={regions}
                          errors={errors}
                          onChange={(patch) => updateTier(index, patch)}
                          onRemove={() => removeTier(index)}
                          onDone={() => setEditingKey(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={tier.key}
                      className="border-b border-gray-200 bg-white last:border-b-0"
                    >
                      <td className="px-4 py-3 align-middle lg:h-table-row lg:py-0">
                        <div className="flex flex-col gap-1">
                          <span className="truncate text-body font-semibold text-gray-900 lg:font-medium">
                            {tier.name || regionLabel(tier.regionCode)}
                          </span>
                          {/* Tablet only — desktop gives notes their own column. */}
                          {tier.description ? (
                            <span className="truncate text-small text-gray-500 lg:hidden">
                              {tier.description}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle text-body font-semibold text-gray-900 lg:py-0 lg:font-medium">
                        <TierPrice tier={tier} />
                      </td>

                      <td className="hidden px-4 py-3 align-middle lg:table-cell lg:py-0">
                        <span className="block truncate text-body text-gray-600">
                          {tier.description || '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-middle text-body text-gray-600 lg:py-0">
                        {tier.turnaround || '—'}
                      </td>

                      <td className="px-4 py-3 text-right align-middle lg:py-0">
                        <button
                          type="button"
                          onClick={() => setEditingKey(tier.key)}
                          className="inline-flex h-8 w-20 items-center justify-center rounded-control border border-primary bg-white text-small font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <DashedAddButton label="Add pricing tier" onClick={addTier} />
    </DetailCard>
  );
}

/*
 * A tier's price as displayed. `formatTierPrice` expects a resolved Money, so the
 * text is converted first and only formatted when it parses — a partially typed
 * amount shows as typed rather than as a misleading formatted figure.
 */
function TierPrice({ tier }: { tier: PricingTierDraft }) {
  const amount = toMinorUnits(tier.amount, tier.currency);
  if (amount === null) return <>{tier.amount || '—'}</>;
  return <>{formatTierPrice({ amount, currency: tier.currency })}</>;
}

function TierEditor({
  tier,
  index,
  regions,
  errors,
  onChange,
  onRemove,
  onDone,
}: {
  tier: PricingTierDraft;
  index: number;
  regions: ServiceRegion[];
  errors: ServiceFormErrors;
  onChange: (patch: Partial<PricingTierDraft>) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const prefix = `tiers.${index}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field
          label="Tier name"
          htmlFor={`${tier.key}-name`}
          error={errors[`${prefix}.name`]}
          required
        >
          <TextInput
            id={`${tier.key}-name`}
            value={tier.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="USA"
            error={errors[`${prefix}.name`]}
          />
        </Field>

        <Field label="Region" htmlFor={`${tier.key}-region`}>
          <SelectInput
            id={`${tier.key}-region`}
            value={tier.regionCode}
            onChange={(event) => onChange({ regionCode: event.target.value })}
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field
          label="Base price"
          htmlFor={`${tier.key}-amount`}
          error={errors[`${prefix}.amount`]}
          required
        >
          <TextInput
            id={`${tier.key}-amount`}
            value={tier.amount}
            onChange={(event) => onChange({ amount: event.target.value })}
            inputMode="decimal"
            placeholder="1250.00"
            error={errors[`${prefix}.amount`]}
          />
        </Field>

        <Field label="Currency" htmlFor={`${tier.key}-currency`}>
          <SelectInput
            id={`${tier.key}-currency`}
            value={tier.currency}
            onChange={(event) => onChange({ currency: event.target.value })}
          >
            {CATALOG_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Includes / notes" htmlFor={`${tier.key}-description`}>
          <TextInput
            id={`${tier.key}-description`}
            value={tier.description ?? ''}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Standard filing + Registered Agent (1 yr)"
          />
        </Field>

        <Field label="Est. turnaround" htmlFor={`${tier.key}-turnaround`}>
          <TextInput
            id={`${tier.key}-turnaround`}
            value={tier.turnaround}
            onChange={(event) => onChange({ turnaround: event.target.value })}
            placeholder="5–7 business days"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onRemove}
          className="text-body font-medium text-error transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Remove tier
        </button>

        <button
          type="button"
          onClick={onDone}
          className="flex h-10 items-center justify-center rounded-control bg-primary px-5 text-body font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Done
        </button>
      </div>
    </div>
  );
}
