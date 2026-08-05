import { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

import { ApiError } from '@/services/api';
import { Callout, Field, SwitchRow, TextInput } from '../../components/FormControls';
import { FormDialog } from '../../components/FormDialog';
import type { TrashSettings } from '../../types/trash';
import { useUpdateTrashSettings } from './queries';

/*
 * How long a deletion stays reversible, and whether the nightly sweep destroys
 * anything at all. Admin-only, both here and on the route.
 *
 * Retention is data rather than a constant for the same reason the payment and
 * email switches are: AGENTS.md is explicit that filings and payments carry
 * regulatory retention, so an org that needs ninety days — or needs the sweep
 * stood down while an audit is open — must not need a redeploy.
 *
 * Two things the copy has to be honest about, because both surprise people:
 *
 *   · Changing the window applies to future deletions only. Records already in
 *     the Trash keep the deadline they were given, which is deliberate:
 *     shortening it must never retroactively destroy something an admin was told
 *     they had thirty days to recover.
 *   · Pausing the sweep is not a pause on the Trash. Records still go in and can
 *     still be restored; nothing leaves on its own, so the bin only grows.
 *
 * No Figma link — built to the same dialog, field, and switch language as the
 * settings screen's Email and Payments panels, and logged as a deviation.
 */

const MIN_DAYS = 1;
const MAX_DAYS = 1825;

export function TrashRetentionDialog({
  open,
  settings,
  onClose,
}: {
  open: boolean;
  settings: TrashSettings | undefined;
  onClose: () => void;
}) {
  const save = useUpdateTrashSettings();

  const [days, setDays] = useState('30');
  const [purgeEnabled, setPurgeEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * Seeded from the server rather than held as the source of truth, and re-seeded
   * whenever the dialog opens — so a cancelled edit does not linger as the next
   * session's starting point.
   */
  useEffect(() => {
    if (!open || !settings) return;

    setDays(String(settings.retentionDays));
    setPurgeEnabled(settings.purgeEnabled);
    setError(null);
  }, [open, settings]);

  const parsed = Number(days);
  const daysInvalid =
    !Number.isInteger(parsed) || parsed < MIN_DAYS || parsed > MAX_DAYS;

  const onSave = () => {
    if (daysInvalid) {
      setError(`Enter a whole number of days between ${MIN_DAYS} and ${MAX_DAYS}.`);
      return;
    }

    setError(null);

    save.mutate(
      { retentionDays: parsed, purgeEnabled },
      {
        onSuccess: onClose,
        onError: (cause: unknown) => {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Could not save. Try again.',
          );
        },
      },
    );
  };

  return (
    <FormDialog
      open={open}
      title="Trash retention"
      description="How long a deleted record can be brought back."
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className="flex h-11 items-center justify-center rounded-control border border-gray-200 px-5 text-body font-semibold text-text transition-colors hover:bg-gray-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={save.isPending}
            className="flex h-11 items-center justify-center rounded-control bg-primary px-5 text-body font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label="Keep deleted records for"
          htmlFor="trash-retention-days"
          hint="Applies to records deleted from now on. Anything already in the Trash keeps the deadline it was given."
          {...(error && daysInvalid ? { error } : {})}
          required
        >
          <TextInput
            id="trash-retention-days"
            type="number"
            inputMode="numeric"
            min={MIN_DAYS}
            max={MAX_DAYS}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            {...(error && daysInvalid ? { error } : {})}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <p className="text-form-label text-text">Automatic deletion</p>
          <SwitchRow
            checked={purgeEnabled}
            onChange={setPurgeEnabled}
            disabled={save.isPending}
            label="Permanently delete expired records automatically"
            on="On — expired records are permanently deleted each day"
            off="Paused — nothing is permanently deleted"
          />
        </div>

        {purgeEnabled ? (
          <Callout tone="info" icon={Info}>
            A record is permanently deleted once its window closes. After that it
            cannot be recovered — only the audit log still records that it existed.
          </Callout>
        ) : (
          <Callout tone="warning" icon={AlertTriangle}>
            Nothing will leave the Trash while this is off. Records can still be
            deleted and restored; the bin simply keeps growing until you switch it
            back on.
          </Callout>
        )}

        {error && !daysInvalid ? (
          <p
            role="alert"
            className="rounded-input border border-error/30 bg-error/5 px-3 py-2 text-body text-error"
          >
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
