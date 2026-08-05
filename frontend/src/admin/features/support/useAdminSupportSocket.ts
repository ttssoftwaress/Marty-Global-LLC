import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import {
  SocketEvent,
  type SocketConversationChanged,
  type SocketMessage,
  type SocketPresence,
  type SocketReadReceipt,
  type SocketTyping,
} from '@/services/socket';
import type { ComposerMode, SupportMessage } from '../../types/support';
import {
  adminSupportThreadKey,
  adminSupportUnattendedKey,
  appendAdminMessage,
  applyAdminReadReceipt,
  failAdminMessage,
  useAdminSupportUnattended,
  useSendAdminSupportMessage,
} from './queries';

/*
 * Realtime for the admin support inbox.
 *
 * The mirror of the portal's hook, with two differences that matter:
 *
 *   - Internal notes arrive here and never reach the customer. That is enforced
 *     on the server by which room the note is emitted to, not by a filter here —
 *     a client-side filter would put the note on the customer's machine and
 *     merely decline to draw it.
 *   - `mine` cannot come off the wire. The same reply is the author's own
 *     message on one desk and a colleague's on another, so it is resolved
 *     against the signed-in agent's id when the message lands.
 */

const TYPING_TIMEOUT_MS = 6_000;
const TYPING_THROTTLE_MS = 2_000;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function useAdminSupportSocket(conversationId: string, currentUserId?: string) {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const sendOverRest = useSendAdminSupportMessage(conversationId);

  const [customerTyping, setCustomerTyping] = useState(false);
  const [customerOnline, setCustomerOnline] = useState(false);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  /*
   * Typing and presence belong to the conversation, not to the desk. This hook
   * lives on the page, which stays mounted while the agent clicks from one
   * thread to the next, so the previous customer's dots have to be dropped as
   * the id changes. Done during render rather than in an effect: the thread pane
   * remounts on the same render, and an effect would clear them one frame after
   * it had already drawn "…is typing" for a customer who never touched it.
   */
  const [presenceOf, setPresenceOf] = useState(conversationId);
  if (presenceOf !== conversationId) {
    setPresenceOf(conversationId);
    setCustomerTyping(false);
    setCustomerOnline(false);
  }

  const toMessage = useCallback(
    (payload: SocketMessage): SupportMessage => ({
      id: payload.id,
      kind:
        payload.author === 'customer'
          ? 'customer'
          : payload.author === 'internal_note'
            ? 'internal_note'
            : 'staff',
      // Resolved per-viewer: the author id decides, not which "side" it came
      // from. A second agent on the thread sees the first agent's replies as
      // someone else's, which is what keeps the thread honest.
      mine: Boolean(currentUserId) && payload.authorUserId === currentUserId,
      authorName: payload.authorName ?? 'Marty Global team',
      authorInitials: initialsOf(payload.authorName ?? 'Marty Global team'),
      body: payload.body,
      sentAt: payload.sentAt,
      clientId: payload.clientId,
      seen: payload.author === 'agent' ? false : undefined,
      // Presigned by the server on the broadcast, so a file the customer sends
      // mid-conversation is openable the moment it lands rather than after a
      // reload.
      attachments: payload.attachments,
    }),
    [currentUserId],
  );

  useEffect(() => {
    if (!socket || !conversationId || !connected) return;

    socket.emit(SocketEvent.JOIN, { conversationId });
    socket.emit(SocketEvent.READ, { conversationId });

    return () => {
      socket.emit(SocketEvent.LEAVE, { conversationId });
    };
  }, [socket, conversationId, connected]);

  useSocketEvent<SocketMessage>(socket, SocketEvent.MESSAGE, (payload) => {
    if (payload.conversationId !== conversationId) return;

    appendAdminMessage(queryClient, conversationId, toMessage(payload));

    if (payload.author === 'customer') {
      setCustomerTyping(false);
      // An open thread is a read one — this is what draws the customer's
      // second tick.
      socket?.emit(SocketEvent.READ, { conversationId });
    }

    void queryClient.invalidateQueries({
      queryKey: ['admin', 'support', 'conversations'],
    });
  });

  useSocketEvent<SocketReadReceipt>(socket, SocketEvent.READ, (payload) => {
    if (payload.conversationId !== conversationId || payload.by !== 'customer') return;
    applyAdminReadReceipt(queryClient, conversationId, payload.readAt);
  });

  useSocketEvent<SocketTyping>(socket, SocketEvent.TYPING, (payload) => {
    // Only the far side draws dots here. A colleague typing into the same thread
    // is a different signal and is not one the design shows.
    if (payload.conversationId !== conversationId || payload.from === 'staff') return;

    setCustomerTyping(payload.typing);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (payload.typing) {
      typingTimeout.current = setTimeout(() => setCustomerTyping(false), TYPING_TIMEOUT_MS);
    }
  });

  useSocketEvent<SocketPresence>(socket, SocketEvent.PRESENCE, (payload) => {
    if (payload.conversationId !== conversationId) return;
    setCustomerOnline(payload.customerOnline);
  });

  /*
   * Typing and presence are told to us by the server and only by the server, so
   * a dropped socket does not mean "still online" — it means we have stopped
   * being told. Held state would otherwise freeze on whatever the last event
   * said and sit there through the whole outage.
   */
  useEffect(() => {
    if (connected) return;
    setCustomerTyping(false);
    setCustomerOnline(false);
    lastTypingSent.current = 0;
  }, [connected]);

  // Keyed on the conversation, not on mount: a timer scheduled for the thread
  // the agent just left has no business firing against the one they opened.
  // The throttle stamp goes with it, so the first keystroke in the new thread
  // emits instead of falling inside the window opened by the previous one.
  useEffect(
    () => () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = null;
      }
      lastTypingSent.current = 0;
    },
    [conversationId],
  );

  const notifyTyping = useCallback(
    (typing: boolean) => {
      if (!socket || !connected) return;

      const now = Date.now();
      if (typing && now - lastTypingSent.current < TYPING_THROTTLE_MS) return;

      lastTypingSent.current = typing ? now : 0;
      socket.emit(SocketEvent.TYPING, { conversationId, typing });
    },
    [socket, connected, conversationId],
  );

  const send = useCallback(
    (mode: ComposerMode, body: string) => {
      const clientId = crypto.randomUUID();

      appendAdminMessage(queryClient, conversationId, {
        id: `pending-${clientId}`,
        clientId,
        kind: mode === 'note' ? 'internal_note' : 'staff',
        mine: true,
        authorName: 'You',
        authorInitials: 'You',
        body,
        sentAt: new Date().toISOString(),
        pending: true,
        seen: mode === 'note' ? undefined : false,
      });

      notifyTyping(false);

      if (socket && connected) {
        socket.emit(SocketEvent.SEND, {
          conversationId,
          body,
          kind: mode,
          clientId,
        });
        return;
      }

      sendOverRest.mutate(
        { body, kind: mode },
        { onError: () => failAdminMessage(queryClient, conversationId, clientId) },
      );
    },
    [socket, connected, conversationId, queryClient, notifyTyping, sendOverRest],
  );

  return { send, notifyTyping, customerTyping, customerOnline, connected };
}

