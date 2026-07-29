import { ArrowLeft, Building2, Search } from 'lucide-react';

import { MailOpsCustomerAvatar } from './MailOpsCustomerAvatar';
import type { MailOpsRoom, MailOpsRoomName } from '../../types/mailroom';

/*
 * "Find mail room" — the card that picks which inbox the scan is filed into.
 *
 * The room is the target, not the customer. A customer may hold several rooms —
 * a Delaware address and a Wyoming one — and an envelope arrives at exactly one
 * of them, so picking the customer and letting the backend guess the room filed
 * post into whichever room happened to be created last.
 *
 * The pick is two steps, because a room name is not unique: "Main Office"
 * belongs to as many customers as chose it, and two of one customer's rooms can
 * share a name too.
 *
 *   1. name    — search, and choose among the matching room names
 *   2. address — every active room carrying that name, with its customer, so the
 *                operator picks the address printed on the envelope in their hand
 *
 * Step two is not skipped when a name resolves to a single room. The address is
 * the thing that makes the choice unambiguous, and auto-advancing past it would
 * hide the one fact the operator is here to confirm — a room count of 1 today
 * becomes 2 the moment another customer names a room the same thing.
 *
 * Both steps are server-side (AGENTS.md) — the page debounces the term into the
 * query and this card only renders what comes back, so the picker never filters
 * a client-side copy of the room table.
 *
 * The links only draw the settled state, so the search and address states are
 * filled in here (Design.md — filling in states the design skipped). The settled
 * row follows the desktop and tablet links: avatar, identity, and the change
 * control pushed right; mobile has no room for that on one line, so the identity
 * sits in the field and the control drops beneath it.
 */

type MailOpsFindRoomProps = {
  selected: MailOpsRoom | null;
  // The name chosen in step one; null while still searching.
  selectedName: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  names: MailOpsRoomName[];
  isSearching: boolean;
  hasSearched: boolean;
  /*
   * Either step failing looks identical to "nothing found" — and "no mail room
   * matches that name" is the answer that makes an operator go looking for a
   * customer record that is in fact fine. Each step says which it is.
   */
  namesError?: boolean;
  onRetryNames?: () => void;
  onSelectName: (name: string) => void;
  // Step two's options — the rooms carrying `selectedName`.
  rooms: MailOpsRoom[];
  isLoadingRooms: boolean;
  roomsError?: boolean;
  onRetryRooms?: () => void;
  onSelectRoom: (room: MailOpsRoom) => void;
  // Back to step one from step two, and back to step one from the settled row.
  onBackToNames: () => void;
  onClear: () => void;
};

/*
 * A failed step, reported in the same one-line slot the card's "Searching…" and
 * "nothing found" copy uses — there is no room in this card for the page-level
 * alert, and the retry rule 4 asks for is the button beside the sentence.
 */
function StepError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 text-small text-error">
      {message}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm font-semibold text-primary underline transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Try again
        </button>
      ) : null}
    </p>
  );
}

export function MailOpsFindRoom({
  selected,
  selectedName,
  search,
  onSearchChange,
  names,
  isSearching,
  hasSearched,
  namesError,
  onRetryNames,
  onSelectName,
  rooms,
  isLoadingRooms,
  roomsError,
  onRetryRooms,
  onSelectRoom,
  onBackToNames,
  onClear,
}: MailOpsFindRoomProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation lg:p-card">
      <h2 className="text-h6 text-text">Find mail room</h2>

      {selected ? (
        /*
         * Settled. Below `md` the change control moves to its own line beneath
         * the row, matching the mobile link.
         */
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-3 md:rounded-input md:bg-primary-light md:p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-input border border-gray-300 bg-gray-50 px-4 py-3 md:border-0 md:bg-transparent md:p-0">
            <MailOpsCustomerAvatar
              id={selected.customer.id}
              initials={selected.customer.initials}
              className="hidden size-8 md:flex"
            />
            {/*
             * All three facts stay on screen: the name alone does not say whose
             * room it is, and neither name nor customer says which address the
             * mail is going to.
             */}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-medium text-text">
                {selected.customer.name} — {selected.name}
              </span>
              <span className="truncate text-small text-gray-400">
                {selected.address}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="self-start rounded-sm text-body font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:shrink-0 md:self-auto md:text-small"
          >
            Change mail room
          </button>
        </div>
      ) : selectedName ? (
        <>
          {/* Step two — the addresses under the chosen name. */}
          <div className="flex w-full items-center gap-2">
            <button
              type="button"
              onClick={onBackToNames}
              aria-label="Back to mail room search"
              className="flex size-8 shrink-0 items-center justify-center rounded-control text-gray-400 transition-colors hover:bg-gray-50 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ArrowLeft className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <p className="min-w-0 flex-1 truncate text-body font-medium text-text">
              {selectedName}
            </p>
          </div>

          <p className="text-small text-gray-400">
            Select the address this mail was received at.
          </p>

          {isLoadingRooms ? (
            <p className="text-small text-gray-400">Loading addresses…</p>
          ) : roomsError ? (
            <StepError
              message="Those addresses could not be loaded."
              onRetry={onRetryRooms}
            />
          ) : rooms.length === 0 ? (
            <p className="text-small text-gray-400">
              No active mail rooms are named “{selectedName}” any more.
            </p>
          ) : (
            <ul className="flex w-full flex-col overflow-hidden rounded-input border border-gray-200">
              {rooms.map((room) => (
                <li key={room.id} className="border-b border-gray-200 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <MailOpsCustomerAvatar
                      id={room.customer.id}
                      initials={room.customer.initials}
                    />
                    {/*
                     * Address first at this step: it is what the operator is
                     * choosing between, and every row here shares a name.
                     */}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-medium text-text">
                        {room.address}
                      </span>
                      <span className="truncate text-small text-gray-400">
                        {room.customer.name}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {/* Step one — search the room names. */}
          <div className="flex h-input w-full items-center gap-2 rounded-input border border-gray-300 bg-gray-50 px-4 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)]">
            <Search
              className="size-[1.125rem] shrink-0 text-gray-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by mail room name..."
              aria-label="Search mail rooms by name"
              className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
            />
          </div>

          {/*
           * Results live under the field rather than in a floating popover, so
           * the card grows in the page flow instead of overlaying the form
           * beneath it — which matters most on mobile, where a popover would
           * cover the whole scan form.
           */}
          {isSearching ? <p className="text-small text-gray-400">Searching…</p> : null}

          {!isSearching && namesError ? (
            <StepError
              message="Mail room search is unavailable right now."
              onRetry={onRetryNames}
            />
          ) : null}

          {!isSearching && !namesError && hasSearched && names.length === 0 ? (
            <p className="text-small text-gray-400">
              No active mail rooms match that name.
            </p>
          ) : null}

          {names.length > 0 ? (
            <ul className="flex w-full flex-col overflow-hidden rounded-input border border-gray-200">
              {names.map((entry) => (
                <li key={entry.name} className="border-b border-gray-200 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelectName(entry.name)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                      <Building2 className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body font-medium text-text">
                      {entry.name}
                    </span>
                    {/*
                     * The count is the warning that this name is shared, so the
                     * operator expects a second choice rather than a submit.
                     */}
                    <span className="shrink-0 text-small text-gray-400">
                      {entry.rooms === 1 ? '1 address' : `${entry.rooms} addresses`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
