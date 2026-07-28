import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import {
  SocketEvent,
  setGuestToken,
  type SocketAvailability,
  type SocketMessage,
  type SocketTyping,
} from '@/services/socket';
import { readGuestToken } from './guest-session';
import {
  appendGuestMessage,
  failGuestMessage,
  guestThreadKey,
  useSendGuestMessage,
  type GuestMessage,
  type GuestThread,
} from './queries';

/*
 * Realtime for the anonymous visitor's chat.
 *
 * The visitor authenticates the socket with the same bearer token their REST
 * calls carry, handed to the client module before it connects — the token is
 * read at handshake time, so it has to be in place first.
 *
 * They never name a conversation. Every event the server accepts from them is
 * resolved against the thread their token owns, which is what stops any id being
 * a way into a stranger's chat.
 */

const TYPING_TIMEOUT_MS = 6_000;
const TYPING_THROTTLE_MS = 2_000;

function toMessage(payload: SocketMessage): GuestMessage {
  return {
    id: payload.id,
    author: payload.author === 'agent' ? 'agent' : 'guest',
    body: payload.body,
    sentAt: payload.sentAt,
    senderName: payload.author === 'agent' ? (payload.authorName ?? undefined) : undefined,
    clientId: payload.clientId,
  };
}

export function useGuestChatSocket(hasThread: boolean) {
  const queryClient = useQueryClient();
  const [tokenReady, setTokenReady] = useState(false);

  // The token has to reach the socket module before it connects — an established
  // connection cannot adopt one, because the handshake already happened.
  useEffect(() => {
    const token = readGuestToken();
    setGuestToken(token);
    setTokenReady(Boolean(token));
  }, [hasThread]);

  const { socket, connected } = useSocket(hasThread && tokenReady);
  const sendOverRest = useSendGuestMessage();

  const [agentTyping, setAgentTyping] = useState(false);
  const [agentsAvailable, setAgentsAvailable] = useState<number | null>(null);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useSocketEvent<SocketMessage>(socket, SocketEvent.MESSAGE, (payload) => {
    appendGuestMessage(queryClient, toMessage(payload));

    if (payload.author === 'agent') {
      setAgentTyping(false);
      socket?.emit(SocketEvent.READ, { conversationId: payload.conversationId });
    }
  });

  useSocketEvent<SocketTyping>(socket, SocketEvent.TYPING, (payload) => {
    if (payload.from === 'guest') return;

    setAgentTyping(payload.typing);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (payload.typing) {
      typingTimeout.current = setTimeout(() => setAgentTyping(false), TYPING_TIMEOUT_MS);
    }
  });

  useSocketEvent<SocketAvailability>(socket, SocketEvent.SUPPORT_AVAILABILITY, (payload) => {
    setAgentsAvailable(payload.agentsAvailable);
  });

  useEffect(
    () => () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    },
    [],
  );

  const notifyTyping = useCallback(
    (typing: boolean) => {
      if (!socket || !connected) return;

      const now = Date.now();
      if (typing && now - lastTypingSent.current < TYPING_THROTTLE_MS) return;

      lastTypingSent.current = typing ? now : 0;
      // No conversation id: the server takes it from the token.
      socket.emit(SocketEvent.TYPING, { typing });
    },
    [socket, connected],
  );

  const send = useCallback(
    (body: string) => {
      const clientId = crypto.randomUUID();

      const thread = queryClient.getQueryData<GuestThread | null>(guestThreadKey);
      if (!thread) return;

      appendGuestMessage(queryClient, {
        id: `pending-${clientId}`,
        clientId,
        author: 'guest',
        body,
        sentAt: new Date().toISOString(),
        pending: true,
      });

      notifyTyping(false);

      if (socket && connected) {
        socket.emit(SocketEvent.SEND, { body, clientId });
        return;
      }

      sendOverRest.mutate(body, {
        onError: () => failGuestMessage(queryClient, clientId),
      });
    },
    [socket, connected, queryClient, notifyTyping, sendOverRest],
  );

  return { send, notifyTyping, agentTyping, agentsAvailable, connected };
}
