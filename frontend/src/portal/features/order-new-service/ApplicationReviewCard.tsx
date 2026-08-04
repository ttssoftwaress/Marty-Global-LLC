import type { ReactNode } from 'react';
import { AlertTriangle, ClipboardList, FileText, Pencil, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type {
  OrderableService,
  ServiceFieldAnswers,
} from '../../types/order-new-service';
import { formatFileSize } from '../../lib/format';
import type { ApplicationStep } from './applicationSteps';
import { answerDisplayValue, isStepComplete } from './applicationSteps';
import { serviceIcon } from './serviceIcons';

/*
 * Review & submit — the whole application, read-only, on one screen.
 *
 * The wizard asks its questions a screen at a time, so by the last screen a
 * customer has not seen most of their own answers since they typed them. This
 * card is the one place the application exists as a single document: every
 * merged step, every question, the answer as it will be submitted, the attached
 * files, and the notes.
 *
 * It renders from the SAME merged steps the form did, in the same order, so
 * "review" cannot drift from "what was asked" — a question added by an admin
 * appears here with no change. Answers print through `answerDisplayValue`,
 * because a select stores an admin key and confirming `tx_1` is not confirming
 * an address.
 *
 * Nothing is editable here. Each section's Edit returns to the screen that owns
 * it with the draft intact, which keeps one editing implementation rather than a
 * second set of controls that could disagree with the first.
 *
 * Unanswered OPTIONAL questions are shown as "Not provided" rather than hidden:
 * a customer reviewing an application needs to see what they skipped. An
 * unanswered REQUIRED one is called out in error styling and named in the
 * banner, because that is the reason Submit is disabled (Design.md — a control
 * disabled for a fixable reason states the reason).
 */

type ApplicationReviewCardProps = {
  steps: ApplicationStep[];
  answers: ServiceFieldAnswers;
  filesByField: Record<string, File[]>;
  services: OrderableService[];
  documents: File[];
  notes: string;
  // Back to the screen that owns a section, by its index in `steps`.
  onEditStep: (stepIndex: number) => void;
  onEditDocuments: () => void;
};

function EditButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex shrink-0 items-center gap-1.5 rounded-input px-2 py-1 text-small font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" />
      Edit
    </button>
  );
}

function AnswerValue({
  value,
  missing,
}: {
  value: string;
  missing: boolean;
}) {
  if (value) {
    // Preserved wrapping so a textarea answer reads back the way it was typed.
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }

  return (
    <span className={missing ? 'text-error' : 'text-gray-400'}>
      {missing ? 'Required — not answered' : 'Not provided'}
    </span>
  );
}

/*
 * One reviewed section: the label/value list. Two presentations swapped by
 * breakpoint, matching the portal's other detail lists — stacked pairs on
 * mobile, divided label-left / value-right rows from md.
 */
type ReviewRow = {
  key: string;
  label: string;
  value: string;
  missing: boolean;
  files?: File[];
};

