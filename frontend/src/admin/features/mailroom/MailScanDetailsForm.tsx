import { Mail, ScanLine } from 'lucide-react';

import { MailScanDropZone } from './MailScanDropZone';
import type { MailFilingKind, MailScanAttachment } from '../../types/mailroom';

/*
 * "New mail details" — the form that files post into the selected mail room's
 * inbox.
 *
 * The first choice is what is being filed, because everything under it follows
 * from it. The default is a SEALED envelope: post is logged from the outside,
 * the customer sees it and presses Scan, and an operator opens it and files the
 * contents onto that same item from the pending queue. Filing the contents in
 * one step stays available for post the customer has standing instructions to
 * open. Both produce one mail item — the envelope and the letter inside it are
 * never two entries in a customer's inbox.
 *
 * The field order is the same at every width, so one tree covers all three
 * links. What changes is the first row: desktop sets Sender name and Date
 * received side by side, while tablet and mobile stack them full-width.
 *
 * Two departures from the links, both logged:
 *   - Notes is a textarea at every width. The desktop and mobile links draw it
 *     as a single-line input and the tablet link as an 80px box; notes like
 *     "Tax year 2025, confidential" are the kind of thing an operator writes
 *     more than one line of, and the tablet link shows the design already
 *     intends a box.
 *   - Date received is a native date input rather than a text field with a
 *     calendar glyph. It gets the platform's own picker and calendar keyboard,
 *     and it removes an entire hand-rolled component from a screen that does
 *     not need one. The design's trailing calendar icon is the browser's.
 *
 * The submit button is navy at every width — the tablet link fills it magenta,
 * but the desktop and mobile links are navy and it is the same primary action
 * on the same form (Design.md, desktop is the source of truth).
 *
 * On mobile the button leaves this card entirely and lives in the page's sticky
 * bottom bar, exactly as the mobile link draws it, so the page owns it and this
 * card only renders it from `md` up.
 *
 * A third departure: "Response needed by" is not in any of the links. Some post
 * needs the customer to do something by a date, and the portal inbox already
 * draws that row in red with a deadline and a Respond action — this is the only
 * place that state can be set, so the form that files the envelope is where it
 * belongs. Entering a date makes Notes required: the note is the reason printed
 * beside the deadline, and a deadline without one is a demand with no ask.
 */

const FILING_OPTIONS: {
  value: MailFilingKind;
  label: string;
  hint: string;
  icon: typeof Mail;
}[] = [
  {
    value: 'envelope',
    label: 'Sealed envelope',
    hint: 'Photograph the outside. The customer asks us to open it.',
    icon: Mail,
  },
  {
    value: 'contents',
    label: 'Opened & scanned',
    hint: 'Already opened. The contents are readable straight away.',
    icon: ScanLine,
  },
];

