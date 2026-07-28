import { useEffect, useState } from 'react';

import {
  deriveLocationCode,
  draftFromLocation,
  flagForCode,
  locationCreatePayload,
  locationUpdatePayload,
  newLocationDraft,
  validateLocationDraft,
} from '../../lib/settings';
import type {
  AdminLocation,
  LocationDraft,
  SettingsFormErrors,
} from '../../types/settings';
import { Field, TextInput } from '../catalog/FormControls';
import { ServiceFormDialog } from '../catalog/ServiceFormDialog';
import { ToggleSwitch } from '../catalog/detail/ToggleSwitch';

/*
 * Add a location, or edit one.
 *
 * The code is guessed from the name while the location is new and shown
 * read-only once it exists: orders, coverage rows, and price points all store
 * the code, so renaming it would detach every record already pointing at it.
 * That is the same rule the field registry enforces on an answer key, for the
 * same reason.
 *
 * The flag needs no typing for a country — a two-letter code derives its own
 * emoji, previewed live beside the box — and the box is there for the codes that
 * aren't countries, or when the derived glyph is not the wanted one.
 */

type LocationFormDialogProps = {
  open: boolean;
  // The location being edited, or null to add one.
  location: AdminLocation | null;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (
    payload:
      | { mode: 'create'; body: ReturnType<typeof locationCreatePayload> }
      | { mode: 'update'; body: ReturnType<typeof locationUpdatePayload> },
  ) => void;
};

export function LocationFormDialog({
  open,
  location,
  isSaving,
  error,
  onClose,
  onSubmit,
}: LocationFormDialogProps) {
  const [draft, setDraft] = useState<LocationDraft>(newLocationDraft);
  const [errors, setErrors] = useState<SettingsFormErrors>({});
  // The code stops tracking the name as soon as the admin edits it by hand.
  const [codeTouched, setCodeTouched] = useState(false);

  const isEdit = location !== null;

  useEffect(() => {
    if (!open) return;
    setDraft(location ? draftFromLocation(location) : newLocationDraft());
    setErrors({});
    setCodeTouched(location !== null);
  }, [open, location]);

  const patch = (next: Partial<LocationDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));

  const setLabel = (label: string) =>
    patch(codeTouched ? { label } : { label, code: deriveLocationCode(label) });

  const submit = () => {
    const found = validateLocationDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit(
      isEdit
        ? { mode: 'update', body: locationUpdatePayload(draft) }
        : { mode: 'create', body: locationCreatePayload(draft) },
    );
  };

  // What the row will show: what was typed, or the flag the code derives.
  const previewFlag = draft.flag.trim() || flagForCode(draft.code);

  return (
    <ServiceFormDialog
      open={open}
      title={isEdit ? 'Edit location' : 'Add a location'}
      description={
        isEdit
          ? 'Changes apply everywhere this location is shown.'
          : 'A jurisdiction services can be offered in, and orders filed under.'
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-caption text-error">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-input rounded-control px-4 text-body font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isSaving}
              className="h-input rounded-control bg-primary px-5 text-body font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add location'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Location name"
          htmlFor="location-label"
          error={errors.label}
          hint="What customers and staff see — “United States”, “European Union”."
          required
        >
          <TextInput
            id="location-label"
            value={draft.label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="United States"
            error={errors.label}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_120px]">
          <Field
            label="Code"
            htmlFor="location-code"
            error={errors.code}
            hint={
              isEdit
                ? 'Orders and coverage are stored under this code, so it cannot be changed.'
                : 'ISO country code where there is one (US, GB), otherwise a short slug (EU).'
            }
            required
          >
            <TextInput
              id="location-code"
              value={draft.code}
              onChange={(event) => {
                setCodeTouched(true);
                patch({ code: event.target.value.toUpperCase() });
              }}
              placeholder="US"
              disabled={isEdit}
              error={errors.code}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>

          <Field
            label="Flag"
            htmlFor="location-flag"
            hint="Blank derives it."
          >
            <TextInput
              id="location-flag"
              value={draft.flag}
              onChange={(event) => patch({ flag: event.target.value })}
              placeholder={previewFlag || '🏳️'}
            />
          </Field>
        </div>

        {/* A div rather than a label: the switch is a real button, and nesting an
            interactive control inside a label makes the click target ambiguous.
            `ToggleSwitch` carries its own accessible name. */}
        <div className="flex items-center gap-3 border-t border-gray-200 pt-4 text-body text-text">
          <ToggleSwitch
            checked={draft.active}
            onChange={(next) => patch({ active: next })}
            label="Offer this location"
          />
          {/* Off keeps the location on every record that already references it
              while removing it from the pickers — the way a jurisdiction is
              closed, since deleting one orders were filed under is not offered. */}
          <span>
            {draft.active
              ? 'On — offered on new orders and shown in every picker'
              : 'Off — hidden from pickers, kept on existing records'}
          </span>
        </div>
      </div>
    </ServiceFormDialog>
  );
}
