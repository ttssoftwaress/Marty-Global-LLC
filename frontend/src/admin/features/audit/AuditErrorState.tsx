import { DataErrorState } from '../../components/DataErrorState';

/*
 * What the screen shows when the trail fails to load.
 *
 * The shape is the admin area's shared error state; only the copy is this
 * screen's. Worth being explicit here in particular: a failed load must never be
 * mistaken for "nothing has happened". That is the difference between a broken
 * page and a false all-clear, so the copy names the failure rather than
 * describing the trail.
 */

type AuditErrorStateProps = {
  onRetry: () => void;
  isRetrying: boolean;
};

export function AuditErrorState({ onRetry, isRetrying }: AuditErrorStateProps) {
  return (
    <DataErrorState
      title="Couldn't load the audit log"
      description="The entries didn't load, so this is not a record of nothing happening. Try again in a moment."
      onRetry={onRetry}
      isRetrying={isRetrying}
    />
  );
}