/*
 * The inbox's own realtime: conversations arriving, moving, and changing state.
 *
 * Separate from the thread hook above, and mounted whether or not a conversation
 * is open, because it answers a different question. The thread hook is about the
 * one conversation on screen; this is about the LIST — a chat the router has just
 * assigned to this agent is not a thread they have joined, so nothing in the
 * per-conversation rooms would ever tell them it exists. That is why new chats
 * used to need a page reload while messages did not.
 *
 * The event carries ids only (services/socket.ts). Everything the list renders is
 * re-read through the API, which applies the viewer's own scope — so what arrives
 * live is exactly what a refresh would have shown, and the socket is never a way
 * to see a conversation the endpoint would withhold.
 *
 * `activeConversationId` gets one extra step: a reassignment turns the previous
 * agent's socket out of the thread's rooms, so anyone still entitled to be there
 * re-joins here. The server re-checks access on that join — which is what makes
 * evicting first and asking later safe.
 */
export function useAdminSupportInboxSocket(activeConversationId?: string) {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();

  useSocketEvent<SocketConversationChanged>(
    socket,
    SocketEvent.CONVERSATION,
    (payload) => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'support', 'conversations'],
      });

      if (!activeConversationId || payload.conversationId !== activeConversationId) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: adminSupportThreadKey(activeConversationId),
      });

      if (connected) {
        socket?.emit(SocketEvent.JOIN, { conversationId: activeConversationId });
      }
    },
  );
}

/*
 * The Support-inbox badge in the admin sidebar: chats sitting in the queue that
 * nobody has been given yet.
 *
 * Mounted in the shell rather than on the inbox page, because the point of the
 * bubble is to be seen from the screens that are NOT the inbox — an admin working
 * the orders queue has no other way to learn a chat arrived with no agent to take
 * it.
 *
 * Fetch is the seed, the socket is the correction — the same shape as the bell's
 * counter (`hooks/useUnreadCounts.ts`). `conversation:updated` reaches the
 * supervisor room on every transition that moves this number: a chat created, a
 * chat assigned or handed on, a chat resolved. The event carries ids only, so the
 * count is re-read through the endpoint, which applies the viewer's own scope.
 *
 * Nothing here decrements locally. An assignment lands on every supervisor's
 * screen at once, and two of them subtracting from their own copy of the number
 * would drift apart within a minute — the server owns the figure, the event only
 * says "ask again".
 */
export function useAdminUnattendedSupport(enabled: boolean): number {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const query = useAdminSupportUnattended(enabled);

  useSocketEvent<SocketConversationChanged>(
    socket,
    SocketEvent.CONVERSATION,
    () => {
      if (!enabled) return;
      void queryClient.invalidateQueries({ queryKey: adminSupportUnattendedKey() });
    },
  );

  return query.data?.count ?? 0;
}

/*
 * The agent's own Online/Away switch.
 *
 * Kept apart from the thread hook because it is a property of the agent, not of
 * a conversation: it holds while they move between threads and while they have
 * none open at all. The server persists it — the switch has to survive a closed
 * laptop — and only ONLINE agents count toward "is anyone available", which is
 * what decides whether a customer's message triggers the offline email handoff.
 */
export function useAgentAvailability(initial = true) {
  const { socket, connected } = useSocket();
  const [available, setAvailable] = useState(initial);

  // Re-announced on every (re)connect: the server's presence map is in-memory
  // and forgets everything when the process restarts.
  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit(SocketEvent.AVAILABILITY, { available });
  }, [socket, connected, available]);

  return {
    available,
    setAvailable,
    toggle: () => setAvailable((value) => !value),
  };
}