function FileNames({ files }: { files: File[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {files.map((file) => (
        <li
          key={`${file.name}:${file.size}`}
          className="flex items-center gap-2 md:justify-end"
        >
          <FileText
            className="size-4 shrink-0 text-gray-500"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">{file.name}</span>
          <span className="shrink-0 text-small font-normal text-gray-400">
            {formatFileSize(file.size)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReviewRows({ rows }: { rows: ReviewRow[] }) {
  return (
    <>
      {/* Mobile — stacked label/value pairs */}
      <dl className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-1">
            <dt className="text-small text-text-secondary">{row.label}</dt>
            <dd className="text-body font-medium text-text">
              {row.files && row.files.length > 0 ? (
                <FileNames files={row.files} />
              ) : (
                <AnswerValue value={row.value} missing={row.missing} />
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* Tablet & desktop — divided rows */}
      <dl className="hidden flex-col md:flex">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-start justify-between gap-6 border-b border-gray-200 py-3.5 last:border-b-0"
          >
            <dt className="shrink-0 text-body text-text-secondary">{row.label}</dt>
            <dd className="min-w-0 text-right text-body font-medium text-text">
              {row.files && row.files.length > 0 ? (
                <FileNames files={row.files} />
              ) : (
                <AnswerValue value={row.value} missing={row.missing} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function ReviewSection({
  title,
  subtitle,
  icon: Icon,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onEdit: () => void;
  editLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex shrink-0 items-center justify-center rounded-[0.5rem] bg-primary-light p-2">
            <Icon className="size-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="min-w-0 text-h6 font-semibold text-text">{title}</h2>
            {subtitle && (
              <p className="text-small text-text-secondary">{subtitle}</p>
            )}
          </div>
        </div>

        <EditButton onClick={onEdit} label={editLabel} />
      </div>

      {children}
    </section>
  );
}

export function ApplicationReviewCard({
  steps,
  answers,
  filesByField,
  services,
  documents,
  notes,
  onEditStep,
  onEditDocuments,
}: ApplicationReviewCardProps) {
  const incompleteSteps = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => !isStepComplete(step, answers));

  return (
    <div className="flex w-full flex-col gap-5 md:gap-6">
      {incompleteSteps.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-input border border-error/30 bg-error/5 px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-error"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-small font-medium text-error">
              Some required questions still need an answer
            </p>
            <p className="text-small text-text-secondary">
              You can submit once{' '}
              {incompleteSteps.map(({ step }) => step.title).join(', ')}{' '}
              {incompleteSteps.length > 1 ? 'are' : 'is'} complete.
            </p>
          </div>
        </div>
      )}

      {steps.map((step, index) => {
        const onlyService = step.askedBy.length === 1 ? step.askedBy[0] : undefined;
        const Icon = onlyService ? serviceIcon(onlyService.iconKey) : ClipboardList;
        const serviceNames = step.askedBy.map(
          (service) => service.shortName ?? service.name,
        );

        const rows: ReviewRow[] = step.fields.map(({ field }) => ({
          key: field.name,
          label: field.label,
          value: answerDisplayValue(field, answers),
          missing:
            Boolean(field.required) &&
            (answers[field.name] ?? '').trim().length === 0,
          ...(field.type === 'file'
            ? { files: filesByField[field.name] ?? [] }
            : {}),
        }));

        return (
          <ReviewSection
            key={step.key}
            title={step.title}
            {...(serviceNames.length > 1
              ? { subtitle: `For ${serviceNames.join(' · ')}` }
              : {})}
            icon={Icon}
            onEdit={() => onEditStep(index)}
            editLabel={`Edit ${step.title}`}
          >
            <ReviewRows rows={rows} />
          </ReviewSection>
        );
      })}

      <ReviewSection
        title="Documents & notes"
        icon={StickyNote}
        onEdit={onEditDocuments}
        editLabel="Edit documents and notes"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-small text-text-secondary">Supporting documents</p>
            {documents.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {documents.map((file) => (
                  <li
                    key={`${file.name}:${file.size}`}
                    className="flex items-center gap-3 rounded-[0.5rem] border border-gray-200 bg-gray-100 px-4 py-3"
                  >
                    <FileText
                      className="size-[1.125rem] shrink-0 text-gray-500"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate text-body text-gray-800">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-small text-gray-400">
                      {formatFileSize(file.size)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-gray-400">No documents attached</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-small text-text-secondary">Additional notes</p>
            {notes.trim() ? (
              <p className="whitespace-pre-wrap break-words text-body text-text">
                {notes.trim()}
              </p>
            ) : (
              <p className="text-body text-gray-400">No notes added</p>
            )}
          </div>
        </div>
      </ReviewSection>

      {/* The services this application orders — the answers above are merged
          across them, so the list is what says which services they serve. */}
      <p className="text-small text-text-secondary">
        Submitting requests a quote for{' '}
        {services.map((service) => service.name).join(', ')}.
      </p>
    </div>
  );
}
