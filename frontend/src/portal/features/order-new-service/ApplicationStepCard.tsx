import { ClipboardList } from 'lucide-react';

import type { ServiceFieldAnswers } from '../../types/order-new-service';
import type { ApplicationStep } from './applicationSteps';
import { visibleOptions } from './applicationSteps';
import { ApplicationField } from './ApplicationField';
import { serviceIcon } from './serviceIcons';

/*
 * One screen of the master application form.
 *
 * This replaces the per-service card the flow used to render. The customer fills
 * in one merged questionnaire, so a screen belongs to a STEP, not to a service —
 * a step several services contribute to is one card listing all of them, and a
 * question two of them share appears once inside it.
 *
 * The header keeps the designed card's shape (primary-light icon badge beside a
 * heading) and adds the line the merge makes necessary: which services this
 * screen is collecting for. When exactly one service contributes, its own glyph
 * and name are used, so a single-service order reads precisely as the design
 * draws it; a merged screen falls back to a neutral clipboard glyph, since no
 * one service owns it.
 *
 * The fields grid is unchanged across the three Figma links: two columns from
 * `lg`, one below it, with textareas and document uploads spanning both columns
 * so they aren't cramped into half the width.
 */

type ApplicationStepCardProps = {
  step: ApplicationStep;
  answers: ServiceFieldAnswers;
  filesByField: Record<string, File[]>;
  onFieldChange: (fieldName: string, value: string) => void;
  onFilesChange: (fieldName: string, files: File[]) => void;
  /*
   * Every question on the master form, by name — the labels a dependent dropdown
   * needs to say which answer it is waiting on. A parent routinely sits on an
   * earlier screen, so this card cannot look it up in its own fields.
   */
  labelsByField: Record<string, string>;
};

export function ApplicationStepCard({
  step,
  answers,
  filesByField,
  onFieldChange,
  onFilesChange,
  labelsByField,
}: ApplicationStepCardProps) {
  const onlyService = step.askedBy.length === 1 ? step.askedBy[0] : undefined;
  const Icon = onlyService ? serviceIcon(onlyService.iconKey) : ClipboardList;

  const serviceNames = step.askedBy.map(
    (service) => service.shortName ?? service.name,
  );

  return (
    <section className="flex w-full flex-col gap-5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-6 lg:gap-6">
      <div className="flex items-start gap-3">
        <span className="flex shrink-0 items-center justify-center rounded-[0.5rem] bg-primary-light p-2">
          <Icon
            className="size-4 text-primary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="min-w-0 text-h6 font-semibold text-text">
            {step.title}
          </h2>

          {step.description && (
            <p className="text-body text-text-secondary">{step.description}</p>
          )}

          {/* Which services this screen is collecting for. Shown whenever more
              than one contributes — that is exactly when the customer would
              otherwise wonder why a service seems to have no form of its own. */}
          {serviceNames.length > 1 && (
            <p className="text-small text-text-secondary">
              For {serviceNames.join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        {step.fields.map(({ field, askedBy }) => (
          <div
            key={field.name}
            className={
              field.type === 'textarea' || field.type === 'file'
                ? 'lg:col-span-2'
                : undefined
            }
          >
            <ApplicationField
              field={field}
              value={answers[field.name] ?? ''}
              onChange={(value) => onFieldChange(field.name, value)}
              idPrefix={step.key}
              files={filesByField[field.name] ?? []}
              onFilesChange={(files) => onFilesChange(field.name, files)}
              askedBy={askedBy.map(
                (service) => service.shortName ?? service.name,
              )}
              {...(field.type === 'select'
                ? {
                    options: visibleOptions(field, answers),
                    ...(field.dependsOn
                      ? {
                          parentLabel:
                            labelsByField[field.dependsOn] ?? field.dependsOn,
                        }
                      : {}),
                  }
                : {})}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
