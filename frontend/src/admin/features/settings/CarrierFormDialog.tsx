import { useEffect, useState } from 'react';

import { FormDialog } from '../../components/FormDialog';
import {
  carrierCreatePayload,
  carrierUpdatePayload,
  deriveCarrierCode,
  draftFromCarrier,
  newCarrierDraft,
  validateCarrierDraft,
} from '../../lib/settings';
import type {
  AdminCarrier,
  CarrierDraft,
  SettingsFormErrors,
} from '../../types/settings';
import { Field, TextInput } from '../../components/FormControls';
import { ToggleSwitch } from '../catalog/detail/ToggleSwitch';

/*
 * Add a mail carrier, or edit one.
 *
 * The mirror of the location form, and deliberately the same shape: a carrier is
 * the same kind of thing — a short reference row other records store by code —
 * so it gets the same rules. The code is derived from the name while the carrier
 * is new and read-only afterwards, because every forwarding request that has
 * shipped stores it.
 */

type CarrierFormDialogProps = {
  open: boolean;
  carrier: AdminCarrier | null;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (
    payload:
      | { mode: 'create'; body: ReturnType<typeof carrierCreatePayload> }
      | { mode: 'update'; body: ReturnType<typeof carrierUpdatePayload> },
  ) => void;
};

export function CarrierFormDialog({
  open,
  carrier,
  isSaving,
  error,
  onClose,
  onSubmit,
}: CarrierFormDialogProps) {
  const [draft, setDraft] = useState<CarrierDraft>(newCarrierDraft);
  const [errors, setErrors] = useState<SettingsFormErrors>({});
  const [codeTouched, setCodeTouched] = useState(false);

  const isEdit = carrier !== null;

  useEffect(() => {
    if (!open) return;
    setDraft(carrier ? draftFromCarrier(carrier) : newCarrierDraft());
    setErrors({});
    setCodeTouched(carrier !== null);
  }, [open, carrier]);

  const patch = (next: Partial<CarrierDraft>) =>
    setDraft((prev) => ({ ...prev, ...next }));

  const setLabel = (label: string) =>
    patch(codeTouched ? { label } : { label, code: deriveCarrierCode(label) });

  const submit = () => {
    const found = validateCarrierDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit(
      isEdit
        ? { mode: 'update', body: carrierUpdatePayload(draft) }
        : { mode: 'create', body: carrierCreatePayload(draft) },
    );
  };

  return (
    <FormDialog
      open={open}
      title={isEdit ? 'Edit carrier' : 'Add a carrier'}
      description={
        isEdit
          ? 'Changes apply everywhere this carrier is shown.'
          : 'A shipping company the mail room can forward parcels with.'
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
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add carrier'}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Carrier name"
          htmlFor="carrier-label"
          error={errors.label}
          hint="What the forwarding form offers — “DHL Express”, “Royal Mail”."
          required
        >
          <TextInput
            id="carrier-label"
            value={draft.label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="DHL Express"
            error={errors.label}
          />
        </Field>

        <Field
          label="Code"
          htmlFor="carrier-code"
          error={errors.code}
          hint={
            isEdit
              ? 'Shipped requests are stored under this code, so it cannot be changed.'
              : 'Derived from the name. Shipped requests store it, so it cannot be changed later.'
          }
          required
        >
          <TextInput
            id="carrier-code"
            value={draft.code}
            onChange={(event) => {
              setCodeTouched(true);
              patch({ code: event.target.value.toLowerCase() });
            }}
            placeholder="dhl"
            disabled={isEdit}
            error={errors.code}
            spellCheck={false}
          />
        </Field>

        <div className="flex items-center gap-3 border-t border-gray-200 pt-4 text-body text-text">
          <ToggleSwitch
            checked={draft.active}
            onChange={(next) => patch({ active: next })}
            label="Ship with this carrier"
          />
          <span>
            {draft.active
              ? 'On — offered on the forwarding form'
              : 'Off — hidden from the form, kept on past shipments'}
          </span>
        </div>
      </div>
    </FormDialog>
  );
}
