import { useQueryClient } from '@tanstack/react-query';

import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import { SocketEvent, type SocketConversationChanged } from '@/services/socket';
import { myConversationsKey } from './queries';

/*
 * Realtime for "My conversations".
 *
 * The list's counterpart to the support inbox's own socket hook, and it exists
 * for the same reason: the screen is a work queue, and a queue that only changes
 * when its reader reloads the page is a queue that quietly hides work. A customer
 * writing into an order thread would otherwise sit unanswered until the assignee
 * happened to refresh.
 *
 * It listens for the LIST event, not for messages. An order thread's messages are
 * broadcast to that conversation's room, and a staff member reading this screen
 * has joined no rooms — they are not in the thread, they are looking at a list of
 * threads. `conversation:updated` is the one signal that reaches them, delivered
 * to their own user room (and to the orders supervisor room for whoever reads the
 * whole queue).
 *
 * The event carries ids only (services/socket.ts), so the list is re-read through
 * the API, which applies the viewer's own scope. What arrives live is exactly what
 * a refresh would have shown — the socket is never a way to see a thread the
 * endpoint would withhold.
 *
 * Support threads emit the same event name and will invalidate this list too. The
 * payload cannot tell the two apart, and one extra refetch of a list the reader is
 * looking at is cheaper than putting the conversation's kind on a broadcast.
 */
export function useMyConversationsSocket(): void {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useSocketEvent<SocketConversationChanged>(socket, SocketEvent.CONVERSATION, () => {
    void queryClient.invalidateQueries({ queryKey: myConversationsKey });
  });
}
