import { useEffect, useRef, useState } from 'react';
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
 */

type SupportAssigneeMenuProps = {
  assignee: SupportAgent | null;
  agents: SupportAgent[];
  onChange: (agentId: string | null) => void;
};

export function SupportAssigneeMenu({
  assignee,
  agents,
  onChange,
}: SupportAssigneeMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          assignee ? `Assigned to ${assignee.name}. Reassign` : 'Assign this conversation'
        }
        className="flex h-10 max-w-[200px] items-center gap-2 rounded-pill bg-gray-100 px-3 transition-colors hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:h-auto md:max-w-[150px] md:gap-1.5 md:rounded-md md:border md:border-gray-200 md:bg-white md:px-2 md:py-1 md:hover:bg-gray-50 lg:h-10 lg:max-w-[220px] lg:gap-2 lg:rounded-input lg:px-3 lg:py-2"
      >
        {assignee ? (
          <SupportAgentAvatar
            id={assignee.id}
            initials={assignee.initials}
            className="size-5 text-[9px] md:size-[18px] md:text-[8px] lg:size-6 lg:text-[10px]"
          />
        ) : (
          <UserPlus
            className="size-4 shrink-0 text-gray-400 md:size-3.5 lg:size-4"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}

        {/* Tablet prints the short name; the other two links print it in full. */}
        <span className="truncate text-[13px] font-medium text-gray-700 md:hidden lg:inline lg:text-[13px] lg:text-gray-600">
          {assignee ? assignee.name : 'Unassigned'}
        </span>
        <span className="hidden truncate text-caption font-medium text-gray-700 md:inline lg:hidden">
          {assignee ? assignee.shortName : 'Unassigned'}
        </span>

        <ChevronDown
          className="size-3.5 shrink-0 text-gray-500 md:size-2.5 lg:size-3.5"
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
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
                    className="size-5 text-[9px]"
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
