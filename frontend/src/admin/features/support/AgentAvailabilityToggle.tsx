/*
 * The agent's own Online / Away switch.
 *
 * It is not a report of whether they are connected — the socket already knows
 * that. It is a statement of intent, and it is the thing that decides whether a
 * customer writing in triggers the offline email handoff: only agents who are
 * both connected AND online count toward "someone is here".
 *
 * That distinction is what makes the control worth having. An agent with the
 * inbox open in a background tab while they work a filing is connected and not
 * available, and a customer told "our team is online" in that situation is being
 * misled by the software.
 */

type AgentAvailabilityToggleProps = {
  available: boolean;
  onChange: (available: boolean) => void;
  // The socket is down: the switch still reflects the agent's choice, but they
  // are not reachable either way, so it says so rather than claiming otherwise.
  connected: boolean;
};

export function AgentAvailabilityToggle({
  available,
  onChange,
  connected,
}: AgentAvailabilityToggleProps) {
  const online = available && connected;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={available}
      onClick={() => onChange(!available)}
      title={
        connected
          ? available
            ? 'You are taking live chats'
            : 'You are away — new chats will email the customer instead'
          : 'Reconnecting…'
      }
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-pill border px-3 text-small font-semibold transition-colors ${
        online
          ? 'border-[rgba(16,185,129,0.3)] bg-[#ecfdf5] text-[#047857] hover:bg-[#d1fae5]'
          : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${
          online ? 'bg-success' : 'bg-gray-400'
        }`}
        aria-hidden="true"
      />
      {!connected ? 'Reconnecting' : available ? 'Online' : 'Away'}
    </button>
  );
}
