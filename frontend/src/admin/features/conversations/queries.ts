import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { StaffConversationsView } from '../../types/conversations';

/*
 * "My conversations" — the order threads this staff member is responsible for.
 *
 * Scoped to the session on the backend, never by an id this sends, so there is no
 * parameter here to get wrong: a staff member cannot ask for another's threads.
 */

export const myConversationsKey = ['admin', 'conversations', 'mine'] as const;

// GET /v1/admin/conversations
export function useMyConversations() {
  return useQuery({
    queryKey: myConversationsKey,
    queryFn: () =>
      apiFetch<ApiSuccess<StaffConversationsView>>('/admin/conversations').then(
        (res) => res.data,
      ),
  });
}
