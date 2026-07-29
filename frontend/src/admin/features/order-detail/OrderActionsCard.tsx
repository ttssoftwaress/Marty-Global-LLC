import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { ApiError } from '@/services/api';
import type {
  AdminOrderDetail,
  AdminOrderUpdate,
  OrderStatus,
} from '../../types/order-detail';
import { UNASSIGNED } from '../../types/order-detail';
import { ActionSelect, type ActionSelectOption } from './ActionSelect';
import { SectionCard } from './SectionCard';
import { useUpdateAdminOrder } from './queries';

/*
 * Take action — the two controls that move an order: its status and who is
 * working it.
 *
 * Both are drafted locally and committed together with one Save, so a reviewer
 * who advances an order and hands it on does it in a single write with a single
 * audit trail, rather than the order flickering through an intermediate state.
 * Nothing is sent until Save; the button is inert until something actually
 * differs from the record.
 *
 * The pipeline is not reimplemented here. `statusOptions` arrives with the
 * record already marked for this actor — a staff member sees the next step or
 * two, an admin sees everything — and an unreachable status renders dimmed
 * rather than hidden, so the flow stays legible. The backend still rejects a
 * disallowed move with a 422, and that message is what the error line prints:
 * this card makes the rule visible, it does not enforce it.
 */

type OrderActionsCardProps = {
  order: AdminOrderDetail;
};

function statusSelectOptions(order: AdminOrderDetail): ActionSelectOption[] {
  return order.statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    hint: option.current
      ? 'Current status'
      : // The one block worth naming in the list itself: every other dimmed row is
        // out of reach because of where the order stands, which the pipeline order
        // already shows. "Needs a quote" is about something the reviewer can go and
        // do right now.
        option.blockedReason === 'quote_required'
        ? 'Needs a quote'
        : undefined,
    // The current status stays selectable so the control can be put back after a
    // stray pick; everything the pipeline does not offer is out of reach.
    disabled: !option.allowed && !option.current,
  }));
}

function assigneeSelectOptions(order: AdminOrderDetail): ActionSelectOption[] {
  return [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...order.assigneeOptions.map((option) => ({
      value: option.value,
      label: option.label,
      hint: option.roleLabel,
    })),
  ];
}

export function OrderActionsCard({ order }: OrderActionsCardProps) {
  const currentAssignee = order.assignee?.id ?? UNASSIGNED;

  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [assigneeId, setAssigneeId] = useState<string>(currentAssignee);

  /*
   * Whether the last save landed, tracked here rather than read off
   * `isSuccess && !dirty`. That pair was a statement about the refetch, not about
   * the write: between the mutation resolving and the invalidated query coming
   * back, the draft still differs from the stale record, so `dirty` is briefly
   * true — the confirmation would be withheld at exactly the moment it is owed,
   * and the Save button would go live again over a change already committed. A
   * slow or failed refetch stretches that window out.
   */
  const [saved, setSaved] = useState(false);

  const update = useUpdateAdminOrder(order.id);

  // The record is the source of truth: once a save lands (or the query refetches
  // for any other reason) the draft snaps back to what the server holds, so the
  // controls can never sit on a value the order does not have.
  useEffect(() => {
    setStatus(order.status);
    setAssigneeId(currentAssignee);
  }, [order.status, currentAssignee]);

  const statusChanged = status !== order.status;
  const assigneeChanged = assigneeId !== currentAssignee;
  const dirty = statusChanged || assigneeChanged;

  const noStepsLeft = order.statusOptions.every((option) => !option.allowed);

  /*
   * Approving is blocked because nothing has been priced yet. Worth saying out
   * loud rather than leaving as a dimmed row: the reviewer's next action is the
   * quote composer further down this same screen, and sending it approves the
   * order in the same step — so this is a signpost, not a dead end.
   */
  const needsQuote = order.statusOptions.some(
    (option) => option.blockedReason === 'quote_required' && !option.current,
  );

  const onSave = () => {
    if (!dirty || update.isPending) return;

    const input: AdminOrderUpdate = {
      ...(statusChanged ? { status } : {}),
      ...(assigneeChanged
        ? { assigneeId: assigneeId === UNASSIGNED ? null : assigneeId }
        : {}),
    };

    setSaved(false);
    update.mutate(input, { onSuccess: () => setSaved(true) });
  };

  // Editing again withdraws the confirmation: it belongs to what was saved, not
  // to the draft now sitting in the controls.
  const onStatusChange = (value: string) => {
    setSaved(false);
    setStatus(value as OrderStatus);
  };

  const onAssigneeChange = (value: string) => {
    setSaved(false);
    setAssigneeId(value);
  };

  /*
   * A 403 here is not the quote card's 403. Quoting is a whole area (`payments`)
   * a member either holds or doesn't, so that card hides itself; status and
   * assignment are this card's whole purpose, so it stays and says why the save
   * didn't land. The backend's message names the endpoint, not the grant — the
   * wording below points at the same place the assign hint does, since asking an
   * administrator is the only thing the reviewer can do about it.
   */
  const permissionDenied =
    update.error instanceof ApiError && update.error.status === 403;

  const errorMessage = permissionDenied
    ? 'You do not have permission to make this change. An administrator can grant it from Team & staff.'
    : update.error instanceof ApiError
      ? update.error.message
      : update.error
        ? 'Could not update this order. Try again.'
        : null;

  return (
    <SectionCard title="Take action">
      <div className="flex flex-col gap-4">
        <ActionSelect
          label="Status"
          options={statusSelectOptions(order)}
          value={status}
          onChange={onStatusChange}
          disabled={update.isPending}
        />

        {/*
         * Handing the order on is a separate grant (`orders.assign`). A member
         * without it still works this order — status, replies, notes — so the
         * control is disabled and explained rather than removed, which would
         * read as "this order cannot be assigned" instead of "not by you".
         */}
        <ActionSelect
          label="Assigned to"
          options={assigneeSelectOptions(order)}
          value={assigneeId}
          onChange={onAssigneeChange}
          disabled={update.isPending || !order.canAssign}
        />

        {!order.canAssign ? (
          <p className="text-small text-gray-500">
            You do not have permission to reassign orders. An administrator can
            grant it from Team &amp; staff.
          </p>
        ) : null}
      </div>

      {needsQuote ? (
        <p className="text-small text-gray-500">
          This order can&apos;t be approved until it has been priced. Send the
          customer a quote below — that approves it in the same step.
        </p>
      ) : null}

      {noStepsLeft ? (
        <p className="text-small text-gray-500">
          This order has reached the end of the pipeline. An administrator can
          still move it if it was closed by mistake.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        // `saved` closes the same window the confirmation opens: the record has
        // not refetched yet, so the draft still reads dirty, and without this the
        // button would go live again over a change already committed.
        disabled={!dirty || update.isPending || saved}
        className="btn btn-primary h-11 w-full rounded-input text-body disabled:cursor-not-allowed disabled:opacity-50"
      >
        {update.isPending ? 'Saving…' : 'Save changes'}
      </button>

      {errorMessage ? (
        <p className="flex items-start gap-2 text-small text-error" role="alert">
          <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {errorMessage}
        </p>
      ) : null}

      {saved ? (
        <p className="flex items-center gap-2 text-small text-[var(--color-success)]">
          <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          Order updated.
        </p>
      ) : null}
    </SectionCard>
  );
}
