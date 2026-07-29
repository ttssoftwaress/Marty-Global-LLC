import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/*
 * The shell both settings panels render inside — heading, add button, and the
 * three states a short admin-curated list has (loading, empty, populated).
 *
 * Shared because the two lists are the same idea twice: locations and carriers
 * are both a reference table other rows point at, so they get the same frame and
 * differ only in their columns.
 */

type SettingsPanelProps = {
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
  // Writes are admin-only on the backend; a staff member holding the settings
  // area reads the list without the controls that would 403.
  canWrite: boolean;
  isLoading: boolean;
  error?: string | null;
  // Shown in place of the list when nothing is registered yet. This is the
  // first-run state of a fresh database, so it is the screen that tells an admin
  // what to do rather than an empty table.
  emptyTitle: string;
  emptyBody: string;
  isEmpty: boolean;
  children: ReactNode;
};

export function SettingsPanel({
  title,
  description,
  addLabel,
  onAdd,
  canWrite,
  isLoading,
  error,
  emptyTitle,
  emptyBody,
  isEmpty,
  children,
}: SettingsPanelProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-body-lg font-semibold text-text">{title}</h2>
          <p className="text-body text-text-secondary lg:max-w-[40rem]">
            {description}
          </p>
        </div>

        {canWrite && (
          <AddButton label={addLabel} onClick={onAdd} className="hidden lg:flex" />
        )}
      </div>

      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 w-full animate-pulse rounded-card bg-gray-200"
            />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="text-body-lg font-medium text-text">{emptyTitle}</p>
          <p className="max-w-[28.75rem] text-body text-text-secondary">{emptyBody}</p>
          {canWrite && <AddButton label={addLabel} onClick={onAdd} className="mt-1" />}
        </div>
      ) : (
        <>
          {children}

          {/* Below `lg` the header's button is hidden and this one takes over, so
              the action sits after the list it adds to rather than above the
              description on a narrow screen. */}
          {canWrite && (
            <AddButton label={addLabel} onClick={onAdd} className="lg:hidden" />
          )}
        </>
      )}
    </section>
  );
}

function AddButton({
  label,
  onClick,
  className = '',
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-input shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-body font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className || 'flex'}`}
    >
      <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  );
}

export function SettingsTh({ children }: { children?: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
      {children}
    </th>
  );
}

// The on/off state as a chip. "Off" rather than "Archived", because the row is
// still real — it is closed to new work, not retired from the records that use it.
export function ActiveChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium ${
        active
          ? 'bg-[var(--color-status-approved-bg)] text-success'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      {active ? 'On' : 'Off'}
    </span>
  );
}
