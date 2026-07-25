import { GripVertical, X } from 'lucide-react';

import { emptyFeatureDraft, moveItem } from '../../../lib/catalog';
import type { FeatureDraft, ServiceFormErrors } from '../../../types/catalog';
import { DashedAddButton, DetailCard } from './DetailCard';

/*
 * "What's included" — the bullet list the customer sees on the service card in
 * the portal's Step 1, edited here one row at a time.
 *
 * Each row is a grip handle, a text input, and a remove control. The design
 * implies drag-to-reorder via the grip; a pointer-drag implementation would mean
 * a DnD library, which the stack budget doesn't include (AGENTS.md), so the grip
 * is a real button that moves its row with ArrowUp/ArrowDown instead. That is
 * keyboard-accessible by construction — which a drag surface is not — and can
 * gain pointer dragging later without changing this contract. Logged as a
 * deviation.
 */

type IncludedItemsCardProps = {
  features: FeatureDraft[];
  errors: ServiceFormErrors;
  onChange: (features: FeatureDraft[]) => void;
};

export function IncludedItemsCard({
  features,
  errors,
  onChange,
}: IncludedItemsCardProps) {
  const updateFeature = (index: number, value: string) => {
    onChange(
      features.map((feature, i) =>
        i === index ? { ...feature, value } : feature,
      ),
    );
  };

  const removeFeature = (index: number) => {
    onChange(features.filter((_, i) => i !== index));
  };

  const reorder = (from: number, to: number) => {
    onChange(moveItem(features, from, to));
  };

  return (
    <DetailCard title="What's included">
      {features.length === 0 ? (
        <p className="text-body text-gray-500">
          No items yet. Add what this service covers — each one appears on the
          service card customers choose from.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {features.map((feature, index) => {
            const error = errors[`features.${index}`];
            const inputId = `included-${feature.key}`;

            return (
              <li
                key={feature.key}
                className="flex items-center gap-2 md:gap-3"
              >
                <button
                  type="button"
                  aria-label={`Reorder item ${index + 1}. Use arrow up and arrow down keys to move it.`}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      reorder(index, index - 1);
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      reorder(index, index + 1);
                    }
                  }}
                  className="flex size-5 shrink-0 cursor-grab items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <GripVertical
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </button>

                <input
                  id={inputId}
                  value={feature.value}
                  onChange={(event) => updateFeature(index, event.target.value)}
                  aria-label={`Included item ${index + 1}`}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${inputId}-error` : undefined}
                  placeholder="State/country filing and registration"
                  className={`h-input min-w-0 flex-1 rounded-input border bg-white px-3 text-body text-text transition-colors placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary md:px-4 ${
                    error ? 'border-error' : 'border-gray-300'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  aria-label={`Remove item ${index + 1}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-control text-gray-400 transition-colors hover:bg-gray-100 hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <DashedAddButton
        label="Add item"
        onClick={() => onChange([...features, emptyFeatureDraft()])}
      />
    </DetailCard>
  );
}
