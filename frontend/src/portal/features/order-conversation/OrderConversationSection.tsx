import { ConversationCard } from './ConversationCard';
import { useOrderConversation } from './queries';

/*
 * The order conversation as the detail page mounts it: owns its own query, so
 * the page passes an id and nothing else and the thread's loading state never
 * blocks the rest of the order from rendering.
 *
 * A failed load renders nothing rather than an error card. The conversation is a
 * secondary panel on a page whose primary content has already loaded — an error
 * block here would be louder than the thing it is reporting.
 */

type OrderConversationSectionProps = {
  orderId: string;
};

function ConversationSkeleton() {
  return (
    <div
      className="h-[17.5rem] w-full animate-pulse rounded-card bg-gray-200"
      aria-hidden="true"
    />
  );
}

export function OrderConversationSection({ orderId }: OrderConversationSectionProps) {
  const { data, isLoading } = useOrderConversation(orderId);

  if (isLoading) return <ConversationSkeleton />;
  if (!data) return null;

  return <ConversationCard conversation={data} />;
}
