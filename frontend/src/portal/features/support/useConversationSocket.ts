import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import {
  SocketEvent,
  type SocketAvailability,
  type SocketMessage,
  type SocketPresence,
  type SocketReadReceipt,
  type SocketTyping,
} from '@/services/socket';
import type { Message } from '../../types/support';
import {
  appendMessage,
  appendOptimistic,
  applyReadReceipt,
  failMessage,
  useSendMessage,
  type SendMessagePayload,
} from './queries';

/*
 * Realtime for one support conversation.
 *
 * The socket delivers; REST is the fallback and the history. The customer's own
 * message is drawn immediately, sent over whichever transport is up, and
 * reconciled when the server's copy comes back — matched on the client id, so a
 * message is never rendered twice and never silently lost.
 *
 * Typing and presence are ephemeral: they live in this hook's state, never in
 * the query cache and never on the server (AGENTS.md, Live Chat).
 */

// How long an agent's "typing" indicator survives without a refresh. The stop
// event is the normal way it clears; this is what covers the agent closing the
// tab mid-sentence, which would otherwise leave the dots up forever.
const TYPING_TIMEOUT_MS = 6_000;

// A typing start is re-emitted at most this often while the customer keeps
// typing. Without it a fast typist emits one event per keystroke.
const TYPING_THROTTLE_MS = 2_000;

function toMessage(payload: SocketMessage): Message {
  return {
    id: payload.id,
    // An internal note never reaches this client — the server emits it to a room
    // the customer is not in — so anything that is not the customer's own is an
    // agent's reply.
    author: payload.author === 'customer' ? 'customer' : 'agent',
    body: payload.body,
    sentAt: payload.sentAt,
    senderName: payload.author === 'agent' ? (payload.authorName ?? undefined) : undefined,
    attachments: payload.attachments,
    clientId: payload.clientId,
    seen: payload.author === 'customer' ? false : undefined,
  };
}

export function useConversationSocket(conversationId: string) {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const sendOverRest = useSendMessage(conversationId);

  const [agentTyping, setAgentTyping] = useState(false);
  const [agentsAvailable, setAgentsAvailable] = useState<number | null>(null);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  /*
   * The dots belong to the conversation. Both callers keep one hook instance
   * across a switch — the page while the customer picks another thread, the
   * widget while it changes which chat is open — so an agent who was typing in
   * the thread being left would otherwise appear to be typing in the one being
   * opened. Reset during render, before the remounted thread draws it.
   */
  const [typingOf, setTypingOf] = useState(conversationId);
  if (typingOf !== conversationId) {
    setTypingOf(conversationId);
    setAgentTyping(false);
  }

  // Join on open, leave on close. Re-joined on every reconnect too: rooms live
  // on the server's connection, so a dropped socket loses its membership.
  useEffect(() => {
    if (!socket || !conversationId || !connected) return;

    socket.emit(SocketEvent.JOIN, { conversationId });
    // Opening a thread is reading it — this is what clears the unread dot and
    // draws the agent's "Seen".
    socket.emit(SocketEvent.READ, { conversationId });

    return () => {
      socket.emit(SocketEvent.LEAVE, { conversationId });
    };
  }, [socket, conversationId, connected]);

  useSocketEvent<SocketMessage>(socket, SocketEvent.MESSAGE, (payload) => {
    if (payload.conversationId !== conversationId) return;

    appendMessage(queryClient, conversationId, toMessage(payload));

    // An incoming reply is read the moment it lands on an open thread.
    if (payload.author !== 'customer') {
      setAgentTyping(false);
      socket?.emit(SocketEvent.READ, { conversationId });
    }

    void queryClient.invalidateQueries({ queryKey: ['support', 'conversations'] });
  });

  useSocketEvent<SocketReadReceipt>(socket, SocketEvent.READ, (payload) => {
    // Only the team's read draws a tick here; the customer's own is not news to
    // the customer.
    if (payload.conversationId !== conversationId || payload.by !== 'staff') return;
    applyReadReceipt(queryClient, conversationId, payload.readAt);
  });

  useSocketEvent<SocketTyping>(socket, SocketEvent.TYPING, (payload) => {
    if (payload.conversationId !== conversationId || payload.from === 'customer') return;

    setAgentTyping(payload.typing);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (payload.typing) {
      typingTimeout.current = setTimeout(() => setAgentTyping(false), TYPING_TIMEOUT_MS);
    }
  });

  useSocketEvent<SocketPresence>(socket, SocketEvent.PRESENCE, (payload) => {
    if (payload.conversationId !== conversationId) return;
    if (payload.agentsAvailable !== undefined) setAgentsAvailable(payload.agentsAvailable);
  });

  useSocketEvent<SocketAvailability>(socket, SocketEvent.SUPPORT_AVAILABILITY, (payload) => {
    setAgentsAvailable(payload.agentsAvailable);
  });

  /*
   * The dots are the server's to report, so a dropped socket does not mean the
   * agent is still typing — it means we have stopped being told. Without this
   * the indicator freezes mid-sentence and stays up for the whole outage, since
   * the stop event that would clear it can no longer arrive.
   */
  useEffect(() => {
    if (connected) return;
    setAgentTyping(false);
    lastTypingSent.current = 0;
  }, [connected]);

  // Keyed on the conversation, not on mount: a timer scheduled for the thread
  // just left has no business firing against the one now open. The throttle
  // stamp goes with it, so the first keystroke in the new thread emits instead
  // of falling inside the window opened by the previous one.
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
      // A stop is always sent; a start is throttled.
      if (typing && now - lastTypingSent.current < TYPING_THROTTLE_MS) return;

      lastTypingSent.current = typing ? now : 0;
      socket.emit(SocketEvent.TYPING, { conversationId, typing });
    },
    [socket, connected, conversationId],
  );

  const send = useCallback(
    (payload: SendMessagePayload) => {
      const clientId = crypto.randomUUID();

      appendOptimistic(queryClient, conversationId, {
        clientId,
        body: payload.body,
      });

      // Stop the indicator the moment the message goes, rather than waiting for
      // the throttle window to lapse.
      notifyTyping(false);

      if (socket && connected) {
        socket.emit(SocketEvent.SEND, {
          conversationId,
          body: payload.body,
          attachments: payload.attachments,
          clientId,
        });
        return;
      }

      /*
       * No live connection — the same message over REST. The optimistic bubble
       * stays until this resolves, and is withdrawn if it fails, so the customer
       * is never left believing something was sent that was not.
       */
      sendOverRest.mutate(payload, {
        onError: () => failMessage(queryClient, conversationId, clientId),
      });
    },
    [socket, connected, conversationId, queryClient, notifyTyping, sendOverRest],
  );

  return { send, notifyTyping, agentTyping, agentsAvailable, connected };
}
