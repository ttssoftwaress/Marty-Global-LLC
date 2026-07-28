import type { ConversationSummary, ConversationThread } from '../../types/messages';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { ThreadHeader } from './ThreadHeader';

/*
 * The detail pane: one conversation's header, its scrolling messages, and the
 * composer. It fills the screen on mobile and sits as a bordered card beside the
 * list from tablet up, with the messages scrolling internally so the header and
 * composer stay put.
 *
 * The header reads from the fetched `thread` when it is in, otherwise from the
 * `summary` already in the list — so switching conversations updates the title
 * instantly while the messages load.
 */

type MessageThreadProps = {
  thread: ConversationThread | undefined;
  summary: ConversationSummary | undefined;
  isLoading: boolean;
  onBack: () => void;
  onSend: (payload: { text: string; files: File[] }) => void;
  onTyping?: (typing: boolean) => void;
  // An agent is composing a reply right now.
  agentTyping?: boolean;
  // Uploading an attachment — the composer holds its send until it finishes.
  busy?: boolean;
  className?: string;
};

export function MessageThread({
  thread,
  summary,
  isLoading,
  onBack,
  onSend,
  onTyping,
  agentTyping = false,
  busy = false,
  className = '',
}: MessageThreadProps) {
  const head = thread ?? summary;

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-white md:rounded-card md:border md:border-gray-200 ${className}`}
    >
      <ThreadHeader
        subject={head?.subject ?? 'Conversation'}
        status={head?.status}
        orderId={head?.orderId}
        onBack={onBack}
      />
      <MessageList
        messages={thread?.messages ?? []}
        isLoading={isLoading}
        typing={agentTyping}
      />
      <Composer onSend={onSend} onTyping={onTyping} busy={busy} />
    </section>
  );
}
