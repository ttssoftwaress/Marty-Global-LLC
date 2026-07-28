import { Plus, Trash2 } from 'lucide-react';

import { CATALOG_CURRENCIES, emptyTierDraft } from '../../lib/catalog';
import type {
  PricingTierDraft,
  ServiceFormErrors,
  ServiceRegion,
} from '../../types/catalog';
import { Field, SelectInput, TextInput } from './FormControls';

/*
 * How a service is priced — the write side of the table's "N pricing tiers"
 * column, where each row here is one of the tiers that column counts.
 *
 * A tier is a name, a price, an optional region scope, and an optional
 * turnaround. Scope defaults to "All regions"; setting it to one of the
 * service's regions is how the same tier is priced differently per jurisdiction,
 * so the region list offered here is the service's own selection rather than
 * every region that exists.
 *
 * The price is typed in major units and converted to integer minor units exactly
 * once, at submit (`toMinorUnits` in lib/catalog) — the amount never becomes a
 * float, and this control never does arithmetic on it (AGENTS.md, Money rules).
 * `inputMode="decimal"` keeps a numeric keypad on mobile while leaving the value
 * a string.
 */

type PricingTierEditorProps = {
  tiers: PricingTierDraft[];
  regions: ServiceRegion[];
  selectedRegionCodes: string[];
  errors: ServiceFormErrors;
  onChange: (tiers: PricingTierDraft[]) => void;
};

export function PricingTierEditor({
  tiers,
  regions,
  selectedRegionCodes,
  errors,
  onChange,
}: PricingTierEditorProps) {
  // Only the regions this service covers can scope one of its tiers.
  const scopedRegions = regions.filter((region) =>
    selectedRegionCodes.includes(region.code),
  );

  const updateTier = (index: number, patch: Partial<PricingTierDraft>) => {
    onChange(
      tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    );
  };

  const addTier = () => {
    // A new tier inherits the currency already in use, so a multi-tier service
    // doesn't have to re-pick it on every row.
    onChange([...tiers, emptyTierDraft(tiers[tiers.length - 1]?.currency)]);
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3">
      {tiers.length === 0 ? (
        <p className="rounded-card border border-dashed border-gray-300 px-4 py-5 text-center text-body text-gray-500">
          No pricing tiers yet. A service with no tiers is quote-only &mdash;
          customers see &ldquo;pricing shared after review&rdquo;.
        </p>
      ) : null}

      {tiers.map((tier, index) => (
        <div
          key={tier.key}
          className="flex flex-col gap-3 rounded-card border border-gray-200 bg-gray-50 p-3 md:p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
              Tier {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeTier(index)}
              className="flex size-8 items-center justify-center rounded-control text-gray-500 transition-colors hover:bg-gray-200 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label={`Remove tier ${index + 1}`}
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Tier name"
              htmlFor={`tier-${tier.key}-name`}
              error={errors[`tiers.${index}.name`]}
              required
            >
              <TextInput
                id={`tier-${tier.key}-name`}
                value={tier.name}
                onChange={(event) =>
                  updateTier(index, { name: event.target.value })
                }
                placeholder="Standard"
                error={errors[`tiers.${index}.name`]}
              />
            </Field>

            <div className="flex gap-2">
              <div className="w-[6.875rem] shrink-0">
                <Field label="Currency" htmlFor={`tier-${tier.key}-currency`}>
                  <SelectInput
                    id={`tier-${tier.key}-currency`}
                    value={tier.currency}
                    onChange={(event) =>
                      updateTier(index, { currency: event.target.value })
                    }
                  >
                    {CATALOG_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>

              <div className="min-w-0 flex-1">
                <Field
                  label="Price"
                  htmlFor={`tier-${tier.key}-amount`}
                  error={errors[`tiers.${index}.amount`]}
                  required
                >
                  <TextInput
                    id={`tier-${tier.key}-amount`}
                    value={tier.amount}
                    onChange={(event) =>
                      updateTier(index, { amount: event.target.value })
                    }
                    inputMode="decimal"
                    placeholder="199.00"
                    error={errors[`tiers.${index}.amount`]}
                  />
                </Field>
              </div>
            </div>

            <Field label="Applies to" htmlFor={`tier-${tier.key}-region`}>
              <SelectInput
                id={`tier-${tier.key}-region`}
                value={tier.regionCode}
                onChange={(event) =>
                  updateTier(index, { regionCode: event.target.value })
                }
              >
                <option value="">All regions</option>
                {scopedRegions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Turnaround"
              htmlFor={`tier-${tier.key}-turnaround`}
              hint="Optional — shown with the quote."
            >
              <TextInput
                id={`tier-${tier.key}-turnaround`}
                value={tier.turnaround}
                onChange={(event) =>
                  updateTier(index, { turnaround: event.target.value })
                }
                placeholder="5–7 business days"
              />
            </Field>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addTier}
        className="flex h-10 items-center justify-center gap-2 rounded-control border border-dashed border-gray-300 px-4 text-body font-medium text-primary transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Add pricing tier
      </button>
    </div>
  );
}