type MailScanDetailsFormProps = {
  kind: MailFilingKind;
  onKindChange: (kind: MailFilingKind) => void;
  sender: string;
  onSenderChange: (value: string) => void;
  receivedOn: string;
  onReceivedOnChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  responseDueOn: string;
  onResponseDueOnChange: (value: string) => void;
  // Ordered — a file's position is the page it is filed as.
  files: MailScanAttachment[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  // 0–1 while the scans upload to R2, null when idle.
  uploadProgress?: number | null;
  formId: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onSubmit: () => void;
};

export function MailScanDetailsForm({
  kind,
  onKindChange,
  sender,
  onSenderChange,
  receivedOn,
  onReceivedOnChange,
  notes,
  onNotesChange,
  responseDueOn,
  onResponseDueOnChange,
  files,
  onFilesAdd,
  onFileRemove,
  uploadProgress = null,
  formId,
  canSubmit,
  isSubmitting,
  errorMessage,
  onSubmit,
}: MailScanDetailsFormProps) {
  const notesRequired = Boolean(responseDueOn);
  const sealed = kind === 'envelope';

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit && !isSubmitting) onSubmit();
      }}
      className="flex w-full flex-col gap-5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:gap-card lg:p-card"
    >
      <h2 className="text-h6 text-text">New mail details</h2>

      {/*
       * What is being filed. A radio group rather than a toggle: these are two
       * named choices with consequences an operator has to read, not an option
       * being switched on — and a radio group is arrow-navigable by keyboard
       * without any script of ours.
       */}
      <fieldset className="flex w-full flex-col gap-2">
        <legend className="mb-2 text-form-label text-text">
          What are you filing?
        </legend>
        <div className="grid w-full gap-2 md:grid-cols-2">
          {FILING_OPTIONS.map((option) => {
            const Icon = option.icon;
            const checked = kind === option.value;

            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-input border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                  checked
                    ? 'border-primary bg-primary-light'
                    : 'border-gray-300 bg-gray-50 hover:border-primary'
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-kind`}
                  value={option.value}
                  checked={checked}
                  onChange={() => onKindChange(option.value)}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-body font-semibold text-text">
                    <Icon
                      className={`size-4 shrink-0 ${checked ? 'text-primary' : 'text-gray-400'}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {option.label}
                  </span>
                  <span className="text-small text-gray-500">{option.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Desktop pairs the first two fields on one row; the narrower links stack. */}
      <div className="flex w-full flex-col gap-5 lg:flex-row lg:gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor={`${formId}-sender`} className="text-form-label text-text">
            Sender name
          </label>
          <input
            id={`${formId}-sender`}
            type="text"
            value={sender}
            onChange={(event) => onSenderChange(event.target.value)}
            placeholder="e.g. Bank of America"
            className="input-field bg-gray-50"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor={`${formId}-received`} className="text-form-label text-text">
            Date received
          </label>
          <input
            id={`${formId}-received`}
            type="date"
            value={receivedOn}
            onChange={(event) => onReceivedOnChange(event.target.value)}
            className="input-field bg-gray-50"
          />
        </div>
      </div>

      <MailScanDropZone
        files={files}
        onAdd={onFilesAdd}
        onRemove={onFileRemove}
        progress={uploadProgress}
        emptyLabel={
          sealed
            ? 'Drag & drop or click to upload the envelope'
            : 'Drag & drop or click to upload scan'
        }
        addLabel={sealed ? 'Add another side' : 'Add another page'}
      />

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={`${formId}-response-due`} className="text-form-label text-text">
          Response needed by (optional)
        </label>
        <input
          id={`${formId}-response-due`}
          type="date"
          value={responseDueOn}
          // The mail cannot need answering before it arrived; the backend
          // rejects it either way (AGENTS.md — the guard is server-side).
          min={receivedOn || undefined}
          onChange={(event) => onResponseDueOnChange(event.target.value)}
          aria-describedby={`${formId}-response-due-hint`}
          className="input-field bg-gray-50 md:max-w-[20rem]"
        />
        <p id={`${formId}-response-due-hint`} className="text-small text-gray-500">
          Files this item as “Action requested” in the customer’s inbox. Add a
          note saying what they need to do.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <label htmlFor={`${formId}-notes`} className="text-form-label text-text">
          {notesRequired ? 'Notes' : 'Notes (optional)'}
        </label>
        <textarea
          id={`${formId}-notes`}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={3}
          placeholder={
            notesRequired
              ? 'e.g. Forwarding address required'
              : 'e.g. Tax year 2025, confidential'
          }
          aria-required={notesRequired}
          className="input-field h-20 resize-none bg-gray-50 py-3"
        />
        {notesRequired && !notes.trim() ? (
          <p role="alert" className="text-small text-error">
            Say what the customer needs to do before the response date.
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="text-small text-error">
          {errorMessage}
        </p>
      ) : null}

      {/* Mobile's submit lives in the page's sticky bottom bar instead. */}
      <div className="hidden w-full justify-end md:flex">
        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="btn btn-primary disabled:cursor-default disabled:bg-gray-300 disabled:hover:bg-gray-300"
        >
          {isSubmitting ? 'Adding…' : 'Add to mail room inbox'}
        </button>

      </div>
    </form>
  );
}
