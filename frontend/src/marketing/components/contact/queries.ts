import { useMutation } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';

/*
 * The public `/contact` form. Uses the shared `services/api.ts` client, unlike
 * the guest chat: a signed-in visitor's submission is allowed to carry their
 * session (the backend's `optionalAuth` reads it for `userId`), and there is no
 * guest-token identity to keep separate from it here.
 */

export type ContactFormPayload = {
  name: string;
  email: string;
  message: string;
  turnstileToken?: string;
};

// POST /v1/contact — rate-limited and Turnstile-verified server-side.
export function useSubmitContactForm() {
  return useMutation({
    mutationFn: (payload: ContactFormPayload) =>
      apiFetch<ApiSuccess<{ id: string }>>('/contact', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((response) => response.data),
  });
}
