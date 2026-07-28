import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, UserPlus } from 'lucide-react';

import type { SupportAgent } from '../../types/support';
import { SupportAgentAvatar } from './SupportAgentAvatar';

/*
 * The assignee capsule — who owns this conversation, and the menu that reassigns
 * it.
 *
 * The links vary the frame and the name: desktop draws an outlined capsule with
 * the full name, tablet a smaller one with the short name, mobile a filled gray
 * pill with the full name. All three are reproduced; the name follows the width
 * because that is what fits, not a copy difference.
 *
 * An unassigned conversation is a state the design did not draw for this control
 * — it shows "Unassign" as an affordance, so the capsule reads "Unassigned" with
 * a person-plus glyph in place of the avatar, keeping the control in the same
 * spot rather than disappearing.
 *
 * The staff list comes with the thread, so the menu opens without a round trip
 * and never offers someone who may not take the conversation.
 *
 * Without `canAssign` the same capsule renders as a plain label. Chats are routed
 * automatically and evenly across the team, so moving one is a supervisor's call
 * (`support.assign`) — and the control is shown-and-inert rather than removed,
 * which would read as "this chat has no owner" instead of "not yours to move".
 * The endpoint refuses it either way; this only keeps the screen honest about it.
 */

type SupportAssigneeMenuProps = {
  assignee: SupportAgent | null;
  agents: SupportAgent[];
  canAssign: boolean;
  onChange: (agentId: string | null) => void;
};

export function SupportAssigneeMenu({
  assignee,
  agents,
  canAssign,
  onChange,
}: SupportAssigneeMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Escape returns focus to the capsule rather than stranding it on the
    // list that is about to unmount.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // One frame for both variants, so the capsule sits in exactly the same place
  // whether or not this member may open it.
  const capsule =
    'flex h-10 max-w-[12.5rem] items-center gap-2 rounded-pill bg-gray-100 px-3 md:h-auto md:max-w-[9.375rem] md:gap-1.5 md:rounded-md md:border md:border-gray-200 md:bg-white md:px-2 md:py-1 lg:h-10 lg:max-w-[13.75rem] lg:gap-2 lg:rounded-input lg:px-3 lg:py-2';

  const identity = (
    <>
      {assignee ? (
        <SupportAgentAvatar
          id={assignee.id}
          initials={assignee.initials}
          className="size-5 text-[0.5625rem] md:size-[1.125rem] md:text-[0.5rem] lg:size-6 lg:text-[0.625rem]"
        />
      ) : (
        <UserPlus
          className="size-4 shrink-0 text-gray-400 md:size-3.5 lg:size-4"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}

      {/* Tablet prints the short name; the other two links print it in full. */}
      <span className="truncate text-[0.8125rem] font-medium text-gray-700 md:hidden lg:inline lg:text-[0.8125rem] lg:text-gray-600">
        {assignee ? assignee.name : 'Unassigned'}
      </span>
      <span className="hidden truncate text-caption font-medium text-gray-700 md:inline lg:hidden">
        {assignee ? assignee.shortName : 'Unassigned'}
      </span>
    </>
  );

  if (!canAssign) {
    return (
      <span
        className={`${capsule} shrink-0`}
        title={
          assignee
            ? `Assigned to ${assignee.name}. Only a supervisor can reassign a chat.`
            : 'Not yet assigned. Only a supervisor can assign a chat.'
        }
      >
        {identity}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={
          assignee ? `Assigned to ${assignee.name}. Reassign` : 'Assign this conversation'
        }
        className={`${capsule} transition-colors hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hover:bg-gray-50`}
      >
        {identity}

        <ChevronDown
          className="size-3.5 shrink-0 text-gray-500 md:size-2.5 lg:size-3.5"
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Assign conversation"
          className="absolute left-0 top-[calc(100%+6px)] z-20 max-h-64 w-56 overflow-y-auto rounded-input border border-gray-200 bg-white py-1 shadow-md-elevation"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={assignee === null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-small text-gray-700 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <UserPlus className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
                Unassigned
              </span>
              {assignee === null ? (
                <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
              ) : null}
            </button>
          </li>

          {agents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                role="option"
                aria-selected={agent.id === assignee?.id}
                onClick={() => {
                  onChange(agent.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-small text-gray-700 transition-colors hover:bg-gray-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <SupportAgentAvatar
                    id={agent.id}
                    initials={agent.initials}
                    className="size-5 text-[0.5625rem]"
                  />
                  <span className="truncate">{agent.name}</span>
                </span>
                {agent.id === assignee?.id ? (
                  <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
