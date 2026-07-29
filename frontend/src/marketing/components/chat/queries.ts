import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import { clearGuestToken, readGuestToken, writeGuestToken } from './guest-session';

/*
 * The anonymous chat's data layer.
 *
 * It does NOT go through `services/api.ts`, which is the one place in the app
 * that deviates from the house rule — and deliberately. That client sends
 * `credentials: 'include'` on every call, and these endpoints are public: a
 * visitor who also happens to be signed in must not have their session cookie
 * attached to a request authorised by a bearer token, or the backend would be
 * looking at two identities at once and the guest guards would be meaningless.
 *
 * The token travels in a header instead, and never in a cookie, for the same
 * reason (guest.controller.ts).
 */

const API_URL = import.meta.env.VITE_API_URL as string;

export type GuestMessage = {
  id: string;
  author: 'guest' | 'agent';
  body: string;
  sentAt: string;
  senderName?: string;
  // Local-only: drawn before the server confirmed it.
  pending?: boolean;
  clientId?: string;
};

export type GuestThread = {
  conversationId: string;
  name: string;
  messages: GuestMessage[];
};

async function guestFetch<T>(
  path: string,
  init?: RequestInit & { token?: string | null },
): Promise<T> {
  const token = init?.token ?? readGuestToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      // Explicitly omitted — see the note above.
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Guest-Token': token } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'INTERNAL_ERROR', 'Could not reach the server.');
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      response.status,
      (error?.code as never) ?? 'INTERNAL_ERROR',
      error?.message ?? 'Request failed',
    );
  }

  return body as T;
}

export const guestThreadKey = ['guest-chat', 'thread'] as const;

/*
 * The visitor's existing conversation, if their token still resolves to one.
 *
 * A 401 here is the ordinary case rather than an error: it means the thread was
 * purged, the token is stale, or this is a first visit. All three mean the same
 * thing to the widget — show the start form — so the stale token is discarded
 * and the query resolves to null.
 */
export function useGuestThread(enabled: boolean) {
  return useQuery({
    queryKey: guestThreadKey,
    enabled: enabled && Boolean(readGuestToken()),
    retry: false,
    queryFn: async () => {
      try {
        const response = await guestFetch<ApiSuccess<GuestThread>>('/guest-chat/thread');
        return response.data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearGuestToken();
          return null;
        }
        throw error;
      }
    },
  });
}

export type StartGuestChatPayload = {
  name: string;
  email: string;
  body: string;
  turnstileToken?: string;
};

// POST /v1/guest-chat/sessions — mints the visitor's token and opens their
// thread. The token comes back exactly once and is stored immediately.
export function useStartGuestChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StartGuestChatPayload) =>
      guestFetch<ApiSuccess<{ token: string; thread: GuestThread }>>(
        '/guest-chat/sessions',
        { method: 'POST', body: JSON.stringify(payload), token: null },
      ).then((response) => response.data),
    onSuccess: (result) => {
      writeGuestToken(result.token);
      queryClient.setQueryData(guestThreadKey, result.thread);
    },
  });
}

// POST /v1/guest-chat/messages — the REST fallback for a send when the socket is
// down. Which conversation is never sent: the server derives it from the token.
export function useSendGuestMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) =>
      guestFetch<ApiSuccess<GuestMessage>>('/guest-chat/messages', {
        method: 'POST',
        body: JSON.stringify({ body }),
      }).then((response) => response.data),
    onSuccess: (message) => appendGuestMessage(queryClient, message),
  });
}

type QueryClient = ReturnType<typeof useQueryClient>;

// Collapse the optimistic bubble, the send's response, and the socket echo of
// one message into a single row.
export function appendGuestMessage(
  queryClient: QueryClient,
  message: GuestMessage,
): void {
  queryClient.setQueryData<GuestThread | null>(guestThreadKey, (thread) => {
    if (!thread) return thread;

    const existing = thread.messages.findIndex(
      (entry) =>
        entry.id === message.id ||
        (message.clientId !== undefined && entry.clientId === message.clientId),
    );

    if (existing >= 0) {
      const messages = [...thread.messages];
      messages[existing] = { ...messages[existing], ...message, pending: false };
      return { ...thread, messages };
    }

    return { ...thread, messages: [...thread.messages, message] };
  });
}

export function failGuestMessage(queryClient: QueryClient, clientId: string): void {
  queryClient.setQueryData<GuestThread | null>(guestThreadKey, (thread) =>
    thread
      ? { ...thread, messages: thread.messages.filter((m) => m.clientId !== clientId) }
      : thread,
  );
}
