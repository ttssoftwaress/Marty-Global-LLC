import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Better Auth client — points at the backend auth handler (VITE_AUTH_URL is the
// API origin; Better Auth appends its own /api/auth base path). The admin plugin
// mirrors the server so roles are typed; inferAdditionalFields carries the custom
// `country` field onto signUp/user types. Backend is the source of truth — keep
// these plugins in sync with backend/src/config/auth.ts.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL as string,
  plugins: [
    adminClient(),
    inferAdditionalFields({
      user: {
        country: { type: 'string', required: false },
      },
    }),
  ],
});

export const { signUp, signIn, signOut, useSession } = authClient;
