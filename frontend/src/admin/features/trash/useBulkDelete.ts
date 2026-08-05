import { useCallback, useState } from 'react';

import { ApiError } from '@/services/api';
import { useAdminMe } from '@/admin/queries/admin-me';
import { useRowSelection, type RowSelection } from '../../hooks/useRowSelection';
import { useDeleteRows, useTrashSettings } from './queries';
import type { TrashEntityKey } from '../../types/trash';

/*
 * Everything a selectable admin list needs to offer a bulk delete, as one hook.
 *
 * Each list would otherwise repeat the same six pieces: the selection, the
 * confirm dialog's open state, the mutation, the error the backend refuses with,
 * clearing the ticks on success, and the permission check that decides whether
 * to offer the action at all. That is enough moving parts that two copies would
 * differ, and the way they would differ is in what happens after a refusal —
 * which is precisely the case that must not be papered over.
 *
 * A list wires it in three places: the header checkbox, the row checkbox, and
 * `<SelectionBar>` + `<ConfirmDeleteDialog>` above the table.
 *
 * THE PERMISSION CHECK IS COURTESY, NOT SECURITY. `data.delete` plus the
 * section's own area is enforced on the server (AGENTS.md, Auth). This only
 * decides whether to draw a control that would be refused — a delete button
 * nobody may press is worse than no button.
 */

export type BulkDelete = {
  selection: RowSelection;
  // Whether to render the tick column and the bar at all.
  canDelete: boolean;
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  confirm: () => void;
  isDeleting: boolean;
  // The backend's sentence, rendered beside the confirm button.
  error: string | null;
  // Null while the setting loads — the dialog softens its copy rather than
  // printing a window that might be wrong.
  retentionDays: number | null;
  // What the last successful delete did, for the caller's confirmation line.
  // Cleared when the dialog is next opened.
  lastResult: { deleted: number; cascaded: number } | null;
};

export function useBulkDelete(params: {
  entityType: TrashEntityKey;
  // The ids currently rendered, in order.
  visibleIds: string[];
  // Anything that invalidates a selection — the tab, the search, the filters.
  resetKey?: string;
}): BulkDelete {
  const me = useAdminMe();
  const selection = useRowSelection(params.visibleIds, params.resetKey);
  const deleteRows = useDeleteRows();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BulkDelete['lastResult']>(null);

  /*
   * Only fetched once the member can actually delete here. It is a one-line
   * settings read, but every admin list would otherwise issue it on mount to
   * fill in a sentence in a dialog most of them never open.
   */
  const canDelete = Boolean(me.data?.permissions.includes('data.delete'));
  const settings = useTrashSettings();

  const openDialog = useCallback(() => {
    setError(null);
    setLastResult(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const confirm = useCallback(() => {
    const ids = selection.selected;
    if (ids.length === 0) return;

    setError(null);

    deleteRows.mutate(
      { entityType: params.entityType, ids },
      {
        onSuccess: (result) => {
          setLastResult({ deleted: result.deleted, cascaded: result.cascaded });
          selection.clear();
          setDialogOpen(false);
        },
        /*
         * The dialog stays open, and the message is the backend's own — the
         * rules that refuse a delete ("this is the last active admin", "this
         * service is on 3 customer records") are known there and nowhere else,
         * so re-wording them here would only ever be a worse guess.
         */
        onError: (cause: unknown) => {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Something went wrong deleting these. Try again.',
          );
        },
      },
    );
  }, [deleteRows, params.entityType, selection]);

  return {
    selection,
    canDelete,
    isDialogOpen,
    openDialog,
    closeDialog,
    confirm,
    isDeleting: deleteRows.isPending,
    error,
    retentionDays: canDelete ? (settings.data?.retentionDays ?? null) : null,
    lastResult,
  };
}
